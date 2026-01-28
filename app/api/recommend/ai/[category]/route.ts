/**
 * AI 智能推荐 API
 * GET /api/recommend/ai/[category]
 *
 * 基于用户历史和偏好，使用 AI 生成个性化推荐
 *
 * 使用量限制：
 * - Free: 30次/月，达到限制提示升级
 * - Pro: 30次/日，达到限制提示等待或升级
 * - Enterprise: 无限制
 */

import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
import { generateRecommendations, isAIProviderConfigured } from "@/lib/ai/zhipu-recommendation";
import { generateSearchLink, selectBestPlatform, selectFoodPlatformWithRotation } from "@/lib/search/search-engine";
import { enhanceTravelRecommendation } from "@/lib/ai/travel-enhancer";
import {
  validateFitnessRecommendationDiversity,
  supplementFitnessTypes,
  enhanceFitnessRecommendation,
  selectFitnessPlatform
} from "@/lib/ai/fitness-enhancer";
import { validateAndFixPlatforms } from "@/lib/search/platform-validator";
import { analyzeEntertainmentDiversity, supplementEntertainmentTypes } from "@/lib/ai/entertainment-diversity-checker";
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
import type { RecommendationCategory, AIRecommendResponse, LinkType } from "@/lib/types/recommendation";
import { canUseRecommendation, recordRecommendationUsage, getUserUsageStats } from "@/lib/subscription/usage-tracker";

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
    const enableStreaming = searchParams.get("stream") === "true"; // 新增：是否启用流式响应

    // ==========================================
    // 使用量限制检查
    // ==========================================
    // 只对登录用户进行使用量检查（匿名用户不受限制，鼓励注册）
    let usageStats: Awaited<ReturnType<typeof getUserUsageStats>> | null = null;
    if (isValidUserId(userId)) {
      try {
        const usageCheck = await canUseRecommendation(userId);
        // 保存使用量统计信息，用于后续响应
        usageStats = usageCheck.stats;

        if (!usageCheck.allowed) {
          const stats = usageCheck.stats;
          const isMonthly = stats.periodType === "monthly";

          // 构建多语言错误消息
          let errorMessage: string;
          let upgradeMessage: string;

          if (locale === "zh") {
            if (isMonthly) {
              // Free 用户达到月度限制
              errorMessage = `您已达到本月 ${stats.periodLimit} 次推荐限制`;
              upgradeMessage = "升级到 Pro 版获取每日 30 次推荐，或升级到企业版获取无限推荐";
            } else {
              // Pro 用户达到日度限制
              errorMessage = `您已达到今日 ${stats.periodLimit} 次推荐限制`;
              upgradeMessage = "请明天再试，或升级到企业版获取无限推荐";
            }
          } else {
            if (isMonthly) {
              errorMessage = `You have reached your monthly limit of ${stats.periodLimit} recommendations`;
              upgradeMessage = "Upgrade to Pro for 30 daily recommendations, or Enterprise for unlimited";
            } else {
              errorMessage = `You have reached your daily limit of ${stats.periodLimit} recommendations`;
              upgradeMessage = "Please try again tomorrow, or upgrade to Enterprise for unlimited recommendations";
            }
          }

          return NextResponse.json(
            {
              success: false,
              recommendations: [],
              source: "fallback" as const,
              error: errorMessage,
              limitExceeded: true,
              usage: {
                current: stats.currentPeriodUsage,
                limit: stats.periodLimit,
                remaining: 0,
                periodType: stats.periodType,
                periodEnd: stats.periodEnd.toISOString(),
                isUnlimited: false,
              },
              upgradeMessage,
              upgradeUrl: "/pro",
            },
            { status: 429 } // Too Many Requests
          );
        }
      } catch (usageError) {
        // 使用量检查失败时，允许继续使用（优雅降级）
        console.warn("[Usage] Failed to check usage limit, allowing request:", usageError);
      }
    }

    // 获取用户偏好和历史（仅当 userId 是有效 UUID 时）
    // 从请求参数获取历史记录限制，默认为 50
    const historyLimit = Math.min(Math.max(parseInt(searchParams.get("historyLimit") || "50"), 1), 100);
    let userHistory: Awaited<ReturnType<typeof getUserRecommendationHistory>> = [];
    let userPreference: Awaited<ReturnType<typeof getUserCategoryPreference>> = null;

    if (isValidUserId(userId)) {
      try {
        [userHistory, userPreference] = await Promise.all([
          getUserRecommendationHistory(userId, category, historyLimit),
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
    if (!isAIProviderConfigured()) {
      console.log("[AI] No provider configured for current region, using fallback data");
      const fallbackRecs = await generateFallbackRecommendations(category, locale, count);

      return NextResponse.json({
        success: true,
        recommendations: fallbackRecs,
        source: "fallback",
      } satisfies AIRecommendResponse);
    }

    // 使用新的 AI + 搜索引擎推荐系统
    try {
      // 1. 使用智谱 AI 生成推荐内容（不含链接）
      // 将用户偏好数据传递给 AI，用于生成更精准的个性化推荐
      const aiRecommendations = await generateRecommendations(
        userHistory || [],
        category,
        locale,
        count,
        userPreference // 传递用户偏好数据（包含问卷画像）
      );

      // 2. 处理推荐的多样性
      let processedRecommendations = aiRecommendations;

      if (category === 'entertainment') {
        // 分析类型分布
        const diversity = analyzeEntertainmentDiversity(aiRecommendations);
        console.log(`[Entertainment] Type distribution:`, diversity.distribution);

        // 如果不够多样，尝试补充
        if (!diversity.isDiverse && diversity.missingTypes.length > 0) {
          console.log(`[Entertainment] Missing types:`, diversity.missingTypes);
          const supplements = await supplementEntertainmentTypes(
            aiRecommendations,
            diversity.missingTypes.slice(0, 2), // 最多补充2种类型
            userHistory || [],
            locale
          );
          processedRecommendations = [...aiRecommendations, ...supplements];
        }
      } else if (category === 'fitness') {
        // 健身推荐必须包含三种类型：健身视频、健身房地点、器材教程
        const fitnessValidation = validateFitnessRecommendationDiversity(aiRecommendations);
        console.log(`[Fitness] Validation:`, { isValid: fitnessValidation.isValid, missingTypes: fitnessValidation.missingTypes });

        // 如果缺少任何类型，补充
        if (!fitnessValidation.isValid && fitnessValidation.missingTypes.length > 0) {
          console.log(`[Fitness] Missing types:`, fitnessValidation.missingTypes);
          const supplements = await supplementFitnessTypes(
            aiRecommendations,
            fitnessValidation.missingTypes,
            userHistory || [],
            locale
          );
          processedRecommendations = [...aiRecommendations, ...supplements];
        }
      }

      // 3. 为每个推荐生成搜索引擎链接
      const finalRecommendations = processedRecommendations.map((rec, index) => {
        let enhancedRec = rec;

        // 特殊处理：旅游推荐使用增强器
        if (category === 'travel') {
          enhancedRec = enhanceTravelRecommendation(rec, locale);
        }
        // 特殊处理：健身推荐使用增强器
        else if (category === 'fitness') {
          enhancedRec = enhanceFitnessRecommendation(rec, locale);
        }

        // 选择最佳平台（传递娱乐类型）
        // 对于 food 分类，使用轮换函数确保平台多样性
        // 对于 fitness 分类，使用专用的选择函数
        let platform: string;
        if (category === 'food') {
          platform = selectFoodPlatformWithRotation(index, enhancedRec.platform, locale);
        } else if (category === 'fitness') {
          // 健身分类使用专用选择函数
          const fitnessType = (enhancedRec as any).fitnessType || 'video';
          platform = selectFitnessPlatform(fitnessType, enhancedRec.platform, locale);
        } else {
          platform = selectBestPlatform(category, enhancedRec.platform, locale, enhancedRec.entertainmentType);
        }

        // 生成搜索链接（传递娱乐类型）
        const searchLink = generateSearchLink(
          enhancedRec.title,
          enhancedRec.searchQuery,
          platform,
          locale,
          category,
          enhancedRec.entertainmentType
        );

        // 根据类别和平台确定 linkType
        let linkType: LinkType = 'search'; // 默认值

        if (category === 'travel') {
          linkType = 'location';
        } else if (category === 'fitness') {
          // 健身分类根据推荐的具体类型设置 linkType
          const fitnessType = (enhancedRec as any).fitnessType || 'video';

          switch (fitnessType) {
            case 'video':
              // 健身视频课程
              linkType = 'video';
              break;
            case 'plan':
              // 健身训练计划文章
              linkType = 'search';
              break;
            case 'equipment':
              // 器材评测文章
              linkType = 'search';
              break;
            default:
              // 后备方案：根据平台
              if (platform === 'YouTube' || platform === 'YouTube Fitness') {
                linkType = 'video';
              } else if (platform === 'FitnessVolt' || platform === 'GarageGymReviews' || platform === 'Muscle & Strength') {
                linkType = 'search';
              } else if (platform === 'Keep' || platform === 'Peloton') {
                linkType = 'app';
              } else if (platform === '小红书') {
                linkType = 'article';
              }
          }
        } else if (category === 'entertainment') {
          // 娱乐分类根据平台和娱乐类型设置 linkType
          // 游戏平台列表（支持所有定义的游戏平台）
          const gamePlatforms = [
            'Steam', 'TapTap', 'Epic Games', 'WeGame', '杉果', '小黑盒', '3DM', '游民星空', 'B站游戏', '4399小游戏',
            'PlayStation Store', 'Xbox Store', 'Nintendo eShop', 'GOG', 'Humble Bundle', 'itch.io', 'Game Pass', 'Green Man Gaming'
          ];
          
          if (platform === 'B站' || platform === 'YouTube' || platform === '爱奇艺' || platform === '腾讯视频' || platform === 'Netflix') {
            linkType = 'video';
          } else if (gamePlatforms.includes(platform) || enhancedRec.entertainmentType === 'game') {
            linkType = 'game';
          } else if (platform === '网易云音乐' || platform === 'Spotify') {
            linkType = 'music';
          } else if (platform === '豆瓣' || platform === 'IMDb') {
            linkType = 'article';
          }
        } else if (category === 'shopping') {
          // 购物分类统一设置为 product
          linkType = 'product';
        } else if (category === 'food') {
          // 美食分类根据平台设置
          if (platform === '大众点评' || platform === '美团' || platform === 'TripAdvisor' || platform === 'OpenTable' || platform === '百度地图' || platform === 'Google Maps') {
            linkType = 'restaurant';
          } else if (platform === '下厨房' || platform === 'Allrecipes') {
            linkType = 'recipe';
          } else {
            linkType = 'article';
          }
        }

        const baseRecommendation = {
          title: enhancedRec.title,
          description: enhancedRec.description,
          reason: enhancedRec.reason,
          tags: enhancedRec.tags,
          link: searchLink.url,           // 搜索引擎链接
          platform: searchLink.displayName,
          linkType: linkType,              // 根据类别和平台设置合适的类型
          category: category,             // 添加缺失的 category 属性
          metadata: {
            searchQuery: enhancedRec.searchQuery,
            originalPlatform: enhancedRec.platform,
            isSearchLink: true,          // 标记这是搜索链接
          }
        };

        // 为娱乐推荐添加 entertainmentType 字段
        if (category === 'entertainment' && enhancedRec.entertainmentType) {
          (baseRecommendation as any).entertainmentType = enhancedRec.entertainmentType;
        }

        // 为健身推荐添加 fitnessType 元数据
        if (category === 'fitness' && (enhancedRec as any).fitnessType) {
          const metadata = baseRecommendation.metadata as any;
          metadata.fitnessType = (enhancedRec as any).fitnessType;
          // 添加易于理解的健身类型标签
          switch ((enhancedRec as any).fitnessType) {
            case 'video':
              metadata.fitnessTypeLabel = locale === 'zh' ? '健身视频课程' : 'Fitness Video Course';
              break;
            case 'plan':
              metadata.fitnessTypeLabel = locale === 'zh' ? '健身训练计划' : 'Fitness Training Plan';
              break;
            case 'equipment':
              metadata.fitnessTypeLabel = locale === 'zh' ? '器材评测推荐' : 'Equipment Review';
              break;
          }
        }

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

      // 4. 验证平台可靠性
      const validatedRecommendations = validateAndFixPlatforms(finalRecommendations, locale);
      console.log(`[Platform] 验证平台可靠性完成`);

      console.log(`[Search] 生成搜索链接数: ${validatedRecommendations.length}`);

      // 6. 如果启用流式响应，分批发送结果
      if (enableStreaming) {
        console.log(`[Stream] Streaming ${validatedRecommendations.length} recommendations...`);

        // 创建流式响应
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();

            // 分批大小：每次发送2个推荐
            const batchSize = 2;
            const selectedRecommendations = validatedRecommendations.slice(0, count);

            // 分批发送推荐
            for (let i = 0; i < selectedRecommendations.length; i += batchSize) {
              const batch = selectedRecommendations.slice(i, i + batchSize);
              const isLastBatch = i + batchSize >= selectedRecommendations.length;

              // 构建流式数据包
              const data = {
                type: isLastBatch ? 'complete' : 'partial',
                recommendations: batch,
                index: i,
                total: selectedRecommendations.length,
                source: "ai",
              };

              // 发送SSE格式的数据
              const message = `data: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(message));

              // 添加小延迟以模拟逐步加载（可选，提升用户体验）
              if (!isLastBatch) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }

            // 异步保存到数据库（不阻塞流式响应）
            if (isValidUserId(userId) && selectedRecommendations.length > 0) {
              Promise.all([
                saveRecommendationsToHistory(userId, selectedRecommendations),
                updateUserPreferences(userId, category, { incrementView: true }),
                recordRecommendationUsage(userId, { category, count: selectedRecommendations.length }),
              ]).catch((err) => {
                console.error(`[Stream Save] Failed to save:`, err);
              });
            }

            // 异步缓存（登录用户）
            if (!isAnonymous) {
              cacheRecommendations(category, preferenceHash, selectedRecommendations, 30).catch((err) => {
                console.error("[Stream Cache] Failed to cache:", err);
              });
            }

            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      // 5. 异步保存到数据库和缓存（不阻塞响应）- 非流式模式
      if (isValidUserId(userId) && validatedRecommendations.length > 0) {
        console.log(`[Save] Recording recommendation for user ${userId.slice(0, 8)}...`);
        // 所有数据库操作都是异步的，不阻塞响应
        Promise.all([
          saveRecommendationsToHistory(userId, validatedRecommendations),
          updateUserPreferences(userId, category, { incrementView: true }),
          recordRecommendationUsage(userId, { category, count: validatedRecommendations.length }),
        ])
          .then(([ids, , usageResult]) => {
            console.log(`[Save] ✓ Successfully saved ${ids.length} recommendations`);
            console.log(`[Preferences] ✓ Updated user preferences for ${category}`);
            if (usageResult.success) {
              console.log(`[Usage] ✓ Recorded usage for ${category}`);
            } else {
              console.warn(`[Usage] ✗ Failed to record usage:`, usageResult.error);
            }
          })
          .catch((err) => {
            console.error(`[Save] ✗ Failed to save recommendations:`, err);
          });
      } else {
        console.log(`[Save] Skipping history save for anonymous user`);
      }

      // 6. 异步缓存推荐结果（用于登录用户）
      if (!isAnonymous) {
        cacheRecommendations(category, preferenceHash, validatedRecommendations, 30)
          .then(() => {
            console.log(`[Cache] ✓ Cached ${validatedRecommendations.length} recommendations for ${category}`);
          })
          .catch((err) => {
            console.error("[Cache] ✗ Failed to cache recommendations:", err);
          });
      }

      // 7. 构建使用量信息并立即返回（使用缓存的统计数据）
      let usageInfo = null;
      if (usageStats) {
        usageInfo = {
          current: usageStats.currentPeriodUsage + 1, // +1 因为本次请求计入使用量
          limit: usageStats.periodLimit,
          remaining: usageStats.isUnlimited ? -1 : Math.max(0, usageStats.remainingUsage - 1),
          periodType: usageStats.periodType,
          periodEnd: usageStats.periodEnd.toISOString(),
          isUnlimited: usageStats.isUnlimited,
        };
      }

      return NextResponse.json({
        success: true,
        recommendations: validatedRecommendations.slice(0, count),
        source: "ai",
        ...(usageInfo && { usage: usageInfo }),
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
      fitness: [
        {
          title: '30分钟瑜伽视频课程',
          description: '专业教练的瑜伽视频教程，适合初学者',
          reason: '帮助你通过视频课程开始健身之旅',
          tags: ['瑜伽', '视频课程', '初学者'],
          searchQuery: '瑜伽入门视频课程',
          platform: 'B站健身',  // 改用B站健身
          fitnessType: 'video'
        },
        {
          title: '哑铃评测与购买指南',
          description: '全面的哑铃评测和选购推荐',
          reason: '帮你选择合适的健身器材',
          tags: ['哑铃评测', '购买指南', '器材推荐'],
          searchQuery: '哑铃评测推荐',
          platform: 'GarageGymReviews',
          fitnessType: 'equipment'
        },
        {
          title: '12周肌肉增长训练计划',
          description: '科学的增肌训练计划和健身方案',
          reason: '让你拥有完整的健身计划达成目标',
          tags: ['健身计划', '增肌', '训练方案'],
          searchQuery: '肌肉训练计划增肌',
          platform: 'FitnessVolt',
          fitnessType: 'plan'
        }
      ]
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
      fitness: [
        {
          title: '30-Minute Yoga Video Course',
          description: 'Professional yoga video tutorial perfect for beginners',
          reason: 'Help you start your fitness journey with video courses',
          tags: ['yoga', 'beginner', 'video course'],
          searchQuery: 'yoga for beginners video tutorial',
          platform: 'YouTube',
          fitnessType: 'video'
        },
        {
          title: 'Dumbbell Reviews and Buying Guide',
          description: 'Comprehensive dumbbell reviews and purchasing recommendations',
          reason: 'Help you choose the right equipment for training',
          tags: ['dumbbell', 'equipment review', 'buying guide'],
          searchQuery: 'dumbbell reviews recommendation',
          platform: 'GarageGymReviews',
          fitnessType: 'equipment'
        },
        {
          title: '12-Week Muscle Building Program',
          description: 'Scientific muscle building training plan and workout routine',
          reason: 'A complete fitness plan to help you achieve your goals',
          tags: ['muscle building', 'training plan', 'workout program'],
          searchQuery: 'muscle building training program',
          platform: 'FitnessVolt',
          fitnessType: 'plan'
        }
      ]
    }
  };

  const recs = fallbacks[locale]?.[category] || fallbacks.zh.entertainment;
  const limitedRecs = recs.slice(0, Math.max(1, count));

  // 为每个推荐生成搜索链接
  return limitedRecs.map((rec, index) => {
    // 对于 food 分类，使用轮换函数确保平台多样性
    let platform: string;
    if (category === 'food') {
      platform = selectFoodPlatformWithRotation(index, rec.platform, locale);
    } else if (category === 'fitness') {
      // 健身分类使用专用选择函数
      const fitnessType = rec.fitnessType || 'video';
      platform = selectFitnessPlatform(fitnessType, rec.platform, locale);
    } else {
      platform = selectBestPlatform(category, rec.platform, locale);
    }
    const searchLink = generateSearchLink(rec.title, rec.searchQuery, platform, locale, category);

    // 根据类别和平台确定linkType
    let linkType: LinkType = 'search';
    if (category === 'fitness') {
      // 健身分类根据推荐的具体类型设置 linkType
      const fitnessType = rec.fitnessType || 'video';

      switch (fitnessType) {
        case 'video':
          // 健身视频课程
          linkType = 'video';
          break;
        case 'plan':
          // 健身计划文章
          linkType = 'search';
          break;
        case 'equipment':
          // 器材评测（指向评测文章）
          linkType = 'search';
          break;
        default:
          // 后备方案：根据平台
          if (platform === 'YouTube' || platform === 'YouTube Fitness') {
            linkType = 'video';
          } else if (platform === 'FitnessVolt' || platform === 'GarageGymReviews') {
            linkType = 'search';
          } else if (platform === 'Keep' || platform === 'MyFitnessPal') {
            linkType = 'app';
          }
      }
    }

    const result = {
      ...rec,
      link: searchLink.url,
      platform: searchLink.displayName,
      linkType: linkType,
      category: category as RecommendationCategory,
      metadata: {
        searchQuery: rec.searchQuery,
        originalPlatform: rec.platform,
        isSearchLink: true          // 标记这是搜索链接
      }
    };

    // 为健身推荐添加 fitnessType 元数据
    if (category === 'fitness' && rec.fitnessType) {
      (result.metadata as any).fitnessType = rec.fitnessType;
      // 添加易于理解的健身类型标签
      switch (rec.fitnessType) {
        case 'video':
          (result.metadata as any).fitnessTypeLabel = locale === 'zh' ? '健身视频课程' : 'Fitness Video Course';
          break;
        case 'plan':
          (result.metadata as any).fitnessTypeLabel = locale === 'zh' ? '健身训练计划' : 'Fitness Training Plan';
          break;
        case 'equipment':
          (result.metadata as any).fitnessTypeLabel = locale === 'zh' ? '器材评测推荐' : 'Equipment Review';
          break;
      }
    }

    return result;
  });
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
