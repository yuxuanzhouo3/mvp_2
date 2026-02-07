/**
 * 轻量级反向地理编码
 *
 * 功能描述：将经纬度坐标转换为可读的城市/区域名称
 * 用于给 AI 提供用户所在城市上下文，避免 AI 凭空猜测位置
 *
 * 策略：
 * 1. 优先使用 Nominatim (OpenStreetMap) 免费 API
 * 2. 失败时回退到坐标直接传递（附带提示让 AI 不要猜测城市）
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

/**
 * 反向地理编码：经纬度 → 城市/区域
 *
 * @param lat - 纬度
 * @param lng - 经度
 * @param locale - 语言 zh|en
 * @returns 地理位置信息，失败返回 null
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  locale: "zh" | "en" = "zh"
): Promise<GeocodedLocation | null> {
  try {
    const result = await nominatimReverse(lat, lng, locale);
    if (result) return result;
  } catch (error) {
    console.warn("[ReverseGeocode] Nominatim failed:", error);
  }

  return null;
}

/**
 * 使用 Nominatim (OpenStreetMap) 反向地理编码
 * 免费、无需 API Key、支持中文
 */
async function nominatimReverse(
  lat: number,
  lng: number,
  locale: string
): Promise<GeocodedLocation | null> {
  const acceptLang = locale === "zh" ? "zh-CN,zh" : "en";
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=${acceptLang}&zoom=18`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ChenHuiApp/1.0",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) return null;

  const data = await response.json();
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
 * @returns 可读的位置描述字符串
 */
export async function buildLocationContext(
  lat: number,
  lng: number,
  locale: "zh" | "en" = "zh"
): Promise<string> {
  const geo = await reverseGeocode(lat, lng, locale);

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
