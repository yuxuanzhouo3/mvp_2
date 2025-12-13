/**
 * 推荐系统数据服务层
 * 处理数据库操作和业务逻辑
 * 
 * 支持双环境架构：INTL (Supabase) 和 CN (CloudBase)
 */

import { getRecommendationAdapter, db } from "@/lib/database";
import type {
  AIRecommendation,
  RecommendationCategory,
  RecommendationHistory,
  UserPreference,
  UserAction,
  UserPreferenceAnalysis,
  UserPreferenceSummary,
} from "@/lib/database/types";

/**
 * 获取用户推荐历史
 */
export async function getUserRecommendationHistory(
  userId: string,
  category?: RecommendationCategory,
  limit: number = 20
): Promise<RecommendationHistory[]> {
  const adapter = await getRecommendationAdapter();
  const result = await adapter.getRecommendationHistory(userId, category, { limit });

  if (result.error) {
    console.error("Error fetching recommendation history:", result.error);
    return [];
  }

  return result.data || [];
}

/**
 * 保存推荐到历史
 */
export async function saveRecommendationToHistory(
  userId: string,
  recommendation: AIRecommendation
): Promise<string | null> {
  const adapter = await getRecommendationAdapter();
  const result = await adapter.saveRecommendation(userId, recommendation);

  if (!result.success || result.error) {
    console.error("Error saving recommendation:", result.error);
    return null;
  }

  return result.id || null;
}

/**
 * 批量保存推荐到历史
 */
export async function saveRecommendationsToHistory(
  userId: string,
  recommendations: AIRecommendation[]
): Promise<string[]> {
  const adapter = await getRecommendationAdapter();
  const result = await adapter.saveRecommendations(userId, recommendations);

  if (!result.success || result.error) {
    console.error("Error saving recommendations:", result.error);
    return [];
  }

  return result.ids || [];
}

/**
 * 记录用户点击行为
 */
export async function recordUserClick(
  userId: string,
  recommendationId: string,
  action: UserAction
): Promise<string | null> {
  const adapter = await getRecommendationAdapter();
  const result = await adapter.recordClick(userId, recommendationId, action);

  if (!result.success || result.error) {
    console.error("Error recording click:", result.error);
    return null;
  }

  return result.id || null;
}

/**
 * 获取用户偏好
 */
export async function getUserPreferences(
  userId: string,
  category?: RecommendationCategory
): Promise<UserPreference[]> {
  const adapter = await getRecommendationAdapter();
  const result = await adapter.getUserPreferences(userId, category);

  if (result.error) {
    console.error("Error fetching user preferences:", result.error);
    return [];
  }

  return result.data || [];
}

/**
 * 获取单个分类的用户偏好
 */
export async function getUserCategoryPreference(
  userId: string,
  category: RecommendationCategory
): Promise<UserPreference | null> {
  const preferences = await getUserPreferences(userId, category);
  return preferences[0] || null;
}

/**
 * 更新用户偏好
 */
export async function updateUserPreferences(
  userId: string,
  category: RecommendationCategory,
  updates: {
    preferences?: Record<string, number>;
    tags?: string[];
    incrementClick?: boolean;
    incrementView?: boolean;
  }
): Promise<UserPreference | null> {
  const adapter = await getRecommendationAdapter();
  const result = await adapter.upsertUserPreference(userId, category, updates);

  if (result.error) {
    console.error("Error updating preferences:", result.error);
    return null;
  }

  return result.data;
}

/**
 * 从推荐历史学习用户偏好
 */
export async function learnPreferencesFromHistory(
  userId: string,
  category: RecommendationCategory
): Promise<void> {
  const history = await getUserRecommendationHistory(userId, category, 50);

  if (history.length === 0) return;

  // 统计点击的推荐的标签
  const tagCounts: Record<string, number> = {};
  const clickedItems = history.filter((h) => h.clicked);

  clickedItems.forEach((item) => {
    const tags = item.metadata?.tags as string[] | undefined;
    if (tags) {
      tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }

    // 从标题和描述中提取关键词（简化处理）
    const title = item.title?.toLowerCase() || "";
    const words = title.split(/[\s,，、]+/).filter((w) => w.length > 1);
    words.forEach((word) => {
      tagCounts[word] = (tagCounts[word] || 0) + 0.5;
    });
  });

  // 计算权重（归一化到 0-1）
  const maxCount = Math.max(...Object.values(tagCounts), 1);
  const preferences: Record<string, number> = {};
  Object.entries(tagCounts).forEach(([tag, count]) => {
    preferences[tag] = Math.round((count / maxCount) * 100) / 100;
  });

  // 提取顶部标签
  const topTags = Object.entries(preferences)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag]) => tag);

  await updateUserPreferences(userId, category, {
    preferences,
    tags: topTags,
  });
}

/**
 * 获取用户完整偏好分析
 */
export async function getUserPreferenceAnalysis(
  userId: string
): Promise<UserPreferenceAnalysis> {
  const allPreferences = await getUserPreferences(userId);

  const summaries: UserPreferenceSummary[] = allPreferences.map((pref) => ({
    category: pref.category,
    topTags: Object.entries(pref.preferences || {})
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([tag]) => tag),
    clickCount: pref.click_count,
    viewCount: pref.view_count,
    lastActivity: pref.last_activity,
  }));

  const totalInteractions = summaries.reduce(
    (sum, s) => sum + s.clickCount + s.viewCount,
    0
  );

  // 找出最喜欢的分类
  const favoriteCategory = summaries.length > 0
    ? summaries.sort((a, b) => b.clickCount - a.clickCount)[0].category
    : null;

  // 最后活跃时间
  const lastActiveAt = summaries.length > 0
    ? summaries.sort((a, b) =>
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      )[0].lastActivity
    : null;

  return {
    userId,
    preferences: summaries,
    totalInteractions,
    favoriteCategory,
    lastActiveAt,
  };
}

/**
 * 检查并清理过期缓存
 */
export async function cleanupExpiredCache(): Promise<number> {
  const adapter = await getRecommendationAdapter();
  const result = await adapter.cleanupExpiredCache();
  return result.deletedCount;
}

/**
 * 获取缓存的推荐
 */
export async function getCachedRecommendations(
  category: RecommendationCategory,
  preferenceHash: string
): Promise<AIRecommendation[] | null> {
  const adapter = await getRecommendationAdapter();
  const result = await adapter.getCachedRecommendations(category, preferenceHash);

  if (result.error || !result.data) {
    return null;
  }

  return result.data.recommendations as AIRecommendation[];
}

/**
 * 保存推荐到缓存
 */
export async function cacheRecommendations(
  category: RecommendationCategory,
  preferenceHash: string,
  recommendations: AIRecommendation[],
  expirationMinutes: number = 60
): Promise<void> {
  const adapter = await getRecommendationAdapter();
  await adapter.cacheRecommendations(
    category,
    preferenceHash,
    recommendations,
    expirationMinutes
  );
}

/**
 * 生成偏好哈希值
 */
export function generatePreferenceHash(preferences: UserPreference | null): string {
  if (!preferences) return "default";

  const topTags = Object.entries(preferences.preferences || {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([tag]) => tag)
    .join(",");

  return topTags || "default";
}

/**
 * 获取当前数据库提供商信息
 */
export function getDatabaseInfo(): {
  provider: 'supabase' | 'cloudbase';
  isSupabase: boolean;
  isCloudBase: boolean;
} {
  return {
    provider: db.getProvider(),
    isSupabase: db.isSupabase(),
    isCloudBase: db.isCloudBase(),
  };
}
