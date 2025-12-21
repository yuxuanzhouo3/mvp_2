/**
 * CloudBase 推荐系统数据库适配器
 * 
 * 实现 RecommendationDatabaseAdapter 接口，用于 CN 环境
 */

import {
  getCloudBaseDatabase,
  CloudBaseCollections,
  generateId,
  nowISO,
  getDbCommand,
  handleCloudBaseError,
} from '../cloudbase-client';
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

/**
 * CloudBase 推荐系统数据库适配器实现
 */
export class CloudBaseRecommendationAdapter implements RecommendationDatabaseAdapter {
  private get db() {
    return getCloudBaseDatabase();
  }

  private get cmd() {
    return getDbCommand();
  }

  /**
   * 获取推荐历史
   * 注意：只返回初始生成的推荐记录，并根据标题去重（只保留最新的一条）
   */
  async getRecommendationHistory(
    userId: string,
    category?: RecommendationCategory,
    options: QueryOptions = {}
  ): Promise<QueryResult<RecommendationHistory>> {
    try {
      const { limit = 20, offset = 0, orderBy = 'created_at', ascending = false } = options;

      const collection = this.db.collection(CloudBaseCollections.RECOMMENDATION_HISTORY);

      let query: any = { user_id: userId };
      if (category) {
        query.category = category;
      }

      // 获取更多记录以便去重后仍有足够数据
      const fetchLimit = Math.min((limit + offset) * 3, 500);

      const result = await collection
        .where(query)
        .orderBy(orderBy, ascending ? 'asc' : 'desc')
        .limit(fetchLimit)
        .get();

      // 转换 CloudBase 的 _id 为 id
      let data = (result.data || []).map((item: any) => ({
        ...item,
        id: item._id || item.id,
      }));

      // 根据 title + category 去重，只保留最新的一条记录
      // 这样可以避免同一推荐因多次刷新而重复展示
      const seen = new Map<string, any>();
      for (const item of data) {
        const key = `${item.category}-${item.title}`;
        if (!seen.has(key)) {
          seen.set(key, item);
        }
        // 由于数据已按时间倒序排列，第一条就是最新的，所以不需要比较时间
      }

      // 转换回数组并应用分页
      const uniqueData = Array.from(seen.values());
      const paginatedData = uniqueData.slice(offset, offset + limit);

      return { data: paginatedData, error: null, count: paginatedData.length };
    } catch (error) {
      return {
        data: null,
        error: handleCloudBaseError(error, 'getRecommendationHistory')
      };
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
      const collection = this.db.collection(CloudBaseCollections.RECOMMENDATION_HISTORY);
      const now = nowISO();

      const doc = {
        user_id: userId,
        category: recommendation.category,
        title: recommendation.title,
        description: recommendation.description || null,
        link: recommendation.link,
        link_type: recommendation.linkType || null,
        metadata: recommendation.metadata || {},
        reason: recommendation.reason || null,
        clicked: false,
        saved: false,
        created_at: now,
        updated_at: now,
      };

      const result = await collection.add(doc);

      return { success: true, id: result.id };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'saveRecommendation') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.RECOMMENDATION_HISTORY);
      const now = nowISO();
      const ids: string[] = [];

      // CloudBase 不支持批量插入，需要逐个插入
      for (const rec of recommendations) {
        const doc = {
          user_id: userId,
          category: rec.category,
          title: rec.title,
          description: rec.description || null,
          link: rec.link,
          link_type: rec.linkType || null,
          metadata: rec.metadata || {},
          reason: rec.reason || null,
          clicked: false,
          saved: false,
          created_at: now,
          updated_at: now,
        };

        const result = await collection.add(doc);
        ids.push(result.id);
      }

