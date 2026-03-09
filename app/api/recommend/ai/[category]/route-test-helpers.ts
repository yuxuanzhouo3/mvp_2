import type { RecommendationCategory } from "@/lib/types/recommendation";

const REQUIRED_SHOPPING_PLATFORMS_CN_WEB = ["京东", "什么值得买", "慢慢买"] as const;
const REQUIRED_SHOPPING_PLATFORMS_CN_MOBILE = ["京东", "拼多多"] as const;
const REQUIRED_TRAVEL_PLATFORMS_CN_MOBILE = ["携程"] as const;
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

const INTL_ANDROID_CONCRETE_QUERY_FALLBACK_BY_PLATFORM: Partial<Record<string, string>> = {
  YouTube: "NPR Tiny Desk Chappell Roan",
  TikTok: "BookTok Fourth Wing edits",
  JustWatch: "The Bear Season 3",
  Spotify: "Noah Kahan Stick Season",
  Medium: "The Bear city life analysis",
  MiniReview: "Vampire Survivors",
  "Amazon Shopping": "Stanley Quencher H2.0 40oz",
  Etsy: "custom house number sign",
  Slickdeals: "Anker 737 power bank deal",
  Pinterest: "small apartment entryway storage",
  DoorDash: "Nashville hot chicken sandwich",
  "Uber Eats": "Chipotle chicken burrito bowl",
  "Fantuan Delivery": "Richmond BC dim sum",
  HungryPanda: "Toronto brown sugar bubble tea",
  TripAdvisor: "Banff Lake Louise",
  Yelp: "Pike Place Chowder Seattle",
  Wanderlog: "New York City 3 day itinerary",
  "Visit A City": "San Diego 2 day itinerary",
  GetYourGuide: "Niagara Falls boat tour",
  "Google Maps": "Golden Gate Bridge San Francisco",
  "Nike Training Club": "20-minute lower body dumbbell workout",
  Peloton: "45-minute Power Zone ride",
  Strava: "Prospect Park 5k loop",
  "Nike Run Club": "10k progression run",
  Hevy: "barbell bench press",
  Strong: "romanian deadlift",
  "Down Dog": "vinyasa flow 20 min",
  MyFitnessPal: "Trader Joe's chicken tikka masala",
};

const INTL_ANDROID_CONCRETE_QUERY_FALLBACK_BY_CATEGORY: Record<RecommendationCategory, string> = {
  entertainment: "The Bear Season 3",
  shopping: "Stanley Quencher H2.0 40oz",
  food: "Nashville hot chicken sandwich",
  travel: "Banff Lake Louise",
  fitness: "20-minute lower body dumbbell workout",
};

type IntlAndroidFoodPriceRange = "$" | "$$" | "$$$";

type IntlAndroidFoodFallbackDish = {
  dishName: string;
  cuisine: string;
  priceRange: IntlAndroidFoodPriceRange;
};

const INTL_ANDROID_FOOD_ALLOWED_PLATFORMS = new Set<string>([
  "DoorDash",
  "Uber Eats",
  "Fantuan Delivery",
  "HungryPanda",
]);

const INTL_ANDROID_FOOD_SCENARIO_TERMS = [
  "family gathering",
  "friends hangout",
  "late night scenario",
  "late-night scenario",
  "date night",
  "office lunch",
  "group dinner",
  "家庭聚餐",
  "朋友小聚",
  "宵夜场景",
  "约会",
  "办公室午餐",
];

const INTL_ANDROID_FOOD_GENERIC_LABEL_TERMS = new Set<string>([
  "food",
  "foods",
  "restaurant",
  "restaurants",
  "cuisine",
  "cuisines",
  "delivery",
  "takeout",
  "meal",
  "meals",
  "lunch",
  "dinner",
  "breakfast",
  "brunch",
  "snack",
  "snacks",
  "chinese food",
  "western food",
  "fast food",
  "中餐",
  "西餐",
  "快餐",
  "面食",
  "甜品",
  "饮品",
]);

