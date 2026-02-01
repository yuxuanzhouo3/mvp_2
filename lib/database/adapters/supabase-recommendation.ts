/**
 * Supabase 推荐系统数据库适配器
 * 
 * 实现 RecommendationDatabaseAdapter 接口，用于 INTL 环境
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  RecommendationDatabaseAdapter,
  RecommendationHistory,
  UserPreference,
  RecommendationCache,
  RecommendationCategory,
  AIRecommendation,
  UserAction,
  QueryOptions,
  QueryResult,
  SingleResult,
  MutationResult,
} from '../types';

// Supabase 客户端缓存
let supabaseInstance: SupabaseClient | null = null;

/**
 * 获取 Supabase 服务端客户端
 */
function getServiceClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase configuration');
  }

  supabaseInstance = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
}

/**
 * Supabase 推荐系统数据库适配器实现
 */
export class SupabaseRecommendationAdapter implements RecommendationDatabaseAdapter {
  private get supabase() {
    return getServiceClient();
  }

  /**
   * 获取推荐历史
   */
  async getRecommendationHistory(
    userId: string,
    category?: RecommendationCategory,
    options: QueryOptions = {}
  ): Promise<QueryResult<RecommendationHistory>> {
    try {
      const { limit = 20, offset = 0, orderBy = 'created_at', ascending = false } = options;

      let query = this.supabase
        .from('recommendation_history')
        .select('*')
        .eq('user_id', userId)
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: data || [], error: null, count: data?.length || 0 };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * 保存单个推荐
   */
  async saveRecommendation(
    userId: string,
    recommendation: AIRecommendation
  ): Promise<MutationResult> {
    try {
      const metadata = { ...(recommendation.metadata || {}) } as any;
      if (recommendation.tags && !Array.isArray(metadata.tags)) {
        metadata.tags = recommendation.tags;
      }
      metadata.candidateLink = recommendation.candidateLink;

      const { data, error } = await this.supabase
        .from('recommendation_history')
        .insert({
          user_id: userId,
          category: recommendation.category,
          title: recommendation.title,
          description: recommendation.description,
          link: recommendation.link,
          link_type: recommendation.linkType,
          metadata,
          reason: recommendation.reason,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, id: data?.id };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 批量保存推荐
   */
  async saveRecommendations(
    userId: string,
    recommendations: AIRecommendation[]
  ): Promise<MutationResult & { ids?: string[] }> {
    try {
      const records = recommendations.map((rec) => ({
        metadata: (() => {
          const metadata = { ...(rec.metadata || {}) } as any;
          if (rec.tags && !Array.isArray(metadata.tags)) {
            metadata.tags = rec.tags;
          }
          metadata.candidateLink = rec.candidateLink;
          return metadata;
        })(),
        user_id: userId,
        category: rec.category,
        title: rec.title,
        description: rec.description,
        link: rec.link,
        link_type: rec.linkType,
        reason: rec.reason,
      }));

      const { data, error } = await this.supabase
        .from('recommendation_history')
        .insert(records)
        .select('id');

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      const ids = (data || []).map((item) => item.id);
      return { success: true, ids };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 更新推荐
   */
  async updateRecommendation(
    id: string,
    updates: Partial<RecommendationHistory>
  ): Promise<MutationResult> {
    try {
      const { error } = await this.supabase
        .from('recommendation_history')
        .update(updates)
        .eq('id', id);

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, id };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 删除推荐
   */
  async deleteRecommendations(
    userId: string,
    ids?: string[],
    category?: RecommendationCategory
  ): Promise<MutationResult & { deletedCount?: number }> {
    try {
      let query = this.supabase
        .from('recommendation_history')
        .delete()
        .eq('user_id', userId);

      if (ids && ids.length > 0) {
        query = query.in('id', ids);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { error, count } = await query;

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, deletedCount: count || 0 };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 获取用户偏好
   */
  async getUserPreferences(
    userId: string,
    category?: RecommendationCategory
  ): Promise<QueryResult<UserPreference>> {
    try {
      let query = this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: data || [], error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * 更新或创建用户偏好
   */
  async upsertUserPreference(
    userId: string,
    category: RecommendationCategory,
    updates: {
      preferences?: Record<string, number>;
      tags?: string[];
      incrementClick?: boolean;
      incrementView?: boolean;
      // 用户画像相关字段
      onboarding_completed?: boolean;
      profile_completeness?: number;
      ai_profile_summary?: string;
      personality_tags?: string[];
    }
  ): Promise<SingleResult<UserPreference>> {
    try {
      // 先获取现有偏好
      const { data: existing } = await this.supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .single();

      if (existing) {
        // 更新现有记录
        const newPreferences = updates.preferences
          ? { ...existing.preferences, ...updates.preferences }
          : existing.preferences;

        const newTags = updates.tags
          ? [...new Set([...(existing.tags || []), ...updates.tags])]
          : existing.tags;

        // 构建更新对象
        const updateData: Record<string, any> = {
          preferences: newPreferences,
          tags: newTags,
          click_count: updates.incrementClick ? (existing.click_count || 0) + 1 : existing.click_count,
          view_count: updates.incrementView ? (existing.view_count || 0) + 1 : existing.view_count,
          last_activity: new Date().toISOString(),
        };

        // 添加画像相关字段（如果提供）
        if (updates.onboarding_completed !== undefined) {
          updateData.onboarding_completed = updates.onboarding_completed;
        }
        if (updates.profile_completeness !== undefined) {
          updateData.profile_completeness = updates.profile_completeness;
        }
        if (updates.ai_profile_summary !== undefined) {
          updateData.ai_profile_summary = updates.ai_profile_summary;
        }
        if (updates.personality_tags !== undefined) {
          updateData.personality_tags = updates.personality_tags;
        }

        const { data, error } = await this.supabase
          .from('user_preferences')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          console.error('[Supabase] 更新用户偏好失败:', error);
          return { data: null, error: new Error(error.message) };
        }

        return { data, error: null };
      } else {
        // 创建新记录
        const insertData: Record<string, any> = {
          user_id: userId,
          category,
          preferences: updates.preferences || {},
          tags: updates.tags || [],
          click_count: updates.incrementClick ? 1 : 0,
          view_count: updates.incrementView ? 1 : 0,
          last_activity: new Date().toISOString(),
        };

        // 添加画像相关字段（如果提供）
        if (updates.onboarding_completed !== undefined) {
          insertData.onboarding_completed = updates.onboarding_completed;
        }
        if (updates.profile_completeness !== undefined) {
          insertData.profile_completeness = updates.profile_completeness;
        }
        if (updates.ai_profile_summary !== undefined) {
          insertData.ai_profile_summary = updates.ai_profile_summary;
        }
        if (updates.personality_tags !== undefined) {
          insertData.personality_tags = updates.personality_tags;
        }

        const { data, error } = await this.supabase
          .from('user_preferences')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          console.error('[Supabase] 创建用户偏好失败:', error);
          return { data: null, error: new Error(error.message) };
        }

        return { data, error: null };
      }
    } catch (error) {
      console.error('[Supabase] upsertUserPreference 异常:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * 记录点击
   */
  async recordClick(
    userId: string,
    recommendationId: string,
    action: UserAction
  ): Promise<MutationResult> {
    try {
      const { data, error } = await this.supabase
        .from('recommendation_clicks')
        .insert({
          user_id: userId,
          recommendation_id: recommendationId,
          action,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      // 如果是点击或保存，更新推荐历史的状态
      if (action === 'click' || action === 'save') {
        const updateField = action === 'click' ? 'clicked' : 'saved';
        await this.supabase
          .from('recommendation_history')
          .update({ [updateField]: true })
          .eq('id', recommendationId);
      }

      return { success: true, id: data?.id };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 获取缓存的推荐
   */
  async getCachedRecommendations(
    category: RecommendationCategory,
    preferenceHash: string
  ): Promise<SingleResult<RecommendationCache>> {
    try {
      const { data, error } = await this.supabase
        .from('recommendation_cache')
        .select('*')
        .eq('category', category)
        .eq('preference_hash', preferenceHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) {
        return { data: null, error: null }; // 缓存不存在不算错误
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * 缓存推荐
   */
  async cacheRecommendations(
    category: RecommendationCategory,
    preferenceHash: string,
    recommendations: any[],
    expirationMinutes: number = 60
  ): Promise<MutationResult> {
    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

      // 先删除旧缓存
      await this.supabase
        .from('recommendation_cache')
        .delete()
        .eq('category', category)
        .eq('preference_hash', preferenceHash);

      // 插入新缓存
      const { error } = await this.supabase.from('recommendation_cache').insert({
        category,
        preference_hash: preferenceHash,
        recommendations,
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpiredCache(): Promise<{ deletedCount: number }> {
    try {
      const { data, error } = await this.supabase.rpc('cleanup_expired_cache');

      if (error) {
        console.error('Error cleaning up cache:', error);
        return { deletedCount: 0 };
      }

      return { deletedCount: data || 0 };
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      return { deletedCount: 0 };
    }
  }
}

