/**
 * 用户返回追踪 API
 * POST /api/recommend/track-return
 * 
 * 记录用户从外部网站返回的行为，包括停留时间
 * 用于判断是否触发反馈问卷
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecommendationAdapter } from '@/lib/database';
import { isValidUserId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, recommendationId, timeAway } = body;

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

    const timeAwaySeconds = parseInt(timeAway) || 0;
    console.log(`[Track Return] 用户 ${userId.slice(0, 8)}... 返回，停留时间: ${timeAwaySeconds} 秒`);

    // 1. 记录返回事件和停留时间
    try {
      const adapter = await getRecommendationAdapter();
      
      // 记录返回行为 - 使用 'view' 作为 action，停留时间记录在 metadata 或专门的字段中
      // 注意：数据库约束只允许 'view', 'click', 'save', 'share', 'dismiss'
      const result = await adapter.recordClick(userId, recommendationId, 'view');
      
      // TODO: 如果需要保存更多元数据（如 timeOnPage, sessionId），
      // 需要先执行数据库迁移扩展 recommendation_clicks 表
      
      if (result.success) {
        console.log('[Track Return] 返回事件已记录');
      } else {
        console.warn('[Track Return] 记录返回事件失败:', result.error);
      }
    } catch (recordError) {
      console.warn('[Track Return] 记录返回事件失败:', recordError);
    }

    // 2. 判断是否触发反馈（停留 > 30秒）
    let triggerFeedback = false;
    let recommendation = null;

    if (timeAwaySeconds > 30) {
      // 停留时间较长，60% 概率触发反馈
      if (Math.random() < 0.6) {
        // 检查是否已有反馈
        const hasExistingFeedback = await checkExistingFeedback(userId, recommendationId);
        
        if (!hasExistingFeedback) {
          triggerFeedback = true;
          
          // 获取推荐详情
          recommendation = await getRecommendationDetails(recommendationId);
        }
      }
    }

    return NextResponse.json({
      success: true,
      triggerFeedback,
      recommendation,
      timeAway: timeAwaySeconds,
      message: triggerFeedback 
        ? '欢迎回来！请告诉我们您的体验'
        : '返回已记录'
    });

  } catch (error: any) {
    console.error('[Track Return] 错误:', error);
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
 * 检查是否已有反馈
 */
async function checkExistingFeedback(
  userId: string,
  recommendationId: string
): Promise<boolean> {
  try {
    void userId;
    void recommendationId;

    // TODO: 实现检查已有反馈的逻辑
    // 简化实现：返回 false 表示没有已有反馈
    return false;
  } catch (error) {
    console.error('[Check Feedback] 错误:', error);
    return false;
  }
}

/**
 * 获取推荐详情
 */
async function getRecommendationDetails(
  recommendationId: string
): Promise<{ id: string; title: string; category: string } | null> {
  try {
    // 尝试从历史记录中获取推荐详情
    // 注意：这需要适配器支持按 ID 查询
    // 简化实现：返回基本信息
    return {
      id: recommendationId,
      title: '推荐内容',
      category: 'unknown'
    };
  } catch (error) {
    console.error('[Get Recommendation] 错误:', error);
    return null;
  }
}

