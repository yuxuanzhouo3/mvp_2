import type { CandidateResult } from "./types";

type NearbyRegion = "CN" | "INTL";
type DistanceUnitSystem = "metric" | "imperial";

export type NearbySearchParams = {
  lat: number;
  lng: number;
  locale: "zh" | "en";
  region: NearbyRegion;
  message: string;
  limit?: number;
};

export type NearbySearchResult = {
  candidates: CandidateResult[];
  radiusKm: number;
  matchedCount: number;
  category?: string;
  source: "database" | "overpass";
};

const DEFAULT_RADIUS_KM = 5;
const MAX_RADIUS_KM = 30;
const MIN_RADIUS_KM = 0.3;
const OVERPASS_MIN_RADIUS_METERS = 200;
const OVERPASS_MAX_RADIUS_METERS = 30000;
const OVERPASS_TIMEOUT_MS = Math.max(
  4000,
  Number(process.env.OVERPASS_TIMEOUT_MS || "12000")
);
const OVERPASS_QUERY_TIMEOUT_SECONDS = Math.max(
  10,
  Number(process.env.OVERPASS_QUERY_TIMEOUT_SECONDS || "20")
);
const OVERPASS_ENDPOINT =
  process.env.OVERPASS_API_ENDPOINT || "https://overpass-api.de/api/interpreter";
const OVERPASS_USER_AGENT =
  process.env.OVERPASS_USER_AGENT ||
  process.env.NOMINATIM_USER_AGENT ||
  "ProjectOneAssistant/1.0 (+https://project-one.app)";
const AMAP_PLACE_AROUND_ENDPOINT =
  process.env.AMAP_PLACE_AROUND_ENDPOINT || "https://restapi.amap.com/v3/place/around";
const AMAP_PLACE_TIMEOUT_MS = Math.max(
  2500,
  Number(process.env.AMAP_PLACE_TIMEOUT_MS || "5000")
);
const AMAP_DISTANCE_ENDPOINT =
  process.env.AMAP_DISTANCE_ENDPOINT || "https://restapi.amap.com/v3/distance";
const AMAP_DISTANCE_TIMEOUT_MS = Math.max(
  1500,
  Number(process.env.AMAP_DISTANCE_TIMEOUT_MS || "4000")
);
const AMAP_DISTANCE_MAX_POINTS = 20;
const KM_TO_MILES = 0.621371;

type OverpassEntityType = "node" | "way" | "relation";

type OverpassElement = {
  type?: OverpassEntityType;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type AmapPoi = {
  id?: string;
  name?: string;
  type?: string;
  address?: string;
  location?: string;
  distance?: number | string;
  tel?: string;
  biz_ext?: {
    rating?: number | string;
    cost?: number | string;
  };
  opentime?: string;
  opentime2?: string;
};

type AmapPlaceResponse = {
  status?: string;
  info?: string;
  pois?: AmapPoi[];
};

type AmapDistanceItem = {
  distance?: number | string;
  duration?: number | string;
};

type AmapDistanceResponse = {
  status?: string;
  info?: string;
  results?: AmapDistanceItem[];
};

type OverpassFilter = {
  key: string;
  valueRegex: string;
};

type RankedOverpassCandidate = {
  candidate: CandidateResult;
  score: number;
  distanceKm: number;
  coordinates?: { lat: number; lng: number };
};

const OVERPASS_FILTERS_BY_CATEGORY: Record<string, OverpassFilter[]> = {
  food: [
    { key: "amenity", valueRegex: "restaurant|fast_food|cafe|food_court|bar|pub|ice_cream|biergarten" },
    { key: "shop", valueRegex: "bakery|confectionery|deli|beverages" },
  ],
  shopping: [
    { key: "shop", valueRegex: "mall|department_store|supermarket|convenience|electronics|computer|mobile_phone|clothes|shoes|beauty|books|sports|gift" },
  ],
  fitness: [
    { key: "amenity", valueRegex: "gym" },
    { key: "leisure", valueRegex: "fitness_centre|sports_centre|swimming_pool|track" },
  ],
  travel: [
    { key: "tourism", valueRegex: "hotel|hostel|guest_house|motel|attraction|museum|viewpoint" },
  ],
  entertainment: [
    { key: "amenity", valueRegex: "cinema|theatre|nightclub|casino|arts_centre|bar|pub" },
    { key: "leisure", valueRegex: "amusement_arcade|bowling_alley|dance" },
  ],
};

const OVERPASS_DEFAULT_FILTERS = OVERPASS_FILTERS_BY_CATEGORY.food;

let overpassQueue: Promise<void> = Promise.resolve();

function clampRadius(radiusKm: number): number {
  if (!Number.isFinite(radiusKm)) return DEFAULT_RADIUS_KM;
  return Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, radiusKm));
}

