import OpenAI from "openai";
import { ZhipuAI } from "zhipuai";
import { isChinaDeployment } from "@/lib/config/deployment.config";

type AIProvider = "openai" | "mistral" | "zhipu" | "qwen-max" | "qwen-plus" | "qwen-turbo";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_MODELS = {
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
  mistral: process.env.MISTRAL_MODEL || "mistral-small-latest",
  zhipu: process.env.ZHIPU_MODEL || "glm-4.5-flash",
  "qwen-max": "qwen-max",
  "qwen-plus": "qwen-plus",
  "qwen-turbo": "qwen-turbo",
};

// 通义千问 API 端点
const QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

function hasValidKey(value?: string | null) {
  return Boolean(value && value.trim() && !value.includes("your_"));
}

function getProviderOrder(): AIProvider[] {
  if (isChinaDeployment()) {
    // CN环境: 优先使用通义千问（qwen-turbo首选，速度快成本低），智谱作为备用
    const providers: AIProvider[] = [];

    if (hasValidKey(process.env.QWEN_API_KEY)) {
      providers.push("qwen-turbo", "qwen-plus", "qwen-max");
    }
    if (hasValidKey(process.env.ZHIPU_API_KEY)) {
      providers.push("zhipu");
    }

    return providers;
  }

  // INTL region: prefer Mistral first, then fall back to OpenAI
  const providers: AIProvider[] = [];

  if (hasValidKey(process.env.MISTRAL_API_KEY)) {
    providers.push("mistral");
  }
  if (hasValidKey(process.env.OPENAI_API_KEY)) {
    providers.push("openai");
  }

  return providers;
}

export function isAIProviderConfigured(): boolean {
  return getProviderOrder().length > 0;
}

export function isZhipuConfigured(): boolean {
  return hasValidKey(process.env.ZHIPU_API_KEY);
}

export function isQwenConfigured(): boolean {
  return hasValidKey(process.env.QWEN_API_KEY);
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
        case "qwen-max":
        case "qwen-plus":
        case "qwen-turbo":
          return {
            content: await callQwen(messages, temperature, provider),
            provider,
            model: provider,
          };
      }
    } catch (error) {
      lastError = error;
      console.error(`[AI][${provider}] request failed:`, error);
    }
  }

  throw lastError || new Error("All AI providers failed");
}

