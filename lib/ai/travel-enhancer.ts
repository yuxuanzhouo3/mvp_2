/**
 * Random Travel 专门推荐处理器
 * 为旅游推荐提供特殊规则和增强体验
 */

export interface TravelRecommendation {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  searchQuery: string;
  platform: string;
  destination: {
    name: string;
    nameEn?: string;
    country?: string;
    region?: string;
  };
  highlights: string[];
  bestSeason?: string;
  travelStyle?: string[];
}

/**
 * 增强 Random Travel 推荐内容
 */
export function enhanceTravelRecommendation(
  recommendation: any,
  locale: string = 'zh'
): TravelRecommendation {
  // 提取核心目的地信息
  const destination = extractDestinationInfo(recommendation.title, recommendation.description);

  // 生成高度相关的搜索查询 - 使用目的地名称而不是通用关键词
  const enhancedSearchQuery = generateDestinationSearchQuery(recommendation, locale);
  const enhancedReason = improveTravelReason(recommendation, locale);

  // 智能选择最佳平台 - 根据推荐类型选择
  const bestPlatform = selectPlatformByRecommendationType(recommendation);

  // 注意：不在这里生成链接，由 route.ts 处理

  // 生成亮点
  const highlights = generateHighlights({ ...recommendation, reason: enhancedReason });

  return {
    ...recommendation,
    reason: enhancedReason,
    searchQuery: enhancedSearchQuery,
    platform: bestPlatform,
    destination,
    highlights,
    metadata: {
      ...recommendation.metadata,
      destination,
      highlights
    }
  };
}

/**
 * Travel helper utils
 */
function trimByChars(value: string, limit: number): string {
  return Array.from(value).slice(0, Math.max(0, limit)).join("");
}

function normalizeTravelText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function extractLandmarkFromTitle(title: string): string {
  const raw = normalizeTravelText(title);
  if (!raw) return "";
  const segments = raw.split(/[·・]/).map((s) => s.trim()).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : raw;
}

function pickMeaningfulTravelTag(tags: string[]): string | "" {
  const generic = /^(旅行|旅游|出行|景点|目的地|热门|推荐|攻略)$/;
  for (const tag of tags) {
    if (tag && !generic.test(tag)) return tag;
  }
  return tags[0] || "";
}

function shouldReplaceTravelReason(reason: string, core: string, tags: string[]): boolean {
  if (!reason) return true;
  if (reason.length < 8) return true;

  const hasCore = Boolean(core && reason.includes(core));
  const hasTag = tags.some((tag) => tag && reason.includes(tag));
  const genericPattern = /(适合|推荐|热门|打卡|周末|放松|口碑|必去|人气|小众|值得)/;
  const genericHit = genericPattern.test(reason);

  if (genericHit) {
    if (reason.length <= 18) return true;
    if (!hasTag) return true;
    return !hasCore;
  }

  return !(hasCore || hasTag);
}

function improveTravelReason(recommendation: any, locale: string): string {
  const title = normalizeTravelText(recommendation.title);
  const description = normalizeTravelText(recommendation.description);
  const rawReason = normalizeTravelText(recommendation.reason);
  const tags = Array.isArray(recommendation.tags)
    ? recommendation.tags.filter((t: unknown): t is string => typeof t === "string" && t.trim().length > 0)
    : [];
  const core = extractLandmarkFromTitle(title);

  if (!shouldReplaceTravelReason(rawReason, core, tags)) {
    return rawReason;
  }

  const sentence = description.split(/[。！？!?]/)[0]?.trim();
  const limit = locale === "zh" ? 44 : 100;

  if (sentence) {
    const trimmed = trimByChars(sentence, limit);
    return core && !trimmed.includes(core) ? `${core}：${trimmed}` : trimmed;
  }

  const tag = pickMeaningfulTravelTag(tags);
  if (tag) {
    const value = core ? `${core}主打${tag}体验` : `主打${tag}体验`;
    return trimByChars(value, limit);
  }

  const fallback = locale === "zh" ? "细节丰富，值得安排" : "Packed with details worth the visit";
  return core ? trimByChars(`${core}，${fallback}`, limit) : trimByChars(fallback, limit);
}

