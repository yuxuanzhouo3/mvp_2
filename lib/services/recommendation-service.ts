/**
 * 推荐系统数据服务层
 * 处理数据库操作和业务逻辑
 */

import { createClient } from "@supabase/supabase-js";
import type {
  AIRecommendation,
  RecommendationCategory,
  RecommendationHistory,
  UserPreference,
  UserAction,
  UserPreferenceAnalysis,
  UserPreferenceSummary,
} from "@/lib/types/recommendation";

// 创建服务端 Supabase 客户端
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase configuration is missing");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 获取用户推荐历史
 */
export async function getUserRecommendationHistory(
  userId: string,
  category?: RecommendationCategory,
  limit: number = 20
): Promise<RecommendationHistory[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("recommendation_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching recommendation history:", error);
    return [];
  }

  return data || [];
}

/**
 * 保存推荐到历史
 */
export async function saveRecommendationToHistory(
  userId: string,
  recommendation: AIRecommendation
): Promise<string | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("recommendation_history")
    .insert({
      user_id: userId,
      category: recommendation.category,
      title: recommendation.title,
      description: recommendation.description,
      link: recommendation.link,
      link_type: recommendation.linkType,
      metadata: recommendation.metadata,
      reason: recommendation.reason,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error saving recommendation:", error);
    return null;
  }

  return data?.id || null;
}

/**
 * 批量保存推荐到历史
 */
export async function saveRecommendationsToHistory(
  userId: string,
  recommendations: AIRecommendation[]
): Promise<string[]> {
  const supabase = getServiceClient();

  const records = recommendations.map((rec) => ({
    user_id: userId,
    category: rec.category,
    title: rec.title,
    description: rec.description,
    link: rec.link,
    link_type: rec.linkType,
    metadata: rec.metadata,
    reason: rec.reason,
  }));

  const { data, error } = await supabase
    .from("recommendation_history")
    .insert(records)
    .select("id");

  if (error) {
    console.error("Error saving recommendations:", error);
    return [];
  }

  return (data || []).map((item) => item.id);
}

/**
 * 记录用户点击行为
 */
export async function recordUserClick(
  userId: string,
  recommendationId: string,
  action: UserAction
): Promise<string | null> {
  const supabase = getServiceClient();

  // 记录点击
  const { data: clickData, error: clickError } = await supabase
    .from("recommendation_clicks")
    .insert({
      user_id: userId,
      recommendation_id: recommendationId,
      action,
    })
    .select("id")
    .single();

  if (clickError) {
    console.error("Error recording click:", clickError);
    return null;
  }

  // 如果是点击或保存，更新推荐历史的状态
  if (action === "click" || action === "save") {
    const updateField = action === "click" ? "clicked" : "saved";
    await supabase
      .from("recommendation_history")
      .update({ [updateField]: true })
      .eq("id", recommendationId);
  }

  return clickData?.id || null;
}

/**
 * 获取用户偏好
 */
export async function getUserPreferences(
  userId: string,
  category?: RecommendationCategory
): Promise<UserPreference[]> {
  const supabase = getServiceClient();

  let query = supabase.from("user_preferences").select("*").eq("user_id", userId);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching user preferences:", error);
    return [];
  }

  return data || [];
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
  const supabase = getServiceClient();

  // 获取现有偏好
  const existing = await getUserCategoryPreference(userId, category);

  if (existing) {
    // 合并偏好权重
    const newPreferences = updates.preferences
      ? { ...existing.preferences, ...updates.preferences }
      : existing.preferences;

    // 合并标签
    const newTags = updates.tags
      ? [...new Set([...existing.tags, ...updates.tags])]
      : existing.tags;

    const { data, error } = await supabase
      .from("user_preferences")
      .update({
        preferences: newPreferences,
        tags: newTags,
        click_count: updates.incrementClick ? existing.click_count + 1 : existing.click_count,
        view_count: updates.incrementView ? existing.view_count + 1 : existing.view_count,
        last_activity: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating preferences:", error);
      return null;
    }

    return data;
  } else {
    // 创建新偏好
    const { data, error } = await supabase
      .from("user_preferences")
      .insert({
        user_id: userId,
        category,
        preferences: updates.preferences || {},
        tags: updates.tags || [],
        click_count: updates.incrementClick ? 1 : 0,
        view_count: updates.incrementView ? 1 : 0,
        last_activity: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating preferences:", error);
      return null;
    }

    return data;
  }
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
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc("cleanup_expired_cache");

  if (error) {
    console.error("Error cleaning up cache:", error);
    return 0;
  }

  return data || 0;
}

/**
 * 获取缓存的推荐
 */
export async function getCachedRecommendations(
  category: RecommendationCategory,
  preferenceHash: string
): Promise<AIRecommendation[] | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("recommendation_cache")
    .select("recommendations")
    .eq("category", category)
    .eq("preference_hash", preferenceHash)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return data.recommendations as AIRecommendation[];
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
  const supabase = getServiceClient();

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

  // 先尝试删除旧的缓存，再插入新的
  // 这样可以避免 upsert 的约束问题
  try {
    await supabase
      .from("recommendation_cache")
      .delete()
      .eq("category", category)
      .eq("preference_hash", preferenceHash);

    await supabase.from("recommendation_cache").insert({
      category,
      preference_hash: preferenceHash,
      recommendations,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to cache recommendations:", error);
  }
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
