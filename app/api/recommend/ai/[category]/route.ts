/**
 * AI 智能推荐 API
 * GET /api/recommend/ai/[category]
 *
 * 基于用户历史和偏好，使用 AI 生成个性化推荐
 */

import { NextRequest, NextResponse } from "next/server";
import { getAIRecommendations, isZhipuConfigured } from "@/lib/ai/zhipu-client";
import { getFallbackRecommendations } from "@/lib/ai/fallback-data";
import { validateLink } from "@/lib/ai/link-validator";
import {
  getUserRecommendationHistory,
  getUserCategoryPreference,
  saveRecommendationsToHistory,
  updateUserPreferences,
  getCachedRecommendations,
  cacheRecommendations,
  generatePreferenceHash,
} from "@/lib/services/recommendation-service";
import { isValidUserId } from "@/lib/utils";
import type { RecommendationCategory, AIRecommendResponse } from "@/lib/types/recommendation";

// 有效的分类列表
const VALID_CATEGORIES: RecommendationCategory[] = [
  "entertainment",
  "shopping",
  "food",
  "travel",
  "fitness",
];

export async function GET(
  request: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const category = params.category as RecommendationCategory;

    // 验证分类
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          recommendations: [],
          source: "fallback",
          error: "Invalid category",
        } satisfies AIRecommendResponse,
        { status: 400 }
      );
    }

    // 获取请求参数
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "anonymous";
    const count = Math.min(parseInt(searchParams.get("count") || "5"), 10);
    const locale = (searchParams.get("locale") as "zh" | "en") || "zh";
    const skipCache = searchParams.get("skipCache") === "true";

    // 获取用户偏好和历史（仅当 userId 是有效 UUID 时）
    let userHistory: Awaited<ReturnType<typeof getUserRecommendationHistory>> = [];
    let userPreference: Awaited<ReturnType<typeof getUserCategoryPreference>> = null;

    if (isValidUserId(userId)) {
      try {
        [userHistory, userPreference] = await Promise.all([
          getUserRecommendationHistory(userId, category, 20),
          getUserCategoryPreference(userId, category),
        ]);
      } catch (dbError) {
        console.warn("Database not available, using anonymous mode:", dbError);
      }
    }

    // 生成偏好哈希用于缓存
    // 对于匿名用户，禁用缓存以确保获得多样化的推荐
    const preferenceHash = generatePreferenceHash(userPreference);
    const isAnonymous = userId === "anonymous";

    // 尝试从缓存获取（仅用于登录用户）
    if (!skipCache && !isAnonymous) {
      try {
        const cachedRecommendations = await getCachedRecommendations(category, preferenceHash);
        if (cachedRecommendations && cachedRecommendations.length > 0) {
          // 从缓存中随机选择
          const shuffled = [...cachedRecommendations].sort(() => Math.random() - 0.5);
          console.log(`[Cache Hit] Using cached recommendations for ${category} with hash ${preferenceHash}`);
          return NextResponse.json({
            success: true,
            recommendations: shuffled.slice(0, count),
            source: "cache",
          } satisfies AIRecommendResponse);
        }
      } catch (cacheError) {
        console.warn("Cache lookup failed:", cacheError);
      }
    } else if (isAnonymous) {
      console.log(`[Anonymous User] Skipping cache for ${category} to provide diverse recommendations`);
    }

    // 检查 AI 是否配置
    if (!isZhipuConfigured()) {
      console.log("Zhipu API not configured, using fallback data");
      const fallbackRecs = getFallbackRecommendations(category, locale, count);

      return NextResponse.json({
        success: true,
        recommendations: fallbackRecs,
        source: "fallback",
      } satisfies AIRecommendResponse);
    }

    // 调用 AI 获取推荐
    try {
      const aiRecommendations = await getAIRecommendations(
        category,
        userHistory,
        userPreference,
        locale,
        count
      );

      // 验证推荐结果
      const validRecommendations = aiRecommendations.filter(
        (rec) => rec.title && rec.link && rec.link.startsWith("http")
      );

      // ✅ 额外验证：确保每条推荐都有有效的、可点击的链接
      const fullValidRecommendations = validRecommendations.filter((rec) => {
        // 使用新的链接验证器
        const linkValidation = validateLink(rec.link);

        if (!linkValidation.isValid) {
          console.warn(
            `[Link Validation] ❌ Recommendation "${rec.title}" rejected - ${linkValidation.error}`
          );
          return false;
        }

        console.log(`[Link Validation] ✅ Recommendation "${rec.title}" - Valid link: ${rec.link}`);
        return true;
      });

      if (fullValidRecommendations.length === 0) {
        throw new Error(`No valid external links from AI (received ${validRecommendations.length}, valid: 0)`);
      }

      if (fullValidRecommendations.length < validRecommendations.length) {
        console.warn(
          `[Link Validation] Filtered out ${validRecommendations.length - fullValidRecommendations.length} recommendations with invalid URLs`
        );
      }

      // 去重：与用户历史进行对比
      const historicalLinks = new Set(userHistory.map((h) => h.link));
      const uniqueRecommendations = fullValidRecommendations.filter((rec) => {
        if (historicalLinks.has(rec.link)) {
          console.warn(`[Dedup] Filtered recommendation already in user history: "${rec.title}"`);
          return false;
        }
        return true;
      });

      // 如果去重后数量太少，仍然返回（但记录警告）
      if (uniqueRecommendations.length === 0) {
        console.warn(
          "[Dedup] All recommendations are in user history, returning original recommendations"
        );
        // 返回原始推荐，但标记为可能重复
      } else if (uniqueRecommendations.length < fullValidRecommendations.length) {
        console.log(
          `[Dedup] Filtered ${fullValidRecommendations.length - uniqueRecommendations.length} recommendation(s) already in user history. Total valid: ${fullValidRecommendations.length} → ${uniqueRecommendations.length}`
        );
      }

      const finalRecommendations =
        uniqueRecommendations.length > 0 ? uniqueRecommendations : fullValidRecommendations;

      // 为匿名用户随机打乱推荐以提供多样化体验
      let recommendationsToReturn = finalRecommendations;
      if (isAnonymous && recommendationsToReturn.length > 1) {
        recommendationsToReturn = [...recommendationsToReturn].sort(() => Math.random() - 0.5);
        console.log(`[Anonymous] Shuffled ${recommendationsToReturn.length} recommendations for diversity`);
      }

      console.log(`[Return] Will return ${Math.min(recommendationsToReturn.length, count)} out of ${recommendationsToReturn.length} available recommendations (requested count: ${count})`);


      // 异步保存到历史和缓存（不阻塞响应）
      if (isValidUserId(userId)) {
        console.log(`[Save] Recording recommendation for user ${userId.slice(0, 8)}...`);
        saveRecommendationsToHistory(userId, recommendationsToReturn)
          .then((ids) => {
            console.log(`[Save] ✓ Successfully saved ${ids.length} recommendations to history`);
          })
          .catch((err) => {
            console.error(`[Save] ✗ Failed to save to history:`, err);
          });

        updateUserPreferences(userId, category, { incrementView: true })
          .then(() => {
            console.log(`[Preferences] ✓ Updated user preferences for ${category}`);
          })
          .catch((err) => {
            console.error(`[Preferences] ✗ Failed to update preferences:`, err);
          });
      } else {
        console.log(`[Save] Skipping history save for anonymous user`);
      }

      // 缓存推荐结果（用于登录用户）
      if (!isAnonymous) {
        cacheRecommendations(category, preferenceHash, finalRecommendations, 30)
          .then(() => {
            console.log(`[Cache] ✓ Cached ${finalRecommendations.length} recommendations for ${category}`);
          })
          .catch((err) => {
            console.error("[Cache] ✗ Failed to cache recommendations:", err);
          });
      }

      return NextResponse.json({
        success: true,
        recommendations: recommendationsToReturn.slice(0, count),
        source: "ai",
      } satisfies AIRecommendResponse);
    } catch (aiError) {
      console.error("AI recommendation failed:", aiError);

      // 检查是否是 API 配置或权限问题
      const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
      const isForbiddenError = errorMessage.includes("403") || errorMessage.includes("access denied");
      const isConfigError = errorMessage.includes("not configured") || errorMessage.includes("not properly");

      if (isForbiddenError || isConfigError) {
        console.error("Critical Zhipu API configuration issue detected", {
          isForbidden: isForbiddenError,
          isConfig: isConfigError,
          error: errorMessage,
        });
        // 返回错误，提示用户检查 API Key
        return NextResponse.json(
          {
            success: false,
            recommendations: [],
            source: "fallback",
            error: "Zhipu API configuration error. Please check your ZHIPU_API_KEY.",
          } satisfies AIRecommendResponse,
          { status: 503 }
        );
      }

      // AI 失败，使用降级数据
      const fallbackRecs = getFallbackRecommendations(category, locale, count);

      return NextResponse.json({
        success: true,
        recommendations: fallbackRecs,
        source: "fallback",
        error: "Zhipu API temporarily unavailable, showing curated recommendations",
      } satisfies AIRecommendResponse);
    }
  } catch (error) {
    console.error("API Error:", error);

    return NextResponse.json(
      {
        success: false,
        recommendations: [],
        source: "fallback",
        error: "Internal server error",
      } satisfies AIRecommendResponse,
      { status: 500 }
    );
  }
}

