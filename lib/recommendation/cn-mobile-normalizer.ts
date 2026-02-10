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
    if (fitnessType === "equipment") {
      return "美团";
    }
    if (fitnessType === "nearby_place") {
      return "高德地图健身";
    }
    if (platform === "美团") {
      return index % 2 === 0 ? "B站健身" : "高德地图健身";
    }
    if (platform === "B站" || platform === "哔哩哔哩") {
      return "B站健身";
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