const INTL_ANDROID_FOOD_FALLBACK_DISHES_BY_PLATFORM: Record<string, IntlAndroidFoodFallbackDish[]> = {
  DoorDash: [
    { dishName: "Nashville hot chicken sandwich", cuisine: "American", priceRange: "$$" },
    { dishName: "Cheese smashburger", cuisine: "American", priceRange: "$$" },
    { dishName: "Chicken caesar wrap", cuisine: "American", priceRange: "$" },
  ],
  "Uber Eats": [
    { dishName: "Chipotle chicken burrito bowl", cuisine: "Mexican", priceRange: "$$" },
    { dishName: "Tonkotsu ramen", cuisine: "Japanese", priceRange: "$$" },
    { dishName: "Pad thai shrimp", cuisine: "Thai", priceRange: "$$" },
  ],
  "Fantuan Delivery": [
    { dishName: "麻辣烫", cuisine: "Chinese", priceRange: "$$" },
    { dishName: "兰州牛肉面", cuisine: "Chinese", priceRange: "$" },
    { dishName: "小笼包", cuisine: "Chinese", priceRange: "$$" },
  ],
  HungryPanda: [
    { dishName: "黄焖鸡米饭", cuisine: "Chinese", priceRange: "$" },
    { dishName: "重庆小面", cuisine: "Chinese", priceRange: "$" },
    { dishName: "螺蛳粉", cuisine: "Chinese", priceRange: "$$" },
  ],
};

const INTL_ANDROID_GENERIC_QUERY_TERMS: Record<RecommendationCategory, string[]> = {
  entertainment: [
    "top",
    "trending",
    "trends",
    "best",
    "movies",
    "movie",
    "shows",
    "show",
    "songs",
    "song",
    "playlist",
    "playlists",
    "games",
    "game",
    "articles",
    "article",
    "video",
    "videos",
    "entertainment",
  ],
  shopping: [
    "top",
    "best",
    "deal",
    "deals",
    "discount",
    "discounts",
    "shopping",
    "products",
    "product",
    "ideas",
    "inspiration",
    "gift",
    "gifts",
    "sale",
    "sales",
    "essentials",
  ],
  food: [
    "food",
    "foods",
    "restaurant",
    "restaurants",
    "cuisine",
    "cuisines",
    "delivery",
    "takeout",
    "recipe",
    "recipes",
    "lunch",
    "dinner",
    "brunch",
    "breakfast",
  ],
  travel: [
    "travel",
    "trip",
    "trips",
    "things",
    "destination",
    "destinations",
    "guide",
    "guides",
    "itinerary",
    "itineraries",
    "attractions",
    "hotel",
    "hotels",
    "vacation",
    "places",
  ],
  fitness: [
    "fitness",
    "workout",
    "workouts",
    "training",
    "exercise",
    "exercises",
    "plan",
    "plans",
    "routine",
    "routines",
    "gym",
    "gyms",
    "tips",
    "beginner",
    "advanced",
  ],
};

const GLOBAL_GENERIC_QUERY_TERMS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "for",
  "with",
  "of",
  "in",
  "on",
  "near",
  "me",
]);

function normalizeQueryBase(value: string): string {
  return String(value || "")
    .replace(/[()\[\]{}<>]/g, " ")
    .replace(/["'“”’]/g, " ")
    .replace(/[|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isIntlMobileEntertainmentContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
}): boolean {
  const { category, locale, isMobile } = params;
  return category === "entertainment" && locale === "en" && Boolean(isMobile);
}

function isIntlAndroidShoppingContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return category === "shopping" && locale === "en" && Boolean(isMobile) && Boolean(isAndroid);
}

function isIntlAndroidFoodContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return category === "food" && locale === "en" && Boolean(isMobile) && Boolean(isAndroid);
}

function isIntlAndroidTravelContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return category === "travel" && locale === "en" && Boolean(isMobile) && Boolean(isAndroid);
}

function isIntlAndroidFitnessContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return category === "fitness" && locale === "en" && Boolean(isMobile) && Boolean(isAndroid);
}

