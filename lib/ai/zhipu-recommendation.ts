import { ZhipuAI } from 'zhipuai';

const client = new ZhipuAI({
  apiKey: process.env.ZHIPU_API_KEY
});

interface UserHistory {
  category: string;
  title: string;
  clicked?: boolean;
  metadata?: any;
}

interface RecommendationItem {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  searchQuery: string;  // 用于搜索引擎的查询词
  platform: string;      // 推荐的平台
}

/**
 * 使用智谱 AI 分析用户偏好并生成推荐
 * 注意：AI 只生成推荐内容，不生成链接
 */
export async function generateRecommendations(
  userHistory: UserHistory[],
  category: string,
  locale: string = 'zh'
): Promise<RecommendationItem[]> {

  const categoryConfig = {
    entertainment: {
      platforms: locale === 'zh'
        ? ['豆瓣', 'B站', '网易云音乐', 'Steam', '爱奇艺']
        : ['IMDb', 'YouTube', 'Spotify', 'Steam', 'Netflix'],
      examples: locale === 'zh'
        ? '电影、游戏、音乐、小说'
        : 'movies, games, music, books'
    },
    shopping: {
      platforms: locale === 'zh'
        ? ['淘宝', '京东', '天猫', '拼多多']
        : ['Amazon', 'eBay', 'Walmart', 'Target'],
      examples: locale === 'zh'
        ? '数码产品、服装、家居用品'
        : 'electronics, clothing, home goods'
    },
    food: {
      platforms: locale === 'zh'
        ? ['大众点评', '美团', '下厨房']
        : ['大众点评', 'TripAdvisor', 'OpenTable'],
      examples: locale === 'zh'
        ? '餐厅、菜谱、美食'
        : 'restaurants, recipes, food'
    },
    travel: {
      platforms: locale === 'zh'
        ? ['携程', '马蜂窝', '穷游', 'Booking.com', 'Agoda', 'Airbnb']
        : ['Booking.com', 'Agoda', 'TripAdvisor', 'Expedia', 'Klook', 'Airbnb'],
      examples: locale === 'zh'
        ? '景点、酒店、旅游攻略、目的地体验'
        : 'attractions, hotels, travel guides, destination experiences'
    },
    fitness: {
      platforms: locale === 'zh'
        ? ['B站', 'Keep', '小红书', '淘宝', '京东', '百度地图', '大众点评']
        : ['YouTube Fitness', 'MyFitnessPal', 'Peloton', 'Google Maps', 'Amazon', 'Yelp'],
      examples: locale === 'zh'
        ? '健身课程、健身房、健身器材、运动装备'
        : 'fitness classes, gyms, fitness equipment, workout gear'
    }
  };

  const config = categoryConfig[category] || categoryConfig.entertainment;

  const prompt = locale === 'zh' ? `
你是一个专业的推荐系统分析师。

任务：基于用户历史行为，生成 3 个个性化推荐。

用户历史记录：
${JSON.stringify(userHistory.slice(0, 20), null, 2)}

当前分类：${category} (${config.examples})

要求：
1. 分析用户的偏好特征（风格、类型、主题等）
2. 为每个推荐生成：
   - 标题：具体的推荐名称
   - 描述：简短介绍（1-2句话）
   - 理由：为什么推荐给这个用户
   - 标签：3-5个相关标签
   - 搜索词：用于在搜索引擎中查找的关键词
   - 平台：推荐在哪个平台查找（从：${config.platforms.join('、')} 中选择）

**特别说明**：
- 如果是美食分类(food)，请推荐具体的餐厅名称、菜品或美食店，而不是文章或食谱
- 推荐应该包含真实的餐厅名、特色菜品、菜系类型等
- 如果是旅游分类(travel)，请推荐具体的旅游景点、城市或目的地，要求：
  * 必须使用真实存在的国家、城市和景点名称（如：日本东京、泰国普吉岛、法国巴黎、印度尼西亚巴厘岛等）
  * 推荐理由：详细说明为什么这个地方值得去（特色、体验、最佳季节等）
  * 目的地名称：具体格式为"国家/地区 · 城市/景点名称"
  * 关键词：包含具体的英文搜索词（如：Bali Indonesia, Tokyo Japan, Paris France）
  * 平台：从${config.platforms.join('、')}中选择（优先使用国际平台如Booking.com、Agoda等）
  * 示例推荐：
    - "泰国 · 普吉岛" - 安达曼海上的热带天堂，以清澈海水和美丽海滩闻名
    - "日本 · 京都" - 古老的寺庙和传统文化，春季樱花盛开
    - "法国 · 巴黎" - 浪漫之都，埃菲尔铁塔和卢浮宫的故乡
  * 重要：不要生成虚构的地名，确保所有地名都是真实存在的！
- 如果是健身分类(fitness)，请推荐多样化的健身方式，要求：
  * 推荐类型应包括：健身视频教程、健身房、健身器材、运动装备等
  * 每个推荐要明确具体：
    - 视频教程：如"30分钟瑜伽入门"、"HIIT燃脂训练"
    - 健身房：如"附近健身房推荐"、"瑜伽馆"
    - 器材装备：如"哑铃套装"、"瑜伽垫"、"跑步机"
  * 根据推荐类型选择合适的平台：
    - 视频教程：选择B站、YouTube Fitness等
    - 健身房：选择百度地图、Google Maps、大众点评等
    - 器材购物：选择淘宝、京东、Amazon等
  * 搜索词要与推荐内容精确匹配，例如：
    - 视频教程："瑜伽入门教程"、"HIIT训练视频"
    - 健身房："附近健身房"、"瑜伽馆"
    - 器材装备："哑铃套装购买"、"瑜伽垫推荐"
- **重要：不要生成任何链接URL，只需要推荐内容！**

返回 JSON 格式（严格遵守，不要有任何额外文字）：
[
  {
    "title": "具体推荐名称",
    "description": "简短描述",
    "reason": "为什么推荐给这个用户",
    "tags": ["标签1", "标签2", "标签3"],
    "searchQuery": "用于搜索的关键词",
    "platform": "淘宝|京东|豆瓣|B站|..."
  }
]` : `
You are a professional recommendation system analyst.

Task: Generate 3 personalized recommendations based on user history.

User history:
${JSON.stringify(userHistory.slice(0, 20), null, 2)}

Current category: ${category} (${config.examples})

Requirements:
1. Analyze user preferences (style, type, theme, etc.)
2. For each recommendation, generate:
   - title: specific recommendation name
   - description: brief introduction (1-2 sentences)
   - reason: why recommend to this user
   - tags: 3-5 relevant tags
   - searchQuery: keywords for search engine
   - platform: which platform to search (from: ${config.platforms.join(', ')})

**Special Instructions**:
- For food category, recommend specific restaurants, dishes, or food establishments with real names
- Include cuisine type, specialty dishes, or restaurant names
- Do not recommend articles or recipes about food
- For travel category, recommend specific tourist destinations, cities, or attractions:
  * Requirements:
    - Must use real existing countries, cities and attractions (e.g., Tokyo Japan, Phuket Thailand, Paris France, Bali Indonesia)
    - Reason: detailed explanation why this place is worth visiting (highlights, experiences, best season, etc.)
    - Destination name: specific format "Country/Region · City/Attraction Name"
    - Keywords: include specific English search terms (e.g., Bali Indonesia, Tokyo Japan, Paris France)
    - Platform: choose from ${config.platforms.join(', ')} (prioritize international platforms like Booking.com, Agoda)
  * Example recommendations:
    - "Thailand · Phuket" - Tropical paradise in the Andaman Sea, famous for clear waters and beautiful beaches
    - "Japan · Kyoto" - Ancient temples and traditional culture, cherry blossoms in spring
    - "France · Paris" - The city of romance, home to the Eiffel Tower and Louvre Museum
  * Important: Do not generate fictional place names, ensure all locations are real and exist!
- For fitness category, recommend diverse fitness approaches:
  * Recommend various types: fitness video tutorials, gyms, fitness equipment, workout gear
  * Be specific for each recommendation:
    - Video tutorials: e.g., "30-minute Yoga for Beginners", "HIIT Fat Burning Workout"
    - Gyms: e.g., "Nearby Gym", "Yoga Studio"
    - Equipment: e.g., "Dumbbell Set", "Yoga Mat", "Treadmill"
  * Choose appropriate platform based on recommendation type:
    - Video tutorials: YouTube Fitness, B站
    - Gyms: Google Maps, 百度地图, Yelp
    - Equipment shopping: Amazon, 淘宝, 京东
  * Search queries must match content precisely, e.g.:
    - Video tutorials: "yoga for beginners", "HIIT workout video"
    - Gyms: "gyms near me", "yoga studio"
    - Equipment: "dumbbell set buy", "best yoga mat"
- **Important: Do not generate any URLs, only recommend content!**

Return JSON format (strictly, no extra text):
[
  {
    "title": "Specific recommendation name",
    "description": "Brief description",
    "reason": "Why recommend to this user",
    "tags": ["tag1", "tag2", "tag3"],
    "searchQuery": "Search keywords",
    "platform": "Amazon|eBay|IMDb|YouTube|..."
  }
]`;

  try {
    const response = await client.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: locale === 'zh'
            ? '你是推荐分析师。只返回 JSON 数组，不要生成链接，不要有markdown标记。'
            : 'You are a recommendation analyst. Only return JSON array, no links, no markdown.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      top_p: 0.9
    });

    const content = response.choices[0].message.content;
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const result = JSON.parse(cleanContent);
    return Array.isArray(result) ? result : [result];

  } catch (error) {
    console.error('智谱 AI 推荐生成失败:', error);
    return getFallbackRecommendations(category, locale);
  }
}

