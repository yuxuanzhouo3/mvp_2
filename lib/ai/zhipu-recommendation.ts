import OpenAI from "openai";
import { ZhipuAI } from "zhipuai";
import { isChinaDeployment } from "@/lib/config/deployment.config";

type AIProvider = "openai" | "mistral" | "zhipu";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_MODELS = {
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
  mistral: process.env.MISTRAL_MODEL || "mistral-large-latest",
  zhipu: process.env.ZHIPU_MODEL || "glm-4.5-flash",
};

function hasValidKey(value?: string | null) {
  return Boolean(value && value.trim() && !value.includes("your_"));
}

function getProviderOrder(): AIProvider[] {
  if (isChinaDeployment()) {
    return hasValidKey(process.env.ZHIPU_API_KEY) ? ["zhipu"] : [];
  }

  const providers: AIProvider[] = [];

  if (hasValidKey(process.env.OPENAI_API_KEY)) {
    providers.push("openai");
  }
  if (hasValidKey(process.env.MISTRAL_API_KEY)) {
    providers.push("mistral");
  }
  if (hasValidKey(process.env.ZHIPU_API_KEY)) {
    // Allow Zhipu as a fallback in INTL if configured (e.g., for testing)
    providers.push("zhipu");
  }

  return providers;
}

export function isAIProviderConfigured(): boolean {
  return getProviderOrder().length > 0;
}

export function isZhipuConfigured(): boolean {
  return hasValidKey(process.env.ZHIPU_API_KEY);
}

async function callAIWithFallback(messages: AIMessage[], temperature = 0.8) {
  const providers = getProviderOrder();

  if (providers.length === 0) {
    throw new Error("No AI provider configured for current deployment region");
  }

  let lastError: unknown;

  for (const provider of providers) {
    try {
      switch (provider) {
        case "openai":
          return {
            content: await callOpenAI(messages, temperature),
            provider,
            model: DEFAULT_MODELS.openai,
          };
        case "mistral":
          return {
            content: await callMistral(messages, temperature),
            provider,
            model: DEFAULT_MODELS.mistral,
          };
        case "zhipu":
          return {
            content: await callZhipu(messages, temperature),
            provider,
            model: DEFAULT_MODELS.zhipu,
          };
      }
    } catch (error) {
      lastError = error;
      console.error(`[AI][${provider}] request failed:`, error);
    }
  }

  throw lastError || new Error("All AI providers failed");
}

async function callOpenAI(messages: AIMessage[], temperature: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!hasValidKey(apiKey)) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey: apiKey.trim() });
  const response = await client.chat.completions.create({
    model: DEFAULT_MODELS.openai,
    messages,
    temperature,
    max_tokens: 2000,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }
  return content;
}

async function callMistral(messages: AIMessage[], temperature: number) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!hasValidKey(apiKey)) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODELS.mistral,
      messages,
      temperature,
      max_tokens: 2000,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Mistral returned empty content");
  }
  return content;
}

async function callZhipu(messages: AIMessage[], temperature: number) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!hasValidKey(apiKey)) {
    throw new Error("ZHIPU_API_KEY is not configured");
  }

  const client = new ZhipuAI({ apiKey: apiKey.trim() });
  const response = await client.chat.completions.create({
    model: DEFAULT_MODELS.zhipu,
    messages,
    temperature,
    top_p: 0.9,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Zhipu returned empty content");
  }
  return content;
}

