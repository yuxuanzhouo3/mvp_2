/**
 * 轻量级反向地理编码
 *
 * 功能描述：将经纬度坐标转换为可读的城市/区域名称
 * 用于给 AI 提供用户所在城市上下文，避免 AI 凭空猜测位置
 *
 * 策略：
 * 1. CN/中国境内坐标优先使用高德地图（可选 API Key）
 * 2. 回退到 Nominatim (OpenStreetMap) 免费 API
 * 3. 全部失败时回退到坐标直接传递（附带提示让 AI 不要猜测城市）
 */

interface GeocodedLocation {
  /** 城市名 */
  city: string;
  /** 区/县 */
  district?: string;
  /** 省/州 */
  province?: string;
  /** 国家 */
  country?: string;
  /** 完整可读地址 */
  displayName: string;
}

export type GeocodeRegion = "CN" | "INTL";

interface NominatimResponse {
  address?: {
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state_district?: string;
    suburb?: string;
    district?: string;
    neighbourhood?: string;
    quarter?: string;
    state?: string;
    province?: string;
    country?: string;
  };
  display_name?: string;
}

interface AmapResponse {
  status?: string;
  info?: string;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      country?: string;
      province?: string;
      city?: string | string[];
      district?: string;
    };
  };
}

let hasWarnedMissingAmapKey = false;
let nominatimQueue: Promise<void> = Promise.resolve();
let lastNominatimRequestAt = 0;

const NOMINATIM_REVERSE_ENDPOINT =
  process.env.NOMINATIM_REVERSE_ENDPOINT || "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_MIN_INTERVAL_MS = Math.max(
  1000,
  Number(process.env.NOMINATIM_MIN_INTERVAL_MS || "1100")
);

function resolveNominatimUserAgent(): string {
  const configured = process.env.NOMINATIM_USER_AGENT?.trim();
  if (configured) {
    return configured;
  }

  const contactUrl =
    process.env.NOMINATIM_CONTACT_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const contactEmail = process.env.NOMINATIM_CONTACT_EMAIL?.trim();

  if (contactUrl && contactEmail) {
    return `ProjectOneAssistant/1.0 (${contactUrl}; ${contactEmail})`;
  }
  if (contactUrl) {
    return `ProjectOneAssistant/1.0 (${contactUrl})`;
  }
  if (contactEmail) {
    return `ProjectOneAssistant/1.0 (mailto:${contactEmail})`;
  }

  return "ProjectOneAssistant/1.0 (+mailto:ops@project-one.app)";
}

const NOMINATIM_USER_AGENT = resolveNominatimUserAgent();
const NOMINATIM_REFERER =
  process.env.NOMINATIM_CONTACT_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runNominatimRateLimited<T>(runner: () => Promise<T>): Promise<T> {
  const task = nominatimQueue.then(async () => {
    const elapsedMs = Date.now() - lastNominatimRequestAt;
    const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - elapsedMs);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastNominatimRequestAt = Date.now();
    return runner();
  });

  nominatimQueue = task.then(
    () => undefined,
    () => undefined
  );

  return task;
}

function isLikelyInChina(lat: number, lng: number): boolean {
  return lat >= 3.8 && lat <= 53.6 && lng >= 73.5 && lng <= 135.1;
}

function shouldPreferAmap(region: GeocodeRegion | undefined, lat: number, lng: number): boolean {
  if (region === "INTL") {
    return false;
  }
  if (region === "CN") {
    return true;
  }
  return isLikelyInChina(lat, lng);
}

function getAmapApiKey(): string | undefined {
  return (
    process.env.AMAP_WEB_SERVICE_KEY ||
    process.env.AMAP_API_KEY ||
    process.env.GAODE_WEB_SERVICE_KEY
  );
}

async function runProvider(
  providerName: "Amap" | "Nominatim",
  runner: () => Promise<GeocodedLocation | null>
): Promise<GeocodedLocation | null> {
  try {
    return await runner();
  } catch (error) {
    console.warn(`[ReverseGeocode] ${providerName} failed:`, error);
    return null;
  }
}

/**
 * 反向地理编码：经纬度 → 城市/区域
 *
 * @param lat - 纬度
 * @param lng - 经度
 * @param locale - 语言 zh|en
 * @param region - 部署区域 CN|INTL（可选）
 * @returns 地理位置信息，失败返回 null
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  locale: "zh" | "en" = "zh",
  region?: GeocodeRegion
): Promise<GeocodedLocation | null> {
  if (region === "INTL") {
    return runProvider("Nominatim", () => nominatimReverse(lat, lng, locale, 5000));
  }

  const preferAmap = shouldPreferAmap(region, lat, lng);

  if (preferAmap) {
    const amapResult = await runProvider("Amap", () => amapReverse(lat, lng, locale));
    if (amapResult) return amapResult;
  }

  const nominatimTimeout = preferAmap ? 2500 : 5000;
  const nominatimResult = await runProvider("Nominatim", () =>
    nominatimReverse(lat, lng, locale, nominatimTimeout)
  );
  if (nominatimResult) return nominatimResult;

  return null;
}

/**
 * 使用高德地图反向地理编码
 * 说明：高德在 CN 网络可达性更高，需要配置 API Key。
 */