/**
 * 降级方案
 */
function getFallbackRecommendations(category: string, locale: string): RecommendationItem[] {
  const fallbacks: Record<string, Record<string, RecommendationItem[]>> = {
    zh: {
      entertainment: [{
        title: '热门电影推荐',
        description: '最近上映的高分电影',
        reason: '根据大众喜好为你推荐',
        tags: ['电影', '热门', '高分'],
        searchQuery: '2024 热门电影 高分',
        platform: '豆瓣'
      }],
      shopping: [{
        title: '热销数码产品',
        description: '最受欢迎的数码好物',
        reason: '根据销量和评价为你推荐',
        tags: ['数码', '热销', '好评'],
        searchQuery: '热销数码产品 好评',
        platform: '京东'
      }],
      food: [{
        title: '特色美食餐厅',
        description: '附近高评分餐厅',
        reason: '根据评价为你推荐',
        tags: ['美食', '餐厅', '高评分'],
        searchQuery: '特色餐厅 高评分',
        platform: '大众点评'
      }],
      travel: [{
        title: '热门旅游景点',
        description: '值得一去的景点',
        reason: '根据热度为你推荐',
        tags: ['旅游', '景点', '热门'],
        searchQuery: '热门旅游景点',
        platform: '携程'
      }],
      fitness: [{
        title: '健身训练课程',
        description: '适合初学者的课程',
        reason: '根据难度为你推荐',
        tags: ['健身', '课程', '初学者'],
        searchQuery: '健身训练课程 初学者',
        platform: 'Keep'
      }]
    },
    en: {
      entertainment: [{
        title: 'Popular Movies',
        description: 'Latest high-rated movies',
        reason: 'Recommended based on popular preferences',
        tags: ['movies', 'popular', 'high-rated'],
        searchQuery: '2024 popular movies high rated',
        platform: 'IMDb'
      }],
      shopping: [{
        title: 'Trending Electronics',
        description: 'Most popular electronic gadgets',
        reason: 'Recommended based on sales and reviews',
        tags: ['electronics', 'trending', 'top-rated'],
        searchQuery: 'trending electronics best seller',
        platform: 'Amazon'
      }],
      food: [{
        title: 'Top-Rated Restaurants',
        description: 'Highly-rated restaurants nearby',
        reason: 'Recommended based on reviews',
        tags: ['food', 'restaurant', 'high-rated'],
        searchQuery: 'top-rated restaurants',
        platform: 'Yelp'
      }],
      travel: [{
        title: 'Popular Attractions',
        description: 'Must-visit destinations',
        reason: 'Recommended based on popularity',
        tags: ['travel', 'attractions', 'popular'],
        searchQuery: 'popular tourist attractions',
        platform: 'TripAdvisor'
      }],
      fitness: [{
        title: 'Fitness Workout Classes',
        description: 'Beginner-friendly workout routines',
        reason: 'Recommended based on difficulty',
        tags: ['fitness', 'workout', 'beginner'],
        searchQuery: 'fitness workout for beginners',
        platform: 'YouTube'
      }]
    }
  };

  return fallbacks[locale]?.[category] || fallbacks.zh.entertainment;
}

export function isZhipuConfigured(): boolean {
  return !!process.env.ZHIPU_API_KEY;
}