async function callQwen(messages: AIMessage[], temperature: number, model: "qwen-max" | "qwen-plus" | "qwen-turbo") {
  const apiKey = process.env.QWEN_API_KEY;
  if (!hasValidKey(apiKey)) {
    throw new Error("QWEN_API_KEY is not configured");
  }

  console.log(`[AI] Calling Qwen API with model: ${model}...`);

  const response = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen API (${model}) error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Qwen (${model}) returned empty content`);
  }

  console.log(`[AI] ✅ Successfully called Qwen API (${model})`);
  return content;
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
    max_tokens: 1200,
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
      max_tokens: 1200,
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

export interface UserPreferenceData {
  preferences?: Record<string, any>;
  tags?: string[];
  ai_profile_summary?: string;
  personality_tags?: string[];
  onboarding_completed?: boolean;
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
  count: number = 5,
  userPreference?: UserPreferenceData | null
): Promise<RecommendationItem[]> {

  // 构建用户画像提示
  let userProfilePrompt = '';
  if (userPreference) {
    const profileParts: string[] = [];

    // 问卷偏好数据
    if (userPreference.preferences && Object.keys(userPreference.preferences).length > 0) {
      profileParts.push(locale === 'zh'
        ? `用户问卷偏好：${JSON.stringify(userPreference.preferences)}`
        : `User questionnaire preferences: ${JSON.stringify(userPreference.preferences)}`);
    }

    // AI画像摘要
    if (userPreference.ai_profile_summary) {
      profileParts.push(locale === 'zh'
        ? `用户AI画像：${userPreference.ai_profile_summary}`
        : `User AI profile: ${userPreference.ai_profile_summary}`);
    }

    // 个性标签
    if (userPreference.personality_tags && userPreference.personality_tags.length > 0) {
      profileParts.push(locale === 'zh'
        ? `用户个性标签：${userPreference.personality_tags.join('、')}`
        : `User personality tags: ${userPreference.personality_tags.join(', ')}`);
    }

    // 用户标签
    if (userPreference.tags && userPreference.tags.length > 0) {
      profileParts.push(locale === 'zh'
        ? `用户兴趣标签：${userPreference.tags.join('、')}`
        : `User interest tags: ${userPreference.tags.join(', ')}`);
    }

    if (profileParts.length > 0) {
      userProfilePrompt = locale === 'zh'
        ? `\n\n**用户画像信息（请根据以下信息生成更精准的个性化推荐）**：\n${profileParts.join('\n')}\n`
        : `\n\n**User Profile (please generate more personalized recommendations based on this)**:\n${profileParts.join('\n')}\n`;
    }
  }

  const categoryConfig = {
    entertainment: {
      platforms: locale === 'zh'
        ? ['腾讯视频', '优酷', 'QQ音乐', '酷狗音乐', '网易云音乐', 'TapTap', '豆瓣', '百度']
        : ['IMDb', 'YouTube', 'Spotify', 'Netflix', 'Rotten Tomatoes', 'Steam', 'Epic Games', 'GOG', 'PlayStation Store', 'Xbox Store', 'Nintendo eShop', 'Humble Bundle', 'itch.io'],
      examples: locale === 'zh'
        ? '电影、电视剧、游戏、音乐、综艺、动漫'
        : 'movies, TV shows, games, music, variety shows, anime',
      types: locale === 'zh'
        ? ['视频', '游戏', '音乐', '影评/资讯']
        : ['video', 'game', 'music', 'review/news'],
      // 游戏平台专用列表，供 AI 在推荐游戏时选择
      gamePlatforms: locale === 'zh'
        ? ['TapTap']
        : ['Steam', 'Epic Games', 'GOG', 'PlayStation Store', 'Xbox Store', 'Nintendo eShop', 'Humble Bundle', 'itch.io', 'Game Pass'],
      // 音乐平台专用列表
      musicPlatforms: locale === 'zh'
        ? ['酷狗音乐', 'QQ音乐', '网易云音乐']
        : ['Spotify', 'YouTube Music', 'Apple Music', 'SoundCloud']
    },
    shopping: {
      platforms: locale === 'zh'
        ? ['京东', '淘宝', '拼多多', '唯品会']
        : ['Amazon', 'eBay', 'Walmart', 'Target'],
      examples: locale === 'zh'
        ? '数码产品、服装、家居用品'
        : 'electronics, clothing, home goods'
    },
    food: {
      platforms: locale === 'zh'
        ? ['大众点评', '高德地图美食', '百度地图美食', '腾讯地图美食']
        : ['Allrecipes', 'Google Maps', 'OpenTable'],
      examples: locale === 'zh'
        ? '餐厅、菜谱、美食'
        : 'restaurants, recipes, food'
    },
    travel: {
      platforms: locale === 'zh'
        ? ['携程', '去哪儿', '小红书', '马蜂窝']
        : ['Booking.com', 'Agoda', 'TripAdvisor', 'Expedia', 'Klook', 'Airbnb'],
      examples: locale === 'zh'
        ? '景点、酒店、旅游攻略、目的地体验'
        : 'attractions, hotels, travel guides, destination experiences'
    },
    fitness: {
      platforms: locale === 'zh'
        ? ['B站健身', '优酷健身', 'Keep', '大众点评', '美团', '百度地图健身', '高德地图健身', '腾讯地图健身']
        : ['YouTube Fitness', 'MyFitnessPal', 'Peloton', 'Google Maps', 'Amazon', 'Yelp'],
      examples: locale === 'zh'
        ? '健身课程、健身房、健身器材、运动装备'
        : 'fitness classes, gyms, fitness equipment, workout gear'
    }
  };

  const config = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.entertainment;

  const desiredCount = Math.max(5, Math.min(10, count));

  const prompt = locale === 'zh' ? `
生成 ${desiredCount} 个多样化推荐，严格遵守类型分布要求。

用户历史：${JSON.stringify(userHistory.slice(0, 15), null, 2)}
${userProfilePrompt}
分类：${category}

输出JSON数组，每项必须包含：title, description, reason, tags(3-5个), searchQuery, platform${category === 'entertainment' ? ', entertainmentType' : ''}

${category === 'entertainment' ? `【强制要求】必须包含4种不同类型，平均分配：
- 视频类(腾讯视频/优酷): 影视作品
- 游戏类(${(config as any).gamePlatforms?.slice(0, 4).join('/')}): 手机游戏名称(不含平台名，可在应用商店下载)
- 音乐类(${(config as any).musicPlatforms?.slice(0, 3).join('/')}): 歌曲/专辑
- 资讯类: 影评/排行/新闻
每种类型至少1个，entertainmentType字段必填(video/game/music/review)` : ''}${category === 'food' ? `【强制要求】必须包含3种类型：
- 食谱类: 纯菜名(如"宫保鸡丁")
- 菜系类: "XX菜系餐厅"(如"川菜餐厅")
- 场合类: "场合+菜系"(如"商务午餐")` : ''}${category === 'travel' ? `【格式要求】标题必须是"国家·城市"(如"中国·西安")，使用真实地名；CN版优先推荐中国境内目的地，至少前3条为中国境内。` : ''}${category === 'fitness' ? `【强制要求】必须包含3种类型，各至少1个，并且每项必须包含 fitnessType 字段：
- 附近场所(nearby_place): 真实可去的健身房/运动场地/场馆（不是教程/不是装备评测）
- 教程(tutorial): 健身动作/课程/跟练视频
- 器材(equipment): "XX使用教程/入门要点"(不是购买链接/不是纯评测导购)
fitnessType 必须为 nearby_place/tutorial/equipment 之一。

【附近场所硬指标】当你输出 fitnessType=nearby_place 时，description 必须同时提到：
1) 通风系统（是否闷/异味，建议看评论）
2) 深蹲架数量（照片里大概几个，是否需要排队）
3) 距离（建议优先步行15分钟内，离家/公司近更容易坚持）
并且 searchQuery 必须包含“附近/步行/地铁/商圈/街道”至少一项，方便定位周边。

【教程硬指标】fitnessType=tutorial 时：searchQuery 必须包含“教程/跟练/训练/视频课”至少一项。
【器材硬指标】fitnessType=equipment 时：searchQuery 必须包含“使用教程/怎么用/入门/动作要点”至少一项。` : ''}
平台选择：${config.platforms.slice(0, 6).join('、')}
勿生成URL` : `
Generate ${desiredCount} personalized recommendations.

User history: ${JSON.stringify(userHistory.slice(0, 15), null, 2)}
${userProfilePrompt}
Category: ${category}

Output JSON array with: title, description, reason, tags(3-5), searchQuery, platform${category === 'entertainment' ? ', entertainmentType' : ''}

${category === 'entertainment' ? `Must include 4 types: video(IMDb/YouTube), game(${(config as any).gamePlatforms?.slice(0, 4).join('/')}), music(Spotify), review
Game searchQuery: game name only` : ''}${category === 'food' ? `3 types: recipe, cuisine, occasion` : ''}${category === 'travel' ? `Format: "Country·City"` : ''}${category === 'fitness' ? `Must include 3 types, at least 1 each, and include fitnessType:
- nearby_place: real nearby gym/sports place
- tutorial: workout tutorial video
- equipment: equipment how-to (not pure shopping)
fitnessType must be nearby_place/tutorial/equipment` : ''}
Platform choices: ${config.platforms.slice(0, 6).join(', ')}
No URLs`;

  try {
    const aiContent = await callRecommendationAI(
      [
        {
          role: 'system',
          content: locale === 'zh'
            ? '推荐分析师。返回JSON数组，包含指定类型，无链接，无markdown。'
            : 'Recommendation analyst. Return JSON array with specified types, no links, no markdown.'
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
        platform: 'B站健身'  // 改用B站健身
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
