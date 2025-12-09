/**
 * AI 智能推荐 API
 * GET /api/recommend/ai/[category]
 *
 * 基于用户历史和偏好，使用 AI 生成个性化推荐
 */

import { NextRequest, NextResponse } from "next/server";
import { generateRecommendations, isZhipuConfigured } from "@/lib/ai/zhipu-recommendation";
import { generateSearchLink, selectBestPlatform } from "@/lib/search/search-engine";
import { enhanceTravelRecommendation } from "@/lib/ai/travel-enhancer";
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
import { getLocale } from "@/lib/utils/locale";
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
    // 从请求参数获取locale，如果没有则使用环境变量配置
    const locale = (searchParams.get("locale") as "zh" | "en") || getLocale();
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
      const fallbackRecs = await generateFallbackRecommendations(category, locale, count);

      return NextResponse.json({
        success: true,
        recommendations: fallbackRecs,
        source: "fallback",
      } satisfies AIRecommendResponse);
    }

    // 使用新的 AI + 搜索引擎推荐系统
    try {
      console.log(`[AI] 用户历史记录数: ${userHistory?.length || 0}`);

      // 1. 使用智谱 AI 生成推荐内容（不含链接）
      const aiRecommendations = await generateRecommendations(userHistory || [], category, locale);
      console.log(`[AI] 生成推荐数: ${aiRecommendations.length}`);

      // 2. 为每个推荐生成搜索引擎链接
      const finalRecommendations = aiRecommendations.map(rec => {
        let enhancedRec = rec;

        // 特殊处理：旅游推荐使用增强器
        if (category === 'travel') {
          enhancedRec = enhanceTravelRecommendation(rec, locale);
        }

        // 选择最佳平台
        const platform = selectBestPlatform(category, enhancedRec.platform, locale);

        // 生成搜索链接
        const searchLink = generateSearchLink(enhancedRec.title, enhancedRec.searchQuery, platform, locale, category);

        const baseRecommendation = {
          title: enhancedRec.title,
          description: enhancedRec.description,
          reason: enhancedRec.reason,
          tags: enhancedRec.tags,
          link: searchLink.url,           // 搜索引擎链接
          platform: searchLink.displayName,
          linkType: category === 'travel' ? ('location' as const) : ('search' as const),    // 旅游推荐使用 location 图标
          category: category,             // 添加缺失的 category 属性
          metadata: {
            searchQuery: enhancedRec.searchQuery,
            originalPlatform: enhancedRec.platform,
            isSearchLink: true,          // 标记这是搜索链接
          }
        };

        // 为旅游推荐添加特殊元数据
        if (category === 'travel') {
          const travelEnhanced = enhancedRec as any;
          const metadata = baseRecommendation.metadata as any;
          if (travelEnhanced.destination) {
            metadata.destination = travelEnhanced.destination;
          }
          if (travelEnhanced.highlights) {
            metadata.highlights = travelEnhanced.highlights;
          }
          if (travelEnhanced.bestSeason) {
            metadata.bestSeason = travelEnhanced.bestSeason;
          }
          if (travelEnhanced.travelStyle) {
            metadata.travelStyle = travelEnhanced.travelStyle;
          }
        }

        return baseRecommendation;
      });

      console.log(`[Search] 生成搜索链接数: ${finalRecommendations.length}`);

      // 3. 保存到数据库
      if (isValidUserId(userId) && finalRecommendations.length > 0) {
        console.log(`[Save] Recording recommendation for user ${userId.slice(0, 8)}...`);
        saveRecommendationsToHistory(userId, finalRecommendations)
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

      // 4. 缓存推荐结果（用于登录用户）
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
        recommendations: finalRecommendations.slice(0, count),
        source: "ai",
      } satisfies AIRecommendResponse);
    } catch (aiError) {
      console.error("AI recommendation failed:", aiError);

      // AI 失败，使用降级数据
      const fallbackRecs = await generateFallbackRecommendations(category, locale, count);

      return NextResponse.json({
        success: true,
        recommendations: fallbackRecs,
        source: "fallback",
        error: "AI temporarily unavailable, showing curated recommendations",
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

/**
 * 生成降级推荐（使用预定义的搜索链接）
 */
async function generateFallbackRecommendations(
  category: string,
  locale: string,
  count: number
) {
  const fallbacks: Record<string, Record<string, any[]>> = {
    zh: {
      entertainment: [{
        title: '热门电影推荐',
        description: '最近上映的高分电影',
        reason: '根据大众喜好为你推荐',
        tags: ['电影', '热门', '高分'],
        searchQuery: '2024 热门电影 高分',
        platform: '豆瓣'
      }],
      shopping: [{
        title: '热销数码产品',
        description: '最受欢迎的数码好物',
        reason: '根据销量和评价为你推荐',
        tags: ['数码', '热销', '好评'],
        searchQuery: '热销数码产品 好评',
        platform: '京东'
      }],
      food: [{
        title: '特色美食餐厅',
        description: '附近高评分餐厅',
        reason: '根据评价为你推荐',
        tags: ['美食', '餐厅', '高评分'],
        searchQuery: '特色餐厅 高评分',
        platform: '大众点评'
      }],
      travel: [{
        title: '热门旅游景点',
        description: '值得一去的景点',
        reason: '根据热度为你推荐',
        tags: ['旅游', '景点', '热门'],
        searchQuery: '热门旅游景点',
        platform: '携程'
      }],
      fitness: [{
        title: '健身训练课程',
        description: '适合初学者的课程',
        reason: '根据难度为你推荐',
        tags: ['健身', '课程', '初学者'],
        searchQuery: '健身训练课程 初学者',
        platform: 'Keep'
      }]
    },
    en: {
      entertainment: [{
        title: 'Popular Movies',
        description: 'Latest high-rated movies',
        reason: 'Recommended based on popular preferences',
        tags: ['movies', 'popular', 'high-rated'],
        searchQuery: '2024 popular movies high rated',
        platform: 'IMDb'
      }],
      shopping: [{
        title: 'Trending Electronics',
        description: 'Most popular electronic gadgets',
        reason: 'Recommended based on sales and reviews',
        tags: ['electronics', 'trending', 'top-rated'],
        searchQuery: 'trending electronics best seller',
        platform: 'Amazon'
      }],
      food: [{
        title: 'Top-Rated Restaurants',
        description: 'Highly-rated restaurants nearby',
        reason: 'Recommended based on reviews',
        tags: ['food', 'restaurant', 'high-rated'],
        searchQuery: 'top-rated restaurants',
        platform: 'Google Maps'
      }],
      travel: [{
        title: 'Popular Attractions',
        description: 'Must-visit destinations',
        reason: 'Recommended based on popularity',
        tags: ['travel', 'attractions', 'popular'],
        searchQuery: 'popular tourist attractions',
        platform: 'TripAdvisor'
      }],
      fitness: [{
        title: 'Fitness Workout Classes',
        description: 'Beginner-friendly workout routines',
        reason: 'Recommended based on difficulty',
        tags: ['fitness', 'workout', 'beginner'],
        searchQuery: 'fitness workout for beginners',
        platform: 'YouTube'
      }]
    }
  };

  const baseRec = fallbacks[locale]?.[category]?.[0] || fallbacks.zh.entertainment[0];

  // 生成搜索链接
  const platform = selectBestPlatform(category, baseRec.platform, locale);
  const searchLink = generateSearchLink(baseRec.title, baseRec.searchQuery, platform, locale, category);

  return [{
    ...baseRec,
    link: searchLink.url,
    platform: searchLink.displayName,
    linkType: 'article' as const,  // 临时映射到 article 类型
    category: category as RecommendationCategory,
    metadata: {
      searchQuery: baseRec.searchQuery,
      originalPlatform: baseRec.platform,
      isSearchLink: true          // 标记这是搜索链接
    }
  }];
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