async function amapReverse(
  lat: number,
  lng: number,
  locale: "zh" | "en"
): Promise<GeocodedLocation | null> {
  const key = getAmapApiKey();
  if (!key) {
    if (!hasWarnedMissingAmapKey) {
      hasWarnedMissingAmapKey = true;
      console.warn(
        "[ReverseGeocode] Amap key is missing. Set AMAP_WEB_SERVICE_KEY (or AMAP_API_KEY)."
      );
    }
    return null;
  }

  const language = locale === "en" ? "en" : "zh_cn";
  const location = `${lng},${lat}`;
  const url =
    `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(key)}` +
    `&location=${encodeURIComponent(location)}` +
    `&extensions=base&radius=1000&language=${language}&output=JSON`;

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(3500),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as AmapResponse;
  if (!data || data.status !== "1" || !data.regeocode?.addressComponent) return null;

  const address = data.regeocode.addressComponent;
  const province = address.province || "";
  const district = address.district || "";
  const cityRaw = Array.isArray(address.city) ? address.city[0] : address.city;
  const city = cityRaw || district || province || "";
  const country = address.country || (locale === "zh" ? "中国" : "China");

  const formattedAddress = data.regeocode.formatted_address || "";
  const fallbackDisplayName =
    locale === "zh"
      ? [country, province, city, district].filter(Boolean).join("")
      : [district, city, province, country].filter(Boolean).join(", ");

  return {
    city,
    district,
    province,
    country,
    displayName: formattedAddress || fallbackDisplayName,
  };
}

/**
 * 使用 Nominatim (OpenStreetMap) 反向地理编码
 * 免费、无需 API Key、支持中文
 */
async function nominatimReverse(
  lat: number,
  lng: number,
  locale: "zh" | "en",
  timeoutMs: number
): Promise<GeocodedLocation | null> {
  const acceptLang = locale === "zh" ? "zh-CN,zh" : "en";
  const url =
    `${NOMINATIM_REVERSE_ENDPOINT}?format=json` +
    `&lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lng))}` +
    `&accept-language=${encodeURIComponent(acceptLang)}` +
    "&zoom=18";

  const headers: Record<string, string> = {
    "User-Agent": NOMINATIM_USER_AGENT,
    "Accept-Language": acceptLang,
  };
  if (NOMINATIM_REFERER) {
    headers.Referer = NOMINATIM_REFERER;
  }

  const response = await runNominatimRateLimited(() =>
    fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
  );

  if (!response.ok) return null;

  const data = (await response.json()) as NominatimResponse;
  if (!data || !data.address) return null;

  const addr = data.address;

  // 提取城市名（Nominatim 返回的字段名因地区而异）
  const city =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.county ||
    addr.state_district ||
    "";

  const district =
    addr.suburb ||
    addr.district ||
    addr.neighbourhood ||
    addr.quarter ||
    "";

  const province =
    addr.state ||
    addr.province ||
    "";

  const country = addr.country || "";

  // 构建可读地址
  let displayName = "";
  if (locale === "zh") {
    displayName = [country, province, city, district].filter(Boolean).join("");
  } else {
    displayName = [district, city, province, country].filter(Boolean).join(", ");
  }

  return {
    city,
    district,
    province,
    country,
    displayName: displayName || data.display_name || "",
  };
}

/**
 * 构建给 AI 的位置上下文字符串
 *
 * @param lat - 纬度
 * @param lng - 经度
 * @param locale - 语言
 * @param region - 部署区域 CN|INTL（可选）
 * @returns 可读的位置描述字符串
 */
export async function buildLocationContext(
  lat: number,
  lng: number,
  locale: "zh" | "en" = "zh",
  region?: GeocodeRegion
): Promise<string> {
  const geo = await reverseGeocode(lat, lng, locale, region);

  if (geo && geo.city) {
    if (locale === "zh") {
      const parts = [geo.province, geo.city, geo.district].filter(Boolean);
      return `[系统提示：用户当前位置 - ${parts.join("")}（纬度:${lat}, 经度:${lng}）。请基于该城市生成真实合理的候选结果，不要编造其他城市的结果。]`;
    }
    const parts = [geo.district, geo.city, geo.province].filter(Boolean);
    return `[System: User location - ${parts.join(", ")} (lat:${lat}, lng:${lng}). Generate results based on this city. Do not fabricate results from other cities.]`;
  }

  // 反向地理编码失败，仍传坐标但强调不要猜测
  if (locale === "zh") {
    return `[系统提示：用户当前位置坐标 - 纬度:${lat}, 经度:${lng}。请根据这个坐标判断用户所在城市，生成该城市的真实候选结果。如果无法判断城市，请询问用户所在城市。]`;
  }
  return `[System: User coordinates - lat:${lat}, lng:${lng}. Determine the user's city from these coordinates and generate results for that city. If unsure, ask the user for their city.]`;
}
