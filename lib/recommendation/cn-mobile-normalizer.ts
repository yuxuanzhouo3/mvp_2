import type { RecommendationCategory } from "@/lib/types/recommendation";

export function isCnMobileScenario(params: {
  locale: "zh" | "en";
  isMobile?: boolean;
}): boolean {
  return params.locale === "zh" && Boolean(params.isMobile);
}

export function normalizeCnMobileCategoryPlatform(params: {
  category: RecommendationCategory;
  platform: string;
  client: "app" | "web";
  isMobile?: boolean;
  locale: "zh" | "en";
  index: number;
  fitnessType?: string;
}): string {
  const { category, platform, client, isMobile, locale, index, fitnessType } = params;
  if (!isCnMobileScenario({ locale, isMobile })) {
    return platform;
  }

  if (client !== "app") {
    return platform;
  }

  if (category === "fitness") {
    if (fitnessType === "tutorial") {
      return "B站";
    }
    if (fitnessType === "equipment") {
      return "京东";
    }
    if (fitnessType === "nearby_place") {
      return index % 2 === 0 ? "美团" : "高德地图";
    }
    if (platform === "B站健身" || platform === "哔哩哔哩") {
      return "B站";
    }
    if (platform === "高德地图健身") {
      return "高德地图";
    }
    return platform;
  }

  if (category === "food") {
    if (platform === "百度地图美食" || platform === "腾讯地图美食") {
      return "小红书";
    }
    if (platform === "高德地图" || platform === "腾讯地图" || platform === "百度地图") {
      return "小红书";
    }
  }

  return platform;
}

export function stripCnFoodGenericTerms(value: string): string {
  return String(value || "")
    .replace(/美食|餐厅|推荐|附近/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCnMobileAppScenario(params: {
  locale: "zh" | "en";
  isMobile?: boolean;
  client: "app" | "web";
}): boolean {
  return isCnMobileScenario(params) && params.client === "app";
}

function ensureContainsAny(value: string, tokens: string[], suffix: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) return suffix.trim();
  if (tokens.some((token) => normalized.includes(token))) {
    return normalized;
  }
  return `${normalized} ${suffix}`.trim();
}

function extractFitnessKeyword(title?: string, tags?: string[] | null): string {
  const genericPattern =
    /(健身器材|器材|健身|训练|教程|使用教程|动作要点|常见错误|跟练|视频|课程|推荐|选购|购买|京东|附近|健身房|步行|地铁|商圈|入门|新手|全身|居家)/g;

  const values = [...(Array.isArray(tags) ? tags : []), String(title || "")];

  for (const value of values) {
    const candidate = String(value || "")
      .replace(/[^\w\u4e00-\u9fa5]+/g, " ")
      .replace(genericPattern, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (candidate && candidate.length <= 8) {
      return candidate;
    }

    const firstToken = candidate.split(/\s+/).find(Boolean);
    if (firstToken) {
      return firstToken.slice(0, 8);
    }
  }

  return "家用";
}

export function normalizeCnMobileFitnessRecommendation(params: {
  title?: string;
  description?: string;
  reason?: string;
  searchQuery?: string;
  tags?: string[] | null;
  platform: string;
  client: "app" | "web";
  isMobile?: boolean;
  locale: "zh" | "en";
  index: number;
  fitnessType?: string;
}): {
  title?: string;
  description?: string;
  reason?: string;
  searchQuery?: string;
  tags?: string[];
  platform: string;
} {
  const { title, description, reason, searchQuery, tags, platform, client, isMobile, locale, index, fitnessType } = params;

  if (!isCnMobileAppScenario({ locale, isMobile, client })) {
    return {
      title,
      description,
      reason,
      searchQuery,
      tags: Array.isArray(tags) ? tags : undefined,
      platform,
    };
  }

  const normalizedPlatform = normalizeCnMobileCategoryPlatform({
    category: "fitness",
    platform,
    client,
    isMobile,
    locale,
    index,
    fitnessType,
  });

  if (fitnessType === "equipment") {
    const keyword = extractFitnessKeyword(title, tags);
    const normalizedTitle = `${keyword}健身器材推荐`;
    return {
      title: normalizedTitle,
      description:
        keyword === "家用"
          ? "优先看承重、尺寸、收纳和材质，适合居家训练或补充基础器械。"
          : `优先看${keyword}的材质、承重、尺寸和收纳方式，适合居家训练或日常补充器械。`,
      reason: "将健身器材结果对齐到京东选购场景，避免内容与平台错位。",
      searchQuery: `${keyword} 健身器材 推荐 京东`,
      tags: Array.from(new Set([keyword, "健身器材", "推荐", "京东"])),
      platform: normalizedPlatform,
    };
  }

  if (fitnessType === "tutorial") {
    return {
      title,
      description,
      reason,
      searchQuery: ensureContainsAny(String(searchQuery || title || ""), ["视频", "跟练", "教程"], "健身视频 跟练"),
      tags: Array.isArray(tags) ? tags : undefined,
      platform: normalizedPlatform,
    };
  }

  if (fitnessType === "nearby_place") {
    return {
      title,
      description,
      reason,
      searchQuery: ensureContainsAny(String(searchQuery || title || ""), ["健身房", "场馆", "附近"], "附近 健身房"),
      tags: Array.isArray(tags) ? tags : undefined,
      platform: normalizedPlatform,
    };
  }

  return {
    title,
    description,
    reason,
    searchQuery,
    tags: Array.isArray(tags) ? tags : undefined,
    platform: normalizedPlatform,
  };
}