function radiusKmToMeters(radiusKm: number): number {
  const meters = Math.round(radiusKm * 1000);
  return Math.max(OVERPASS_MIN_RADIUS_METERS, Math.min(OVERPASS_MAX_RADIUS_METERS, meters));
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isLikelyInChina(lat: number, lng: number): boolean {
  return lat >= 3.8 && lat <= 53.6 && lng >= 73.5 && lng <= 135.1;
}

function getDistanceUnitSystem(region: NearbyRegion): DistanceUnitSystem {
  return region === "INTL" ? "imperial" : "metric";
}

function resolveMapPlatformForLocation(lat: number, lng: number): "高德地图" | "Google Maps" {
  return isLikelyInChina(lat, lng) ? "高德地图" : "Google Maps";
}

function getAmapApiKey(): string | undefined {
  return (
    process.env.AMAP_WEB_SERVICE_KEY ||
    process.env.AMAP_API_KEY ||
    process.env.GAODE_WEB_SERVICE_KEY
  );
}

function getAmapTypeCodes(category?: string): string {
  switch (category) {
    case "food":
      return "050000";
    case "shopping":
      return "060000";
    case "fitness":
      return "080000";
    case "travel":
      return "100000|110000";
    case "entertainment":
      return "080300|080400|080600|090000";
    default:
      return "060000";
  }
}

function isCarWashIntent(message: string): boolean {
  const normalized = message.toLowerCase();
  const enPattern =
    /(car wash|auto wash|vehicle wash|auto detail|detailing|car detailing|car care)/;
  const zhPattern =
    /(\u6d17\u8f66|\u6c7d\u8f66\u7f8e\u5bb9|\u7cbe\u6d17|\u6253\u8721|\u5185\u9970\u6e05\u6d17|\u6f06\u9762\u62a4\u7406)/;
  return enPattern.test(normalized) || zhPattern.test(message);
}

function buildAmapSearchProfile(
  message: string,
  category: string | undefined,
  locale: "zh" | "en"
): { types: string; keywords?: string; strictCarWash: boolean } {
  if (isCarWashIntent(message)) {
    return {
      // Auto service + car wash related subtypes (use with keyword to avoid broad noise).
      types: "010500|010501|010502|010503|010504|010505",
      keywords: locale === "zh" ? "洗车" : "car wash",
      strictCarWash: true,
    };
  }

  return {
    types: getAmapTypeCodes(category),
    strictCarWash: false,
  };
}

const CAR_WASH_POSITIVE_EN =
  /(car wash|auto wash|vehicle wash|auto detail|detailing|car detailing|car care|wash station|self[-\s]?serve wash)/;
const CAR_WASH_POSITIVE_ZH =
  /(\u6d17\u8f66|\u6c7d\u8f66\u7f8e\u5bb9|\u7cbe\u6d17|\u6253\u8721|\u5185\u9970\u6e05\u6d17|\u6f06\u9762)/;
const CAR_WASH_EXCLUSION_EN =
  /(disinfection|sanitize|sanitation|quarantine|livestock|animal transport|logistics|hazmat|waste truck|sprayer)/;
const CAR_WASH_EXCLUSION_ZH =
  /(\u6d17\u6d88|\u6d88\u6bd2|\u68c0\u75ab|\u52a8\u7269\u8fd0\u8f93|\u8fd0\u8f93\u8f66\u8f86|\u7269\u6d41\u8f66\u8f86|\u73af\u536b|\u5e9f\u7269|\u5371\u5316|\u6d88\u6740|\u6d17\u6d88\u4e2d\u5fc3|\u6d88\u6d17\u4e2d\u5fc3)/;
const CAR_WASH_RETAIL_OVERRIDE_EN =
  /(car wash shop|car wash station|self[-\s]?serve wash|auto spa|detailing shop)/;
const CAR_WASH_RETAIL_OVERRIDE_ZH =
  /(\u6d17\u8f66\u5e97|\u81ea\u52a9\u6d17\u8f66|\u81ea\u52a9\u6d17\u8f66\u7ad9|\u6c7d\u8f66\u7f8e\u5bb9\u5e97)/;

function hasCarWashExclusion(text: string): boolean {
  const normalized = text.toLowerCase();
  return CAR_WASH_EXCLUSION_EN.test(normalized) || CAR_WASH_EXCLUSION_ZH.test(text);
}

function isAmapPoiCarWashRelevant(poi: AmapPoi): boolean {
  const text = [poi.name || "", poi.type || "", poi.address || ""].join(" ");
  return isCarWashTextRelevant(text);
}

function isCarWashTextRelevant(text: string): boolean {
  const normalized = text.toLowerCase();

  if (hasCarWashExclusion(text)) {
    const retailOverride =
      CAR_WASH_RETAIL_OVERRIDE_EN.test(normalized) ||
      CAR_WASH_RETAIL_OVERRIDE_ZH.test(text);
    if (!retailOverride) {
      return false;
    }
  }

  return CAR_WASH_POSITIVE_EN.test(normalized) || CAR_WASH_POSITIVE_ZH.test(text);
}

function parseAmapLocation(location: string | undefined): { lat: number; lng: number } | null {
  if (!location) return null;
  const [lngRaw, latRaw] = location.split(",");
  const lat = toNumber(latRaw);
  const lng = toNumber(lngRaw);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

async function fetchAmapDrivingDistancesKm(
  key: string,
  origin: { lat: number; lng: number },
  points: Array<{ lat: number; lng: number }>
): Promise<Array<number | null> | null> {
  const normalizedPoints = points
    .filter(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        point.lat >= -90 &&
        point.lat <= 90 &&
        point.lng >= -180 &&
        point.lng <= 180
    )
    .slice(0, AMAP_DISTANCE_MAX_POINTS);

  if (normalizedPoints.length === 0) {
    return [];
  }

  const origins = normalizedPoints
    .map((point) => `${point.lng},${point.lat}`)
    .join("|");
  const destination = `${origin.lng},${origin.lat}`;
  const url =
    `${AMAP_DISTANCE_ENDPOINT}?key=${encodeURIComponent(key)}` +
    `&origins=${encodeURIComponent(origins)}` +
    `&destination=${encodeURIComponent(destination)}` +
    "&type=1&output=JSON";

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(AMAP_DISTANCE_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("[NearbyStoreSearch] Amap driving distance request failed:", error);
    return null;
  }

  if (!response.ok) {
    console.warn("[NearbyStoreSearch] Amap driving distance status:", response.status);
    return null;
  }

  let data: AmapDistanceResponse;
  try {
    data = (await response.json()) as AmapDistanceResponse;
  } catch (error) {
    console.warn("[NearbyStoreSearch] Failed to parse Amap driving distance JSON:", error);
    return null;
  }

  if (data.status !== "1") {
    if (data.info) {
      console.warn("[NearbyStoreSearch] Amap driving distance returned error:", data.info);
    }
    return null;
  }

  const results = Array.isArray(data.results) ? data.results : [];
  if (results.length === 0) {
    return null;
  }

  const distances = results.map((item) => {
    const meters = toNumber(item.distance);
    if (meters === null || !Number.isFinite(meters) || meters < 0) {
      return null;
    }
    return meters / 1000;
  });

  while (distances.length < normalizedPoints.length) {
    distances.push(null);
  }

  return distances.slice(0, normalizedPoints.length);
}

function buildAmapDescription(
  poi: AmapPoi,
  distanceKm: number,
  locale: "zh" | "en",
  region: NearbyRegion
): string {
  const distance = formatDistance(distanceKm, getDistanceUnitSystem(region));
  const reasons: string[] = [
    locale === "zh" ? `距离约 ${distance}` : `${distance} away`,
  ];

  if (poi.type) {
    reasons.push(locale === "zh" ? `类型: ${poi.type}` : `type: ${poi.type}`);
  }
  if (poi.opentime2 || poi.opentime) {
    reasons.push(locale === "zh" ? "含营业时间信息" : "opening hours available");
  }

  return reasons.join(", ");
}

function normalizeCandidateKey(candidate: CandidateResult): string {
  const name = (candidate.name || "").trim().toLowerCase();
  const address = (candidate.address || "").trim().toLowerCase();
  return `${name}::${address}`;
}

function mergeCandidateLists(
  primary: CandidateResult[],
  secondary: CandidateResult[],
  limit: number
): CandidateResult[] {
  const merged: CandidateResult[] = [];
  const dedupe = new Set<string>();

  for (const candidate of [...primary, ...secondary]) {
    const key = normalizeCandidateKey(candidate);
    if (!key || dedupe.has(key)) {
      continue;
    }
    dedupe.add(key);
    merged.push(candidate);
    if (merged.length >= limit) {
      break;
    }
  }

  return merged;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistance(
  distanceKm: number,
  unitSystem: DistanceUnitSystem
): string {
  if (unitSystem === "imperial") {
    const miles = distanceKm * KM_TO_MILES;
    if (miles < 0.1) {
      return "0.1 miles";
    }
    if (miles < 10) {
      return `${miles.toFixed(1)} miles`;
    }
    return `${Math.round(miles)} miles`;
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

export function parseRadiusKmFromMessage(message: string): number {
  const text = message.toLowerCase();

  const milesMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mile|miles)/i);
  if (milesMatch) {
    return clampRadius(Number(milesMatch[1]) * 1.60934);
  }

  const kilometerMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:公里|千米|km|kilometers?|kilometres?)/i);
  if (kilometerMatch) {
    return clampRadius(Number(kilometerMatch[1]));
  }

  const meterMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:米|m|meters?)/i);
  if (meterMatch) {
    return clampRadius(Number(meterMatch[1]) / 1000);
  }

  return DEFAULT_RADIUS_KM;
}

