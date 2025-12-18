/**
 * 基于用户画像的 AI 推荐服务
 * 使用 AI 分析用户画像和历史行为，生成个性化推荐
 */

import { callRecommendationAI } from './zhipu-recommendation';

/* =========================
 * 类型定义
 * ========================= */

export interface UserProfile {
  summary?: string;
  tags?: string[];
  preferences?: Record<string, any>;
  onboardingCompleted?: boolean;
  profileCompleteness?: number;
}

export interface UserHistory {
  category: string;
  title: string;
  clicked?: boolean;
  metadata?: any;
}

export interface ProfileRecommendationItem {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  searchQuery: string;
  platform: string;
  entertainmentType?: 'video' | 'game' | 'music' | 'review';
}

export interface ProfileSummaryResult {
  summary: string;
  tags: string[];
  insights: Record<string, string>;
}

/* =========================
 * 基于用户画像生成推荐
 * ========================= */

export async function generateProfileBasedRecommendations(
  userHistory: UserHistory[],
  category: string,
  userProfile?: UserProfile,
  locale: string = 'zh'
): Promise<ProfileRecommendationItem[]> {
  const prompt = buildRecommendationPrompt(
    userHistory,
    category,
    userProfile,
    locale
  );

  try {
    const content = await callRecommendationAI(
      [
        {
          role: 'system',
          content: locale === 'zh'
            ? '你是专业的推荐系统分析师。基于用户画像和历史行为，生成个性化推荐。只返回 JSON 数组，不要有任何额外内容。'
            : 'You are a professional recommendation analyst. Generate personalized recommendations based on user profile and history. Return only JSON array, no extra content.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      0.8
    );

    const result = JSON.parse(content);
    return Array.isArray(result) ? result : [result];
  } catch (error) {
    console.error('[AI Profile] 推荐生成失败:', error);
    return getFallbackRecommendations(category, locale);
  }
}

/* =========================
 * 构建推荐 Prompt
 * ========================= */

function buildRecommendationPrompt(
  history: UserHistory[],
  category: string,
  profile?: UserProfile,
  locale: string = 'zh'
): string {
  const clickedItems = history
    .filter((h) => h.clicked)
    .map((h) => h.title);

  const recentItems = history
    .slice(0, 5)
    .map((h) => h.title);

  if (locale === 'zh') {
    let prompt = `你是一个专业的推荐系统分析师。

任务：为用户生成 3 个个性化推荐。

当前分类：${category}

用户历史行为：
- 最近浏览：${recentItems.join(', ') || '无'}
- 点击过的：${clickedItems.join(', ') || '无'}
`;

    if (profile) {
      prompt += `
用户画像：
- 摘要：${profile.summary || '暂无'}
- 个性标签：${profile.tags?.join(', ') || '暂无'}
- 偏好设置：${JSON.stringify(profile.preferences || {})}
- 画像完整度：${profile.profileCompleteness || 0}%
`;
    }

    prompt += `
要求：
1. 深度分析用户的兴趣偏好和行为模式
2. 生成 3 个高度个性化的推荐
3. 每个推荐需要包含：
   - title: 推荐的具体名称
   - description: 简短介绍（1-2句话）
   - reason: 为什么推荐给这个用户（基于画像和历史）
   - tags: 3-5个相关标签
   - searchQuery: 用于搜索引擎的关键词
   - platform: 推荐的平台名称

**重要：只返回 JSON 数组，不要有任何其他文字！**

返回格式：
[
  {
    "title": "推荐名称",
    "description": "简短描述",
    "reason": "基于你的画像，你可能喜欢...",
    "tags": ["标签1", "标签2", "标签3"],
    "searchQuery": "搜索关键词",
    "platform": "平台名称"
  }
]
`;
    return prompt;
  } else {
    let prompt = `You are a professional recommendation system analyst.

Task: Generate 3 personalized recommendations for the user.

Current category: ${category}

User behavior history:
- Recent views: ${recentItems.join(', ') || 'None'}
- Clicked items: ${clickedItems.join(', ') || 'None'}
`;

    if (profile) {
      prompt += `
User Profile:
- Summary: ${profile.summary || 'Not available'}
- Personality tags: ${profile.tags?.join(', ') || 'Not available'}
- Preferences: ${JSON.stringify(profile.preferences || {})}
- Profile completeness: ${profile.profileCompleteness || 0}%
`;
    }

    prompt += `
Requirements:
1. Deeply analyze the user's interests and behavior patterns
2. Generate 3 highly personalized recommendations
3. Each recommendation should include:
   - title: Specific recommendation name
   - description: Brief introduction (1-2 sentences)
   - reason: Why recommend to this user (based on profile and history)
   - tags: 3-5 relevant tags
   - searchQuery: Keywords for search engine
   - platform: Recommended platform name

**IMPORTANT: Only return JSON array, no other text!**

Return format:
[
  {
    "title": "Recommendation name",
    "description": "Brief description",
    "reason": "Based on your profile, you might like...",
    "tags": ["tag1", "tag2", "tag3"],
    "searchQuery": "search keywords",
    "platform": "Platform name"
  }
]
`;
    return prompt;
  }
}

/* =========================
 * 降级推荐
 * ========================= */

function getFallbackRecommendations(
  category: string,
  locale: string
): ProfileRecommendationItem[] {
  const fallbacks: Record<string, Record<string, ProfileRecommendationItem>> = {
    zh: {
      entertainment: {
        title: '热门游戏推荐',
        description: '最近流行的游戏作品',
        reason: '根据大众喜好为你推荐',
        tags: ['游戏', '热门'],
        searchQuery: '2024 热门游戏',
        platform: 'Steam',
      },
      shopping: {
        title: '热销商品',
        description: '最受欢迎的商品',
        reason: '根据销量为你推荐',
        tags: ['热销', '好评'],
        searchQuery: '热销商品',
        platform: '京东',
      },
      food: {
        title: '人气餐厅',
        description: '高评分餐厅',
        reason: '根据评价为你推荐',
        tags: ['美食', '高分'],
        searchQuery: '人气餐厅',
        platform: '大众点评',
      },
      travel: {
        title: '热门景点',
        description: '必去景点',
        reason: '根据热度为你推荐',
        tags: ['旅游', '热门'],
        searchQuery: '热门景点',
        platform: '携程',
      },
      fitness: {
        title: '健身课程',
        description: '适合新手的课程',
        reason: '根据难度为你推荐',
        tags: ['健身', '入门'],
        searchQuery: '健身课程',
        platform: 'Keep',
      },
    },
    en: {
      entertainment: {
        title: 'Popular Games',
        description: 'Trending game titles',
        reason: 'Recommended based on popularity',
        tags: ['games', 'trending'],
        searchQuery: '2024 popular games',
        platform: 'Steam',
      },
      shopping: {
        title: 'Best Sellers',
        description: 'Most popular products',
        reason: 'Recommended based on sales',
        tags: ['best seller', 'top rated'],
        searchQuery: 'best sellers',
        platform: 'Amazon',
      },
      food: {
        title: 'Top Restaurants',
        description: 'Highly rated restaurants',
        reason: 'Recommended based on reviews',
        tags: ['food', 'top rated'],
        searchQuery: 'top restaurants',
        platform: 'TripAdvisor',
      },
      travel: {
        title: 'Popular Destinations',
        description: 'Must-visit places',
        reason: 'Recommended based on popularity',
        tags: ['travel', 'popular'],
        searchQuery: 'popular destinations',
        platform: 'Booking.com',
      },
      fitness: {
        title: 'Fitness Programs',
        description: 'Beginner friendly workouts',
        reason: 'Recommended based on difficulty',
        tags: ['fitness', 'beginner'],
        searchQuery: 'fitness programs',
        platform: 'YouTube',
      },
    },
  };

  const localeData = fallbacks[locale] || fallbacks.zh;
  return [localeData[category] || localeData.entertainment];
}

/* =========================
 * 生成用户画像摘要
 * ========================= */

export async function generateUserProfileSummary(
  answers: Record<string, any>,
  locale: string = 'zh'
): Promise<ProfileSummaryResult> {
  const prompt = locale === 'zh'
    ? `你是一位资深的用户画像分析师。

用户完成了兴趣问卷，以下是他们的回答：
${JSON.stringify(answers, null, 2)}

请分析这个用户的特征，生成详细的用户画像。

要求：
1. 生成一段简洁的画像摘要（2-3句话）
2. 提取 5-10 个关键的个性标签
3. 分析用户在各分类下的核心偏好

返回 JSON 格式：
{
  "summary": "这是一位...",
  "tags": ["标签1", "标签2"],
  "insights": {
    "entertainment": "偏好分析...",
    "shopping": "偏好分析...",
    "food": "偏好分析...",
    "travel": "偏好分析...",
    "fitness": "偏好分析..."
  }
}`
    : `You are an experienced user profile analyst.

A user has completed an interest questionnaire. Here are their answers:
${JSON.stringify(answers, null, 2)}

Please analyze this user's characteristics and generate a detailed user profile.

Requirements:
1. Generate a concise profile summary (2-3 sentences)
2. Extract 5-10 key personality tags
3. Analyze the user's core preferences in each category

Return JSON format:
{
  "summary": "This is a user who...",
  "tags": ["tag1", "tag2"],
  "insights": {
    "entertainment": "Preference analysis...",
    "shopping": "Preference analysis...",
    "food": "Preference analysis...",
    "travel": "Preference analysis...",
    "fitness": "Preference analysis..."
  }
}`;

  try {
    const content = await callRecommendationAI(
      [
        {
          role: 'system',
          content: locale === 'zh'
            ? '你是用户画像分析专家，只返回 JSON'
            : 'You are a user profile analysis expert, return only JSON',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      0.7
    );

    return JSON.parse(content);
  } catch (error) {
    console.error('[AI Profile] 生成失败:', error);
    return {
      summary: locale === 'zh'
        ? '一位对多种内容感兴趣的用户'
        : 'A user interested in various content',
      tags: locale === 'zh'
        ? ['探索者', '好奇心强']
        : ['explorer', 'curious'],
      insights: {},
    };
  }
}

/* =========================
 * 更新用户画像权重
 * ========================= */

export function calculateProfileWeightUpdates(
  currentPreferences: Record<string, number>,
  feedback: {
    isInterested?: boolean;
    hasPurchased?: boolean;
    rating?: number;
  },
  tags: string[]
): Record<string, number> {
  const prefs = { ...currentPreferences };

  tags.forEach(tag => {
    const current = prefs[tag] || 0;
    
    if (feedback.isInterested === true) {
      prefs[tag] = current + 1; // 感兴趣 +1
    }
    
    if (feedback.hasPurchased) {
      prefs[tag] = current + 3; // 已购买 +3
    }
    
    if (feedback.isInterested === false) {
      prefs[tag] = Math.max(0, current - 1); // 不感兴趣 -1
    }
    
    // 根据评分调整
    if (feedback.rating) {
      if (feedback.rating >= 4) {
        prefs[tag] = current + 2;
      } else if (feedback.rating <= 2) {
        prefs[tag] = Math.max(0, current - 1);
      }
    }
  });

  return prefs;
}

/* =========================
 * 计算画像完整度
 * ========================= */

export function calculateProfileCompleteness(params: {
  onboardingCompleted: boolean;
  usageCount: number;
  feedbackCount: number;
}): number {
  let completeness = 0;

  // 问卷完成：80分
  if (params.onboardingCompleted) {
    completeness = 80;
  }

  // 使用次数加分（最多 10 分，每2次+1分）
  completeness += Math.min(10, Math.floor(params.usageCount / 2));

  // 反馈次数加分（最多 10 分，每次+2分）
  completeness += Math.min(10, params.feedbackCount * 2);

  return Math.min(100, completeness);
}