/**
 * 判断是否为国际目的地
 */
function isInternationalDestination(title: string): boolean {
  const internationalKeywords = [
    'Bali', 'Phuket', 'Singapore', 'Tokyo', 'Seoul', 'Dubai', 'Paris', 'London',
    'New York', 'Los Angeles', 'Sydney', 'Barcelona', 'Rome', 'Amsterdam',
    '巴厘岛', '普吉岛', '新加坡', '东京', '首尔', '迪拜', '巴黎', '伦敦'
  ];

  return internationalKeywords.some(keyword =>
    title.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * 生成基于目的地的精准搜索查询
 */
function generateDestinationSearchQuery(
  recommendation: any,
  locale: string
): string {
  const locationName = extractCoreLocationName(recommendation.title);
  const title = typeof recommendation.title === "string" ? recommendation.title.trim() : "";

  if (locale === "zh") {
    return (locationName || title).trim();
  }

  const typeKeywords = getTypeSpecificKeywords(recommendation, locale);
  let searchQuery = locationName || title;
  if (typeKeywords) {
    searchQuery += ` ${typeKeywords}`;
  }
  return searchQuery.trim();
}


/**
 * 根据推荐类型选择最佳平台
 */
function selectPlatformByRecommendationType(
  recommendation: any
): string {
  const title = recommendation.title?.toLowerCase() || '';
  const tags = recommendation.tags || [];

  // 所有类型都优先使用 TripAdvisor
  // 景点、观光、文化遗址
  if (title.includes('寺') || title.includes('庙') || title.includes('塔') ||
      title.includes('宫') || title.includes('博物馆') || title.includes('遗址') ||
      tags.includes('历史文化') || tags.includes('文化') || tags.includes('景点')) {
    return 'TripAdvisor';
  }

  // 主题公园、娱乐
  if (title.includes('迪士尼') || title.includes('乐园') || title.includes('公园') ||
      tags.includes('主题公园') || tags.includes('娱乐')) {
    return 'TripAdvisor';
  }

  // 自然风光、海滩
  if (title.includes('海滩') || title.includes('山') ||
      title.includes('湖') || title.includes('瀑布') ||
      tags.includes('自然') || tags.includes('海滩')) {
    return 'TripAdvisor';
  }

  // 游船、体验
  if (title.includes('游船') || title.includes('体验') || title.includes('tour') ||
      tags.includes('游船') || tags.includes('体验')) {
    return 'TripAdvisor';
  }

  // 只有明确是国际度假村才使用 Booking.com（最小化使用）
  if (isInternationalDestination(recommendation.title) &&
      (title.includes('度假村') || title.includes('resort'))) {
    return 'Booking.com';
  }

  // 默认选择 TripAdvisor（主要使用）
  return 'TripAdvisor';
}

/**
 * 提取核心地点名称
 */
function extractCoreLocationName(
  title: string
): string {
  const suffixes = [
    "\u65c5\u884c\u653b\u7565", "\u6e38\u73a9\u6307\u5357", "\u4e00\u65e5\u6e38", "\u4e24\u65e5\u6e38",
    "Tour", "Travel Guide", "Day Trip", "Experience"
  ];

  let name = title;
  suffixes.forEach((suffix) => {
    if (name.includes(suffix)) {
      name = name.replace(suffix, "").trim();
    }
  });

  const trimmed = name.trim();
  if (!trimmed) return trimmed;

  if (/[\u00b7\u30fb]/.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(/[\uFF0C,\u3001/\-]/);
  return parts[0]?.trim() || trimmed;
}

/**
 * 根据推荐类型获取特定关键词
 */
function getTypeSpecificKeywords(recommendation: any, locale: string): string {
  const title = recommendation.title?.toLowerCase() || '';
  const tags: string[] = (recommendation.tags || []).filter(
    (t: unknown): t is string => typeof t === 'string' && t.trim().length > 0
  );

  // 英文关键词
  const enKeywords = {
    temple: 'temple',
    palace: 'palace museum',
    museum: 'museum',
    tower: 'tower observation deck',
    park: 'park attraction',
    beach: 'beach',
    island: 'island',
    disney: 'disneyland theme park',
    cruise: 'cruise tour',
    experience: 'experience tour',
    food: 'food tour cuisine',
    shopping: 'shopping district market'
  };

  // 中文关键词
  const zhKeywords = {
    寺: '寺庙',
    庙: '庙宇',
    宫: '宫殿',
    塔: '塔观景',
    博物馆: '博物馆',
    公园: '公园景点',
    海滩: '海滩',
    海岛: '海岛度假',
    迪士尼: '迪士尼乐园',
    游船: '游船观光',
    体验: '体验活动',
    美食: '美食旅游',
    购物: '购物区'
  };

  const keywords = locale === 'zh' ? zhKeywords : enKeywords;

  for (const [key, value] of Object.entries(keywords)) {
    if (title.includes(key) || tags.some(tag => tag.includes(key))) {
      return value;
    }
  }

  // 如果没有特定类型，返回通用的旅游关键词
  return locale === 'zh' ? '旅游景点' : 'attractions things to do';
}

/**
 * 从推荐内容中提取目的地信息
 */
function extractDestinationInfo(title: string, description: string): TravelRecommendation['destination'] {
  // 尝试提取目的地名称
  const parts = title.split(/[，,·•]/);
  const name = parts[0]?.trim() || title;

  // 尝试提取国家/地区信息
  let country, region;
  const lowerDesc = description.toLowerCase();

  const countryMappings: Record<string, string> = {
    'thailand': '泰国',
    'indonesia': '印度尼西亚',
    'japan': '日本',
    'korea': '韩国',
    'usa': '美国',
    'france': '法国',
    'italy': '意大利',
    'uk': '英国',
    'spain': '西班牙'
  };

  // 查找国家信息
  for (const [en, zh] of Object.entries(countryMappings)) {
    if (lowerDesc.includes(en) || description.includes(zh)) {
      country = zh;
      break;
    }
  }

  return {
    name,
    country,
    region
  };
}

/**
 * 生成旅游亮点
 */
function generateHighlights(recommendation: any): string[] {
  const highlights: string[] = [];

  // 从推荐理由中提取亮点
  if (recommendation.reason) {
    const patterns = [
      /([^，,。.]*?美景[^，,。.]*?)/,
      /([^，,。.]*?文化[^，,。.]*?)/,
      /([^，,。.]*?美食[^，,。.]*?)/,
      /([^，,。.]*?体验[^，,。.]*?)/,
      /([^，,。.]*?活动[^，,。.]*?)/,
      /([^，,。.]*?风景[^，,。.]*?)/,
      /([^，,。.]*?历史[^，,。.]*?)/
    ];

    patterns.forEach(pattern => {
      const match = recommendation.reason.match(pattern);
      if (match) {
        highlights.push(match[1].trim());
      }
    });
  }

  // 如果没有提取到足够的亮点，使用标签
  if (highlights.length < 3 && recommendation.tags) {
    highlights.push(...recommendation.tags.slice(0, 3 - highlights.length));
  }

  return highlights.slice(0, 4); // 最多返回4个亮点
}

/**
 * 为旅游推荐生成特殊的元数据标签
 */
export function generateTravelMetadata(recommendation: TravelRecommendation): Record<string, any> {
  return {
    destination: recommendation.destination,
    highlights: recommendation.highlights,
    bestSeason: recommendation.bestSeason,
    travelStyle: recommendation.travelStyle,
    isInternational: recommendation.destination.country !== '中国',
    category: 'travel',
    enhanced: true
  };
}