function inferCategoryFromMessage(message: string, locale: "zh" | "en"): string | undefined {
  const text = message.toLowerCase();

  const zhRules: Array<{ pattern: RegExp; category: string }> = [
    {
      pattern:
        /(\u6d17\u8f66|\u6c7d\u8f66\u7f8e\u5bb9|\u517b\u8f66|\u4fee\u8f66|\u8f66\u670d\u52a1|car wash|auto detail|detailing|car care)/,
      category: "local_life",
    },
    { pattern: /(吃|餐|外卖|美食|咖啡|奶茶|火锅|烧烤)/, category: "food" },
    { pattern: /(健身|运动|瑜伽|游泳|羽毛球|跑步|gym|fitness)/, category: "fitness" },
    { pattern: /(酒店|景点|出行|旅行|机票|火车)/, category: "travel" },
    { pattern: /(商场|超市|电脑|手机|数码|家电|购物)/, category: "shopping" },
    { pattern: /(电影院|剧本杀|KTV|娱乐|酒吧)/, category: "entertainment" },
  ];

  const enRules: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /(car wash|auto detail|detailing|car service|auto repair)/, category: "local_life" },
    { pattern: /(food|restaurant|coffee|cafe|tea|delivery|eat)/, category: "food" },
    { pattern: /(gym|fitness|workout|yoga|sports)/, category: "fitness" },
    { pattern: /(travel|hotel|flight|trip|sightseeing)/, category: "travel" },
    { pattern: /(shop|store|mall|electronics|grocery)/, category: "shopping" },
    { pattern: /(movie|cinema|karaoke|bar|entertainment)/, category: "entertainment" },
  ];

  const primaryRules = locale === "zh" ? zhRules : enRules;
  const fallbackRules = locale === "zh" ? enRules : zhRules;
  const primaryMatch = primaryRules.find((rule) => rule.pattern.test(text));
  if (primaryMatch) {
    return primaryMatch.category;
  }
  return fallbackRules.find((rule) => rule.pattern.test(text))?.category;
}

function normalizeTagValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replaceAll(";", ", ").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function extractLocation(element: OverpassElement): { lat: number; lng: number } | null {
  const lat = toNumber(element.lat) ?? toNumber(element.center?.lat);
  const lng = toNumber(element.lon) ?? toNumber(element.center?.lon);

  if (lat === null || lng === null) return null;
  return { lat, lng };
}

function pickPoiName(tags: Record<string, string>): string | null {
  const rawName = tags["name:en"] || tags.name || tags.brand || tags.operator;
  if (!rawName) return null;
  const name = rawName.trim();
  if (!name) return null;
  return name;
}

function isGenericPoiName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return true;

  const lower = trimmed.toLowerCase();
  const genericPatterns: RegExp[] = [
    /^(restaurant|restaurants|food|eatery|cafe|coffee shop|coffee|bar|pub)$/,
    /^(shop|store|mall|market|supermarket|grocery|convenience store)$/,
    /^(gym|fitness|fitness center|sports center|hotel|hostel|cinema|theatre)$/,
    /^(饭店|餐厅|商店|店铺|超市|健身房|酒店)$/,
  ];

  return genericPatterns.some((pattern) => pattern.test(lower));
}

function inferCategoryFromTags(
  tags: Record<string, string>,
  fallbackCategory?: string
): string {
  const amenity = (tags.amenity || "").toLowerCase();
  const shop = (tags.shop || "").toLowerCase();
  const tourism = (tags.tourism || "").toLowerCase();
  const leisure = (tags.leisure || "").toLowerCase();

  if (
    ["restaurant", "fast_food", "cafe", "food_court", "bar", "pub", "ice_cream"].includes(amenity) ||
    ["bakery", "deli", "confectionery", "beverages"].includes(shop)
  ) {
    return "food";
  }

  if (
    ["mall", "department_store", "supermarket", "convenience", "electronics", "computer", "mobile_phone"].includes(shop)
  ) {
    return "shopping";
  }

  if (
    amenity === "gym" ||
    ["fitness_centre", "sports_centre", "swimming_pool"].includes(leisure)
  ) {
    return "fitness";
  }

  if (
    ["hotel", "hostel", "guest_house", "attraction", "museum", "viewpoint"].includes(tourism)
  ) {
    return "travel";
  }

  if (
    ["cinema", "theatre", "nightclub", "casino", "arts_centre"].includes(amenity) ||
    ["amusement_arcade", "bowling_alley"].includes(leisure)
  ) {
    return "entertainment";
  }

  return fallbackCategory || "local_life";
}

function buildAddressFromTags(tags: Record<string, string>): string | undefined {
  const addrFull = tags["addr:full"];
  if (addrFull && addrFull.trim().length > 0) {
    return addrFull.trim();
  }

  const houseNumber = tags["addr:housenumber"]?.trim();
  const street = tags["addr:street"]?.trim();
  const city = tags["addr:city"]?.trim() || tags["addr:suburb"]?.trim() || tags["addr:district"]?.trim();
  const state = tags["addr:state"]?.trim();
  const country = tags["addr:country"]?.trim();

  const firstLine = [houseNumber, street].filter(Boolean).join(" ");
  const restLine = [city, state, country].filter(Boolean).join(", ");
  const merged = [firstLine, restLine].filter(Boolean).join(", ");

  return merged || undefined;
}