      return { success: true, ids };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'saveRecommendations') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.RECOMMENDATION_HISTORY);

      // 移除不应该更新的字段
      const { id: _, user_id, created_at, ...updateData } = updates as any;

      await collection.doc(id).update({
        ...updateData,
        updated_at: nowISO(),
      });

      return { success: true, id };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'updateRecommendation') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.RECOMMENDATION_HISTORY);
      let deletedCount = 0;

      if (ids && ids.length > 0) {
        // 删除指定 ID 的记录
        for (const id of ids) {
          await collection.doc(id).remove();
          deletedCount++;
        }
      } else {
        // 删除用户的所有记录（可选按分类）
        let query: any = { user_id: userId };
        if (category) {
          query.category = category;
        }

        const result = await collection.where(query).remove();
        deletedCount = result.deleted || 0;
      }

      return { success: true, deletedCount };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'deleteRecommendations') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.USER_PREFERENCES);

      let query: any = { user_id: userId };
      if (category) {
        query.category = category;
      }

      const result = await collection.where(query).get();

      const data = (result.data || []).map((item: any) => ({
        ...item,
        id: item._id || item.id,
      }));

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: handleCloudBaseError(error, 'getUserPreferences') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.USER_PREFERENCES);
      const now = nowISO();

      // 查找现有记录
      const existingResult = await collection
        .where({ user_id: userId, category })
        .get();

      const existing = existingResult.data?.[0];

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
          last_activity: now,
          updated_at: now,
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

        await collection.doc(existing._id).update(updateData);

        return {
          data: {
            ...existing,
            ...updateData,
            id: existing._id,
          } as UserPreference,
          error: null,
        };
      } else {
        // 创建新记录
        const newDoc: Record<string, any> = {
          user_id: userId,
          category,
          preferences: updates.preferences || {},
          tags: updates.tags || [],
          click_count: updates.incrementClick ? 1 : 0,
          view_count: updates.incrementView ? 1 : 0,
          last_activity: now,
          created_at: now,
          updated_at: now,
        };

        // 添加画像相关字段（如果提供）
        if (updates.onboarding_completed !== undefined) {
          newDoc.onboarding_completed = updates.onboarding_completed;
        }
        if (updates.profile_completeness !== undefined) {
          newDoc.profile_completeness = updates.profile_completeness;
        }
        if (updates.ai_profile_summary !== undefined) {
          newDoc.ai_profile_summary = updates.ai_profile_summary;
        }
        if (updates.personality_tags !== undefined) {
          newDoc.personality_tags = updates.personality_tags;
        }

        const result = await collection.add(newDoc);

        return {
          data: {
            ...newDoc,
            id: result.id,
          } as UserPreference,
          error: null,
        };
      }
    } catch (error) {
      return {
        data: null,
        error: handleCloudBaseError(error, 'upsertUserPreference')
      };
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
      const clicksCollection = this.db.collection(CloudBaseCollections.RECOMMENDATION_CLICKS);
      const historyCollection = this.db.collection(CloudBaseCollections.RECOMMENDATION_HISTORY);

      // 记录点击
      const result = await clicksCollection.add({
        user_id: userId,
        recommendation_id: recommendationId,
        action,
        clicked_at: nowISO(),
      });

      // 如果是点击或保存，更新推荐历史的状态
      if (action === 'click' || action === 'save') {
        const updateField = action === 'click' ? 'clicked' : 'saved';
        await historyCollection.doc(recommendationId).update({
          [updateField]: true,
          updated_at: nowISO(),
        });
      }

      return { success: true, id: result.id };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'recordClick') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.RECOMMENDATION_CACHE);
      const now = nowISO();

      const result = await collection
        .where({
          category,
          preference_hash: preferenceHash,
        })
        .get();

      if (!result.data || result.data.length === 0) {
        return { data: null, error: null };
      }

      const cache = result.data[0];

      // 检查是否过期
      if (cache.expires_at < now) {
        // 缓存已过期，删除并返回 null
        await collection.doc(cache._id).remove();
        return { data: null, error: null };
      }

      return {
        data: {
          ...cache,
          id: cache._id,
        } as RecommendationCache,
        error: null,
      };
    } catch (error) {
      return { data: null, error: null }; // 缓存查询失败不算错误
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
      const collection = this.db.collection(CloudBaseCollections.RECOMMENDATION_CACHE);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expirationMinutes * 60 * 1000);

      // 先删除旧缓存
      await collection
        .where({ category, preference_hash: preferenceHash })
        .remove();

      // 插入新缓存
      await collection.add({
        category,
        preference_hash: preferenceHash,
        recommendations,
        expires_at: expiresAt.toISOString(),
        created_at: nowISO(),
      });

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'cacheRecommendations') 
      };
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpiredCache(): Promise<{ deletedCount: number }> {
    try {
      const collection = this.db.collection(CloudBaseCollections.RECOMMENDATION_CACHE);
      const now = nowISO();

      // CloudBase 使用 command 进行比较操作
      const result = await collection
        .where({
          expires_at: this.cmd.lt(now),
        })
        .remove();

      return { deletedCount: result.deleted || 0 };
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      return { deletedCount: 0 };
    }
  }
}

