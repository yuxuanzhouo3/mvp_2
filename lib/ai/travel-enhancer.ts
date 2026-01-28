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
  const enhancedSearchQuery = generateDestinationSearchQuery(recommendation, destination, locale);

  // 智能选择最佳平台 - 根据推荐类型选择
  const bestPlatform = selectPlatformByRecommendationType(recommendation);

  // 注意：不在这里生成链接，由 route.ts 处理

  // 生成亮点
  const highlights = generateHighlights(recommendation);

  return {
    ...recommendation,
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
  destination: TravelRecommendation['destination'],
  locale: string
): string {
  // 提取核心地点名称
  const locationName = extractCoreLocationName(recommendation.title);

  // 根据推荐类型添加特定关键词
  const typeKeywords = getTypeSpecificKeywords(recommendation, locale);

  // 构建搜索查询
  let searchQuery = locationName;

  // 添加类型关键词
  if (typeKeywords) {
    searchQuery += ` ${typeKeywords}`;
  }

  // 优先使用英文搜索，因为大多数旅游平台是国际化的
  if (locale === 'zh') {
    const englishName = getEnglishLocationName(locationName);
    if (englishName && englishName !== locationName) {
      searchQuery = englishName + (typeKeywords ? ` ${typeKeywords}` : '');
    }
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
  // 移除常见的后缀
  const suffixes = [
    '旅游攻略', '游玩指南', '一日游', '两日游',
    'Tour', 'Travel Guide', 'Day Trip', 'Experience'
  ];

  let name = title;
  suffixes.forEach(suffix => {
    if (name.includes(suffix)) {
      name = name.replace(suffix, '').trim();
    }
  });

  // 如果标题中有分隔符，取第一部分
  const parts = name.split(/[，,·•]/);
  name = parts[0]?.trim() || name;

  return name;
}

/**
 * 根据推荐类型获取特定关键词
 */
function getTypeSpecificKeywords(recommendation: any, locale: string): string {
  const title = recommendation.title?.toLowerCase() || '';
  const tags = recommendation.tags || [];

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
 * 获取地点的英文名称
 */
function getEnglishLocationName(name: string): string | null {
  const nameMappings: Record<string, string> = {
    '巴厘岛': 'Bali Indonesia',
    '普吉岛': 'Phuket Thailand',
    '东京': 'Tokyo Japan',
    '京都': 'Kyoto Japan',
    '大阪': 'Osaka Japan',
    '首尔': 'Seoul South Korea',
    '新加坡': 'Singapore',
    '迪拜': 'Dubai UAE',
    '巴黎': 'Paris France',
    '伦敦': 'London UK',
    '纽约': 'New York USA',
    '洛杉矶': 'Los Angeles USA',
    '悉尼': 'Sydney Australia',
    '巴塞罗那': 'Barcelona Spain',
    '罗马': 'Rome Italy',
    '阿姆斯特丹': 'Amsterdam Netherlands',
    '故宫博物院': 'Forbidden City Beijing',
    '长城': 'Great Wall of China',
    '富士山': 'Mount Fuji Japan'
  };

  // 尝试精确匹配
  if (nameMappings[name]) {
    return nameMappings[name];
  }

  // 尝试包含匹配
  for (const [zh, en] of Object.entries(nameMappings)) {
    if (name.includes(zh)) {
      return en;
    }
  }

  return null;
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