function tokenizeForRanking(message: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "for", "with", "near", "nearby", "around", "find", "show",
    "please", "me", "to", "in", "on", "of", "my", "within", "公里", "附近", "周边",
    "找", "一下", "帮我", "我想", "restaurant", "restaurants", "shop", "store",
  ]);

  const normalized = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  return normalized.filter((token) => !stopWords.has(token)).slice(0, 8);
}

function scoreOverpassCandidate(
  candidate: CandidateResult,
  distanceKm: number,
  messageTokens: string[]
): number {
  let score = 0;

  score += Math.max(0, 8 - distanceKm * 3);

  if (candidate.businessHours) score += 0.8;
  if (candidate.phone) score += 0.6;
  if (candidate.address) score += 0.5;
  if (candidate.tags && candidate.tags.length > 0) score += 0.8;

  if (messageTokens.length > 0) {
    const searchable = [
      candidate.name,
      candidate.description,
      candidate.searchQuery,
      candidate.address || "",
      ...(candidate.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    for (const token of messageTokens) {
      if (searchable.includes(token)) {
        score += 1.2;
      }
    }
  }

  return score;
}

function buildOverpassDescription(
  tags: Record<string, string>,
  distanceKm: number,
  region: NearbyRegion
): string {
  const reasons: string[] = [
    `${formatDistance(distanceKm, getDistanceUnitSystem(region))} away`,
  ];

  const cuisine = normalizeTagValue(tags.cuisine);
  if (cuisine) {
    reasons.push(`cuisine: ${cuisine}`);
  }

  const amenity = normalizeTagValue(tags.amenity);
  if (amenity && !cuisine) {
    reasons.push(`type: ${amenity}`);
  }

  const shop = normalizeTagValue(tags.shop);
  if (shop) {
    reasons.push(`shop: ${shop}`);
  }

  if (tags.opening_hours) {
    reasons.push("opening hours available");
  }

  if (tags.takeaway === "yes" || tags.delivery === "yes") {
    reasons.push("takeaway/delivery supported");
  }

  return reasons.join(", ");
}

function getOverpassFilters(category?: string): OverpassFilter[] {
  if (!category) {
    return OVERPASS_DEFAULT_FILTERS;
  }
  return OVERPASS_FILTERS_BY_CATEGORY[category] || OVERPASS_DEFAULT_FILTERS;
}

function buildOverpassQuery(
  filters: OverpassFilter[],
  radiusMeters: number,
  lat: number,
  lng: number
): string {
  const latString = lat.toFixed(6);
  const lngString = lng.toFixed(6);
  const clauses: string[] = [];

  for (const filter of filters) {
    clauses.push(
      `node["${filter.key}"~"${filter.valueRegex}"](around:${radiusMeters},${latString},${lngString});`,
      `way["${filter.key}"~"${filter.valueRegex}"](around:${radiusMeters},${latString},${lngString});`,
      `relation["${filter.key}"~"${filter.valueRegex}"](around:${radiusMeters},${latString},${lngString});`
    );
  }

  return [
    `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];`,
    "(",
    ...clauses,
    ");",
    "out center tags;",
  ].join("\n");
}

function escapeRegexFragment(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildKeywordRegexFromMessage(
  message: string,
  category?: string
): string | undefined {
  const tokens = tokenizeForRanking(message).filter((token) => token.length >= 2).slice(0, 8);
  const categoryHints =
    category === "shopping"
      ? ["apple", "mac", "computer", "laptop", "pc", "notebook", "electronics", "digital", "苹果", "电脑", "数码", "笔记本"]
      : [];

  const merged = [...tokens, ...categoryHints]
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2);

  const unique = Array.from(new Set(merged));
  if (unique.length === 0) return undefined;

  return unique.map((token) => escapeRegexFragment(token)).join("|");
}

function buildOverpassKeywordQuery(
  keywordRegex: string,
  radiusMeters: number,
  lat: number,
  lng: number
): string {
  const latString = lat.toFixed(6);
  const lngString = lng.toFixed(6);

  const clauses = [
    `node["name"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
    `way["name"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
    `relation["name"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
    `node["brand"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
    `way["brand"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
    `relation["brand"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
    `node["operator"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
    `way["operator"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
    `relation["operator"~"${keywordRegex}",i](around:${radiusMeters},${latString},${lngString});`,
  ];

  return [
    `[out:json][timeout:${OVERPASS_QUERY_TIMEOUT_SECONDS}];`,
    "(",
    ...clauses,
    ");",
    "out center tags;",
  ].join("\n");
}

function runOverpassQueued<T>(runner: () => Promise<T>): Promise<T> {
  const task = overpassQueue.then(() => runner());
  overpassQueue = task.then(
    () => undefined,
    () => undefined
  );
  return task;
}

async function fetchOverpassElements(query: string): Promise<OverpassElement[] | null> {
  let response: Response;
  try {
    response = await runOverpassQueued(() =>
      fetch(OVERPASS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": OVERPASS_USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
      })
    );
  } catch (error) {
    console.error("[NearbyStoreSearch] Overpass request failed:", error);
    return null;
  }

  if (!response.ok) {
    console.warn("[NearbyStoreSearch] Overpass responded with status:", response.status);
    return null;
  }

  let data: OverpassResponse;
  try {
    data = (await response.json()) as OverpassResponse;
  } catch (error) {
    console.error("[NearbyStoreSearch] Failed to parse Overpass JSON:", error);
    return null;
  }

  return Array.isArray(data.elements) ? data.elements : [];
}

function mapOverpassElementsToResult(
  elements: OverpassElement[],
  params: NearbySearchParams,
  category: string | undefined,
  radiusKm: number,
  limit: number
): NearbySearchResult {
  const tokens = tokenizeForRanking(params.message);
  const mapPlatform = resolveMapPlatformForLocation(params.lat, params.lng);
  const unitSystem = getDistanceUnitSystem(params.region);
  const ranked: RankedOverpassCandidate[] = [];
  const dedupe = new Set<string>();

  for (const element of elements) {
    const tags = element.tags || {};
    const name = pickPoiName(tags);
    if (!name || isGenericPoiName(name)) {
      continue;
    }

    const normalizedName = name.toLowerCase();
    if (dedupe.has(normalizedName)) {
      continue;
    }

    const coordinates = extractLocation(element);
    if (!coordinates) {
      continue;
    }

    const distanceKm = haversineDistanceKm(
      params.lat,
      params.lng,
      coordinates.lat,
      coordinates.lng
    );
    if (distanceKm > radiusKm) {
      continue;
    }

    const poiCategory = inferCategoryFromTags(tags, category);
    const address = buildAddressFromTags(tags);
    const contactPhone = tags["contact:phone"] || tags.phone || tags["phone:mobile"];
    const businessHours = tags.opening_hours;
    const cuisine = normalizeTagValue(tags.cuisine);
    const amenity = normalizeTagValue(tags.amenity);
    const shop = normalizeTagValue(tags.shop);

    const tagsForCard = [cuisine, amenity, shop].filter(
      (tag): tag is string => Boolean(tag && tag.length > 0)
    );

    const ratingRaw = toNumber(tags.stars) ?? toNumber(tags.rating);
    const rating = ratingRaw && ratingRaw <= 5 ? ratingRaw : undefined;
    const id =
      element.id !== undefined && element.type
        ? `osm_${element.type}_${element.id}`
        : `osm_${Math.random().toString(36).slice(2, 10)}`;
    const searchQuery = [name, address].filter(Boolean).join(", ");
    const description = buildOverpassDescription(tags, distanceKm, params.region);

    const candidate: CandidateResult = {
      id,
      name,
      description,
      category: poiCategory,
      distance: formatDistance(distanceKm, unitSystem),
      rating,
      businessHours: businessHours || undefined,
      phone: contactPhone || undefined,
      address,
      tags: tagsForCard.length > 0 ? tagsForCard : undefined,
      platform: mapPlatform,
      searchQuery: searchQuery || name,
    };

    ranked.push({
      score: scoreOverpassCandidate(candidate, distanceKm, tokens),
      distanceKm,
      candidate,
      coordinates,
    });
    dedupe.add(normalizedName);
  }

  ranked.sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (Math.abs(scoreDiff) > 0.001) {
      return scoreDiff;
    }
    return left.distanceKm - right.distanceKm;
  });

  return {
    candidates: ranked.slice(0, limit).map((item) => item.candidate),
    radiusKm,
    matchedCount: ranked.length,
    category,
    source: "overpass",
  };
}

async function fetchNearbyStoresFromOverpass(
  params: NearbySearchParams,
  category: string | undefined,
  radiusKm: number,
  limit: number
): Promise<NearbySearchResult> {
  const filters = getOverpassFilters(category);
  const keywordRegex = buildKeywordRegexFromMessage(params.message, category);

  const runSearch = async (currentRadiusKm: number): Promise<NearbySearchResult | null> => {
    const radiusMeters = radiusKmToMeters(currentRadiusKm);
    const primaryQuery = buildOverpassQuery(filters, radiusMeters, params.lat, params.lng);
    const primaryElements = await fetchOverpassElements(primaryQuery);
    if (!primaryElements) {
      return null;
    }

    const primaryResult = mapOverpassElementsToResult(
      primaryElements,
      params,
      category,
      currentRadiusKm,
      limit
    );
    if (primaryResult.candidates.length > 0) {
      return primaryResult;
    }

    if (!keywordRegex) {
      return primaryResult;
    }

    const keywordQuery = buildOverpassKeywordQuery(
      keywordRegex,
      radiusMeters,
      params.lat,
      params.lng
    );
    const keywordElements = await fetchOverpassElements(keywordQuery);
    if (!keywordElements) {
      return primaryResult;
    }

    const keywordResult = mapOverpassElementsToResult(
      keywordElements,
      params,
      category,
      currentRadiusKm,
      limit
    );
    if (keywordResult.candidates.length > 0) {
      return keywordResult;
    }

    return primaryResult;
  };

  const primaryResult = await runSearch(radiusKm);
  if (primaryResult && primaryResult.candidates.length > 0) {
    return primaryResult;
  }

  const expandedRadiusKm = clampRadius(Math.max(radiusKm + 8, radiusKm * 1.8));
  if (expandedRadiusKm > radiusKm + 0.1) {
    const expandedResult = await runSearch(expandedRadiusKm);
    if (expandedResult && expandedResult.candidates.length > 0) {
      return expandedResult;
    }
  }

  if (primaryResult) {
    return primaryResult;
  }

  return {
    candidates: [],
    radiusKm,
    matchedCount: 0,
    category,
    source: "overpass",
  };
}

async function fetchNearbyStoresFromAmap(
  params: NearbySearchParams,
  category: string | undefined,
  radiusKm: number,
  limit: number
): Promise<NearbySearchResult | null> {
  const key = getAmapApiKey();
  if (!key) {
    return null;
  }

  const radiusMeters = radiusKmToMeters(radiusKm);
  const offset = Math.max(5, Math.min(20, limit));
  const profile = buildAmapSearchProfile(params.message, category, params.locale);
  const types = profile.types;
  const url =
    `${AMAP_PLACE_AROUND_ENDPOINT}?key=${encodeURIComponent(key)}` +
    `&location=${encodeURIComponent(`${params.lng},${params.lat}`)}` +
    `&types=${encodeURIComponent(types)}` +
    (profile.keywords ? `&keywords=${encodeURIComponent(profile.keywords)}` : "") +
    `&radius=${encodeURIComponent(String(radiusMeters))}` +
    `&sortrule=distance&offset=${encodeURIComponent(String(offset))}` +
    "&page=1&extensions=all&output=JSON";

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(AMAP_PLACE_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("[NearbyStoreSearch] Amap nearby request failed:", error);
    return null;
  }

  if (!response.ok) {
    console.warn("[NearbyStoreSearch] Amap nearby responded with status:", response.status);
    return null;
  }

  let data: AmapPlaceResponse;
  try {
    data = (await response.json()) as AmapPlaceResponse;
  } catch (error) {
    console.warn("[NearbyStoreSearch] Failed to parse Amap nearby JSON:", error);
    return null;
  }

  if (data.status !== "1") {
    if (data.info) {
      console.warn("[NearbyStoreSearch] Amap nearby returned error:", data.info);
    }
    return null;
  }

  const pois = Array.isArray(data.pois) ? data.pois : [];
  if (pois.length === 0) {
    return {
      candidates: [],
      radiusKm,
      matchedCount: 0,
      category,
      source: "overpass",
    };
  }

  const messageTokens = tokenizeForRanking(params.message);
  const mapPlatform = resolveMapPlatformForLocation(params.lat, params.lng);
  const unitSystem = getDistanceUnitSystem(params.region);
  const ranked: RankedOverpassCandidate[] = [];
  const dedupe = new Set<string>();

  for (const poi of pois) {
    if (profile.strictCarWash && !isAmapPoiCarWashRelevant(poi)) {
      continue;
    }

    const name = (poi.name || "").trim();
    if (!name || isGenericPoiName(name)) {
      continue;
    }

    const normalizedName = name.toLowerCase();
    if (dedupe.has(normalizedName)) {
      continue;
    }

    const coordinates = parseAmapLocation(poi.location);
    const distanceMeters = toNumber(poi.distance);
    let distanceKm = distanceMeters !== null ? distanceMeters / 1000 : null;
    if (distanceKm === null && coordinates) {
      distanceKm = haversineDistanceKm(params.lat, params.lng, coordinates.lat, coordinates.lng);
    }
    if (distanceKm === null || !Number.isFinite(distanceKm)) {
      continue;
    }
    if (distanceKm > radiusKm) {
      continue;
    }

    const address = poi.address?.trim() || undefined;
    const typeTag = normalizeTagValue(poi.type);
    const tagsForCard = typeTag ? typeTag.split(";").slice(0, 3) : undefined;
    const ratingRaw = toNumber(poi.biz_ext?.rating);
    const rating = ratingRaw && ratingRaw <= 5 ? ratingRaw : undefined;
    const description = buildAmapDescription(poi, distanceKm, params.locale, params.region);
    const searchQuery = [name, address].filter(Boolean).join(", ");

    const candidate: CandidateResult = {
      id: poi.id || `amap_${Math.random().toString(36).slice(2, 10)}`,
      name,
      description,
      category: category || inferCategoryFromMessage(params.message, params.locale) || "local_life",
      distance: formatDistance(distanceKm, unitSystem),
      rating,
      priceRange: toNumber(poi.biz_ext?.cost) ? `${poi.biz_ext?.cost}` : undefined,
      businessHours: poi.opentime2 || poi.opentime || undefined,
      phone: poi.tel || undefined,
      address,
      tags: tagsForCard && tagsForCard.length > 0 ? tagsForCard : undefined,
      platform: mapPlatform,
      searchQuery: searchQuery || name,
    };

    ranked.push({
      score: scoreOverpassCandidate(candidate, distanceKm, messageTokens),
      distanceKm,
      candidate,
      coordinates: coordinates || undefined,
    });
    dedupe.add(normalizedName);
  }

  ranked.sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (Math.abs(scoreDiff) > 0.001) {
      return scoreDiff;
    }
    return left.distanceKm - right.distanceKm;
  });

  let finalRanked = ranked;
  if (profile.strictCarWash && ranked.length > 0) {
    const points = ranked
      .map((item) => item.coordinates || null)
      .filter((point): point is { lat: number; lng: number } => Boolean(point));

    const drivingDistances = await fetchAmapDrivingDistancesKm(
      key,
      { lat: params.lat, lng: params.lng },
      points
    );

    if (drivingDistances && drivingDistances.length > 0) {
      let distanceIndex = 0;
      const routeFiltered: RankedOverpassCandidate[] = [];

      for (const item of ranked) {
        if (!item.coordinates) {
          routeFiltered.push(item);
          continue;
        }

        const drivingKm = drivingDistances[distanceIndex];
        distanceIndex += 1;

        if (drivingKm !== null && Number.isFinite(drivingKm)) {
          if (drivingKm > radiusKm) {
            continue;
          }

          routeFiltered.push({
            ...item,
            distanceKm: drivingKm,
            candidate: {
              ...item.candidate,
              distance: formatDistance(drivingKm, unitSystem),
            },
          });
          continue;
        }

        routeFiltered.push(item);
      }

      routeFiltered.sort((left, right) => {
        const scoreDiff = right.score - left.score;
        if (Math.abs(scoreDiff) > 0.001) {
          return scoreDiff;
        }
        return left.distanceKm - right.distanceKm;
      });

      finalRanked = routeFiltered;
    }
  }

  const candidates = finalRanked.slice(0, limit).map((item) => item.candidate);
  return {
    candidates,
    radiusKm,
    matchedCount: finalRanked.length,
    category,
    source: "overpass",
  };
}

export async function searchNearbyStores(
  params: NearbySearchParams
): Promise<NearbySearchResult> {
  const radiusKm = parseRadiusKmFromMessage(params.message);
  const inferredCategory = inferCategoryFromMessage(params.message, params.locale);
  const limit = Math.max(1, Math.min(10, params.limit ?? 5));
  const strictCarWash = isCarWashIntent(params.message);

  if (params.region === "INTL") {
    const shouldTryAmap = isLikelyInChina(params.lat, params.lng);
    let amapResult: NearbySearchResult | null = null;

    if (shouldTryAmap) {
      amapResult = await fetchNearbyStoresFromAmap(
        params,
        inferredCategory,
        radiusKm,
        Math.max(limit, 8)
      );
      if (strictCarWash && amapResult && amapResult.candidates.length > 0) {
        amapResult.category = inferredCategory;
        return {
          ...amapResult,
          candidates: amapResult.candidates.slice(0, limit),
        };
      }
      if (amapResult && amapResult.candidates.length >= limit) {
        amapResult.category = inferredCategory;
        return {
          ...amapResult,
          candidates: amapResult.candidates.slice(0, limit),
        };
      }
    }

    const overpassResult = await fetchNearbyStoresFromOverpass(
      params,
      inferredCategory,
      radiusKm,
      limit
    );
    overpassResult.category = inferredCategory;

    if (amapResult && amapResult.candidates.length > 0) {
      const mergedCandidates = mergeCandidateLists(
        amapResult.candidates,
        overpassResult.candidates,
        limit
      );

      return {
        candidates: mergedCandidates,
        radiusKm: amapResult.radiusKm,
        matchedCount: Math.max(
          amapResult.matchedCount,
          overpassResult.matchedCount,
          mergedCandidates.length
        ),
        category: inferredCategory,
        source: "overpass",
      };
    }

    return overpassResult;
  }

  const shouldTryAmap = isLikelyInChina(params.lat, params.lng);
  let amapResult: NearbySearchResult | null = null;
  if (shouldTryAmap) {
    amapResult = await fetchNearbyStoresFromAmap(
      params,
      inferredCategory,
      radiusKm,
      Math.max(limit, 8)
    );
  }

  if (amapResult) {
    amapResult.category = inferredCategory;
    return {
      ...amapResult,
      candidates: amapResult.candidates.slice(0, limit),
    };
  }

  return {
    candidates: [],
    radiusKm,
    matchedCount: 0,
    category: inferredCategory,
    source: "database",
  };
}
