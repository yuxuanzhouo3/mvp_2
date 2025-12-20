/**
 * 用户反馈提交 API
 * POST /api/recommend/submit-feedback
 *
 * 处理用户对推荐内容的反馈（感兴趣、已购买、评分等）
 * 更新用户画像权重
 *
 * 支持双环境架构：INTL (Supabase) 和 CN (CloudBase)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecommendationAdapter } from '@/lib/database';
import { calculateProfileWeightUpdates } from '@/lib/ai/profile-based-recommendation';
import { isValidUserId } from '@/lib/utils';
import { isChinaDeployment } from '@/lib/config/deployment.config';
import {
  getCloudBaseDatabase,
  CloudBaseCollections,
  nowISO,
} from '@/lib/database/cloudbase-client';

export const dynamic = 'force-dynamic';

export interface FeedbackData {
  userId: string;
  recommendationId: string;
  feedbackType: 'interest' | 'purchase' | 'rating' | 'skip';
  isInterested?: boolean;
  hasPurchased?: boolean;
  rating?: number;
  comment?: string;
  triggeredBy?: string;
}

/**
 * 保存用户反馈到数据库
 * 支持双环境架构
 */
async function saveFeedbackToDatabase(feedbackRecord: {
  user_id: string;
  recommendation_id: string;
  feedback_type: string;
  is_interested: boolean | null;
  has_purchased: boolean | null;
  rating: number | null;
  comment: string | null;
  triggered_by: string;
  created_at: string;
}): Promise<{ success: boolean; error?: string }> {
  if (isChinaDeployment()) {
    // CN 环境：使用 CloudBase
    try {
      const db = getCloudBaseDatabase();
      await db.collection(CloudBaseCollections.USER_FEEDBACKS).add(feedbackRecord);
      return { success: true };
    } catch (error: any) {
      console.error('[Feedback] CloudBase 保存反馈失败:', error);
      return { success: false, error: error.message };
    }
  } else {
    // INTL 环境：使用 Supabase
    try {
      const { supabaseAdmin } = await import('@/lib/integrations/supabase-admin');
      const { error } = await supabaseAdmin
        .from('user_feedbacks')
        .insert(feedbackRecord);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error: any) {
      console.error('[Feedback] Supabase 保存反馈失败:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * 获取用户反馈历史
 * 支持双环境架构
 */
async function getFeedbackHistory(
  userId: string,
  limit: number = 10
): Promise<{ data: any[]; error?: string }> {
  if (isChinaDeployment()) {
    // CN 环境：使用 CloudBase
    try {
      const db = getCloudBaseDatabase();
      const result = await db
        .collection(CloudBaseCollections.USER_FEEDBACKS)
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();

      const data = (result.data || []).map((item: any) => ({
        id: item._id,
        user_id: item.user_id,
        recommendation_id: item.recommendation_id,
        feedback_type: item.feedback_type,
        is_interested: item.is_interested,
        has_purchased: item.has_purchased,
        rating: item.rating,
        comment: item.comment,
        triggered_by: item.triggered_by,
        created_at: item.created_at,
      }));

      return { data };
    } catch (error: any) {
      console.error('[Feedback] CloudBase 获取反馈历史失败:', error);
      return { data: [], error: error.message };
    }
  } else {
    // INTL 环境：使用 Supabase
    try {
      const { supabaseAdmin } = await import('@/lib/integrations/supabase-admin');
      const { data, error } = await supabaseAdmin
        .from('user_feedbacks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { data: [], error: error.message };
      }
      return { data: data || [] };
    } catch (error: any) {
      console.error('[Feedback] Supabase 获取反馈历史失败:', error);
      return { data: [], error: error.message };
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as FeedbackData;
    const {
      userId,
      recommendationId,
      feedbackType,
      isInterested,
      hasPurchased,
      rating,
      comment,
      triggeredBy = 'return_visit'
    } = body;

    // 验证必要字段
    if (!userId || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID', success: false },
        { status: 400 }
      );
    }

    if (!recommendationId) {
      return NextResponse.json(
        { error: '推荐ID不能为空', success: false },
        { status: 400 }
      );
    }

    if (!feedbackType) {
      return NextResponse.json(
        { error: '反馈类型不能为空', success: false },
        { status: 400 }
      );
    }

    console.log(`[Feedback] 用户 ${userId.slice(0, 8)}... 提交反馈: ${feedbackType}`);

    const adapter = await getRecommendationAdapter();

    // 0. 直接保存反馈到 user_feedbacks 表
    const feedbackRecord = {
      user_id: userId,
      recommendation_id: recommendationId,
      feedback_type: feedbackType,
      is_interested: isInterested ?? null,
      has_purchased: hasPurchased ?? null,
      rating: rating ?? null,
      comment: comment ?? null,
      triggered_by: triggeredBy,
      created_at: nowISO(),
    };

    const saveResult = await saveFeedbackToDatabase(feedbackRecord);
    if (!saveResult.success) {
      console.error('[Feedback] 保存反馈到user_feedbacks表失败:', saveResult.error);
    } else {
      console.log('[Feedback] 反馈已保存到user_feedbacks表');
    }

    // 1. 获取推荐详情以获取标签和分类
    let recommendationCategory = 'entertainment';
    let recommendationTags: string[] = [];

    try {
      // 从历史记录中获取推荐信息
      const historyResult = await adapter.getRecommendationHistory(userId);
      const recommendation = historyResult.data?.find(
        (rec: any) => rec.id === recommendationId
      );

      if (recommendation) {
        recommendationCategory = recommendation.category;
        recommendationTags = recommendation.metadata?.tags || [];
      }
    } catch (historyError) {
      console.warn('[Feedback] 获取推荐详情失败:', historyError);
    }

    // 2. 记录反馈（通过 recordClick 方法）
    // 注意：数据库约束允许的 action 类型为 'view', 'click', 'save', 'share', 'dismiss', 'return', 'feedback'
    // 需要先执行数据库迁移扩展约束
    try {
      // 使用 'click' 作为 action 类型（保守做法），或在数据库迁移后使用 'feedback'
      await adapter.recordClick(userId, recommendationId, 'click');
      console.log(`[Feedback] 反馈记录成功 - 类型: ${feedbackType}, 评分: ${rating || 'N/A'}`);
    } catch (recordError) {
      console.error('[Feedback] 记录反馈失败:', recordError);
    }

    // 3. 更新用户画像权重
    try {
      // 获取当前偏好
      const prefResult = await adapter.getUserPreferences(userId, recommendationCategory as any);
      const currentPreferences = prefResult.data?.[0]?.preferences || {};

      // 计算新权重
      const updatedPreferences = calculateProfileWeightUpdates(
        currentPreferences as Record<string, number>,
        { isInterested, hasPurchased, rating },
        recommendationTags
      );

      // 更新偏好
      await adapter.upsertUserPreference(userId, recommendationCategory as any, {
        preferences: updatedPreferences,
        incrementClick: isInterested || hasPurchased
      });

      console.log('[Feedback] 画像权重更新成功');
    } catch (updateError) {
      console.error('[Feedback] 更新画像权重失败:', updateError);
    }

    // 4. 计算积分或奖励（可选）
    let rewardMessage = '';
    if (feedbackType !== 'skip') {
      rewardMessage = '感谢您的反馈！您的意见将帮助我们提供更好的推荐。';
    }

    return NextResponse.json({
      success: true,
      message: rewardMessage || '反馈已提交',
      feedbackType,
      profileUpdated: true
    });

  } catch (error: any) {
    console.error('[Feedback] 错误:', error);
    return NextResponse.json(
      {
        error: error.message || '服务器错误',
        success: false
      },
      { status: 500 }
    );
  }
}

/**
 * 获取用户反馈历史
 * GET /api/recommend/submit-feedback?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!userId || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID', success: false },
        { status: 400 }
      );
    }

    // 获取用户的反馈历史
    const { data: feedbackHistory, error } = await getFeedbackHistory(userId, limit);

    if (error) {
      console.warn('[Feedback History] 获取反馈历史警告:', error);
    }

    return NextResponse.json({
      success: true,
      feedbacks: feedbackHistory,
      totalCount: feedbackHistory.length
    });

  } catch (error: any) {
    console.error('[Feedback History] 错误:', error);
    return NextResponse.json(
      {
        error: error.message || '服务器错误',
        success: false
      },
      { status: 500 }
    );
  }
}
