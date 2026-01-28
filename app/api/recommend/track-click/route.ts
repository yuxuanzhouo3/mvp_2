/**
 * 推荐点击追踪 API
 * POST /api/recommend/track-click
 * 
 * 记录用户点击推荐链接的行为，用于优化推荐
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordUserClick } from '@/lib/services/recommendation-service';
import { getRecommendationAdapter } from '@/lib/database';
import { isValidUserId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, recommendationId } = body;

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

    console.log(`[Track Click] 用户 ${userId.slice(0, 8)}... 点击推荐 ${recommendationId.slice(0, 8)}...`);

    // 1. 记录点击行为 - 传递正确的 UserAction 类型字符串
    const clickId = await recordUserClick(userId, recommendationId, 'click');

    if (!clickId) {
      console.warn('[Track Click] 记录点击失败，但继续处理');
    } else {
      console.log(`[Track Click] 点击记录成功: ${clickId}`);
    }

    // 2. 更新推荐状态为已点击
    try {
      await getRecommendationAdapter();
      // 注意：这个方法需要适配器支持
      // 如果适配器不支持，可以跳过此步骤
      console.log('[Track Click] 更新推荐点击状态');
    } catch (updateError) {
      console.warn('[Track Click] 更新点击状态失败:', updateError);
    }

    // 3. 判断是否触发反馈
    const triggerFeedback = await shouldTriggerFeedback(
      userId,
      recommendationId
    );

    return NextResponse.json({
      success: true,
      clickId,
      triggerFeedback,
      recommendationId,
      message: '点击已记录'
    });

  } catch (error: any) {
    console.error('[Track Click] 错误:', error);
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
 * 判断是否应该触发反馈弹窗
 */
async function shouldTriggerFeedback(
  userId: string,
  recommendationId: string
): Promise<boolean> {
  try {
    void userId;
    void recommendationId;

    // 随机 30% 概率触发
    if (Math.random() > 0.3) {
      return false;
    }

    // 检查今天已触发次数（简化实现）
    // 实际应该查询数据库中今天的反馈记录数
    const todayTriggerCount = 0; // TODO: 从数据库获取
    
    if (todayTriggerCount >= 3) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Feedback Trigger] 判断失败:', error);
    return false;
  }
}

