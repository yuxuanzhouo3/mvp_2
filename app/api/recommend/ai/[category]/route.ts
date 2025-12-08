/**
 * AI 智能推荐 API
 * GET /api/recommend/ai/[category]
 *
 * 基于用户历史和偏好，使用 AI 生成个性化推荐
 */

import { type NextRequest, NextResponse } from "next/server";
import { getAIRecommendations, isZhipuConfigured } from "@/lib/ai/zhipu-client";
import { getFallbackRecommendations } from "@/lib/ai/fallback-data";
import {
  getUserRecommendationHistory,
  getUserCategoryPreference,
  saveRecommendationsToHistory,
  updateUserPreferences,
  getCachedRecommendations,
  cacheRecommendations,
  generatePreferenceHash,
} from "@/lib/services/recommendation-service";
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
    const count = Math.min(parseInt(searchParams.get("count") || "3"), 5);
    const locale = (searchParams.get("locale") as "zh" | "en") || "zh";
    const skipCache = searchParams.get("skipCache") === "true";

    // 获取用户偏好和历史
    let userHistory: Awaited<ReturnType<typeof getUserRecommendationHistory>> = [];
    let userPreference: Awaited<ReturnType<typeof getUserCategoryPreference>> = null;

    if (userId !== "anonymous") {
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
    const preferenceHash = generatePreferenceHash(userPreference);

    // 尝试从缓存获取
    if (!skipCache) {
      try {
        const cachedRecommendations = await getCachedRecommendations(category, preferenceHash);
        if (cachedRecommendations && cachedRecommendations.length > 0) {
          // 从缓存中随机选择
          const shuffled = [...cachedRecommendations].sort(() => Math.random() - 0.5);
          return NextResponse.json({
            success: true,
            recommendations: shuffled.slice(0, count),
            source: "cache",
          } satisfies AIRecommendResponse);
        }
      } catch (cacheError) {
        console.warn("Cache lookup failed:", cacheError);
      }
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

      if (validRecommendations.length === 0) {
        throw new Error("No valid recommendations from AI");
      }

      // 去重：与用户历史进行对比
      const historicalLinks = new Set(userHistory.map((h) => h.link));
      const uniqueRecommendations = validRecommendations.filter((rec) => {
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
      } else if (uniqueRecommendations.length < validRecommendations.length) {
        console.log(
          `[Dedup] Filtered ${validRecommendations.length - uniqueRecommendations.length} recommendation(s) already in user history`
        );
      }

      const finalRecommendations =
        uniqueRecommendations.length > 0 ? uniqueRecommendations : validRecommendations;

      // 异步保存到历史和缓存（不阻塞响应）
      if (userId !== "anonymous") {
        saveRecommendationsToHistory(userId, finalRecommendations).catch((err) =>
          console.error("Failed to save to history:", err)
        );

        updateUserPreferences(userId, category, { incrementView: true }).catch((err) =>
          console.error("Failed to update preferences:", err)
        );
      }

      // 缓存推荐结果
      cacheRecommendations(category, preferenceHash, finalRecommendations, 30).catch((err) =>
        console.error("Failed to cache recommendations:", err)
      );

      return NextResponse.json({
        success: true,
        recommendations: finalRecommendations,
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
    url.searchParams.set("count", String(Math.min(count, 5)));
    url.searchParams.set("locale", locale);
    url.searchParams.set("skipCache", String(skipCache));

    // 如果提供了用户标签，先更新偏好
    if (userTags.length > 0 && userId !== "anonymous") {
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
