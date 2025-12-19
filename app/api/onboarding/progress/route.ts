/**
 * 问卷进度保存和获取 API
 * POST /api/onboarding/progress - 保存进度
 * GET /api/onboarding/progress?userId=xxx - 获取进度
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/integrations/supabase-admin';
import { isValidUserId } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * POST - 保存问卷进度
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, answers, currentCategoryIndex, currentQuestionIndex } = body;

    if (!userId || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID', success: false },
        { status: 400 }
      );
    }

    // 使用 upsert 来保存或更新进度
    const { error } = await supabaseAdmin
      .from('onboarding_responses')
      .upsert(
        {
          user_id: userId,
          answers: answers || {},
          current_category_index: currentCategoryIndex ?? 0,
          current_question_index: currentQuestionIndex ?? 0,
          is_completed: false,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    if (error) {
      console.error('[Onboarding Progress] 保存进度失败:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    console.log(`[Onboarding Progress] 用户 ${userId.slice(0, 8)}... 进度已保存`);

    return NextResponse.json({
      success: true,
      message: '进度已保存',
    });
  } catch (error: any) {
    console.error('[Onboarding Progress] 错误:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误', success: false },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取问卷进度
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID', success: false },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('onboarding_responses')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 是 "no rows found" 错误，不需要处理
      console.error('[Onboarding Progress] 获取进度失败:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        hasProgress: false,
        data: null,
      });
    }

    console.log(`[Onboarding Progress] 用户 ${userId.slice(0, 8)}... 获取进度成功`);

    return NextResponse.json({
      success: true,
      hasProgress: true,
      data: {
        answers: data.answers || {},
        currentCategoryIndex: data.current_category_index || 0,
        currentQuestionIndex: data.current_question_index || 0,
        isCompleted: data.is_completed || false,
        updatedAt: data.updated_at,
      },
    });
  } catch (error: any) {
    console.error('[Onboarding Progress] 错误:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误', success: false },
      { status: 500 }
    );
  }
}

/**
 * DELETE - 清除问卷进度（问卷完成后调用）
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId || !isValidUserId(userId)) {
      return NextResponse.json(
        { error: '无效的用户ID', success: false },
        { status: 400 }
      );
    }

    // 标记为已完成而不是删除
    const { error } = await supabaseAdmin
      .from('onboarding_responses')
      .update({ is_completed: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error('[Onboarding Progress] 标记完成失败:', error);
    }

    return NextResponse.json({
      success: true,
      message: '问卷已标记完成',
    });
  } catch (error: any) {
    console.error('[Onboarding Progress] 错误:', error);
    return NextResponse.json(
      { error: error.message || '服务器错误', success: false },
      { status: 500 }
    );
  }
}
