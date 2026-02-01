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
import { resolveCandidateLink } from "@/lib/outbound/link-resolver";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { dedupeRecommendations } from "@/lib/recommendation/dedupe";
import { generateFallbackCandidates } from "@/lib/recommendation/fallback-generator";
import { getUserFeedbackHistory, extractNegativeFeedbackSamples } from "@/lib/services/feedback-service";

// 有效的分类列表
const VALID_CATEGORIES: RecommendationCategory[] = [
  "entertainment",
  "shopping",
  "food",
  "travel",
  "fitness",
];

function stableHashToUnitInterval(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

type WeightedCandidate = {
  platform: string;
  weight: number;
};

function pickWeightedPlatform(candidates: WeightedCandidate[], seed: string): string {
  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return candidates[0]?.platform || (seed ? "百度" : "Google");

  const r = stableHashToUnitInterval(seed) * total;
  let acc = 0;
  for (const item of candidates) {
    acc += item.weight;
    if (r <= acc) return item.platform;
  }
  return candidates[candidates.length - 1]?.platform || candidates[0]?.platform || "百度";
}

function selectWeightedPlatformForCategory(
  category: RecommendationCategory,
  locale: "zh" | "en",
  seed: string,
  suggestedPlatform?: string,
  entertainmentType?: "video" | "game" | "music" | "review"
): string | null {
  const isZh = locale === "zh";

  if (category === "entertainment" && entertainmentType && entertainmentType !== "video") {
    return null;
  }

  const candidates: WeightedCandidate[] | null = (() => {
    if (isZh) {
      switch (category) {
        case "food":
          return [
            { platform: "大众点评", weight: 0.35 },
            { platform: "高德地图美食", weight: 0.25 },
            { platform: "百度地图美食", weight: 0.2 },
            { platform: "腾讯地图美食", weight: 0.2 },
          ];
        case "shopping":
          return [
            { platform: "京东", weight: 0.3 },
            { platform: "淘宝", weight: 0.3 },
            { platform: "拼多多", weight: 0.2 },
            { platform: "唯品会", weight: 0.2 },
          ];
        case "entertainment":
          return [
            { platform: "腾讯视频", weight: 0.5 },
            { platform: "优酷", weight: 0.5 },
          ];
        case "travel":
          return [
            { platform: "携程", weight: 0.3 },
            { platform: "去哪儿", weight: 0.25 },
            { platform: "小红书", weight: 0.2 },
            { platform: "马蜂窝", weight: 0.25 },
          ];
        case "fitness":
          return null;
        default:
          return null;
      }
    }

    switch (category) {
      case "food":
        return [
          { platform: "Uber Eats", weight: 0.2 },
          { platform: "DoorDash", weight: 0.2 },
          { platform: "Yelp", weight: 0.2 },
          { platform: "Google Maps", weight: 0.1 },
          { platform: "OpenTable", weight: 0.1 },
          { platform: "Google", weight: 0.1 },
          { platform: "YouTube", weight: 0.1 },
        ];
      case "shopping":
        return [
          { platform: "Amazon", weight: 0.2 },
          { platform: "eBay", weight: 0.2 },
          { platform: "Walmart", weight: 0.2 },
          { platform: "Target", weight: 0.1 },
          { platform: "Google", weight: 0.1 },
          { platform: "YouTube", weight: 0.1 },
          { platform: "Google Maps", weight: 0.1 },
        ];
      case "entertainment":
        return [
          { platform: "YouTube", weight: 0.3 },
          { platform: "Netflix", weight: 0.3 },
          { platform: "IMDb", weight: 0.1 },
          { platform: "Google", weight: 0.1 },
          { platform: "Rotten Tomatoes", weight: 0.1 },
          { platform: "Metacritic", weight: 0.1 },
        ];
      case "travel":
        return [
          { platform: "Google Maps", weight: 0.2 },
          { platform: "Booking.com", weight: 0.2 },
          { platform: "TripAdvisor", weight: 0.2 },
          { platform: "Agoda", weight: 0.1 },
          { platform: "Airbnb", weight: 0.1 },
          { platform: "Google", weight: 0.1 },
          { platform: "YouTube", weight: 0.1 },
        ];
      case "fitness":
        return [
          { platform: "YouTube Fitness", weight: 0.2 },
          { platform: "MyFitnessPal", weight: 0.2 },
          { platform: "Peloton", weight: 0.2 },
          { platform: "Google", weight: 0.1 },
          { platform: "YouTube", weight: 0.1 },
          { platform: "Google Maps", weight: 0.1 },
          { platform: "Muscle & Strength", weight: 0.1 },
        ];
      default:
        return null;
    }
  })();

  if (!candidates || candidates.length === 0) return null;
  if (suggestedPlatform && candidates.some((c) => c.platform === suggestedPlatform)) {
    const boosted = candidates.map((candidate) =>
      candidate.platform === suggestedPlatform
        ? { ...candidate, weight: candidate.weight + 0.15 }
        : candidate
    );
    return pickWeightedPlatform(boosted, seed);
  }
  return pickWeightedPlatform(candidates, seed);
}

function mapSearchPlatformToProvider(platform: string, locale: "zh" | "en"): string {
  const cnMap: Record<string, string> = {
    高德地图美食: "高德地图",
    百度地图美食: "百度地图",
    腾讯地图美食: "腾讯地图",
    京东秒送: "京东秒送",
    淘宝闪购: "淘宝闪购",
    美团外卖: "美团外卖",
    高德地图旅游: "高德地图",
    百度地图旅游: "百度地图",
    高德地图健身: "高德地图",
    百度地图健身: "百度地图",
    腾讯地图健身: "腾讯地图",
    百度美食: "百度",
    百度健身: "百度",
    B站健身: "B站",
    腾讯视频健身: "腾讯视频",
    优酷健身: "优酷",
  };

  const intlMap: Record<string, string> = {
    "TripAdvisor Travel": "TripAdvisor",
  };

  if (locale === "zh") return cnMap[platform] || platform;
  return intlMap[platform] || platform;
}

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
    const client = (searchParams.get("client") as "app" | "web" | null) || "web";
    const latRaw = searchParams.get("lat");
    const lngRaw = searchParams.get("lng");
    const geo =
      latRaw && lngRaw && Number.isFinite(Number(latRaw)) && Number.isFinite(Number(lngRaw))
        ? { lat: Number(latRaw), lng: Number(lngRaw) }
        : null;
    const excludeTitlesRaw = searchParams.get("excludeTitles");
    let excludeTitles: string[] = [];
    if (excludeTitlesRaw) {
      try {
        const parsed = JSON.parse(excludeTitlesRaw);
        if (Array.isArray(parsed)) {
          excludeTitles = parsed.filter((t) => typeof t === "string");
        }
      } catch {
        excludeTitles = excludeTitlesRaw
          .split(/[|,]/g)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      }
    }

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
    let recommendationSignals:
      | {
          topTags: string[];
          positiveSamples: Array<{
            title: string;
            tags?: string[];
            searchQuery?: string;
          }>;
          negativeSamples: Array<{
            title: string;
            tags?: string[];
            searchQuery?: string;
            feedbackType: string;
            rating?: number | null;
          }>;
        }
      | null = null;

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

    if (isValidUserId(userId)) {
      try {
        const historyById = new Map(
          (userHistory || [])
            .filter((h) => typeof h?.id === "string" && typeof h?.title === "string")
            .map((h) => [h.id, { title: h.title, metadata: h.metadata || null }] as const)
        );

        const feedbacks = await getUserFeedbackHistory(userId, 20);
        const negativeSamples = extractNegativeFeedbackSamples({
          feedbacks,
          historyById,
          maxSamples: 10,
        }).map((s) => ({
          title: s.title,
          ...(s.tags && s.tags.length > 0 ? { tags: s.tags } : {}),
          ...(s.searchQuery ? { searchQuery: s.searchQuery } : {}),
          feedbackType: s.feedbackType,
          ...(typeof s.rating === "number" ? { rating: s.rating } : {}),
        }));

        const topTags = (() => {
          const weighted = Object.entries((userPreference as any)?.preferences || {})
            .filter(([k, v]) => typeof k === "string" && k.trim().length > 0 && typeof v === "number")
            .sort((a, b) => Number(b[1]) - Number(a[1]))
            .map(([k]) => k.trim())
            .slice(0, 12);
          const direct = Array.isArray((userPreference as any)?.tags)
            ? ((userPreference as any).tags as unknown[]).filter(
                (t): t is string => typeof t === "string" && t.trim().length > 0
              )
            : [];
          const merged = [...weighted, ...direct];
          const seen = new Set<string>();
          const uniq: string[] = [];
          for (const tag of merged) {
            const key = tag.trim().toLowerCase();
            if (!key || seen.has(key)) continue;
            seen.add(key);
            uniq.push(tag.trim());
          }
          return uniq.slice(0, 12);
        })();

        const positiveSamples = (userHistory || [])
          .filter((h: any) => !!h?.clicked || !!h?.saved)
          .slice(0, 10)
          .map((h: any) => {
            const tagCandidate = h?.metadata?.tags;
            const tags = Array.isArray(tagCandidate)
              ? tagCandidate.filter((t: any) => typeof t === "string" && t.trim().length > 0)
              : undefined;
            const searchQueryCandidate = h?.metadata?.searchQuery;
            const searchQuery =
              typeof searchQueryCandidate === "string" && searchQueryCandidate.trim().length > 0
                ? searchQueryCandidate
                : undefined;
            return {
              title: h.title,
              ...(tags && tags.length > 0 ? { tags } : {}),
              ...(searchQuery ? { searchQuery } : {}),
            };
          })
          .filter((s) => typeof s.title === "string" && s.title.trim().length > 0);

        recommendationSignals = {
          topTags,
          positiveSamples,
          negativeSamples,
        };
      } catch (signalError) {
        console.warn("[Signals] Failed to load feedback signals:", signalError);
        recommendationSignals = null;
      }
    }

    // 生成偏好哈希用于缓存
    // 对于匿名用户，禁用缓存以确保获得多样化的推荐
    const preferenceHash = generatePreferenceHash(userPreference, userHistory || []);
    const isAnonymous = userId === "anonymous";

    // 尝试从缓存获取（仅用于登录用户）
    if (!skipCache && !isAnonymous) {
      try {
        const cachedRecommendations = await getCachedRecommendations(category, preferenceHash);
        if (cachedRecommendations && cachedRecommendations.length > 0) {
          // 从缓存中随机选择
          const shuffled = [...cachedRecommendations].sort(() => Math.random() - 0.5);
          console.log(`[Cache Hit] Using cached recommendations for ${category} with hash ${preferenceHash}`);
          const normalizedRecommendations = shuffled.slice(0, count).map((rec) => ({
            ...rec,
            description: rec.description ?? "",
            linkType: rec.linkType ?? "search",
            metadata: (rec.metadata ?? {}) as any,
            reason: rec.reason ?? "",
          }));
          return NextResponse.json({
            success: true,
            recommendations: normalizedRecommendations as any,
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
      const fallbackRecs = await generateFallbackRecommendations({
        category,
        locale,
        count,
        client,
        geo,
        userHistory,
        userPreference,
        excludeTitles,
      });

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
      const candidateCount = Math.min(20, Math.max(count * 3, 12));
      const aiRecommendations = await generateRecommendations(
        userHistory || [],
        category,
        locale,
        candidateCount,
        userPreference, // 传递用户偏好数据（包含问卷画像）
        { client, geo, avoidTitles: excludeTitles, signals: recommendationSignals }
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

      processedRecommendations = dedupeRecommendations(processedRecommendations as any, {
        count,
        userHistory: userHistory as any,
        excludeTitles,
        mode: "strict",
      });

      if (processedRecommendations.length < count) {
        const missing = count - processedRecommendations.length;
        const topUpCandidateCount = Math.min(20, Math.max(missing * 4, 8));
        const avoidTitlesForTopUp = [
          ...excludeTitles,
          ...(processedRecommendations as any[]).map((r) => r?.title),
          ...(userHistory || []).map((h) => h?.title),
        ]
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .slice(0, 120);

        const topUps = await generateRecommendations(
          userHistory || [],
          category,
          locale,
          topUpCandidateCount,
          userPreference,
          { client, geo, avoidTitles: avoidTitlesForTopUp, signals: recommendationSignals }
        );

        processedRecommendations = dedupeRecommendations(
          [...(processedRecommendations as any[]), ...(topUps as any[])],
          {
            count,
            userHistory: userHistory as any,
            excludeTitles: avoidTitlesForTopUp,
            mode: "strict",
          }
        );
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

        const selectionSeed = `${userId || "anon"}:${category}:${index}:${enhancedRec.title}`;
        const weightedPlatform = selectWeightedPlatformForCategory(
          category,
          locale,
          selectionSeed,
          enhancedRec.platform,
          enhancedRec.entertainmentType
        );

        let platform: string;
        if (weightedPlatform) {
          platform = weightedPlatform;
        } else if (category === 'food') {
          platform = selectFoodPlatformWithRotation(index, enhancedRec.platform, locale);
        } else if (category === 'fitness') {
          const fitnessType = (enhancedRec as any).fitnessType || 'tutorial';
          platform = selectFitnessPlatform(fitnessType, enhancedRec.platform, locale);
        } else {
          platform = selectBestPlatform(category, enhancedRec.platform, locale, enhancedRec.entertainmentType);
        }

        // 生成搜索链接（传递娱乐类型）
        let searchLink = generateSearchLink(
          enhancedRec.title,
          enhancedRec.searchQuery,
          platform,
          locale,
          category,
          enhancedRec.entertainmentType
        );

        if (geo && locale === "zh") {
          const baseQuery = (enhancedRec.searchQuery || enhancedRec.title) as string;
          const mapQuery =
            platform === "百度地图美食" || platform === "高德地图美食" || platform === "腾讯地图美食"
              ? `${baseQuery} 餐厅`
              : platform === "百度地图健身" || platform === "高德地图健身" || platform === "腾讯地图健身"
                ? `${baseQuery} 健身房`
                : baseQuery;

          if (platform === "百度地图美食" || platform === "百度地图健身" || platform === "百度地图") {
            searchLink = {
              ...searchLink,
              url: `https://api.map.baidu.com/place/search?query=${encodeURIComponent(mapQuery)}&location=${encodeURIComponent(
                `${geo.lat},${geo.lng}`
              )}&radius=2000&output=html&src=mvp_2-demo`,
            };
          }

          if (platform === "高德地图美食" || platform === "高德地图健身" || platform === "高德地图") {
            searchLink = {
              ...searchLink,
              url: `https://uri.amap.com/search?keyword=${encodeURIComponent(mapQuery)}&center=${encodeURIComponent(
                `${geo.lng},${geo.lat}`
              )}&radius=2000`,
            };
          }
        }

        // 根据类别和平台确定 linkType
        let linkType: LinkType = 'search'; // 默认值

        if (category === 'travel') {
          linkType = 'location';
        } else if (category === 'fitness') {
          // 健身分类根据推荐的具体类型设置 linkType
          const fitnessType = (enhancedRec as any).fitnessType || 'tutorial';

          switch (fitnessType) {
            case 'tutorial':
              linkType = 'video';
              break;
            case 'nearby_place':
              linkType = 'location';
              break;
            case 'equipment':
              if (platform === 'B站健身' || platform === '优酷健身' || platform === 'YouTube' || platform === 'YouTube Fitness') {
                linkType = 'video';
              } else {
                linkType = 'search';
              }
              break;
            default:
              // 后备方案：根据平台
              if (platform === 'YouTube' || platform === 'YouTube Fitness') {
                linkType = 'video';
              } else if (platform === 'Keep' || platform === 'Peloton') {
                linkType = 'app';
              } else if (platform === '小红书') {
                linkType = 'article';
              } else if (platform === '百度地图健身' || platform === '高德地图健身' || platform === '腾讯地图健身' || platform === '大众点评' || platform === '美团') {
                linkType = 'location';
              } else {
                linkType = 'search';
              }
          }
        } else if (category === 'entertainment') {
          // 娱乐分类根据平台和娱乐类型设置 linkType
          // 游戏平台列表（支持所有定义的游戏平台）
          const gamePlatforms = [
            'Steam', 'TapTap', 'Epic Games', 'WeGame', '杉果', '小黑盒', '3DM', '游民星空', 'B站游戏', '4399小游戏',
            'PlayStation Store', 'Xbox Store', 'Nintendo eShop', 'GOG', 'Humble Bundle', 'itch.io', 'Game Pass', 'Green Man Gaming'
          ];
          
          if (platform === 'B站' || platform === 'YouTube' || platform === '爱奇艺' || platform === '腾讯视频' || platform === '优酷' || platform === 'Netflix') {
            linkType = 'video';
          } else if (gamePlatforms.includes(platform) || enhancedRec.entertainmentType === 'game') {
            linkType = 'game';
          } else if (platform === '酷狗音乐' || platform === 'QQ音乐' || platform === '网易云音乐' || platform === 'Spotify') {
            linkType = 'music';
          } else if (platform === '豆瓣' || platform === 'IMDb') {
            linkType = 'article';
          }
        } else if (category === 'shopping') {
          // 购物分类统一设置为 product
          linkType = 'product';
        } else if (category === 'food') {
          // 美食分类根据平台设置
          if (
            platform === '大众点评' ||
            platform === '美团' ||
            platform === 'TripAdvisor' ||
            platform === 'OpenTable' ||
            platform === '百度地图' ||
            platform === '百度地图美食' ||
            platform === '高德地图美食' ||
            platform === '腾讯地图美食' ||
            platform === 'Google Maps'
          ) {
            linkType = 'restaurant';
          } else if (platform === '下厨房' || platform === 'Allrecipes') {
            linkType = 'recipe';
          } else {
            linkType = 'article';
          }
        }

        const region = isChinaDeployment() ? "CN" : "INTL";
        const providerForCandidateLink = mapSearchPlatformToProvider(platform, locale);
        const candidateLink = resolveCandidateLink({
          title: enhancedRec.title,
          query: (enhancedRec.searchQuery || enhancedRec.title) as string,
          category,
          locale,
          region,
          provider: providerForCandidateLink,
        });

        const baseRecommendation = {
          title: enhancedRec.title,
          description: enhancedRec.description,
          reason: enhancedRec.reason,
          tags: enhancedRec.tags,
          link: searchLink.url,           // 搜索引擎链接
          platform: searchLink.displayName,
          linkType: linkType,              // 根据类别和平台设置合适的类型
          category: category,             // 添加缺失的 category 属性
          candidateLink,
          metadata: {
            searchQuery: enhancedRec.searchQuery,
            originalPlatform: enhancedRec.platform,
            isSearchLink: true,          // 标记这是搜索链接
            tags: enhancedRec.tags,
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
            case 'tutorial':
              metadata.fitnessTypeLabel = locale === 'zh' ? '健身教程跟练' : 'Workout Tutorial';
              break;
            case 'nearby_place':
              metadata.fitnessTypeLabel = locale === 'zh' ? '附近健身场所' : 'Nearby Fitness Place';
              break;
            case 'equipment':
              metadata.fitnessTypeLabel = locale === 'zh' ? '器材评测推荐' : 'Equipment Review';
              break;
            case 'video':
              metadata.fitnessTypeLabel = locale === 'zh' ? '健身视频课程' : 'Fitness Video Course';
              break;
            case 'plan':
              metadata.fitnessTypeLabel = locale === 'zh' ? '健身训练计划' : 'Fitness Training Plan';
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
      const fallbackRecs = await generateFallbackRecommendations({
        category,
        locale,
        count,
        client,
        geo,
        userHistory,
        userPreference,
        excludeTitles,
      });

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
  params: {
    category: RecommendationCategory;
    locale: "zh" | "en";
    count: number;
    client: "app" | "web";
    geo: { lat: number; lng: number } | null;
    userHistory: Awaited<ReturnType<typeof getUserRecommendationHistory>>;
    userPreference: Awaited<ReturnType<typeof getUserCategoryPreference>> | null;
    excludeTitles: string[];
  }
) {
  const { category, client, count, excludeTitles, geo, locale, userHistory, userPreference } = params;
  const limitedRecs = generateFallbackCandidates({
    category,
    locale,
    count,
    client,
    userPreference: userPreference as any,
    userHistory: userHistory as any,
    excludeTitles,
  });

  // 为每个推荐生成搜索链接
  return limitedRecs.map((rec, index) => {
    const selectionSeed = `fallback:${category}:${index}:${rec.title}`;
    const weightedPlatform = selectWeightedPlatformForCategory(
      category as RecommendationCategory,
      locale,
      selectionSeed,
      rec.platform,
      rec.entertainmentType
    );

    let platform: string;
    if (weightedPlatform) {
      platform = weightedPlatform;
    } else if (category === 'food') {
      platform = selectFoodPlatformWithRotation(index, rec.platform, locale);
    } else if (category === 'fitness') {
      const fitnessType = rec.fitnessType || 'tutorial';
      platform = selectFitnessPlatform(fitnessType as any, rec.platform, locale);
    } else {
      platform = selectBestPlatform(category, rec.platform, locale, rec.entertainmentType);
    }
    let searchLink = generateSearchLink(
      rec.title,
      rec.searchQuery,
      platform,
      locale,
      category,
      rec.entertainmentType
    );
    if (geo && locale === "zh") {
      const baseQuery = (rec.searchQuery || rec.title) as string;
      const mapQuery =
        platform === "百度地图美食" || platform === "高德地图美食" || platform === "腾讯地图美食"
          ? `${baseQuery} 餐厅`
          : platform === "百度地图健身" || platform === "高德地图健身" || platform === "腾讯地图健身"
            ? `${baseQuery} 健身房`
            : baseQuery;

      if (platform === "百度地图美食" || platform === "百度地图健身" || platform === "百度地图") {
        searchLink = {
          ...searchLink,
          url: `https://api.map.baidu.com/place/search?query=${encodeURIComponent(mapQuery)}&location=${encodeURIComponent(
            `${geo.lat},${geo.lng}`
          )}&radius=2000&output=html&src=mvp_2-demo`,
        };
      }

      if (platform === "高德地图美食" || platform === "高德地图健身" || platform === "高德地图") {
        searchLink = {
          ...searchLink,
          url: `https://uri.amap.com/search?keyword=${encodeURIComponent(mapQuery)}&center=${encodeURIComponent(
            `${geo.lng},${geo.lat}`
          )}&radius=2000`,
        };
      }
    }
    const region = isChinaDeployment() ? "CN" : "INTL";
    const providerForCandidateLink = mapSearchPlatformToProvider(platform, locale);
    const candidateLink = resolveCandidateLink({
      title: rec.title,
      query: rec.searchQuery || rec.title,
      category: category as RecommendationCategory,
      locale,
      region,
      provider: providerForCandidateLink,
    });

    // 根据类别和平台确定linkType
    let linkType: LinkType = 'search';
    if (category === 'fitness') {
      // 健身分类根据推荐的具体类型设置 linkType
      const fitnessType = rec.fitnessType || 'tutorial';

      switch (fitnessType) {
        case 'tutorial':
          linkType = 'video';
          break;
        case 'nearby_place':
          linkType = 'location';
          break;
        case 'equipment':
          if (platform === 'YouTube' || platform === 'YouTube Fitness' || platform === 'B站健身' || platform === '优酷健身') {
            linkType = 'video';
          } else {
            linkType = 'search';
          }
          break;
        default:
          // 后备方案：根据平台
          if (platform === 'YouTube' || platform === 'YouTube Fitness') {
            linkType = 'video';
          } else if (platform === 'Keep' || platform === 'MyFitnessPal') {
            linkType = 'app';
          } else if (platform === '百度地图健身' || platform === '高德地图健身' || platform === '腾讯地图健身' || platform === '大众点评' || platform === '美团') {
            linkType = 'location';
          } else {
            linkType = 'search';
          }
      }
    }

    const result = {
      ...rec,
      link: searchLink.url,
      platform: searchLink.displayName,
      linkType: linkType,
      category: category as RecommendationCategory,
      candidateLink,
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
        case 'tutorial':
          (result.metadata as any).fitnessTypeLabel = locale === 'zh' ? '健身教程' : 'Fitness Tutorial';
          break;
        case 'nearby_place':
          (result.metadata as any).fitnessTypeLabel = locale === 'zh' ? '附近场所' : 'Nearby Place';
          break;
        case 'equipment':
          (result.metadata as any).fitnessTypeLabel = locale === 'zh' ? '器材使用教程' : 'Equipment How-to';
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
