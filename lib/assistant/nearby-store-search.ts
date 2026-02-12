import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCloudBaseDatabase } from "@/lib/database/cloudbase-client";
import type { CandidateResult } from "./types";

type NearbyRegion = "CN" | "INTL";

type NearbyStoreRow = {
  id?: string;
  _id?: string;
  region?: string;
  city?: string;
  district?: string;
  name?: string;
  category?: string;
  description?: string;
  tags?: string[];
  address?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  rating?: number | string;
  price_range?: string;
  priceRange?: string;
  business_hours?: string;
  businessHours?: string;
  estimated_time?: string;
  estimatedTime?: string;
  phone?: string;
  platform?: string;
  search_query?: string;
  searchQuery?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
};

type NearbyStoreWithDistance = {
  row: NearbyStoreRow;
  distanceKm: number;
};

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
};

const DEFAULT_RADIUS_KM = 5;
const MAX_RADIUS_KM = 30;
const MIN_RADIUS_KM = 0.3;

let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration for nearby store search");
  }

  supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminInstance;
}

function clampRadius(radiusKm: number): number {
  if (!Number.isFinite(radiusKm)) return DEFAULT_RADIUS_KM;
  return Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, radiusKm));
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

function formatDistance(distanceKm: number): string {
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
    { pattern: /(吃|餐|外卖|美食|咖啡|奶茶|火锅|烧烤)/, category: "food" },
    { pattern: /(健身|运动|瑜伽|游泳|羽毛球|跑步|gym|fitness)/, category: "fitness" },
    { pattern: /(酒店|景点|出行|旅行|机票|火车)/, category: "travel" },
    { pattern: /(商场|超市|电脑|手机|数码|家电|购物)/, category: "shopping" },
    { pattern: /(电影院|剧本杀|KTV|娱乐|酒吧)/, category: "entertainment" },
  ];

  const enRules: Array<{ pattern: RegExp; category: string }> = [
    { pattern: /(food|restaurant|coffee|cafe|tea|delivery|eat)/, category: "food" },
    { pattern: /(gym|fitness|workout|yoga|sports)/, category: "fitness" },
    { pattern: /(travel|hotel|flight|trip|sightseeing)/, category: "travel" },
    { pattern: /(shop|store|mall|electronics|grocery)/, category: "shopping" },
    { pattern: /(movie|cinema|karaoke|bar|entertainment)/, category: "entertainment" },
  ];

  const rules = locale === "zh" ? zhRules : enRules;
  const matched = rules.find((rule) => rule.pattern.test(text));
  return matched?.category;
}

async function fetchNearbyStoresFromSupabase(
  region: NearbyRegion,
  category?: string
): Promise<NearbyStoreRow[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("assistant_nearby_stores")
    .select("*")
    .eq("is_active", true)
    .eq("region", region)
    .limit(800);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) {
      console.error("[NearbyStoreSearch] Supabase query failed:", error.message);
    }
    return [];
  }

  return data as NearbyStoreRow[];
}

async function fetchNearbyStoresFromCloudBase(
  region: NearbyRegion,
  category?: string
): Promise<NearbyStoreRow[]> {
  try {
    const db = getCloudBaseDatabase();
    const whereCondition: Record<string, unknown> = {
      is_active: true,
      region,
    };

    if (category) {
      whereCondition.category = category;
    }

    const result = await db
      .collection("assistant_nearby_stores")
      .where(whereCondition)
      .limit(800)
      .get();

    return (result.data || []) as NearbyStoreRow[];
  } catch (error) {
    console.error("[NearbyStoreSearch] CloudBase query failed:", error);
    return [];
  }
}

function mapRowsToCandidates(
  rows: NearbyStoreRow[],
  params: NearbySearchParams,
  radiusKm: number,
  limit: number
): NearbySearchResult {
  const withDistance: NearbyStoreWithDistance[] = rows
    .map((row) => {
      const lat = toNumber(row.latitude) ?? toNumber(row.lat);
      const lng = toNumber(row.longitude) ?? toNumber(row.lng);

      if (lat === null || lng === null) {
        return null;
      }

      const distanceKm = haversineDistanceKm(params.lat, params.lng, lat, lng);
      return { row, distanceKm };
    })
    .filter((item): item is NearbyStoreWithDistance => Boolean(item))
    .filter((item) => item.distanceKm <= radiusKm);

  withDistance.sort((left, right) => {
    const distanceDiff = left.distanceKm - right.distanceKm;
    if (Math.abs(distanceDiff) > 0.001) {
      return distanceDiff;
    }

    const leftRating = toNumber(left.row.rating) ?? 0;
    const rightRating = toNumber(right.row.rating) ?? 0;
    return rightRating - leftRating;
  });

  const candidates: CandidateResult[] = withDistance.slice(0, limit).map((item, index) => {
    const row = item.row;
    const id = row.id || row._id || `nearby_${index + 1}`;
    const category = row.category || "local_life";
    const name = row.name || (params.locale === "zh" ? "附近门店" : "Nearby Store");
    const description =
      row.description ||
      (params.locale === "zh"
        ? `距离约 ${formatDistance(item.distanceKm)}，可到店查看。`
        : `About ${formatDistance(item.distanceKm)} away, available for in-store visit.`);

    const rating = toNumber(row.rating) ?? undefined;

    return {
      id,
      name,
      description,
      category,
      distance: formatDistance(item.distanceKm),
      rating,
      priceRange: row.price_range || row.priceRange || undefined,
      estimatedTime: row.estimated_time || row.estimatedTime || undefined,
      businessHours: row.business_hours || row.businessHours || undefined,
      phone: row.phone || undefined,
      address: row.address || undefined,
      tags: Array.isArray(row.tags) ? row.tags : undefined,
      platform:
        row.platform || (params.region === "CN" ? "高德地图" : "Google Maps"),
      searchQuery: row.search_query || row.searchQuery || name,
    };
  });

  return {
    candidates,
    radiusKm,
    matchedCount: withDistance.length,
  };
}

export async function searchNearbyStores(
  params: NearbySearchParams
): Promise<NearbySearchResult> {
  const radiusKm = parseRadiusKmFromMessage(params.message);
  const inferredCategory = inferCategoryFromMessage(params.message, params.locale);
  const limit = Math.max(1, Math.min(10, params.limit ?? 5));

  const primaryRows =
    params.region === "CN"
      ? await fetchNearbyStoresFromCloudBase(params.region, inferredCategory)
      : await fetchNearbyStoresFromSupabase(params.region, inferredCategory);

  const result = mapRowsToCandidates(primaryRows, params, radiusKm, limit);
  result.category = inferredCategory;

  if (result.candidates.length >= Math.min(3, limit) || !inferredCategory) {
    return result;
  }

  const fallbackRows =
    params.region === "CN"
      ? await fetchNearbyStoresFromCloudBase(params.region)
      : await fetchNearbyStoresFromSupabase(params.region);

  const fallbackResult = mapRowsToCandidates(fallbackRows, params, radiusKm, limit);
  fallbackResult.category = inferredCategory;
  return fallbackResult;
}
