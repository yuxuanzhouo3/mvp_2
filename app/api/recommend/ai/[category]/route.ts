/**
 * AI 智能推荐 API
 * GET /api/recommend/ai/[category]
 *
 * 基于用户历史和偏好，使用 AI 生成个性化推荐
 *
 * 使用量限制：
 * - Free: 30 次/月，达到限制提示升级
 * - Pro: 30 次/日，达到限制提示等待或升级
 * - Enterprise: 无限次
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { generateRecommendations, isAIProviderConfigured } from "@/lib/ai/zhipu-recommendation";
import { generateSearchLink, selectBestPlatform, selectFoodPlatformWithRotation } from "@/lib/search/search-engine";
import { enhanceTravelRecommendation } from "@/lib/ai/travel-enhancer";
import {
  validateFitnessRecommendationDiversity,
  supplementFitnessTypes,
  enhanceFitnessRecommendation,
  selectFitnessPlatform,
  identifyFitnessType,
} from "@/lib/ai/fitness-enhancer";
import { validateAndFixPlatforms } from "@/lib/search/platform-validator";
import {
  analyzeEntertainmentDiversity,
  supplementEntertainmentTypes,
  inferEntertainmentType,
} from "@/lib/ai/entertainment-diversity-checker";
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
import { mapSearchPlatformToProvider } from "@/lib/outbound/provider-mapping";

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

const ENTERTAINMENT_TYPE_ORDER = ["video", "game", "music", "review"] as const;

function prioritizeEntertainmentCandidates<T extends { title?: string; searchQuery?: string; entertainmentType?: string }>(
  items: T[]
): T[] {
  const picks: T[] = [];
  const pickedKeys = new Set<string>();
  const firstByType = new Map<string, T>();

  const toKey = (item: T) => `${item.title || ""}|${item.searchQuery || ""}|${item.entertainmentType || ""}`;

  for (const item of items) {
    const type = item.entertainmentType;
    if (type && ENTERTAINMENT_TYPE_ORDER.includes(type as any) && !firstByType.has(type)) {
      firstByType.set(type, item);
    }
  }

  for (const type of ENTERTAINMENT_TYPE_ORDER) {
    const item = firstByType.get(type);
    if (!item) continue;
    const key = toKey(item);
    if (pickedKeys.has(key)) continue;
    pickedKeys.add(key);
    picks.push(item);
  }

  const rest = items.filter((item) => {
    const key = toKey(item);
    if (pickedKeys.has(key)) return false;
    pickedKeys.add(key);
    return true;
  });

  return [...picks, ...rest];
}

function normalizeIntlMobileEntertainmentType(
  item: {
    platform?: string;
    entertainmentType?: string;
    title?: string;
    description?: string;
    searchQuery?: string;
    tags?: string[];
  }
): "video" | "game" | "music" | "review" {
  const platform = String(item.platform || "");
  if (platform === "YouTube" || platform === "TikTok") return "video";
  if (platform === "MiniReview") return "game";
  if (platform === "Spotify") return "music";
  if (platform === "JustWatch" || platform === "Medium") return "review";

  const normalized =
    item.entertainmentType === "video" ||
    item.entertainmentType === "game" ||
    item.entertainmentType === "music" ||
    item.entertainmentType === "review"
      ? item.entertainmentType
      : inferEntertainmentType(item as any);
  if (normalized === "video" || normalized === "game" || normalized === "music" || normalized === "review") {
    return normalized;
  }
  return "video";
}

function enforceIntlMobileEntertainmentMix<T extends {
  platform?: string;
  entertainmentType?: string;
  title?: string;
  description?: string;
  reason?: string;
  tags?: string[];
  searchQuery?: string;
}>(
  items: T[]
): T[] {
  const normalized = (items || []).map((item) => {
    const platform = String(item.platform || "");
    const fixedType = normalizeIntlMobileEntertainmentType(item as any);
    const fixedPlatform =
      fixedType === "video"
        ? platform === "TikTok"
          ? "TikTok"
          : "YouTube"
        : fixedType === "game"
          ? "MiniReview"
          : fixedType === "music"
            ? "Spotify"
            : platform === "Medium"
              ? "Medium"
              : "JustWatch";
    return {
      ...item,
      entertainmentType: fixedType,
      platform: fixedPlatform,
    } as T;
  });

  const byType = {
    video: normalized.filter((item) => item.entertainmentType === "video"),
    game: normalized.filter((item) => item.entertainmentType === "game"),
    music: normalized.filter((item) => item.entertainmentType === "music"),
    review: normalized.filter((item) => item.entertainmentType === "review"),
  };

  const pickPlatform = (
    platform: "YouTube" | "TikTok" | "JustWatch" | "Spotify" | "Medium" | "MiniReview",
    fallbackType: "video" | "game" | "music" | "review",
    fallbackTitle: string,
    fallbackQuery: string,
    sourceTypeList?: T[]
  ): T => {
    const direct = normalized.find((item) => item.platform === platform);
    if (direct) return direct;
    const source = sourceTypeList?.[0];
    if (source) {
      return {
        ...source,
        platform,
        entertainmentType: fallbackType,
      } as T;
    }
    return {
      title: fallbackTitle,
      description: fallbackTitle,
      reason: "",
      tags: [],
      searchQuery: fallbackQuery,
      platform,
      entertainmentType: fallbackType,
    } as unknown as T;
  };

  const youtubeVideo = pickPlatform(
    "YouTube",
    "video",
    "Trending Shorts",
    "trending shorts",
    byType.video
  );
  const tiktokVideo = pickPlatform(
    "TikTok",
    "video",
    "TikTok Trends",
    "tiktok trends",
    byType.video
  );
  const justWatch = pickPlatform(
    "JustWatch",
    "review",
    "Top Movies & Shows",
    "top movies shows",
    byType.review
  );
  const spotify = pickPlatform(
    "Spotify",
    "music",
    "Top Songs Playlist",
    "top songs playlist",
    byType.music
  );
  const medium = pickPlatform(
    "Medium",
    "review",
    "Deep Entertainment Articles",
    "entertainment analysis",
    byType.review
  );
  const miniReview = pickPlatform(
    "MiniReview",
    "game",
    "Top Android Indie Games",
    "indie android games",
    byType.game
  );

  return [
    youtubeVideo,
    tiktokVideo,
    justWatch,
    spotify,
    medium,
    miniReview,
    ...normalized.filter((item) => ![youtubeVideo, tiktokVideo, justWatch, spotify, medium, miniReview].includes(item)),
  ];
}

function enforceIntlMobileEntertainmentLinkTypes<T extends { platform?: string; linkType?: string }>(items: T[]): T[] {
  return (items || []).map((item) => {
    const platform = String(item.platform || "");
    let linkType = item.linkType;
    if (platform === "YouTube" || platform === "TikTok") {
      linkType = "video";
    } else if (platform === "MiniReview") {
      linkType = "game";
    } else if (platform === "Spotify") {
      linkType = "music";
    } else if (platform === "JustWatch" || platform === "Medium") {
      linkType = "article";
    }
    return { ...item, linkType } as T;
  });
}

const FITNESS_REQUIRED_TYPES_WEB_CN = ["tutorial", "theory_article", "equipment"] as const;
const FITNESS_REQUIRED_TYPES_DEFAULT = ["nearby_place", "tutorial", "equipment"] as const;

function getFitnessRequiredTypes(isCnWeb: boolean) {
  return isCnWeb ? FITNESS_REQUIRED_TYPES_WEB_CN : FITNESS_REQUIRED_TYPES_DEFAULT;
}

function getFitnessTypeValue(item: any): string {
  return (item?.fitnessType as string) || identifyFitnessType(item) || "tutorial";
}

function prioritizeFitnessRecommendations<T extends { title?: string; searchQuery?: string; fitnessType?: string }>(
  items: T[],
  requiredTypes: readonly string[]
): T[] {
  const picks: T[] = [];
  const pickedKeys = new Set<string>();
  const firstByType = new Map<string, T>();

  const toKey = (item: T, type: string) => `${item.title || ""}|${item.searchQuery || ""}|${type}`;

  for (const item of items) {
    const type = getFitnessTypeValue(item);
    if (requiredTypes.includes(type) && !firstByType.has(type)) {
      firstByType.set(type, item);
    }
  }

  for (const type of requiredTypes) {
    const item = firstByType.get(type);
    if (!item) continue;
    const key = toKey(item, type);
    if (pickedKeys.has(key)) continue;
    pickedKeys.add(key);
    picks.push(item);
  }

  const rest = items.filter((item) => {
    const type = getFitnessTypeValue(item);
    const key = toKey(item, type);
    if (pickedKeys.has(key)) return false;
    pickedKeys.add(key);
    return true;
  });

  return [...picks, ...rest];
}

function pickFitnessKeyword(rec: { title?: string; tags?: string[]; metadata?: any }, fallback: string): string {
  const tags = (rec.tags || rec.metadata?.tags || []).filter((t: any) => typeof t === "string") as string[];
  const generic = [
    "健身",
    "训练",
    "教程",
    "跟练",
    "视频",
    "器材",
    "推荐",
    "原理",
    "课程",
    "动作",
    "入门",
    "进阶",
    "计划",
    "全身",
    "小白",
    "基础",
  ];

  for (const tag of tags) {
    const cleaned = tag.trim();
    if (!cleaned) continue;
    if (generic.some((word) => cleaned.includes(word))) continue;
    return cleaned.length > 8 ? cleaned.slice(0, 8) : cleaned;
  }

  const rawTitle = String(rec.title || "");
  if (!rawTitle) return fallback;
  const stripped = rawTitle
    .replace(/[^\w\u4e00-\u9fa5]+/g, " ")
    .replace(/(健身|训练|教程|跟练|视频|器材|推荐|原理|课程|动作|入门|进阶|计划|全身|小白|基础)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const candidate = stripped || rawTitle;
  return candidate.length > 8 ? candidate.slice(0, 8) : candidate;
}

function buildFitnessReason(
  rec: { title?: string; tags?: string[]; metadata?: any; fitnessType?: string },
  locale: "zh" | "en",
  isCnWeb: boolean
): string | null {
  if (!isCnWeb || locale !== "zh") return null;
  const type = getFitnessTypeValue(rec);

  const templates: Record<string, string[]> = {
    tutorial: [
      "围绕{keyword}的跟练，节奏清晰易上手",
      "{keyword}重点动作拆解，练得更稳",
      "短时{keyword}训练，适合碎片时间",
    ],
    theory_article: [
      "讲清{keyword}原理与常见误区，少走弯路",
      "{keyword}基础机制梳理，训练更有效",
      "从科学角度解释{keyword}，适合小白",
    ],
    equipment: [
      "{keyword}器材评测与选购要点，避坑省钱",
      "聚焦{keyword}器材入门搭配，性价比更清晰",
      "{keyword}器材使用重点，居家训练更方便",
    ],
    nearby_place: [
      "距离近+设备齐全，训练更容易坚持",
      "关注通风与器械配置，选馆更省心",
      "评价集中且设施完善，适合稳定打卡",
    ],
  };

  const fallbackKeyword = type === "equipment" ? "器材" : type === "nearby_place" ? "附近" : "训练";
  const keyword = pickFitnessKeyword(rec, fallbackKeyword) || fallbackKeyword;
  const pool = templates[type] || templates.tutorial;
  const seed = `${type}:${rec.title || ""}`;
  const index = Math.floor(stableHashToUnitInterval(seed) * pool.length);
  const template = pool[index] || pool[0];
  return template.replace("{keyword}", keyword);
}

function normalizeFitnessSearchQueryForCnWeb(query: string, fitnessType: string): string {
  let result = String(query || "").trim();
  if (!result) return result;
  const ensure = (tokens: string[], append: string) => {
    if (!tokens.some((token) => result.includes(token))) {
      result = `${result} ${append}`.trim();
    }
  };

  switch (fitnessType) {
    case "tutorial":
      ensure(["教程", "跟练", "训练", "视频"], "健身视频 跟练");
      break;
    case "theory_article":
      ensure(["原理", "机制", "科学", "小白", "误区"], "原理 科普 小白");
      break;
    case "equipment":
      ensure(["器材", "评测", "选购", "推荐", "使用要点"], "器材 评测 选购 推荐");
      break;
    default:
      break;
  }

  return result;
}

function getFitnessTypeLabel(
  fitnessType: string,
  locale: "zh" | "en",
  isCnWeb: boolean
): string | null {
  if (locale === "zh") {
    if (isCnWeb) {
      switch (fitnessType) {
        case "tutorial":
          return "健身视频推荐";
        case "theory_article":
          return "健身原理文章";
        case "equipment":
          return "健身器材推荐";
        case "nearby_place":
          return "附近健身场所";
        default:
          return null;
      }
    }
    switch (fitnessType) {
      case "tutorial":
        return "健身教程跟练";
      case "nearby_place":
        return "附近健身场所";
      case "equipment":
        return "器材评测推荐";
      case "theory_article":
        return "健身原理文章";
      case "video":
        return "健身视频课程";
      case "plan":
        return "健身训练计划";
      default:
        return null;
    }
  }

  switch (fitnessType) {
    case "tutorial":
      return "Fitness Tutorial";
    case "nearby_place":
      return "Nearby Fitness Place";
    case "equipment":
      return "Equipment Review";
    case "theory_article":
      return "Fitness Principles";
    case "video":
      return "Fitness Video Course";
    case "plan":
      return "Fitness Training Plan";
    default:
      return null;
  }
}

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

const REQUIRED_SHOPPING_PLATFORMS_CN_WEB = ["京东", "什么值得买", "慢慢买"] as const;
const REQUIRED_ENTERTAINMENT_PLATFORMS_INTL_MOBILE = [
  "YouTube",
  "TikTok",
  "JustWatch",
  "Spotify",
  "Medium",
  "MiniReview",
] as const;
const REQUIRED_SHOPPING_PLATFORMS_INTL_ANDROID = [
  "Amazon Shopping",
  "Amazon Shopping",
  "Etsy",
  "Etsy",
  "Slickdeals",
  "Pinterest",
] as const;
const REQUIRED_FOOD_PLATFORMS_INTL_ANDROID = [
  "DoorDash",
  "DoorDash",
  "Uber Eats",
  "Uber Eats",
  "Fantuan Delivery",
  "HungryPanda",
] as const;
const REQUIRED_TRAVEL_PLATFORMS_INTL_ANDROID = [
  "TripAdvisor",
  "Yelp",
  "Wanderlog",
  "Visit A City",
  "GetYourGuide",
  "Google Maps",
] as const;
const REQUIRED_FITNESS_PLATFORMS_INTL_ANDROID = [
  "Nike Training Club",
  "Peloton",
  "Strava",
  "Nike Run Club",
  "Hevy",
  "Strong",
  "Down Dog",
  "MyFitnessPal",
] as const;

function isIntlMobileEntertainmentContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
}): boolean {
  const { category, locale, isMobile } = params;
  return category === "entertainment" && locale === "en" && Boolean(isMobile);
}

export function isIntlAndroidShoppingContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return (
    category === "shopping" &&
    locale === "en" &&
    Boolean(isMobile) &&
    Boolean(isAndroid)
  );
}

export function isIntlAndroidFoodContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return (
    category === "food" &&
    locale === "en" &&
    Boolean(isMobile) &&
    Boolean(isAndroid)
  );
}

export function isIntlAndroidTravelContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return (
    category === "travel" &&
    locale === "en" &&
    Boolean(isMobile) &&
    Boolean(isAndroid)
  );
}

export function isIntlAndroidFitnessContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return (
    category === "fitness" &&
    locale === "en" &&
    Boolean(isMobile) &&
    Boolean(isAndroid)
  );
}

export function getRecommendationTargetCount(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
  requestedCount: number;
}): number {
  const { requestedCount } = params;
  if (isIntlMobileEntertainmentContext(params)) {
    return Math.max(requestedCount, REQUIRED_ENTERTAINMENT_PLATFORMS_INTL_MOBILE.length);
  }
  if (isIntlAndroidShoppingContext(params)) {
    return Math.max(requestedCount, REQUIRED_SHOPPING_PLATFORMS_INTL_ANDROID.length);
  }
  if (isIntlAndroidFoodContext(params)) {
    return Math.max(requestedCount, REQUIRED_FOOD_PLATFORMS_INTL_ANDROID.length);
  }
  if (isIntlAndroidTravelContext(params)) {
    return Math.max(requestedCount, REQUIRED_TRAVEL_PLATFORMS_INTL_ANDROID.length);
  }
  if (isIntlAndroidFitnessContext(params)) {
    return Math.max(requestedCount, REQUIRED_FITNESS_PLATFORMS_INTL_ANDROID.length);
  }
  return requestedCount;
}

function getEntertainmentPlatformOverride(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  index: number;
  count: number;
}): string | null {
  const { category, locale, isMobile, index, count } = params;
  if (!isIntlMobileEntertainmentContext({ category, locale, isMobile })) return null;
  if (count <= 0) return null;
  const max = Math.min(count, REQUIRED_ENTERTAINMENT_PLATFORMS_INTL_MOBILE.length);
  return index < max ? REQUIRED_ENTERTAINMENT_PLATFORMS_INTL_MOBILE[index] : null;
}

export function getShoppingPlatformOverride(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  client: "app" | "web";
  isMobile?: boolean;
  isAndroid?: boolean;
  index: number;
  count: number;
}): string | null {
  const { category, locale, client, isMobile, isAndroid, index, count } = params;
  if (isIntlAndroidShoppingContext({ category, locale, isMobile, isAndroid })) {
    if (count <= 0) return null;
    const max = Math.min(count, REQUIRED_SHOPPING_PLATFORMS_INTL_ANDROID.length);
    return index < max ? REQUIRED_SHOPPING_PLATFORMS_INTL_ANDROID[index] : null;
  }
  if (category !== "shopping" || locale !== "zh" || client !== "web") return null;
  if (count <= 0) return null;
  const max = Math.min(count, REQUIRED_SHOPPING_PLATFORMS_CN_WEB.length);
  return index < max ? REQUIRED_SHOPPING_PLATFORMS_CN_WEB[index] : null;
}

export function getFoodPlatformOverride(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
  index: number;
  count: number;
}): string | null {
  const { category, locale, isMobile, isAndroid, index, count } = params;
  if (!isIntlAndroidFoodContext({ category, locale, isMobile, isAndroid })) {
    return null;
  }
  if (count <= 0) return null;
  const max = Math.min(count, REQUIRED_FOOD_PLATFORMS_INTL_ANDROID.length);
  return index < max ? REQUIRED_FOOD_PLATFORMS_INTL_ANDROID[index] : null;
}

export function getTravelPlatformOverride(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
  index: number;
  count: number;
}): string | null {
  const { category, locale, isMobile, isAndroid, index, count } = params;
  if (!isIntlAndroidTravelContext({ category, locale, isMobile, isAndroid })) {
    return null;
  }
  if (count <= 0) return null;
  const max = Math.min(count, REQUIRED_TRAVEL_PLATFORMS_INTL_ANDROID.length);
  return index < max ? REQUIRED_TRAVEL_PLATFORMS_INTL_ANDROID[index] : null;
}

export function getFitnessPlatformOverride(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
  index: number;
  count: number;
}): string | null {
  const { category, locale, isMobile, isAndroid, index, count } = params;
  if (!isIntlAndroidFitnessContext({ category, locale, isMobile, isAndroid })) {
    return null;
  }
  if (count <= 0) return null;
  const max = Math.min(count, REQUIRED_FITNESS_PLATFORMS_INTL_ANDROID.length);
  return index < max ? REQUIRED_FITNESS_PLATFORMS_INTL_ANDROID[index] : null;
}

function resolveFoodPlatformForWebCN(rec: {
  title?: string;
  searchQuery?: string;
  tags?: string[];
  platform?: string;
}): string | null {
  const PLATFORM_RECIPE = "下厨房";
  const PLATFORM_REVIEW = "大众点评";
  const PLATFORM_AMAP = "高德地图";
  const PLATFORM_AMAP_FOOD = "高德地图美食";

  const suggested = typeof rec.platform === "string" ? rec.platform : "";
  if (suggested === PLATFORM_RECIPE) return PLATFORM_RECIPE;
  if (suggested === PLATFORM_REVIEW) return PLATFORM_REVIEW;
  if (suggested === PLATFORM_AMAP || suggested === PLATFORM_AMAP_FOOD) {
    return PLATFORM_AMAP_FOOD;
  }

  const tagsText = Array.isArray(rec.tags) ? rec.tags.join(" ") : "";
  const text = `${rec.title || ""} ${rec.searchQuery || ""} ${tagsText}`.trim();

  if (/(食谱|菜谱|做法|recipe)/i.test(text)) return PLATFORM_RECIPE;
  if (/(附近|周边|步行|地铁|商圈|街道)/.test(text)) {
    return PLATFORM_AMAP_FOOD;
  }
  if (/(点评|评价|口碑|评分)/.test(text)) return PLATFORM_REVIEW;

  return null;
}

function resolveTravelPlatformForWebCN(
  rec: {
    title?: string;
    description?: string;
    searchQuery?: string;
    tags?: string[];
  },
  index: number
): string | null {
  const tagsText = Array.isArray(rec.tags) ? rec.tags.join(" ") : "";
  const text = `${rec.title || ""} ${rec.description || ""} ${rec.searchQuery || ""} ${tagsText}`.trim();

  if (/(酒店|住宿|民宿|客栈|旅馆|度假村|机票|航班|机酒|高铁|火车票|动车票)/.test(text)) {
    return "携程";
  }

  if (/(攻略|指南|游记|路线|行程|避坑|预算|玩法|打卡|小众)/.test(text)) {
    return index % 2 === 0 ? "马蜂窝" : "穷游";
  }

  return null;
}

function buildAmapWebSearchUrl(query: string, geo: { lat: number; lng: number }): string {
  const radiusMeters = 2000;
  const latDelta = radiusMeters / 111000;
  const lngDelta = latDelta / Math.cos((geo.lat * Math.PI) / 180);
  const minLat = (geo.lat - latDelta).toFixed(6);
  const maxLat = (geo.lat + latDelta).toFixed(6);
  const minLng = (geo.lng - lngDelta).toFixed(6);
  const maxLng = (geo.lng + lngDelta).toFixed(6);
  const geoobj = `${minLng}|${minLat}|${maxLng}|${maxLat}`;
  return `https://www.amap.com/search?query=${encodeURIComponent(query)}&geoobj=${encodeURIComponent(geoobj)}&zoom=17`;
}

function selectWeightedPlatformForCategory(
  category: RecommendationCategory,
  locale: "zh" | "en",
  seed: string,
  client: "app" | "web",
  suggestedPlatform?: string,
  entertainmentType?: "video" | "game" | "music" | "review",
  isMobile?: boolean
): string | null {
  const isZh = locale === "zh";

  const candidates: WeightedCandidate[] | null = (() => {
    if (isZh) {
      switch (category) {
        case "food":
          return [
            ...(client === "app"
              ? ([
                  { platform: "大众点评", weight: 0.16 },
                  { platform: "小红书美食", weight: 0.14 },
                  { platform: "美团", weight: 0.12 },
                  { platform: "美团外卖", weight: 0.12 },
                  { platform: "京东秒送", weight: 0.12 },
                  { platform: "淘宝闪购", weight: 0.12 },
                  { platform: "高德地图美食", weight: 0.1 },
                  { platform: "百度地图美食", weight: 0.06 },
                  { platform: "腾讯地图美食", weight: 0.06 },
                ] satisfies WeightedCandidate[])
              : ([
                  { platform: "下厨房", weight: 0.35 },
                  { platform: "高德地图美食", weight: 0.25 },
                  { platform: "大众点评", weight: 0.25 },
                  { platform: "小红书美食", weight: 0.15 },
                ] satisfies WeightedCandidate[])),
          ];
        case "shopping":
          return [
            ...(client === "app"
              ? ([
                  { platform: "京东", weight: 0.3 },
                  { platform: "淘宝", weight: 0.3 },
                  { platform: "拼多多", weight: 0.2 },
                  { platform: "唯品会", weight: 0.2 },
                ] satisfies WeightedCandidate[])
              : ([
                  { platform: "京东", weight: 0.45 },
                  { platform: "什么值得买", weight: 0.3 },
                  { platform: "慢慢买", weight: 0.25 },
                ] satisfies WeightedCandidate[])),
          ];
        case "entertainment":
          if (client === "web" && suggestedPlatform === "笔趣阁") {
            return [{ platform: "笔趣阁", weight: 1 }];
          }
          switch (entertainmentType || "video") {
            case "video":
              return [
                ...(client === "app"
                  ? ([
                      { platform: "腾讯视频", weight: 0.34 },
                      { platform: "优酷", weight: 0.33 },
                      { platform: "爱奇艺", weight: 0.33 },
                    ] satisfies WeightedCandidate[])
                  : ([{ platform: "腾讯视频", weight: 1 }] satisfies WeightedCandidate[])),
              ];
            case "game":
              return [
                ...(client === "app"
                  ? ([{ platform: "TapTap", weight: 1 }] satisfies WeightedCandidate[])
                  : ([
                      { platform: "TapTap", weight: 0.5 },
                      { platform: "Steam", weight: 0.5 },
                    ] satisfies WeightedCandidate[])),
              ];
            case "music":
              return [
                ...(client === "app"
                  ? ([
                      { platform: "酷狗音乐", weight: 0.40 },
                      { platform: "网易云音乐", weight: 0.30 },
                      { platform: "QQ音乐", weight: 0.30 },
                    ] satisfies WeightedCandidate[])
                  : ([{ platform: "酷狗音乐", weight: 1 }] satisfies WeightedCandidate[])),
              ];
            case "review":
            default:
              return [
                ...(client === "app"
                  ? ([{ platform: "百度", weight: 1 }] satisfies WeightedCandidate[])
                  : ([{ platform: "笔趣阁", weight: 1 }] satisfies WeightedCandidate[])),
              ];
          }
        case "travel":
          return [
            ...(client === "app"
              ? ([
                  { platform: "携程", weight: 0.4 },
                  { platform: "去哪儿", weight: 0.3 },
                  { platform: "马蜂窝", weight: 0.3 },
                ] satisfies WeightedCandidate[])
              : ([
                  { platform: "携程", weight: 0.4 },
                  { platform: "马蜂窝", weight: 0.35 },
                  { platform: "穷游", weight: 0.25 },
                ] satisfies WeightedCandidate[])),
          ];
        case "fitness":
          return null;
        default:
          return null;
      }
    }

    // INTL mobile branch — prioritize platforms with native apps on Google Play
    if (isMobile) {
      switch (category) {
        case "entertainment":
          return [
            { platform: "YouTube", weight: 0.18 },
            { platform: "TikTok", weight: 0.18 },
            { platform: "JustWatch", weight: 0.16 },
            { platform: "Spotify", weight: 0.16 },
            { platform: "Medium", weight: 0.16 },
            { platform: "MiniReview", weight: 0.16 },
          ];
        case "shopping":
          return [
            { platform: "Amazon Shopping", weight: 0.30 },
            { platform: "Etsy", weight: 0.25 },
            { platform: "Slickdeals", weight: 0.25 },
            { platform: "Pinterest", weight: 0.20 },
          ];
        case "food":
          return [
            { platform: "DoorDash", weight: 0.30 },
            { platform: "Uber Eats", weight: 0.30 },
            { platform: "Fantuan Delivery", weight: 0.20 },
            { platform: "HungryPanda", weight: 0.20 },
          ];
        case "travel":
          return [
            { platform: "TripAdvisor", weight: 0.18 },
            { platform: "Yelp", weight: 0.18 },
            { platform: "Wanderlog", weight: 0.15 },
            { platform: "Visit A City", weight: 0.12 },
            { platform: "GetYourGuide", weight: 0.17 },
            { platform: "Google Maps", weight: 0.20 },
          ];
        case "fitness":
          return [
            { platform: "Nike Training Club", weight: 0.14 },
            { platform: "Peloton", weight: 0.14 },
            { platform: "Strava", weight: 0.13 },
            { platform: "Nike Run Club", weight: 0.11 },
            { platform: "Hevy", weight: 0.11 },
            { platform: "Strong", weight: 0.11 },
            { platform: "Down Dog", weight: 0.13 },
            { platform: "MyFitnessPal", weight: 0.13 },
          ];
        default:
          return null;
      }
    }

    // INTL web branch
    switch (category) {
      case "food":
        return [
          { platform: "Uber Eats", weight: 0.25 },
          { platform: "Google Maps", weight: 0.20 },
          { platform: "Yelp", weight: 0.20 },
          { platform: "Love and Lemons", weight: 0.15 },
          { platform: "YouTube", weight: 0.10 },
          { platform: "Google", weight: 0.10 },
        ];
      case "shopping":
        return [
          { platform: "Amazon", weight: 0.25 },
          { platform: "eBay", weight: 0.25 },
          { platform: "Walmart", weight: 0.25 },
          { platform: "Google Maps", weight: 0.15 },
          { platform: "Google", weight: 0.10 },
        ];
      case "entertainment":
        return [
          { platform: "YouTube", weight: 0.25 },
          { platform: "IMDb", weight: 0.20 },
          { platform: "Spotify", weight: 0.15 },
          { platform: "Steam", weight: 0.15 },
          { platform: "Metacritic", weight: 0.10 },
          { platform: "Netflix", weight: 0.10 },
          { platform: "Google", weight: 0.05 },
        ];
      case "travel":
        return [
          { platform: "Booking.com", weight: 0.25 },
          { platform: "TripAdvisor", weight: 0.25 },
          { platform: "YouTube", weight: 0.15 },
          { platform: "Google Maps", weight: 0.15 },
          { platform: "SANParks", weight: 0.10 },
          { platform: "Airbnb", weight: 0.10 },
        ];
      case "fitness":
        return [
          { platform: "YouTube Fitness", weight: 0.30 },
          { platform: "Muscle & Strength", weight: 0.25 },
          { platform: "Google Maps", weight: 0.15 },
          { platform: "MyFitnessPal", weight: 0.10 },
          { platform: "Peloton", weight: 0.10 },
          { platform: "Google", weight: 0.10 },
        ];
      default:
        return null;
    }
  })();

  if (!candidates || candidates.length === 0) return null;
  if (suggestedPlatform && candidates.some((c) => c.platform === suggestedPlatform)) {
    const boosted = candidates.map((candidate) =>
      candidate.platform === suggestedPlatform ? { ...candidate, weight: candidate.weight + 0.15 } : candidate
    );
    return pickWeightedPlatform(boosted, seed);
  }
  return pickWeightedPlatform(candidates, seed);
}

export async function GET(request: NextRequest, { params }: { params: { category: string } }) {
  try {
    const category = params.category as RecommendationCategory;

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

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "anonymous";
    const requestedCount = Math.min(parseInt(searchParams.get("count") || "5"), 10);
    const locale = (searchParams.get("locale") as "zh" | "en") || getLocale();
    const skipCache = searchParams.get("skipCache") === "true";
    const enableStreaming = searchParams.get("stream") === "true";
    const client = (searchParams.get("client") as "app" | "web" | null) || "web";
    const latRaw = searchParams.get("lat");
    const lngRaw = searchParams.get("lng");
    const geo =
      latRaw && lngRaw && Number.isFinite(Number(latRaw)) && Number.isFinite(Number(lngRaw))
        ? { lat: Number(latRaw), lng: Number(lngRaw) }
        : null;
    const isCnWeb = isChinaDeployment() && locale === "zh" && client === "web";
    const userAgent = request.headers.get("user-agent") || "";
    const isMobile = /iphone|ipad|ipod|android/i.test(userAgent);
    const isAndroid = /android/i.test(userAgent);
    const count = getRecommendationTargetCount({
      category,
      locale,
      isMobile,
      isAndroid,
      requestedCount,
    });

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

    let usageStats: Awaited<ReturnType<typeof getUserUsageStats>> | null = null;
    if (isValidUserId(userId)) {
      try {
        const usageCheck = await canUseRecommendation(userId);
        usageStats = usageCheck.stats;

        if (!usageCheck.allowed) {
          const stats = usageCheck.stats;
          const isMonthly = stats.periodType === "monthly";

          let errorMessage: string;
          let upgradeMessage: string;

          if (locale === "zh") {
            if (isMonthly) {
              errorMessage = `您已达到本月 ${stats.periodLimit} 次推荐限制`;
              upgradeMessage = "升级到 Pro 版获取每日 30 次推荐，或升级到企业版获取无限推荐";
            } else {
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
            { status: 429 }
          );
        }
      } catch (usageError) {
        console.warn("[Usage] Failed to check usage limit, allowing request:", usageError);
      }
    }

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

    const preferenceHash = generatePreferenceHash(userPreference, userHistory || []);
    const isAnonymous = userId === "anonymous";

    const shouldBypassCacheForIntlMobileEntertainment =
      isIntlMobileEntertainmentContext({ category, locale, isMobile });

    if (!skipCache && !isAnonymous && !shouldBypassCacheForIntlMobileEntertainment) {
      try {
        const cachedRecommendations = await getCachedRecommendations(category, preferenceHash);
        if (cachedRecommendations && cachedRecommendations.length > 0) {
          const shuffled = [...cachedRecommendations].sort(() => Math.random() - 0.5);
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
    }

    if (!isAIProviderConfigured()) {
      const fallbackRecs = await generateFallbackRecommendations({
        category,
        locale,
        count,
        client,
        geo,
        userHistory,
        userPreference,
        excludeTitles,
        isMobile,
        isAndroid,
      });

      const fallbackOutput = isIntlMobileEntertainmentContext({ category, locale, isMobile })
        ? enforceIntlMobileEntertainmentLinkTypes((fallbackRecs as any[]).slice(0, count))
        : fallbackRecs;

      return NextResponse.json({
        success: true,
        recommendations: fallbackOutput,
        source: "fallback",
      } satisfies AIRecommendResponse);
    }

    try {
      const computeValidatedRecommendations = async () => {
        const candidateCount = Math.min(20, Math.max(count * 3, 12));
        const aiRecommendations = await generateRecommendations(userHistory || [], category, locale, candidateCount, userPreference, {
          client,
          geo,
          avoidTitles: excludeTitles,
          signals: recommendationSignals,
          isMobile,
        });

        const shouldEnsureEntertainmentTypes = category === "entertainment" && locale === "zh" && client === "web" && isChinaDeployment();
        const shouldEnsureFitnessTypes = category === "fitness" && isCnWeb;
        const fitnessRequiredTypes = category === "fitness" ? getFitnessRequiredTypes(isCnWeb) : null;
        let processedRecommendations = aiRecommendations;

        if (category === "entertainment") {
          const diversity = analyzeEntertainmentDiversity(aiRecommendations);
          if (!diversity.isDiverse && diversity.missingTypes.length > 0) {
            const supplements = await supplementEntertainmentTypes(aiRecommendations, diversity.missingTypes, userHistory || [], locale);
            processedRecommendations = [...aiRecommendations, ...supplements];
          }
          if (shouldEnsureEntertainmentTypes) {
            processedRecommendations = prioritizeEntertainmentCandidates(processedRecommendations as any);
          }

          if (isIntlMobileEntertainmentContext({ category, locale, isMobile })) {
            processedRecommendations = enforceIntlMobileEntertainmentMix(processedRecommendations as any).slice(0, count) as any;
          }
        } else if (category === "fitness") {
          const fitnessValidation = validateFitnessRecommendationDiversity(
            aiRecommendations,
            (fitnessRequiredTypes || FITNESS_REQUIRED_TYPES_DEFAULT) as any
          );
          if (!fitnessValidation.isValid && fitnessValidation.missingTypes.length > 0) {
            const supplements = await supplementFitnessTypes(aiRecommendations, fitnessValidation.missingTypes, userHistory || [], locale);
            processedRecommendations = [...aiRecommendations, ...supplements];
          }
          if (shouldEnsureFitnessTypes && fitnessRequiredTypes) {
            processedRecommendations = prioritizeFitnessRecommendations(processedRecommendations as any, fitnessRequiredTypes);
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

          const topUps = await generateRecommendations(userHistory || [], category, locale, topUpCandidateCount, userPreference, {
            client,
            geo,
            avoidTitles: avoidTitlesForTopUp,
            signals: recommendationSignals,
            isMobile,
          });

          processedRecommendations = dedupeRecommendations([...(processedRecommendations as any[]), ...(topUps as any[])], {
            count,
            userHistory: userHistory as any,
            excludeTitles: avoidTitlesForTopUp,
            mode: "strict",
          });
        }

        if (isIntlMobileEntertainmentContext({ category, locale, isMobile })) {
          processedRecommendations = enforceIntlMobileEntertainmentMix(processedRecommendations as any).slice(0, count) as any;
        }

        if (shouldEnsureEntertainmentTypes) {
          const coverage = analyzeEntertainmentDiversity(processedRecommendations as any);
          if (coverage.missingTypes.length > 0) {
            const supplements = await supplementEntertainmentTypes(processedRecommendations as any, coverage.missingTypes, userHistory || [], locale);
            const merged = [...(processedRecommendations as any[]), ...(supplements as any[])];
            const filled = dedupeRecommendations(merged as any, {
              count: merged.length,
              userHistory: userHistory as any,
              excludeTitles,
              mode: "fill",
            });
            processedRecommendations = prioritizeEntertainmentCandidates(filled as any).slice(0, count) as any;
          } else {
            processedRecommendations = prioritizeEntertainmentCandidates(processedRecommendations as any);
          }
        }

        if (shouldEnsureFitnessTypes && fitnessRequiredTypes) {
          const coverage = validateFitnessRecommendationDiversity(processedRecommendations as any, fitnessRequiredTypes as any);
          if (coverage.missingTypes.length > 0) {
            const supplements = await supplementFitnessTypes(processedRecommendations as any, coverage.missingTypes, userHistory || [], locale);
            const merged = [...(processedRecommendations as any[]), ...(supplements as any[])];
            const filled = dedupeRecommendations(merged as any, {
              count: merged.length,
              userHistory: userHistory as any,
              excludeTitles,
              mode: "fill",
            });
            processedRecommendations = prioritizeFitnessRecommendations(filled as any, fitnessRequiredTypes).slice(0, count) as any;
          } else {
            processedRecommendations = prioritizeFitnessRecommendations(processedRecommendations as any, fitnessRequiredTypes);
          }
        }

        if (isIntlMobileEntertainmentContext({ category, locale, isMobile })) {
          processedRecommendations = enforceIntlMobileEntertainmentMix(processedRecommendations as any).slice(0, count) as any;
        }

        let webFoodReviewCount = 0;

        const finalRecommendations = processedRecommendations.map((rec, index) => {
          let enhancedRec = rec;

          if (category === "travel") {
            enhancedRec = enhanceTravelRecommendation(rec, locale);
          } else if (category === "fitness") {
            enhancedRec = enhanceFitnessRecommendation(rec, locale);
            if (isCnWeb) {
              const fitnessType = (enhancedRec as any).fitnessType || "tutorial";
              const adjustedQuery = normalizeFitnessSearchQueryForCnWeb(
                (enhancedRec.searchQuery || enhancedRec.title) as string,
                fitnessType
              );
              enhancedRec = { ...enhancedRec, searchQuery: adjustedQuery };
            }
          }

          const selectionSeed = `${userId || "anon"}:${category}:${index}:${enhancedRec.title}`;
          const weightedPlatform = selectWeightedPlatformForCategory(
            category,
            locale,
            selectionSeed,
            client,
            enhancedRec.platform,
            enhancedRec.entertainmentType,
            isMobile
          );

          const forcedEntertainmentPlatform = getEntertainmentPlatformOverride({
            category,
            locale,
            isMobile,
            index,
            count,
          });
          const forcedShoppingPlatform = getShoppingPlatformOverride({
            category,
            locale,
            client,
            isMobile,
            isAndroid,
            index,
            count,
          });
          const forcedFoodPlatform = getFoodPlatformOverride({
            category,
            locale,
            isMobile,
            isAndroid,
            index,
            count,
          });
          const forcedTravelPlatform = getTravelPlatformOverride({
            category,
            locale,
            isMobile,
            isAndroid,
            index,
            count,
          });
          const forcedFitnessPlatform = getFitnessPlatformOverride({
            category,
            locale,
            isMobile,
            isAndroid,
            index,
            count,
          });
          const forcedPlatform =
            forcedEntertainmentPlatform ||
            forcedShoppingPlatform ||
            forcedFoodPlatform ||
            forcedTravelPlatform ||
            forcedFitnessPlatform;
          const foodPlatformHint =
            category === "food" && locale === "zh" && client === "web" ? resolveFoodPlatformForWebCN(enhancedRec as any) : null;
          const travelPlatformHint =
            category === "travel" && locale === "zh" && client === "web"
              ? resolveTravelPlatformForWebCN(enhancedRec as any, index)
              : null;

          let platform: string;
          if (forcedPlatform) {
            platform = forcedPlatform;
          } else if (foodPlatformHint) {
            platform = foodPlatformHint;
          } else if (travelPlatformHint) {
            platform = travelPlatformHint;
          } else if (weightedPlatform) {
            platform = weightedPlatform;
          } else if (category === "food") {
            platform = selectFoodPlatformWithRotation(index, enhancedRec.platform, locale);
          } else if (category === "fitness") {
            const fitnessType = (enhancedRec as any).fitnessType || "tutorial";
            if (isCnWeb) {
              if (fitnessType === "theory_article") {
                platform = "知乎";
              } else if (fitnessType === "equipment") {
                platform = "什么值得买";
              } else if (fitnessType === "tutorial") {
                platform = "B站健身";
              } else if (fitnessType === "nearby_place") {
                platform = locale === "zh" ? (index % 2 === 0 ? "美团" : "高德地图健身") : "Google Maps";
              } else {
                platform = selectFitnessPlatform(fitnessType, enhancedRec.platform, locale);
              }
            } else {
              const titleText = typeof enhancedRec.title === "string" ? enhancedRec.title : "";
              const tags = Array.isArray(enhancedRec.tags) ? enhancedRec.tags : [];
              const looksLikeTheory =
                client === "web" &&
                (/(原理|科学|机制|为什么|误区|入门)/.test(titleText) ||
                  tags.some((t) => typeof t === "string" && /(原理|科学|机制|误区|入门)/.test(t)));
              if (looksLikeTheory || fitnessType === "theory_article") {
                platform = locale === "zh" ? "知乎" : "Muscle & Strength";
              } else if (client === "web" && fitnessType === "equipment") {
                platform = "什么值得买";
              } else if (fitnessType === "tutorial") {
                platform = locale === "zh" ? "B站健身" : "YouTube Fitness";
              } else if (fitnessType === "nearby_place") {
                platform = locale === "zh" ? (index % 2 === 0 ? "美团" : "高德地图健身") : "Google Maps";
              } else {
                platform = selectFitnessPlatform(fitnessType, enhancedRec.platform, locale);
              }
            }
          } else {
            platform = selectBestPlatform(category, enhancedRec.platform, locale, enhancedRec.entertainmentType, isMobile);
          }

          if (category === "food" && locale === "zh" && client === "web") {
            const tagsText = Array.isArray((enhancedRec as any).tags) ? (enhancedRec as any).tags.join(" ") : "";
            const text = `${enhancedRec.title || ""} ${enhancedRec.searchQuery || ""} ${tagsText}`.trim();
            const looksLikeRecipe = /(食谱|菜谱|做法|recipe)/i.test(text);

            if (looksLikeRecipe) {
              platform = "下厨房";
            } else if (platform === "大众点评") {
              if (webFoodReviewCount >= 1) {
                platform = "高德地图美食";
              } else {
                webFoodReviewCount += 1;
              }
            } else if (platform !== "高德地图美食" && platform !== "下厨房") {
              platform = geo ? "高德地图美食" : "下厨房";
            }
          }

          let searchQueryForLink = (enhancedRec.searchQuery || enhancedRec.title) as string;
          if (category === "travel" && locale === "zh") {
            const titleText = String(enhancedRec.title || "");
            if (shouldUseTitleForTravelQuery(searchQueryForLink, titleText)) {
              searchQueryForLink = titleText;
            }
            if (platform === "\u7a77\u6e38") {
              searchQueryForLink = extractTravelLandmark(searchQueryForLink);
            }
          }

          // 购物类目：在搜索词中附加用户画像的预算范围（京东、淘宝、拼多多、唯品会）
          if (category === "shopping" && ["京东", "淘宝", "拼多多", "唯品会"].includes(platform)) {
            const budgetHint = getShoppingBudgetHint(userPreference);
            if (budgetHint && !searchQueryForLink.includes(budgetHint)) {
              searchQueryForLink = `${searchQueryForLink} ${budgetHint}`;
            }
          }
          searchQueryForLink = sanitizeSearchQueryForLink({
            category,
            entertainmentType: enhancedRec.entertainmentType,
            platform,
            locale,
            title: String(enhancedRec.title || ""),
            searchQuery: searchQueryForLink,
          });

          let searchLink = generateSearchLink(
            enhancedRec.title,
            searchQueryForLink,
            platform,
            locale,
            category,
            enhancedRec.entertainmentType
          );

          // 京东：在 web URL 上追加价格过滤参数（app/web 模式均适用，影响 web fallback 链接）
          if (category === "shopping" && platform === "京东" && locale === "zh") {
            const range = getShoppingBudgetRange(userPreference);
            if (range) {
              try {
                const url = new URL(searchLink.url);
                if (url.hostname === "search.jd.com" && url.pathname === "/Search") {
                  const ev = `exprice_${range.min}-${range.max}^`;
                  if (!url.searchParams.get("ev")) {
                    url.searchParams.set("ev", ev);
                  }
                  if (!url.searchParams.get("pricefrom")) {
                    url.searchParams.set("pricefrom", String(range.min));
                  }
                  if (!url.searchParams.get("priceto") && range.max < 1000000) {
                    url.searchParams.set("priceto", String(range.max));
                  }
                  searchLink = { ...searchLink, url: url.toString() };
                }
              } catch {}
            }
          }

          if (geo && locale === "zh") {
            const baseQuery = searchQueryForLink;
            const mapQuery =
              platform === "百度地图美食" || platform === "高德地图美食" || platform === "腾讯地图美食"
                ? baseQuery
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
                url:
                  client === "web"
                    ? buildAmapWebSearchUrl(mapQuery, geo)
                    : `https://uri.amap.com/search?keyword=${encodeURIComponent(mapQuery)}&center=${encodeURIComponent(
                      `${geo.lng},${geo.lat}`
                    )}&radius=2000`,
              };
            }
          }

          let linkType: LinkType = "search";

          if (category === "travel") {
            linkType = "location";
          } else if (category === "fitness") {
            const fitnessType = (enhancedRec as any).fitnessType || "tutorial";

            switch (fitnessType) {
              case "tutorial":
                linkType = "video";
                break;
              case "nearby_place":
                linkType = "location";
                break;
              case "equipment":
                if (platform === "什么值得买") {
                  linkType = "product";
                } else if (
                  platform === "B站健身" ||
                  platform === "优酷健身" ||
                  platform === "YouTube" ||
                  platform === "YouTube Fitness"
                ) {
                  linkType = "video";
                } else {
                  linkType = "search";
                }
                break;
              case "theory_article":
                linkType = "article";
                break;
              default:
                if (platform === "YouTube" || platform === "YouTube Fitness") {
                  linkType = "video";
                } else if (platform === "Keep" || platform === "Peloton") {
                  linkType = "app";
                } else if (platform === "小红书" || platform === "知乎") {
                  linkType = "article";
                } else if (
                  platform === "百度地图健身" ||
                  platform === "高德地图健身" ||
                  platform === "腾讯地图健身" ||
                  platform === "大众点评" ||
                  platform === "美团"
                ) {
                  linkType = "location";
                } else {
                  linkType = "search";
                }
            }
          } else if (category === "entertainment") {
            const gamePlatforms = [
              "Steam",
              "TapTap",
              "Epic Games",
              "WeGame",
              "杉果",
              "小黑盒",
              "3DM",
              "游民星空",
              "B站游戏",
              "4399小游戏",
              "PlayStation Store",
              "Xbox Store",
              "Nintendo eShop",
              "GOG",
              "Humble Bundle",
              "itch.io",
              "Game Pass",
              "Green Man Gaming",
              "MiniReview",
            ];

            if (
              platform === "B站" ||
              platform === "YouTube" ||
              platform === "TikTok" ||
              platform === "爱奇艺" ||
              platform === "腾讯视频" ||
              platform === "优酷" ||
              platform === "Netflix"
            ) {
              linkType = "video";
            } else if (gamePlatforms.includes(platform) || enhancedRec.entertainmentType === "game") {
              linkType = "game";
            } else if (
              platform === "酷狗音乐" ||
              platform === "QQ音乐" ||
              platform === "网易云音乐" ||
              platform === "Spotify"
            ) {
              linkType = "music";
            } else if (platform === "豆瓣" || platform === "IMDb" || platform === "JustWatch" || platform === "Medium") {
              linkType = "article";
            } else if (platform === "笔趣阁") {
              linkType = "book";
            }
          } else if (category === "shopping") {
            linkType = "product";
          } else if (category === "food") {
            if (
              platform === "大众点评" ||
              platform === "美团" ||
              platform === "TripAdvisor" ||
              platform === "OpenTable" ||
              platform === "百度地图" ||
              platform === "百度地图美食" ||
              platform === "高德地图美食" ||
              platform === "腾讯地图美食" ||
              platform === "Google Maps"
            ) {
              linkType = "restaurant";
            } else if (platform === "下厨房" || platform === "Allrecipes") {
              linkType = "recipe";
            } else {
              linkType = "article";
            }
          }

          const region = isChinaDeployment() ? "CN" : "INTL";
          const providerForCandidateLink = mapSearchPlatformToProvider(platform, locale);
          const candidateLink = resolveCandidateLink({
            title: enhancedRec.title,
            query: searchQueryForLink,
            category,
            locale,
            region,
            provider: providerForCandidateLink,
            isMobile,
          });

          const reasonOverride =
            category === "fitness" ? buildFitnessReason(enhancedRec as any, locale, isCnWeb) : null;

          const baseRecommendation = {
            title: enhancedRec.title,
            description: enhancedRec.description,
            reason: clampRecommendationReason(reasonOverride || enhancedRec.reason, locale),
            tags: enhancedRec.tags,
            link: searchLink.url,
            platform: searchLink.displayName,
            linkType: linkType,
            category: category,
            candidateLink,
            metadata: {
              searchQuery: searchQueryForLink,
              originalPlatform: enhancedRec.platform,
              isSearchLink: true,
              tags: enhancedRec.tags,
            },
          };

          if (category === "entertainment" && enhancedRec.entertainmentType) {
            (baseRecommendation as any).entertainmentType = enhancedRec.entertainmentType;
          }

          if (category === "fitness" && (enhancedRec as any).fitnessType) {
            const metadata = baseRecommendation.metadata as any;
            const fitnessType = (enhancedRec as any).fitnessType;
            metadata.fitnessType = fitnessType;
            const label = getFitnessTypeLabel(fitnessType, locale, isCnWeb);
            if (label) metadata.fitnessTypeLabel = label;
          }

          if (category === "travel") {
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

        const validatedRecommendations = validateAndFixPlatforms(finalRecommendations, locale);
        return validatedRecommendations;
      };

      if (enableStreaming) {
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            let eventId = 0;
            const send = (event: string, data: any) => {
              const payload = `id: ${eventId++}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(payload));
            };

            try {
              const warmupCount = Math.max(1, Math.min(2, count));
              const warmupRecs = await generateFallbackRecommendations({
                category,
                locale,
                count: warmupCount,
                client,
                geo,
                userHistory,
                userPreference,
                excludeTitles,
                isMobile,
                isAndroid,
              });

              send("recommend", {
                type: "partial",
                phase: "warmup",
                recommendations: warmupRecs,
                index: 0,
                total: warmupRecs.length,
                source: "warmup",
              });

              const validatedRecommendations = await computeValidatedRecommendations();
              const selectedRecommendations = validatedRecommendations.slice(0, count);

              for (let i = 0; i < selectedRecommendations.length; i += 1) {
                send("recommend", {
                  type: "partial",
                  phase: "ai",
                  recommendations: [selectedRecommendations[i]],
                  index: i,
                  total: selectedRecommendations.length,
                  source: "ai",
                });
              }

              let usageInfo = null;
              if (usageStats) {
                usageInfo = {
                  current: usageStats.currentPeriodUsage + 1,
                  limit: usageStats.periodLimit,
                  remaining: usageStats.isUnlimited ? -1 : Math.max(0, usageStats.remainingUsage - 1),
                  periodType: usageStats.periodType,
                  periodEnd: usageStats.periodEnd.toISOString(),
                  isUnlimited: usageStats.isUnlimited,
                };
              }

              const streamCompleteRecs = selectedRecommendations.length > 0 ? selectedRecommendations : warmupRecs;

              send("recommend", {
                type: "complete",
                phase: "ai",
                recommendations: streamCompleteRecs,
                index: selectedRecommendations.length,
                total: selectedRecommendations.length,
                source: selectedRecommendations.length > 0 ? "ai" : "fallback",
                ...(usageInfo && { usage: usageInfo }),
              });

              if (isValidUserId(userId) && selectedRecommendations.length > 0) {
                Promise.all([
                  saveRecommendationsToHistory(userId, selectedRecommendations),
                  updateUserPreferences(userId, category, { incrementView: true }),
                  recordRecommendationUsage(userId, { category, count: selectedRecommendations.length }),
                ]).catch((err) => {
                  console.error(`[Stream Save] Failed to save:`, err);
                });
              }

              if (!isAnonymous) {
                cacheRecommendations(category, preferenceHash, selectedRecommendations, 30).catch((err) => {
                  console.error("[Stream Cache] Failed to cache:", err);
                });
              }
            } catch (err) {
              const fallbackRecs = await generateFallbackRecommendations({
                category,
                locale,
                count,
                client,
                geo,
                userHistory,
                userPreference,
                excludeTitles,
                isMobile,
                isAndroid,
              });

              send("error", {
                type: "error",
                message: err instanceof Error ? err.message : String(err || ""),
              });

              send("recommend", {
                type: "complete",
                phase: "fallback",
                recommendations: fallbackRecs,
                index: 0,
                total: fallbackRecs.length,
                source: "fallback",
              });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      }

      const validatedRecommendations = await computeValidatedRecommendations();

      if (isValidUserId(userId) && validatedRecommendations.length > 0) {
        Promise.all([
          saveRecommendationsToHistory(userId, validatedRecommendations),
          updateUserPreferences(userId, category, { incrementView: true }),
          recordRecommendationUsage(userId, { category, count: validatedRecommendations.length }),
        ]).catch((err) => {
          console.error(`[Save] Failed to save recommendations:`, err);
        });
      }

      if (!isAnonymous) {
        cacheRecommendations(category, preferenceHash, validatedRecommendations, 30).catch((err) => {
          console.error("[Cache] Failed to cache recommendations:", err);
        });
      }

      let usageInfo = null;
      if (usageStats) {
        usageInfo = {
          current: usageStats.currentPeriodUsage + 1,
          limit: usageStats.periodLimit,
          remaining: usageStats.isUnlimited ? -1 : Math.max(0, usageStats.remainingUsage - 1),
          periodType: usageStats.periodType,
          periodEnd: usageStats.periodEnd.toISOString(),
          isUnlimited: usageStats.isUnlimited,
        };
      }

      const finalOutput = isIntlMobileEntertainmentContext({ category, locale, isMobile })
        ? enforceIntlMobileEntertainmentLinkTypes(validatedRecommendations.slice(0, count) as any)
        : validatedRecommendations.slice(0, count);

      return NextResponse.json({
        success: true,
        recommendations: finalOutput,
        source: "ai",
        ...(usageInfo && { usage: usageInfo }),
      } satisfies AIRecommendResponse);
    } catch (aiError) {
      console.error("AI recommendation failed:", aiError);

      const fallbackRecs = await generateFallbackRecommendations({
        category,
        locale,
        count,
        client,
        geo,
        userHistory,
        userPreference,
        excludeTitles,
        isMobile,
        isAndroid,
      });

      const fallbackOutput = isIntlMobileEntertainmentContext({ category, locale, isMobile })
        ? enforceIntlMobileEntertainmentLinkTypes((fallbackRecs as any[]).slice(0, count))
        : fallbackRecs;

      return NextResponse.json({
        success: true,
        recommendations: fallbackOutput,
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

function clampRecommendationReason(value: unknown, locale: "zh" | "en") {
  const raw = typeof value === "string" ? value : value == null ? "" : String(value);
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return locale === "zh" ? "结合你的偏好与近期行为筛选" : "Picked based on your preferences and recent interactions";
  }
  const limit = locale === "zh" ? 50 : 120;
  const sliced = Array.from(normalized).slice(0, limit).join("");
  return sliced.trim();
}

function getShoppingBudgetHint(userPreference: Awaited<ReturnType<typeof getUserCategoryPreference>> | null) {
  const raw = (userPreference as any)?.preferences?.price_range;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value.trim()) return "";
  const key = value.trim();
  if (/[元￥$]/.test(key) || /\d/.test(key)) return key;
  const map: Record<string, string> = {
    under_50: "50元以下",
    "50_200": "50-200元",
    "200_500": "200-500元",
    "500_1000": "500-1000元",
    over_1000: "1000元以上",
  };
  return map[key] || "";
}

function getShoppingBudgetRange(userPreference: Awaited<ReturnType<typeof getUserCategoryPreference>> | null) {
  const raw = (userPreference as any)?.preferences?.price_range;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  const map: Record<string, { min: number; max: number }> = {
    under_50: { min: 0, max: 50 },
    "50_200": { min: 50, max: 200 },
    "200_500": { min: 200, max: 500 },
    "500_1000": { min: 500, max: 1000 },
  };
  if (map[normalized]) return map[normalized];

  const rangeMatch = normalized.match(/(\d+)\s*[-~]\s*(\d+)\s*(元|￥|RMB)?/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max > min) {
      return { min, max };
    }
  }

  const underMatch = normalized.match(/(\d+)\s*(元|￥|RMB)?\s*以下/);
  if (underMatch) {
    const max = Number(underMatch[1]);
    if (Number.isFinite(max) && max > 0) return { min: 0, max };
  }

  const overMatch = normalized.match(/(\d+)\s*(元|￥|RMB)?\s*以上/);
  if (overMatch) {
    const min = Number(overMatch[1]);
    if (Number.isFinite(min) && min >= 0) return { min, max: 1000000 };
  }

  if (normalized === "over_1000") return { min: 1000, max: 1000000 };
  return null;
}

function normalizeQueryBase(value: string): string {
  return String(value || "")
    .replace(/[【】[\]（）(){}<>《》]/g, " ")
    .replace(/[“”"'‘’`]/g, " ")
    .replace(/[|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripQueryTokens(value: string, tokens: string[], wordBoundary = false): string {
  let result = value;
  for (const token of tokens) {
    if (!token) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = wordBoundary ? `\\b${escaped}\\b` : escaped;
    result = result.replace(new RegExp(pattern, "gi"), " ");
  }
  return normalizeQueryBase(result);
}

function shouldUseTitleForTravelQuery(searchQuery: string, title: string): boolean {
  const query = normalizeQueryBase(searchQuery);
  const titleText = normalizeQueryBase(title);
  if (!query) return true;
  if (!titleText) return false;

  if (/^(中国|国内|国外|热门)$/.test(query)) return true;
  if (/中国/.test(query) && /(旅游|景点|公园)/.test(query) && query.length <= 8) return true;

  const segments = String(title || "")
    .split(/[·・]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length >= 2) {
    const landmark = segments[segments.length - 1];
    if (landmark && !query.includes(landmark)) return true;
  }

  if (query.length <= 4 && titleText.length > query.length + 2) return true;
  return false;
}

function extractTravelLandmark(value: string): string {
  const segments = String(value || "")
    .split(/[·・]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : String(value || "");
}

function sanitizeSearchQueryForLink(params: {
  category: RecommendationCategory;
  entertainmentType?: "video" | "game" | "music" | "review";
  platform: string;
  locale: "zh" | "en";
  title: string;
  searchQuery?: string | null;
}): string {
  const { category, entertainmentType, platform, locale, title, searchQuery } = params;
  const base = normalizeQueryBase(searchQuery || title);
  if (!base) return base;
  if (category === "food" && locale === "zh") {
    let query = base;
    query = stripQueryTokens(query, ["美食", "餐厅"]);
    return query || normalizeQueryBase(title) || base;
  }
  if (category !== "entertainment" || !entertainmentType) return base;

  let query = base;

  if (locale === "zh") {
    if (entertainmentType === "video" && ["腾讯视频", "优酷", "爱奇艺"].includes(platform)) {
      query = stripQueryTokens(query, ["豆瓣", "评分", "影评", "解析", "在线观看", "在线播放"]);
      query = stripQueryTokens(query, ["douban", "imdb", "rottentomatoes", "metacritic"], true);
    }

    if (
      entertainmentType === "game" &&
      ["Steam", "TapTap", "WeGame", "杉果", "小黑盒", "3DM", "游民星空", "B站游戏", "4399小游戏"].includes(platform)
    ) {
      const titleText = normalizeQueryBase(title);
      query = titleText || query;
      query = stripQueryTokens(query, ["Steam", "TapTap", "WeGame", "Epic", "GOG", "Xbox", "PlayStation", "Nintendo"], true);
      query = stripQueryTokens(query, ["中文版", "汉化", "破解版", "下载", "购买", "攻略", "评测", "官网", "免费"]);
      if (platform === "Steam") {
        const asciiOnly = normalizeQueryBase(query.replace(/[^\x00-\x7F]+/g, " "));
        if (asciiOnly.length >= 3) {
          query = asciiOnly;
        }
      }
    }

    if (entertainmentType === "music" && ["酷狗音乐", "QQ音乐", "网易云音乐"].includes(platform)) {
      query = stripQueryTokens(query, ["酷狗", "QQ音乐", "网易云音乐"]);
      query = stripQueryTokens(query, ["kugou", "qqmusic", "netease"], true);
    }

    if (entertainmentType === "review" && platform === "笔趣阁") {
      const titleText = normalizeQueryBase(title);
      query = titleText || query;
      query = stripQueryTokens(query, ["笔趣阁", "小说", "网文", "全文", "下载", "TXT", "阅读", "免费", "完结", "最新"]);
    }
  } else if (entertainmentType === "game" && platform === "Steam") {
    const titleText = normalizeQueryBase(title);
    query = titleText || query;
    query = stripQueryTokens(query, ["Steam"], true);
  } else if (entertainmentType === "game" && platform === "MiniReview") {
    query = stripQueryTokens(query, ["MiniReview"], true);
    query = stripQueryTokens(query, ["review", "reviews", "rating", "ratings", "best android games"], true);
  }

  return query || normalizeQueryBase(title) || base;
}

async function generateFallbackRecommendations(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  count: number;
  client: "app" | "web";
  geo: { lat: number; lng: number } | null;
  userHistory: Awaited<ReturnType<typeof getUserRecommendationHistory>>;
  userPreference: Awaited<ReturnType<typeof getUserCategoryPreference>> | null;
  excludeTitles: string[];
  isMobile?: boolean;
  isAndroid?: boolean;
}) {
  const {
    category,
    client,
    count,
    excludeTitles,
    geo,
    locale,
    userHistory,
    userPreference,
    isMobile,
    isAndroid,
  } = params;
  const isCnWeb = isChinaDeployment() && locale === "zh" && client === "web";
  const limitedRecs = generateFallbackCandidates({
    category,
    locale,
    count,
    client,
    userPreference: userPreference as any,
    userHistory: userHistory as any,
    excludeTitles,
  });

  let webFoodReviewCount = 0;

  const seededRecs = isIntlMobileEntertainmentContext({ category, locale, isMobile })
    ? enforceIntlMobileEntertainmentMix(limitedRecs as any).slice(0, count)
    : limitedRecs;

  return seededRecs.map((rec, index) => {
    let enhancedRec = category === "travel" ? enhanceTravelRecommendation(rec, locale) : rec;
    if (category === "fitness") {
      enhancedRec = enhanceFitnessRecommendation(rec, locale);
      if (isCnWeb) {
        const fitnessType = (enhancedRec as any).fitnessType || "tutorial";
        const adjustedQuery = normalizeFitnessSearchQueryForCnWeb(
          (enhancedRec.searchQuery || enhancedRec.title) as string,
          fitnessType
        );
        enhancedRec = { ...enhancedRec, searchQuery: adjustedQuery };
      }
    }
    const selectionSeed = `fallback:${category}:${index}:${enhancedRec.title}`;
      const fallbackRec = enhancedRec as any;
      const weightedPlatform = selectWeightedPlatformForCategory(
        category as RecommendationCategory,
        locale,
        selectionSeed,
        client,
        enhancedRec.platform,
        fallbackRec.entertainmentType,
        isMobile
      );

    const forcedEntertainmentPlatform = getEntertainmentPlatformOverride({
      category: category as RecommendationCategory,
      locale,
      isMobile,
      index,
      count,
    });
    const forcedShoppingPlatform = getShoppingPlatformOverride({
      category: category as RecommendationCategory,
      locale,
      client,
      isMobile,
      isAndroid,
      index,
      count,
      });
    const forcedFoodPlatform = getFoodPlatformOverride({
      category: category as RecommendationCategory,
      locale,
      isMobile,
      isAndroid,
      index,
      count,
    });
    const forcedTravelPlatform = getTravelPlatformOverride({
      category: category as RecommendationCategory,
      locale,
      isMobile,
      isAndroid,
      index,
      count,
    });
    const forcedFitnessPlatform = getFitnessPlatformOverride({
      category: category as RecommendationCategory,
      locale,
      isMobile,
      isAndroid,
      index,
      count,
    });
    const forcedPlatform =
      forcedEntertainmentPlatform ||
      forcedShoppingPlatform ||
      forcedFoodPlatform ||
      forcedTravelPlatform ||
      forcedFitnessPlatform;
    const foodPlatformHint =
      category === "food" && locale === "zh" && client === "web" ? resolveFoodPlatformForWebCN(enhancedRec as any) : null;
    const travelPlatformHint =
      category === "travel" && locale === "zh" && client === "web"
        ? resolveTravelPlatformForWebCN(enhancedRec as any, index)
        : null;

    let platform: string;
    if (forcedPlatform) {
      platform = forcedPlatform;
    } else if (foodPlatformHint) {
      platform = foodPlatformHint;
    } else if (travelPlatformHint) {
      platform = travelPlatformHint;
    } else if (weightedPlatform) {
      platform = weightedPlatform;
    } else if (category === "food") {
      platform = selectFoodPlatformWithRotation(index, enhancedRec.platform, locale);
      } else if (category === "fitness") {
        const fitnessType = fallbackRec.fitnessType || "tutorial";
      if (isCnWeb) {
        if (fitnessType === "theory_article") {
          platform = "知乎";
        } else if (fitnessType === "equipment") {
          platform = "什么值得买";
        } else if (fitnessType === "tutorial") {
          platform = "B站健身";
        } else if (fitnessType === "nearby_place") {
          platform = locale === "zh" ? (index % 2 === 0 ? "美团" : "高德地图健身") : "Google Maps";
        } else {
          platform = selectFitnessPlatform(fitnessType as any, enhancedRec.platform || "", locale);
        }
      } else {
        const titleText = typeof enhancedRec.title === "string" ? enhancedRec.title : "";
        const tags = Array.isArray((enhancedRec as any).tags) ? ((enhancedRec as any).tags as any[]) : [];
        const looksLikeTheory =
          client === "web" &&
          (/(原理|科学|机制|为什么|误区|入门)/.test(titleText) ||
            tags.some((t) => typeof t === "string" && /(原理|科学|机制|误区|入门)/.test(t)));
        if (looksLikeTheory || fitnessType === "theory_article") {
          platform = locale === "zh" ? "知乎" : "Muscle & Strength";
        } else if (client === "web" && fitnessType === "equipment") {
          platform = "什么值得买";
        } else if (fitnessType === "tutorial") {
          platform = locale === "zh" ? "B站健身" : "YouTube Fitness";
        } else if (fitnessType === "nearby_place") {
          platform = locale === "zh" ? (index % 2 === 0 ? "美团" : "高德地图健身") : "Google Maps";
        } else {
          platform = selectFitnessPlatform(fitnessType as any, enhancedRec.platform || "", locale);
        }
      }
    } else {
      platform = selectBestPlatform(category, enhancedRec.platform || "", locale, fallbackRec.entertainmentType, isMobile);
    }

    if (category === "food" && locale === "zh" && client === "web") {
      const tagsText = Array.isArray((enhancedRec as any).tags) ? (enhancedRec as any).tags.join(" ") : "";
      const text = `${enhancedRec.title || ""} ${enhancedRec.searchQuery || ""} ${tagsText}`.trim();
      const looksLikeRecipe = /(食谱|菜谱|做法|recipe)/i.test(text);

      if (looksLikeRecipe) {
        platform = "下厨房";
      } else if (platform === "大众点评") {
        if (webFoodReviewCount >= 1) {
          platform = "高德地图美食";
        } else {
          webFoodReviewCount += 1;
        }
      } else if (platform !== "高德地图美食" && platform !== "下厨房") {
        platform = geo ? "高德地图美食" : "下厨房";
      }
    }

    let searchQueryForLink = enhancedRec.searchQuery || enhancedRec.title;
    if (category === "travel" && locale === "zh") {
      const titleText = String(enhancedRec.title || "");
      if (shouldUseTitleForTravelQuery(searchQueryForLink as string, titleText)) {
        searchQueryForLink = titleText;
      }
      if (platform === "\u7a77\u6e38") {
        searchQueryForLink = extractTravelLandmark(searchQueryForLink as string);
      }
    }

    searchQueryForLink = sanitizeSearchQueryForLink({
      category,
      entertainmentType: fallbackRec.entertainmentType,
      platform,
      locale,
      title: String(enhancedRec.title || ""),
      searchQuery: searchQueryForLink as string,
    });

    let searchLink = generateSearchLink(
      String(enhancedRec.title || ""),
      String(searchQueryForLink || ""),
      platform,
      locale,
      category,
      fallbackRec.entertainmentType
    );
    if (geo && locale === "zh") {
      const baseQuery = searchQueryForLink || ((enhancedRec.searchQuery || enhancedRec.title) as string);
      const mapQuery =
        platform === "百度地图美食" || platform === "高德地图美食" || platform === "腾讯地图美食"
          ? baseQuery
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
          url:
            client === "web"
              ? buildAmapWebSearchUrl(mapQuery, geo)
              : `https://uri.amap.com/search?keyword=${encodeURIComponent(mapQuery)}&center=${encodeURIComponent(
                `${geo.lng},${geo.lat}`
              )}&radius=2000`,
        };
      }
    }

    const region = isChinaDeployment() ? "CN" : "INTL";
    const providerForCandidateLink = mapSearchPlatformToProvider(platform, locale);
    const candidateLink = resolveCandidateLink({
      title: String(enhancedRec.title || ""),
      query: String(searchQueryForLink || enhancedRec.title || ""),
      category: category as RecommendationCategory,
      locale,
      region,
      provider: providerForCandidateLink,
      isMobile,
    });

    const reasonOverride =
      category === "fitness" ? buildFitnessReason(enhancedRec as any, locale, isCnWeb) : null;

    let linkType: LinkType = "search";
    if (category === "fitness") {
      const fitnessType = fallbackRec.fitnessType || "tutorial";

      switch (fitnessType) {
        case "tutorial":
          linkType = "video";
          break;
        case "nearby_place":
          linkType = "location";
          break;
        case "equipment":
          if (platform === "什么值得买") {
            linkType = "product";
          } else if (platform === "YouTube" || platform === "YouTube Fitness" || platform === "B站健身" || platform === "优酷健身") {
            linkType = "video";
          } else {
            linkType = "search";
          }
          break;
        case "theory_article":
          linkType = "article";
          break;
        default:
          if (platform === "YouTube" || platform === "YouTube Fitness") {
            linkType = "video";
          } else if (platform === "Keep" || platform === "MyFitnessPal") {
            linkType = "app";
          } else if (
            platform === "百度地图健身" ||
            platform === "高德地图健身" ||
            platform === "腾讯地图健身" ||
            platform === "大众点评" ||
            platform === "美团"
          ) {
            linkType = "location";
          } else {
            linkType = "search";
          }
      }
    }

    const result = {
      ...enhancedRec,
      reason: clampRecommendationReason(reasonOverride || enhancedRec.reason, locale),
      link: searchLink.url,
      platform: searchLink.displayName,
      linkType: linkType,
      category: category as RecommendationCategory,
      candidateLink,
      metadata: {
        searchQuery: searchQueryForLink,
        originalPlatform: enhancedRec.platform,
        isSearchLink: true,
      },
    };

    if (category === "fitness" && fallbackRec.fitnessType) {
      const fitnessType = fallbackRec.fitnessType;
      (result.metadata as any).fitnessType = fitnessType;
      const label = getFitnessTypeLabel(fitnessType, locale, isCnWeb);
      if (label) {
        (result.metadata as any).fitnessTypeLabel = label;
      }
    }
    return result;
  });
}

export async function POST(request: NextRequest, { params }: { params: { category: string } }) {
  try {
    const category = params.category as RecommendationCategory;

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

    const body = await request.json();
    const { userId = "anonymous", count = 3, locale = "zh", skipCache = false, userTags = [] } = body;

    const url = new URL(request.url);
    url.searchParams.set("userId", userId);
    url.searchParams.set("count", String(Math.min(count, 10)));
    url.searchParams.set("locale", locale);
    url.searchParams.set("skipCache", String(skipCache));

    if (userTags.length > 0 && isValidUserId(userId)) {
      try {
        await updateUserPreferences(userId, category, { tags: userTags });
      } catch (err) {
        console.warn("Failed to update user tags:", err);
      }
    }

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
