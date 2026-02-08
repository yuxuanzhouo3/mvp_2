/**
 * 用户问卷提交 API
 * POST /api/onboarding/submit
 * 
 * 处理用户问卷答案，使用 AI 生成画像，保存到数据库
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateUserProfileSummary } from '@/lib/ai/profile-based-recommendation';
import { getRecommendationAdapter } from '@/lib/database';
import { getLocale } from '@/lib/utils/locale';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 获取请求数据
    const body = await request.json();
    const { userId, answers } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID不能为空', success: false },
        { status: 400 }
      );
    }

    if (!answers || Object.keys(answers).length === 0) {
      return NextResponse.json(
        { error: '问卷答案不能为空', success: false },
        { status: 400 }
      );
    }

    console.log('[Onboarding] 收到答案:', Object.keys(answers).length, '项');

    // 获取语言设置
    const locale = getLocale();

    // 1. 按分类整理答案
    const categorized: Record<string, Record<string, any>> = {
      entertainment: {},
      shopping: {},
      food: {},
      travel: {},
      fitness: {}
    };

    Object.entries(answers).forEach(([key, value]) => {
      const parts = key.split('_');
      const category = parts[0];
      const questionId = parts.slice(1).join('_');

      if (categorized[category]) {
        categorized[category][questionId] = value;
      } else {
        // 处理特殊分类如 entertainment_games
        const mainCategory = Object.keys(categorized).find(c => key.startsWith(c));
        if (mainCategory) {
          const qId = key.slice(mainCategory.length + 1);
          categorized[mainCategory][qId] = value;
        }
      }
    });

    // 2. 使用 AI 生成画像
    let aiProfile;
    try {
      aiProfile = await generateUserProfileSummary(categorized, locale);
      console.log('[Onboarding] AI 画像生成成功:', aiProfile.summary);
    } catch (aiError) {
      console.error('[Onboarding] AI 画像生成失败:', aiError);
      aiProfile = {
        summary: locale === 'zh' 
          ? '一位多元化兴趣的用户'
          : 'A user with diverse interests',
        tags: locale === 'zh'
          ? ['探索者', '多元化']
          : ['explorer', 'diverse'],
        insights: {}
      };
    }

    // 3. 保存到数据库
    const adapter = await getRecommendationAdapter();

    // 保存各分类的用户偏好（包含画像字段）
    const savePromises = Object.entries(categorized).map(async ([category, prefs]) => {
      try {
        const result = await adapter.upsertUserPreference(userId, category as any, {
          preferences: prefs,
          tags: aiProfile.tags,
          // 画像相关字段
          onboarding_completed: true,
          profile_completeness: 80,
          ai_profile_summary: aiProfile.insights[category] || aiProfile.summary,
          personality_tags: aiProfile.tags,
        });

        if (result.error) {
          console.error(`[Onboarding] 保存 ${category} 偏好失败:`, result.error);
        } else {
          console.log(`[Onboarding] 保存 ${category} 偏好成功`);
        }
      } catch (err) {
        console.error(`[Onboarding] 保存 ${category} 偏好异常:`, err);
      }
    });

    await Promise.all(savePromises);

    console.log('[Onboarding] 所有数据保存完成');

    return NextResponse.json({
      success: true,
      profile: {
        summary: aiProfile.summary,
        tags: aiProfile.tags,
        insights: aiProfile.insights,
        profileCompleteness: 80
      },
      message: locale === 'zh' 
        ? '问卷提交成功，已生成个性化画像'
        : 'Survey submitted successfully, personalized profile generated'
    });

  } catch (error: any) {
    console.error('[Onboarding] 错误:', error);
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
 * 获取用户问卷完成状态
 * GET /api/onboarding/submit?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: '用户ID不能为空', success: false },
        { status: 400 }
      );
    }

    const adapter = await getRecommendationAdapter();
    
    // 获取用户偏好来判断是否完成问卷
    const result = await adapter.getUserPreferences(userId);
    
    const hasPreferences = result.data && result.data.length > 0;
    
    // 优先检查 onboarding_completed 字段，然后检查 preferences 是否有内容
    const hasCompletedOnboarding = hasPreferences && (result.data ?? []).some(
      (pref: any) => pref.onboarding_completed === true || 
        (pref.preferences && Object.keys(pref.preferences).length > 0)
    );

    // 计算画像完整度
    let profileCompleteness = 0;
    
    // 从数据库中获取画像完整度（如果存在）
    const savedCompleteness = result.data?.find(
      (p: any) => p.profile_completeness !== undefined && p.profile_completeness !== null
    )?.profile_completeness;
    
    if (savedCompleteness !== undefined) {
      profileCompleteness = savedCompleteness;
    } else if (hasCompletedOnboarding) {
      profileCompleteness = 80;
      
      // 计算使用次数加分
      const historyResult = await adapter.getRecommendationHistory(userId);
      const usageCount = historyResult.data?.length || 0;
      profileCompleteness += Math.min(10, Math.floor(usageCount / 2));
    }

    // 获取 AI 画像摘要
    const aiProfileSummary = result.data?.find(
      (p: any) => p.ai_profile_summary
    )?.ai_profile_summary;
    
    const personalityTags = result.data?.find(
      (p: any) => p.personality_tags && p.personality_tags.length > 0
    )?.personality_tags;

    return NextResponse.json({
      success: true,
      onboardingCompleted: hasCompletedOnboarding,
      profileCompleteness,
      categoriesCompleted: result.data?.map((p: any) => p.category) || [],
      aiProfileSummary,
      personalityTags
    });

  } catch (error: any) {
    console.error('[Onboarding Check] 错误:', error);
    return NextResponse.json(
      { 
        error: error.message || '服务器错误',
        success: false 
      },
      { status: 500 }
    );
  }
}