function isIntlAndroidConcreteTermContext(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
}): boolean {
  const { category, locale, isMobile, isAndroid } = params;
  return (
    locale === "en" &&
    Boolean(isMobile) &&
    Boolean(isAndroid) &&
    ["entertainment", "shopping", "food", "travel", "fitness"].includes(category)
  );
}

function isConcreteIntlAndroidSearchQuery(params: {
  category: RecommendationCategory;
  query: string;
}): boolean {
  const normalized = normalizeQueryBase(params.query);
  if (!normalized) return false;

  const lowered = normalized.toLowerCase();
  if (/^https?:\/\//.test(lowered)) return false;
  if (/\b(top|best|trending|trends|ideas|guide|guides|list|playlist|playlists)\b/.test(lowered)) {
    return false;
  }
  if (/\b(near me|things to do|what to buy|random)\b/.test(lowered)) {
    return false;
  }

  const categoryTerms = new Set(INTL_ANDROID_GENERIC_QUERY_TERMS[params.category] || []);
  const words = lowered.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  const hasCjk = /[\u4e00-\u9fff]/.test(normalized);
  if (hasCjk) {
    return normalized.length >= 2;
  }

  const contentWords = words.filter((word) => !GLOBAL_GENERIC_QUERY_TERMS.has(word) && !categoryTerms.has(word));
  if (contentWords.length >= 2) return true;

  const single = contentWords[0] || "";
  if (!single) return false;
  if (/\d/.test(single)) return true;
  if (single.length >= 5) return true;
  return false;
}

function resolveIntlAndroidFoodPlatform(platform: string, index: number): string {
  if (INTL_ANDROID_FOOD_ALLOWED_PLATFORMS.has(platform)) return platform;
  return REQUIRED_FOOD_PLATFORMS_INTL_ANDROID[Math.abs(index) % REQUIRED_FOOD_PLATFORMS_INTL_ANDROID.length] || "DoorDash";
}

function resolveIntlAndroidFoodFallbackDish(platform: string, index: number): IntlAndroidFoodFallbackDish {
  const normalizedPlatform = resolveIntlAndroidFoodPlatform(platform, index);
  const choices =
    INTL_ANDROID_FOOD_FALLBACK_DISHES_BY_PLATFORM[normalizedPlatform] ||
    INTL_ANDROID_FOOD_FALLBACK_DISHES_BY_PLATFORM.DoorDash;
  return choices[Math.abs(index) % choices.length] || INTL_ANDROID_FOOD_FALLBACK_DISHES_BY_PLATFORM.DoorDash[0];
}

function includesIntlAndroidFoodScenarioTerms(value: string): boolean {
  const normalized = normalizeQueryBase(value).toLowerCase();
  if (!normalized) return false;
  return INTL_ANDROID_FOOD_SCENARIO_TERMS.some((term) => normalized.includes(normalizeQueryBase(term).toLowerCase()));
}

function isIntlAndroidFoodGenericLabel(value: string): boolean {
  const normalized = normalizeQueryBase(value).toLowerCase();
  if (!normalized) return true;
  if (INTL_ANDROID_FOOD_GENERIC_LABEL_TERMS.has(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every((word) => INTL_ANDROID_FOOD_GENERIC_LABEL_TERMS.has(word))) {
    return true;
  }
  return false;
}

function isValidIntlAndroidFoodDishTerm(value: string): boolean {
  const normalized = normalizeQueryBase(value);
  if (!normalized) return false;
  if (includesIntlAndroidFoodScenarioTerms(normalized)) return false;
  if (isIntlAndroidFoodGenericLabel(normalized)) return false;
  return isConcreteIntlAndroidSearchQuery({
    category: "food",
    query: normalized,
  });
}

export function shouldEnsureCnEntertainmentTypes(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  client: "app" | "web";
  isChinaDeploymentEnabled: boolean;
}): boolean {
  const { category, locale, client, isChinaDeploymentEnabled } = params;
  if (!isChinaDeploymentEnabled) return false;
  if (category !== "entertainment" || locale !== "zh") return false;
  return client === "web" || client === "app";
}

export function sanitizeIntlAndroidFoodRecommendation(params: {
  title?: string | null;
  query?: string | null;
  tags?: string[] | null;
  platform?: string | null;
  index: number;
}): {
  title: string;
  searchQuery: string;
  tags: string[];
  platform: string;
  cuisine: string;
  priceRange: IntlAndroidFoodPriceRange;
} {
  const platform = resolveIntlAndroidFoodPlatform(String(params.platform || ""), params.index);
  const fallbackDish = resolveIntlAndroidFoodFallbackDish(platform, params.index);

  const normalizedTitle = normalizeQueryBase(String(params.title || ""));
  const normalizedQuery = normalizeQueryBase(String(params.query || ""));

  const title = isValidIntlAndroidFoodDishTerm(normalizedTitle) ? normalizedTitle : fallbackDish.dishName;
  const searchQuery = isValidIntlAndroidFoodDishTerm(normalizedQuery) ? normalizedQuery : title;

  const rawTags = Array.isArray(params.tags)
    ? params.tags
        .filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
        .map((tag) => tag.trim())
    : [];
  const tagSet = new Set(rawTags);
  const hasCuisineTag = rawTags.some((tag) => /^cuisine:/i.test(tag));
  const hasPriceRangeTag = rawTags.some((tag) => /^price_range:(\$|\$\$|\$\$\$)$/i.test(tag));
  if (!hasCuisineTag) tagSet.add(`cuisine:${fallbackDish.cuisine}`);
  if (!hasPriceRangeTag) tagSet.add(`price_range:${fallbackDish.priceRange}`);

  return {
    title,
    searchQuery,
    tags: Array.from(tagSet),
    platform,
    cuisine: fallbackDish.cuisine,
    priceRange: fallbackDish.priceRange,
  };
}

export function enforceConcreteIntlAndroidSearchQuery(params: {
  category: RecommendationCategory;
  platform: string;
  title?: string | null;
  query?: string | null;
}): string {
  const query = normalizeQueryBase(params.query || "");
  const title = normalizeQueryBase(params.title || "");

  if (isConcreteIntlAndroidSearchQuery({ category: params.category, query })) {
    return query;
  }

  if (isConcreteIntlAndroidSearchQuery({ category: params.category, query: title })) {
    return title;
  }

  const byPlatform = INTL_ANDROID_CONCRETE_QUERY_FALLBACK_BY_PLATFORM[params.platform];
  if (byPlatform) {
    return byPlatform;
  }

  return INTL_ANDROID_CONCRETE_QUERY_FALLBACK_BY_CATEGORY[params.category] || query || title;
}

export function alignIntlAndroidTitleWithSearchQuery(params: {
  category: RecommendationCategory;
  locale: "zh" | "en";
  isMobile?: boolean;
  isAndroid?: boolean;
  title?: string | null;
  searchQuery?: string | null;
}): string {
  const normalizedTitle = normalizeQueryBase(String(params.title || ""));
  const normalizedQuery = normalizeQueryBase(String(params.searchQuery || ""));

  if (
    !isIntlAndroidConcreteTermContext({
      category: params.category,
      locale: params.locale,
      isMobile: params.isMobile,
      isAndroid: params.isAndroid,
    })
  ) {
    return normalizedTitle || normalizedQuery;
  }

  if (!normalizedQuery) {
    return normalizedTitle;
  }

  if (isConcreteIntlAndroidSearchQuery({ category: params.category, query: normalizedTitle })) {
    return normalizedTitle;
  }

  return normalizedQuery;
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
  if (category === "shopping" && locale === "zh" && client === "app" && Boolean(isMobile)) {
    if (count <= 0) return null;
    const max = Math.min(count, REQUIRED_SHOPPING_PLATFORMS_CN_MOBILE.length);
    return index < count ? REQUIRED_SHOPPING_PLATFORMS_CN_MOBILE[index % max] : null;
  }
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
  if (category === "travel" && locale === "zh" && Boolean(isMobile)) {
    if (count <= 0) return null;
    const max = Math.min(count, REQUIRED_TRAVEL_PLATFORMS_CN_MOBILE.length);
    return index < count ? REQUIRED_TRAVEL_PLATFORMS_CN_MOBILE[index % max] : null;
  }
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
