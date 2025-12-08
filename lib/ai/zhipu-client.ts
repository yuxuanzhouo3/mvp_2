/**
 * 智谱 AI 客户端
 * 用于生成个性化推荐
 */

import type {
  AIRecommendation,
  RecommendationCategory,
  RecommendationHistory,
  UserPreference,
} from "@/lib/types/recommendation";

// 智谱 API 配置
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_MODEL = "glm-4-flash";

interface ZhipuMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ZhipuResponse {
  code?: number | string;
  msg?: string;
  data?: {
    choices?: Array<{
      index?: number;
      finish_reason?: string;
      message?: {
        role?: string;
        content?: string;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  error?: {
    message?: string;
  };
  [key: string]: any; // 允许其他未知字段
}

/**
 * 分类链接配置（包含真实可用的外部链接模板）
 */
const CATEGORY_LINK_CONFIG = {
  entertainment: {
    cn: {
      book: [
        { name: "三体", url: "https://book.douban.com/subject/2567698/", type: "book" },
        { name: "活着", url: "https://book.douban.com/subject/4913064/", type: "book" },
        { name: "百年孤独", url: "https://book.douban.com/subject/6082808/", type: "book" },
        { name: "围城", url: "https://book.douban.com/subject/1008145/", type: "book" },
      ],
      game: [
        { name: "原神", url: "https://ys.mihoyo.com/", type: "game" },
        { name: "王者荣耀", url: "https://pvp.qq.com/", type: "game" },
        { name: "和平精英", url: "https://gp.qq.com/", type: "game" },
        { name: "崩坏：星穹铁道", url: "https://sr.mihoyo.com/", type: "game" },
      ],
      movie: [
        { name: "流浪地球2", url: "https://movie.douban.com/subject/35267208/", type: "movie" },
        { name: "满江红", url: "https://movie.douban.com/subject/35Mo6647/", type: "movie" },
        { name: "让子弹飞", url: "https://movie.douban.com/subject/3742360/", type: "movie" },
        { name: "肖申克的救赎", url: "https://movie.douban.com/subject/1292052/", type: "movie" },
      ],
      music: [
        { name: "周杰伦热门歌曲", url: "https://music.163.com/#/artist?id=6452", type: "music" },
        { name: "薛之谦热门歌曲", url: "https://music.163.com/#/artist?id=5781", type: "music" },
        { name: "林俊杰热门歌曲", url: "https://music.163.com/#/artist?id=3684", type: "music" },
        { name: "邓紫棋热门歌曲", url: "https://music.163.com/#/artist?id=7763", type: "music" },
      ],
    },
    intl: {
      book: [
        { name: "The Three-Body Problem", url: "https://www.amazon.com/dp/0765382032", type: "book" },
        { name: "Dune", url: "https://www.amazon.com/dp/0441172717", type: "book" },
        { name: "1984", url: "https://www.amazon.com/dp/0451524934", type: "book" },
        { name: "The Hitchhiker's Guide", url: "https://www.amazon.com/dp/0345391802", type: "book" },
      ],
      game: [
        { name: "Elden Ring", url: "https://store.steampowered.com/app/1245620/ELDEN_RING/", type: "game" },
        { name: "Baldur's Gate 3", url: "https://store.steampowered.com/app/1086940/Baldurs_Gate_3/", type: "game" },
        { name: "Cyberpunk 2077", url: "https://store.steampowered.com/app/1091500/Cyberpunk_2077/", type: "game" },
        { name: "The Legend of Zelda", url: "https://www.nintendo.com/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/", type: "game" },
      ],
      movie: [
        { name: "Oppenheimer", url: "https://www.imdb.com/title/tt15398776/", type: "movie" },
        { name: "Inception", url: "https://www.imdb.com/title/tt1375666/", type: "movie" },
        { name: "Interstellar", url: "https://www.imdb.com/title/tt0816692/", type: "movie" },
        { name: "The Dark Knight", url: "https://www.imdb.com/title/tt0468569/", type: "movie" },
      ],
      music: [
        { name: "Taylor Swift", url: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02", type: "music" },
        { name: "The Weeknd", url: "https://open.spotify.com/artist/1Xyo4u8uXC1ZmMpatF05PJ", type: "music" },
        { name: "Ed Sheeran", url: "https://open.spotify.com/artist/6eUKZXaKkcviH0Ku9w2n3V", type: "music" },
        { name: "BTS", url: "https://open.spotify.com/artist/3Nrfpe0tUJi4K4DXYWgMUX", type: "music" },
      ],
    },
  },
  shopping: {
    cn: {
      fashion: [
        { name: "优衣库官网", url: "https://www.uniqlo.cn/", type: "product" },
        { name: "ZARA中国", url: "https://www.zara.cn/", type: "product" },
        { name: "H&M中国", url: "https://www.hm.com/cn/", type: "product" },
        { name: "淘宝女装", url: "https://nvzhuang.taobao.com/", type: "product" },
      ],
      electronics: [
        { name: "小米商城", url: "https://www.mi.com/", type: "product" },
        { name: "华为商城", url: "https://www.vmall.com/", type: "product" },
        { name: "Apple中国", url: "https://www.apple.com.cn/", type: "product" },
        { name: "京东数码", url: "https://channel.jd.com/digital.html", type: "product" },
      ],
      home: [
        { name: "宜家中国", url: "https://www.ikea.cn/", type: "product" },
        { name: "无印良品", url: "https://www.muji.com.cn/", type: "product" },
        { name: "网易严选", url: "https://you.163.com/", type: "product" },
        { name: "淘宝家居", url: "https://jiaju.taobao.com/", type: "product" },
      ],
    },
    intl: {
      fashion: [
        { name: "UNIQLO", url: "https://www.uniqlo.com/", type: "product" },
        { name: "ZARA", url: "https://www.zara.com/", type: "product" },
        { name: "H&M", url: "https://www.hm.com/", type: "product" },
        { name: "Amazon Fashion", url: "https://www.amazon.com/fashion", type: "product" },
      ],
      electronics: [
        { name: "Apple Store", url: "https://www.apple.com/store", type: "product" },
        { name: "Best Buy", url: "https://www.bestbuy.com/", type: "product" },
        { name: "Amazon Electronics", url: "https://www.amazon.com/electronics", type: "product" },
        { name: "Newegg", url: "https://www.newegg.com/", type: "product" },
      ],
      home: [
        { name: "IKEA", url: "https://www.ikea.com/", type: "product" },
        { name: "Wayfair", url: "https://www.wayfair.com/", type: "product" },
        { name: "Amazon Home", url: "https://www.amazon.com/home-garden", type: "product" },
        { name: "Target Home", url: "https://www.target.com/c/home/", type: "product" },
      ],
    },
  },
  food: {
    cn: {
      restaurant: [
        { name: "海底捞火锅", url: "https://www.dianping.com/search/keyword/1/0_%E6%B5%B7%E5%BA%95%E6%8D%9E", type: "restaurant" },
        { name: "西贝莜面村", url: "https://www.dianping.com/search/keyword/1/0_%E8%A5%BF%E8%B4%9D", type: "restaurant" },
        { name: "喜茶", url: "https://www.dianping.com/search/keyword/1/0_%E5%96%9C%E8%8C%B6", type: "restaurant" },
        { name: "外婆家", url: "https://www.dianping.com/search/keyword/1/0_%E5%A4%96%E5%A9%86%E5%AE%B6", type: "restaurant" },
      ],
      recipe: [
        { name: "下厨房", url: "https://www.xiachufang.com/", type: "recipe" },
        { name: "美食杰", url: "https://www.meishij.net/", type: "recipe" },
        { name: "香哈网", url: "https://www.xiangha.com/", type: "recipe" },
        { name: "豆果美食", url: "https://www.douguo.com/", type: "recipe" },
      ],
    },
    intl: {
      restaurant: [
        { name: "Yelp Restaurants", url: "https://www.yelp.com/", type: "restaurant" },
        { name: "TripAdvisor Restaurants", url: "https://www.tripadvisor.com/Restaurants", type: "restaurant" },
        { name: "OpenTable", url: "https://www.opentable.com/", type: "restaurant" },
        { name: "Google Maps Food", url: "https://www.google.com/maps/search/restaurants/", type: "restaurant" },
      ],
      recipe: [
        { name: "AllRecipes", url: "https://www.allrecipes.com/", type: "recipe" },
        { name: "Tasty", url: "https://tasty.co/", type: "recipe" },
        { name: "BBC Good Food", url: "https://www.bbcgoodfood.com/", type: "recipe" },
        { name: "Food Network", url: "https://www.foodnetwork.com/recipes", type: "recipe" },
      ],
    },
  },
  travel: {
    cn: {
      location: [
        { name: "故宫博物院", url: "https://www.dpm.org.cn/", type: "location" },
        { name: "西湖景区", url: "https://www.westlake.gov.cn/", type: "location" },
        { name: "黄山风景区", url: "http://www.huangshan.com.cn/", type: "location" },
        { name: "张家界", url: "https://www.zjjpark.com/", type: "location" },
      ],
      hotel: [
        { name: "携程酒店", url: "https://hotels.ctrip.com/", type: "hotel" },
        { name: "飞猪酒店", url: "https://hotel.fliggy.com/", type: "hotel" },
        { name: "美团酒店", url: "https://hotel.meituan.com/", type: "hotel" },
        { name: "去哪儿酒店", url: "https://hotel.qunar.com/", type: "hotel" },
      ],
    },
    intl: {
      location: [
        { name: "TripAdvisor Things To Do", url: "https://www.tripadvisor.com/Attractions", type: "location" },
        { name: "Google Travel", url: "https://www.google.com/travel/things-to-do", type: "location" },
        { name: "Lonely Planet", url: "https://www.lonelyplanet.com/", type: "location" },
        { name: "Viator Tours", url: "https://www.viator.com/", type: "location" },
      ],
      hotel: [
        { name: "Booking.com", url: "https://www.booking.com/", type: "hotel" },
        { name: "Airbnb", url: "https://www.airbnb.com/", type: "hotel" },
        { name: "Hotels.com", url: "https://www.hotels.com/", type: "hotel" },
        { name: "Expedia Hotels", url: "https://www.expedia.com/Hotels", type: "hotel" },
      ],
    },
  },
  fitness: {
    cn: {
      course: [
        { name: "Keep健身", url: "https://www.gotokeep.com/", type: "course" },
        { name: "B站健身教程", url: "https://search.bilibili.com/all?keyword=%E5%81%A5%E8%BA%AB%E6%95%99%E7%A8%8B", type: "video" },
        { name: "抖音健身", url: "https://www.douyin.com/search/%E5%81%A5%E8%BA%AB", type: "video" },
        { name: "小红书健身", url: "https://www.xiaohongshu.com/search_result?keyword=%E5%81%A5%E8%BA%AB", type: "article" },
      ],
      location: [
        { name: "大众点评健身房", url: "https://www.dianping.com/search/keyword/1/45_%E5%81%A5%E8%BA%AB%E6%88%BF", type: "location" },
        { name: "美团健身", url: "https://www.meituan.com/jianshen/", type: "location" },
      ],
    },
    intl: {
      course: [
        { name: "YouTube Fitness", url: "https://www.youtube.com/results?search_query=workout", type: "video" },
        { name: "Nike Training Club", url: "https://www.nike.com/ntc-app", type: "app" },
        { name: "Peloton", url: "https://www.onepeloton.com/", type: "course" },
        { name: "Fitness Blender", url: "https://www.fitnessblender.com/", type: "video" },
      ],
      location: [
        { name: "Google Maps Gyms", url: "https://www.google.com/maps/search/gyms/", type: "location" },
        { name: "Yelp Gyms", url: "https://www.yelp.com/search?find_desc=gyms", type: "location" },
        { name: "ClassPass", url: "https://classpass.com/", type: "app" },
      ],
    },
  },
};

/**
 * 生成推荐 Prompt
 */
function generatePrompt(
  category: RecommendationCategory,
  userHistory: RecommendationHistory[],
  userPreferences: UserPreference | null,
  locale: "zh" | "en",
  count: number = 3
): string {
  const region = locale === "zh" ? "cn" : "intl";
  const linkConfig = CATEGORY_LINK_CONFIG[category]?.[region] || {};

  // 构建用户历史摘要
  const historyTitles = userHistory.slice(0, 10).map((h) => h.title).join(", ");
  const preferencesTags = userPreferences?.tags?.join(", ") || "";
  const preferencesWeights = userPreferences?.preferences
    ? Object.entries(userPreferences.preferences)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([tag]) => tag)
        .join(", ")
    : "";

  // 链接示例
  const linkExamples = Object.entries(linkConfig)
    .flatMap(([type, items]) =>
      (items as any[]).slice(0, 2).map((item) => `${item.name}: ${item.url}`)
    )
    .join("\n");

  const categoryNames: Record<RecommendationCategory, { zh: string; en: string }> = {
    entertainment: { zh: "娱乐", en: "Entertainment" },
    shopping: { zh: "购物", en: "Shopping" },
    food: { zh: "美食", en: "Food" },
    travel: { zh: "旅行", en: "Travel" },
    fitness: { zh: "健身", en: "Fitness" },
  };

  const categoryName = categoryNames[category][locale === "zh" ? "zh" : "en"];

  if (locale === "zh") {
    return `你是一个智能推荐助手，专门为用户提供${categoryName}类的个性化推荐。

## 用户信息
- 历史选择: ${historyTitles || "暂无历史记录（新用户）"}
- 偏好标签: ${preferencesTags || "暂无明确偏好"}
- 推测偏好: ${preferencesWeights || "暂无推测"}

## 任务
请基于用户历史和偏好，推荐 ${count} 个${categoryName}相关的内容。

## 重要要求
1. 每条推荐必须包含**真实可访问的外部链接**
2. 链接必须是真实存在的网站，不能是虚构的
3. 推荐理由要个性化，提到用户的偏好

## 可用的链接参考（请使用类似的真实链接）
${linkExamples}

## 返回格式
请严格返回 JSON 数组格式，不要有任何其他文字：
[
  {
    "title": "推荐标题",
    "description": "详细描述（30-50字）",
    "category": "${category}",
    "link": "https://真实网站链接",
    "linkType": "类型(product/video/book/location/restaurant/recipe/hotel/course/movie/music/game)",
    "metadata": {
      "price": "价格（如适用）",
      "rating": 评分数字（如适用）,
      "duration": "时长（如适用）",
      "calories": 卡路里数字（如适用）
    },
    "reason": "为什么推荐给你：基于你之前..."
  }
]`;
  } else {
    return `You are a smart recommendation assistant specializing in ${categoryName} recommendations.

## User Information
- History: ${historyTitles || "No history (new user)"}
- Preference Tags: ${preferencesTags || "No explicit preferences"}
- Inferred Preferences: ${preferencesWeights || "No inferences"}

## Task
Based on user history and preferences, recommend ${count} ${categoryName}-related items.

## Important Requirements
1. Each recommendation MUST include a **real, accessible external link**
2. Links must be real websites, not fictional
3. Reasons should be personalized, mentioning user preferences

## Reference Links (use similar real links)
${linkExamples}

## Response Format
Return ONLY a JSON array, no other text:
[
  {
    "title": "Recommendation title",
    "description": "Detailed description (30-50 words)",
    "category": "${category}",
    "link": "https://real-website-link",
    "linkType": "type(product/video/book/location/restaurant/recipe/hotel/course/movie/music/game)",
    "metadata": {
      "price": "price (if applicable)",
      "rating": rating_number (if applicable),
      "duration": "duration (if applicable)",
      "calories": calories_number (if applicable)
    },
    "reason": "Why we recommend this: Based on your..."
  }
]`;
  }
}

/**
 * 调用智谱 API
 */
async function callZhipuAPI(messages: ZhipuMessage[], retryCount: number = 0): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  const MAX_RETRIES = 2;

  if (!apiKey) {
    throw new Error("ZHIPU_API_KEY is not configured");
  }

  if (apiKey.includes("your_")) {
    throw new Error("ZHIPU_API_KEY is not properly configured (contains placeholder)");
  }

  try {
    const response = await fetch(ZHIPU_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2000,
        top_p: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;

      // 解析错误响应
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.msg || errorText;
      } catch {
        // 继续使用原始错误文本
      }

      // 详细的错误日志
      console.error(`Zhipu API Error (Status ${statusCode}):`, {
        status: statusCode,
        message: errorMessage,
        timestamp: new Date().toISOString(),
        model: ZHIPU_MODEL,
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey.length,
      });

      // 403 Forbidden - API Key 或权限问题
      if (statusCode === 403) {
        throw new Error(
          `Zhipu API access denied (403 Forbidden): ${errorMessage}. Please check your API key validity and account permissions.`
        );
      }

      // 429 Too Many Requests - 速率限制，可以重试
      if (statusCode === 429 && retryCount < MAX_RETRIES) {
        console.warn(`Rate limited, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callZhipuAPI(messages, retryCount + 1);
      }

      // 500+ 服务器错误，可以重试
      if (statusCode >= 500 && retryCount < MAX_RETRIES) {
        console.warn(`Server error (${statusCode}), retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callZhipuAPI(messages, retryCount + 1);
      }

      throw new Error(`Zhipu API error: ${statusCode} - ${errorMessage}`);
    }

    const data: ZhipuResponse = await response.json();

    // 获取 choices - 可能在 data.choices 或顶层 choices
    const choices = data.data?.choices || data.choices;

    console.log("Zhipu API Response Debug:", {
      statusOk: response.ok,
      code: data.code,
      msg: data.msg,
      hasChoices: !!choices,
      choicesLength: choices?.length || 0,
      responseKeys: Object.keys(data),
      timestamp: new Date().toISOString(),
    });

    // 检查是否是错误响应
    if (data.error || (typeof data.code === "string" && data.code !== "0") || (typeof data.code === "number" && data.code !== 0)) {
      const errorMsg = data.error?.message || data.msg || "Unknown error";
      const errorCode = data.code || "unknown";
      throw new Error(`Zhipu API returned error - Code: ${errorCode}, Message: ${errorMsg}`);
    }

    // 检查成功响应 - 支持两种格式
    if (!choices || choices.length === 0) {
      console.error("Invalid response structure - no choices found:", {
        hasData: !!data.data,
        hasDataChoices: !!data.data?.choices,
        hasTopChoices: !!data.choices,
        responseKeys: Object.keys(data),
        fullResponse: JSON.stringify(data).substring(0, 500),
      });
      throw new Error("Zhipu API returned no choices - invalid response format");
    }

    const content = choices[0]?.message?.content;
    if (!content) {
      console.error("Empty content in response:", JSON.stringify(choices[0]));
      throw new Error("Zhipu API returned empty content");
    }

    console.log("✓ Successfully extracted content from Zhipu API response");
    return content;
  } catch (error) {
    // 重新抛出已知的错误
    if (error instanceof Error) {
      throw error;
    }
    // 捕获未知错误
    throw new Error(`Unexpected error calling Zhipu API: ${error}`);
  }
}

/**
 * 解析 AI 响应为推荐列表
 */
function parseAIResponse(content: string): AIRecommendation[] {
  try {
    // 尝试提取 JSON 部分
    let jsonContent = content.trim();

    // 如果响应被包裹在 markdown 代码块中，提取出来
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // 如果响应包含额外文字，尝试提取数组部分
    const arrayMatch = jsonContent.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonContent = arrayMatch[0];
    }

    const parsed = JSON.parse(jsonContent);

    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    // 验证并清理每个推荐，同时转换元数据类型
    const recommendations = parsed.map((item, index) => {
      // 处理元数据，确保数值字段是正确的类型
      const metadata = item.metadata || {};
      if (metadata.rating && typeof metadata.rating === "string") {
        metadata.rating = parseFloat(metadata.rating);
      }
      if (metadata.calories && typeof metadata.calories === "string") {
        metadata.calories = parseFloat(metadata.calories);
      }

      return {
        title: item.title || `Recommendation ${index + 1}`,
        description: item.description || "",
        category: item.category || "entertainment",
        link: item.link || "",
        linkType: item.linkType || "article",
        metadata,
        reason: item.reason || "",
      };
    });

    // 去重：保留第一个，删除重复的推荐（基于 title 和 link）
    const seen = new Set<string>();
    const deduplicated = recommendations.filter((rec) => {
      // 使用 title + link 作为唯一标识
      const key = `${rec.title}|${rec.link}`;
      if (seen.has(key)) {
        console.warn(`[Dedup] Filtered duplicate recommendation: "${rec.title}"`);
        return false;
      }
      seen.add(key);
      return true;
    });

    if (deduplicated.length < recommendations.length) {
      console.log(
        `[Dedup] Removed ${recommendations.length - deduplicated.length} duplicate(s) from ${recommendations.length} recommendations`
      );
    }

    return deduplicated;
  } catch (error) {
    console.error("Failed to parse AI response:", error, "Content:", content);
    throw new Error("Failed to parse AI response as JSON");
  }
}

/**
 * 获取 AI 推荐
 */
export async function getAIRecommendations(
  category: RecommendationCategory,
  userHistory: RecommendationHistory[],
  userPreferences: UserPreference | null,
  locale: "zh" | "en" = "zh",
  count: number = 3
): Promise<AIRecommendation[]> {
  const prompt = generatePrompt(category, userHistory, userPreferences, locale, count);

  const messages: ZhipuMessage[] = [
    {
      role: "system",
      content:
        locale === "zh"
          ? "你是一个智能推荐助手，只返回 JSON 格式的推荐结果，不要有任何其他文字。"
          : "You are a smart recommendation assistant. Return ONLY JSON-formatted recommendations, no other text.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const response = await callZhipuAPI(messages);
  return parseAIResponse(response);
}

/**
 * 检查智谱 API 是否可用
 */
export function isZhipuConfigured(): boolean {
  // 开发模式下禁用 AI（使用 DEV_MODE=true）
  if (process.env.DEV_MODE === "true") {
    return false;
  }
  return !!process.env.ZHIPU_API_KEY;
}

export { CATEGORY_LINK_CONFIG };