function cleanAIContent(content: string) {
  return content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

export async function callRecommendationAI(messages: AIMessage[], temperature = 0.8) {
  const result = await callAIWithFallback(messages, temperature);
  return cleanAIContent(result.content);
}

interface UserHistory {
  category: string;
  title: string;
  clicked?: boolean;
  metadata?: any;
}

export interface RecommendationItem {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  searchQuery: string;  // 用于搜索引擎的查询词
  platform: string;      // 推荐的平台
  entertainmentType?: 'video' | 'game' | 'music' | 'review';  // 娱乐类型（仅娱乐分类）
}

/**
 * 使用智谱 AI 分析用户偏好并生成推荐
 * 注意：AI 只生成推荐内容，不生成链接
 */
export async function generateRecommendations(
  userHistory: UserHistory[],
  category: string,
  locale: string = 'zh',
  count: number = 5
): Promise<RecommendationItem[]> {

  const categoryConfig = {
    entertainment: {
      platforms: locale === 'zh'
        ? ['豆瓣', 'B站', '网易云音乐', 'Steam', '爱奇艺', '腾讯视频', '优酷']
        : ['IMDb', 'YouTube', 'Spotify', 'Steam', 'Netflix', 'Rotten Tomatoes', 'Twitch'],
      examples: locale === 'zh'
        ? '电影、电视剧、游戏、音乐、综艺、动漫'
        : 'movies, TV shows, games, music, variety shows, anime',
      types: locale === 'zh'
        ? ['视频', '游戏', '音乐', '影评/资讯']
        : ['video', 'game', 'music', 'review/news']
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
        : ['Allrecipes', 'Google Maps', 'OpenTable'],
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

  const config = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.entertainment;

  const desiredCount = Math.max(5, Math.min(10, count));

  const prompt = locale === 'zh' ? `
你是一个专业的推荐系统分析师。

任务：基于用户历史行为，生成 ${desiredCount} 个多样化的个性化推荐（覆盖不同子类型和平台）。

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
- 如果是娱乐分类(entertainment)，必须确保推荐包含以下4种类型：
  * 视频类：电影、电视剧、综艺、动漫等
  * 游戏类：PC游戏、手机游戏、主机游戏等
  * 音乐类：歌曲、专辑、演唱会等
  * 影评/资讯类：影评、娱乐新闻、明星资讯等
  * 每个推荐必须明确标注属于哪种类型
  * 确保生成的3个推荐涵盖至少3种不同的娱乐类型
  * 推荐内容必须是真实存在的作品或内容，使用准确的作品名称
  * 搜索关键词必须精确匹配作品名称，例如：
    - 视频："流浪地球2 豆瓣评分"、"三体 电视剧 观看"
    - 游戏："艾尔登法环 Steam"、"原神 下载"
    - 音乐："周杰伦 新歌 2024"、"霉霉 Taylor Swift 巡演"
    - 影评："奥本海默 影评解析"、"2024年电影排行榜"
- 如果是美食分类(food)，**必须严格按照以下三种推荐类型生成内容**：

  **推荐类型要求**：
  * **食谱类（Allrecipes）**：
    - 推荐：具体的菜谱名称（如"麻婆豆腐"、"红烧肉"、"意大利面"）
    - 内容：详细描述菜品特色、所需食材、烹饪难度、适合人群
    - 搜索词：纯菜名，如"麻婆豆腐"、"红烧肉"、"chocolate cake"
    - 标签：菜系、难度、口味（如"川菜、简单、麻辣"）

  * **菜系类（Google Maps）**：
    - 推荐：菜系类型（如"川菜"、"粤菜"、"意大利菜"、"日料"）
    - 内容：介绍该菜系特点、代表菜品、适合场合、价格区间
    - 搜索词：菜系名称，如"川菜餐厅"、"意大利菜"、"Japanese restaurants"
    - 标签：菜系类型、特色、消费水平

  * **特殊场合餐厅（OpenTable）**：
    - 推荐：特定场合的餐厅选择（如"商务午餐"、"浪漫约会"、"家庭聚餐"）
    - 内容：说明场合特点、适合餐厅类型、人均消费、预订注意事项
    - 搜索词：场合 + 菜系，如"商务午餐 中餐"、"romantic dinner Italian"
    - 标签：场合类型、菜系、价格区间

  **关键要求：推荐内容必须与对应平台页面完全匹配！**
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
  * 推荐类型应包括：健身视频教程、健身房位置、健身器材使用教程等
  * 每个推荐要明确具体并指向正确的内容：
    - 视频教程：如"30分钟瑜伽入门"、"HIIT燃脂训练"（链接到B站、YouTube的教程）
    - 健身房：如"附近瑜伽馆推荐"、"24小时健身房"（链接到Google Maps、百度地图等位置服务）
    - 器材使用教程：如"哑铃训练教程"、"跑步机正确使用方法"（链接到B站、YouTube的教程视频，不是购物链接）
  * 根据推荐类型选择合适的平台：
    - 健身视频教程：选择B站、YouTube Fitness等
    - 健身房位置：选择百度地图、Google Maps、大众点评等
    - 器材使用教程：选择B站、YouTube Fitness等（教程视频，不是购物）
  * 生成3个推荐时必须满足以下要求：
    - 第一个必须是健身视频教程（video type）
    - 第二个必须是健身房地点推荐（location type）
    - 第三个必须是器材使用教程（equipment type）
    - 这三种类型缺一不可！
  * 重要：器材推荐的searchQuery应该是"XX器材+使用教程/训练方法"而不是"XX器材+购买"
  * 搜索词要与推荐内容精确匹配，例如：
    - 视频教程："瑜伽入门教程"、"HIIT训练视频"
    - 健身房："附近瑜伽馆"、"24小时健身房"
    - 器材教程："哑铃训练教程"、"跑步机使用方法"、"瑜伽垫基础动作"
- **重要：不要生成任何链接URL，只需要推荐内容！**

返回 JSON 格式（严格遵守，不要有任何额外文字）：
[
  {
    "title": "具体推荐名称",
    "description": "简短描述",
    "reason": "为什么推荐给这个用户",
    "tags": ["标签1", "标签2", "标签3"],
    "searchQuery": "用于搜索的关键词",
    "platform": "淘宝|京东|豆瓣|B站|...",
    "entertainmentType": "video|game|music|review"
  }
]` : `
You are a professional recommendation system analyst.

Task: Generate ${desiredCount} diverse personalized recommendations based on user history (cover different subtypes/platforms).

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
- For entertainment category, must ensure recommendations include all 4 types:
  * Video: movies, TV shows, variety shows, anime, etc.
  * Game: PC games, mobile games, console games, etc.
  * Music: songs, albums, concerts, etc.
  * Review/News: movie reviews, entertainment news, celebrity news, etc.
  * Each recommendation must clearly indicate which type it belongs to
  * Ensure the 3 generated recommendations cover at least 3 different entertainment types
  * Recommended content must be real existing works or content, use accurate titles
  * Search keywords must precisely match work titles, for example:
    - Video: "Oppenheimer 2023 review", "The Boys season 4 watch"
    - Game: "Baldur's Gate 3 Steam", "Genshin Impact download"
    - Music: "Taylor Swift new album 2024", "Bruno Mars concert"
    - Review: "Dune Part Two review", "2024 Oscar predictions"
- For food category, **MUST follow these three recommendation types strictly**:

  **Recommendation Type Requirements**:
  * **Recipe Type (Allrecipes)**:
    - Recommend: Specific recipe names (e.g., "Chocolate Chip Cookies", "Spaghetti Carbonara", "Chicken Stir Fry")
    - Content: Describe dish characteristics, required ingredients, difficulty level, suitable for
    - Search terms: Pure recipe name, like "Chocolate Chip Cookies", "pasta carbonara"
    - Tags: Cuisine type, difficulty, flavor profile (e.g., "Italian, easy, creamy")

  * **Cuisine Type (Google Maps)**:
    - Recommend: Cuisine categories (e.g., "Italian cuisine", "Chinese food", "Japanese restaurants", "Mexican")
    - Content: Introduce cuisine features, signature dishes, suitable occasions, price range
    - Search terms: Cuisine name, like "Italian restaurants", "Chinese food near me"
    - Tags: Cuisine type, characteristics, price level

  * **Special Occasion Restaurants (OpenTable)**:
    - Recommend: Restaurants for specific occasions (e.g., "business lunch", "romantic dinner", "family gathering")
    - Content: Explain occasion features, suitable restaurant types, average cost, booking tips
    - Search terms: Occasion + cuisine, like "business lunch Italian", "romantic dinner French"
    - Tags: Occasion type, cuisine, price range

  **CRITICAL: Content must perfectly match the target platform page!**
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
- For fitness category, recommend three distinct types of fitness content:
  * **Fitness Video Course (YouTube)**: Professional video tutorials and classes
    - Examples: "30-minute Yoga Video Course", "HIIT Fat Burning Workout", "Pilates Basics"
    - Platform: YouTube (video courses)
    - Search: "yoga for beginners video", "HIIT workout tutorial"
    - Tags: Should include exercise type, duration, difficulty
  
  * **Fitness Equipment Reviews (GarageGymReviews)**: Equipment reviews and purchasing guides
    - Examples: "Dumbbell Reviews and Buying Guide", "Best Home Treadmill 2024", "Adjustable Dumbbells Comparison"
    - Platform: GarageGymReviews (equipment reviews)
    - Search: "dumbbell reviews recommendation", "home gym equipment guide"
    - Tags: Should include equipment type, use case, price range
  
  * **Fitness Training Plans (FitnessVolt)**: Complete training programs and fitness plans
    - Examples: "12-Week Muscle Building Program", "Fat Loss Training Plan", "Beginner Workout Routine"
    - Platform: FitnessVolt (fitness plans)
    - Search: "muscle building training program", "weight loss fitness plan"
    - Tags: Should include goal, duration, difficulty level

  * CRITICAL REQUIREMENTS:
    - Each recommendation must be a different type (video, equipment, plan)
    - Video recommendations ONLY link to YouTube (video courses)
    - Equipment recommendations ONLY link to GarageGymReviews (reviews, NOT shopping sites)
    - Plan recommendations ONLY link to FitnessVolt (article, NOT video platforms)
    - Search queries must match the platform content precisely:
      * Video: "exercise name video tutorial"
      * Equipment: "equipment name review recommendation" 
      * Plan: "goal name training program"
    - All three types are REQUIRED for fitness recommendations!
  * Important: Do NOT recommend shopping platforms like Amazon for fitness equipment - use GarageGymReviews instead
- **Important: Do not generate any URLs, only recommend content!**

Return JSON format (strictly, no extra text):
[
  {
    "title": "Specific recommendation name",
    "description": "Brief description",
    "reason": "Why recommend to this user",
    "tags": ["tag1", "tag2", "tag3"],
    "searchQuery": "Search keywords",
    "platform": "Amazon|eBay|IMDb|YouTube|...",
    "entertainmentType": "video|game|music|review"
  }
]`;

  try {
    const aiContent = await callRecommendationAI(
      [
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
      0.8
    );

    if (!aiContent) {
      console.error('AI 返回空内容');
      return getFallbackRecommendations(category, locale);
    }

    const result = JSON.parse(aiContent);
    return Array.isArray(result) ? result : [result];

  } catch (error) {
    console.error('AI 推荐生成失败:', error);
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
