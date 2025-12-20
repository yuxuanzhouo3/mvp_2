/**
 * 问卷进度保存和获取 API
 * POST /api/onboarding/progress - 保存进度
 * GET /api/onboarding/progress?userId=xxx - 获取进度
 * 
 * 支持双环境架构：INTL (Supabase) 和 CN (CloudBase)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/integrations/supabase-admin';
import { isValidUserId } from '@/lib/utils';
import { isChinaDeployment } from '@/lib/config/deployment.config';

export const dynamic = 'force-dynamic';

// 动态导入 CloudBase 模块（避免在 INTL 环境报错）
async function getCloudBaseDB() {
  const { getCloudBaseDatabase, nowISO, withRetry } = await import('@/lib/database/cloudbase-client');
  return { db: getCloudBaseDatabase(), nowISO, withRetry };
}

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

    if (isChinaDeployment()) {
      // CN 环境：使用 CloudBase
      try {
        const { db, nowISO, withRetry } = await getCloudBaseDB();
        const collection = db.collection('onboarding_progress');

        // 使用重试机制查找现有记录
        const existingResult = await withRetry(
          () => collection.where({ user_id: userId }).get(),
          '查询问卷进度'
        );

        if (existingResult.data && existingResult.data.length > 0) {
          // 更新现有记录
          const existingDoc = existingResult.data[0];
          await withRetry(
            () => collection.doc(existingDoc._id).update({
              answers: answers || {},
              current_category_index: currentCategoryIndex ?? 0,
              current_question_index: currentQuestionIndex ?? 0,
              is_completed: false,
              updated_at: nowISO(),
            }),
            '更新问卷进度'
          );
        } else {
          // 创建新记录
          await withRetry(
            () => collection.add({
              user_id: userId,
              answers: answers || {},
              current_category_index: currentCategoryIndex ?? 0,
              current_question_index: currentQuestionIndex ?? 0,
              is_completed: false,
              created_at: nowISO(),
              updated_at: nowISO(),
            }),
            '创建问卷进度'
          );
        }

        console.log(`[Onboarding Progress CN] 用户 ${userId.slice(0, 8)}... 进度已保存`);
      } catch (cloudbaseError: any) {
        console.error('[Onboarding Progress CN] CloudBase 错误:', cloudbaseError);
        // 如果 CloudBase 失败，返回成功但不保存（不阻塞用户）
        // 或者可以尝试回退
        return NextResponse.json({
          success: true,
          message: '进度保存跳过（数据库暂时不可用）',
          warning: 'CloudBase unavailable',
        });
      }
    } else {
      // INTL 环境：使用 Supabase
      const { error } = await supabaseAdmin
        .from('onboarding_progress')
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

      console.log(`[Onboarding Progress INTL] 用户 ${userId.slice(0, 8)}... 进度已保存`);
    }

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

    let progressData: any = null;

    if (isChinaDeployment()) {
      // CN 环境：使用 CloudBase
      try {
        const { db, withRetry } = await getCloudBaseDB();
        const collection = db.collection('onboarding_progress');
        const result = await withRetry(
          () => collection.where({ user_id: userId }).get(),
          '获取问卷进度'
        );

        if (result.data && result.data.length > 0) {
          progressData = result.data[0];
        }

        console.log(`[Onboarding Progress CN] 用户 ${userId.slice(0, 8)}... 获取进度成功`);
      } catch (cloudbaseError: any) {
        console.error('[Onboarding Progress CN] CloudBase 错误:', cloudbaseError);
        // CloudBase 失败时返回无进度（不阻塞用户）
        return NextResponse.json({
          success: true,
          hasProgress: false,
          data: null,
        });
      }
    } else {
      // INTL 环境：使用 Supabase
      const { data, error } = await supabaseAdmin
        .from('onboarding_progress')
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

      progressData = data;
      console.log(`[Onboarding Progress INTL] 用户 ${userId.slice(0, 8)}... 获取进度成功`);
    }

    if (!progressData) {
      return NextResponse.json({
        success: true,
        hasProgress: false,
        data: null,
      });
    }

    return NextResponse.json({
      success: true,
      hasProgress: true,
      data: {
        answers: progressData.answers || {},
        currentCategoryIndex: progressData.current_category_index || 0,
        currentQuestionIndex: progressData.current_question_index || 0,
        isCompleted: progressData.is_completed || false,
        updatedAt: progressData.updated_at,
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

    if (isChinaDeployment()) {
      // CN 环境：使用 CloudBase
      try {
        const { db, nowISO, withRetry } = await getCloudBaseDB();
        const collection = db.collection('onboarding_progress');
        const result = await withRetry(
          () => collection.where({ user_id: userId }).get(),
          '查询问卷进度'
        );

        if (result.data && result.data.length > 0) {
          await withRetry(
            () => collection.doc(result.data[0]._id).update({
              is_completed: true,
              updated_at: nowISO(),
            }),
            '标记问卷完成'
          );
        }

        console.log(`[Onboarding Progress CN] 用户 ${userId.slice(0, 8)}... 问卷已标记完成`);
      } catch (cloudbaseError: any) {
        console.error('[Onboarding Progress CN] CloudBase 错误:', cloudbaseError);
        // CloudBase 失败时仍返回成功（不阻塞用户）
      }
    } else {
      // INTL 环境：使用 Supabase
      const { error } = await supabaseAdmin
        .from('onboarding_progress')
        .update({ is_completed: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) {
        console.error('[Onboarding Progress] 标记完成失败:', error);
      }

      console.log(`[Onboarding Progress INTL] 用户 ${userId.slice(0, 8)}... 问卷已标记完成`);
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
