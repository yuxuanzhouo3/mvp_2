/**
 * 推荐点击记录 API
 * POST /api/recommend/click
 * 
 * 支持双环境架构：INTL (Supabase) 和 CN (CloudBase)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { getRecommendationAdapter } from "@/lib/database";
import type { UserAction } from "@/lib/database/types";

export async function POST(request: NextRequest) {
  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { user } = authResult;
    const { recommendationId, action = 'click' } = await request.json();

    if (!recommendationId) {
      return NextResponse.json(
        { error: 'recommendationId is required' },
        { status: 400 }
      );
    }

    const adapter = await getRecommendationAdapter();

    // 记录点击
    const result = await adapter.recordClick(
      user.id,
      recommendationId,
      action as UserAction
    );

    if (!result.success) {
      console.error('Failed to record click:', result.error);
      return NextResponse.json(
        { error: 'Failed to record click' },
        { status: 500 }
      );
    }

    // 如果是点击行为，更新用户偏好点击计数
    if (action === 'click') {
      // 获取推荐的分类
      const historyResult = await adapter.getRecommendationHistory(user.id, undefined, {
        limit: 200,
      });

      // 从历史中找到对应的推荐记录获取分类
      // 这里简化处理，实际可以通过单独查询推荐记录获取
      const rec = historyResult.data?.find((r) => r.id === recommendationId);

      if (rec?.category) {
        await adapter.upsertUserPreference(user.id, rec.category, {
          incrementClick: true,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Click API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