// 支持 POST 请求（带有更多参数）
export async function POST(
  request: NextRequest,
  { params }: { params: { category: string } }
) {
  try {
    const category = params.category as RecommendationCategory;

    // 验证分类
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        {
          success: false,
          recommendations: [],
          source: "fallback",
          error: "Invalid category",
        } satisfies AIRecommendResponse,
        { status: 400 }
      );
    }

    // 获取请求体
    const body = await request.json();
    const {
      userId = "anonymous",
      count = 3,
      locale = "zh",
      skipCache = false,
      userTags = [],
    } = body;

    // 构建 URL 并调用 GET 处理器
    const url = new URL(request.url);
    url.searchParams.set("userId", userId);
    url.searchParams.set("count", String(Math.min(count, 10)));
    url.searchParams.set("locale", locale);
    url.searchParams.set("skipCache", String(skipCache));

    // 如果提供了用户标签，先更新偏好
    if (userTags.length > 0 && isValidUserId(userId)) {
      try {
        await updateUserPreferences(userId, category, { tags: userTags });
      } catch (err) {
        console.warn("Failed to update user tags:", err);
      }
    }

    // 创建新的请���并调用 GET
    const newRequest = new NextRequest(url, {
      method: "GET",
      headers: request.headers,
    });

    return GET(newRequest, { params });
  } catch (error) {
    console.error("POST API Error:", error);

    return NextResponse.json(
      {
        success: false,
        recommendations: [],
        source: "fallback",
        error: "Invalid request body",
      } satisfies AIRecommendResponse,
      { status: 400 }
    );
  }
}
