'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface OnboardingStatus {
  loading: boolean;
  completed: boolean;
  profileCompleteness: number;
  categoriesCompleted: string[];
}

/**
 * Onboarding 状态管理 Hook
 * 用于检查用户是否完成问卷，并在需要时引导至问卷页面
 */
export function useOnboarding(userId: string | null | undefined) {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus>({
    loading: true,
    completed: false,
    profileCompleteness: 0,
    categoriesCompleted: []
  });

  // 检查问卷完成状态
  const checkStatus = useCallback(async () => {
    if (!userId) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const response = await fetch(`/api/onboarding/submit?userId=${userId}`);
      const data = await response.json();

      if (data.success) {
        setStatus({
          loading: false,
          completed: data.onboardingCompleted,
          profileCompleteness: data.profileCompleteness || 0,
          categoriesCompleted: data.categoriesCompleted || []
        });
      } else {
        setStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('检查问卷状态失败:', error);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  }, [userId]);

  // 初始化时检查状态
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // 引导至问卷页面
  const redirectToOnboarding = useCallback(() => {
    router.push('/onboarding');
  }, [router]);

  // 检查是否需要显示问卷提示
  const shouldShowOnboardingPrompt = useCallback(() => {
    // 检查是否已被用户关闭
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('onboarding_prompt_dismissed');
      const dismissedTime = dismissed ? parseInt(dismissed) : 0;
      
      // 如果关闭时间在 24 小时内，不显示
      if (dismissed === 'true' || (dismissedTime && Date.now() - dismissedTime < 24 * 60 * 60 * 1000)) {
        return false;
      }
    }
    
    return !status.loading && !status.completed && userId;
  }, [status.loading, status.completed, userId]);

  return {
    ...status,
    checkStatus,
    redirectToOnboarding,
    shouldShowOnboardingPrompt
  };
}

/**
 * 用户反馈触发管理 Hook
 */
export function useFeedbackTrigger(userId: string | null | undefined) {
  const [pendingFeedback, setPendingFeedback] = useState<{
    id: string;  // 改为 id 以匹配 FeedbackDialog 期望的类型
    title: string;
    category: string;
  } | null>(null);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);

  // 追踪点击
  const trackClick = useCallback(async (
    recommendationId: string,
    sessionId?: string
  ) => {
    if (!userId) return { success: false, triggerFeedback: false };

    try {
      const response = await fetch('/api/recommend/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recommendationId,
          sessionId
        })
      });

      return await response.json();
    } catch (error) {
      console.error('追踪点击失败:', error);
      return { success: false, triggerFeedback: false };
    }
  }, [userId]);

  // 追踪返回
  const trackReturn = useCallback(async (
    recommendationId: string,
    timeAway: number,
    sessionId?: string
  ) => {
    if (!userId) return { success: false, triggerFeedback: false };

    try {
      const response = await fetch('/api/recommend/track-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recommendationId,
          timeAway,
          sessionId
        })
      });

      const data = await response.json();

      // 如果需要触发反馈
      if (data.triggerFeedback && data.recommendation) {
        setPendingFeedback({
          id: data.recommendation.id,  // 使用 id 字段名
          title: data.recommendation.title,
          category: data.recommendation.category
        });
        setFeedbackDialogOpen(true);
      }

      return data;
    } catch (error) {
      console.error('追踪返回失败:', error);
      return { success: false, triggerFeedback: false };
    }
  }, [userId]);

  // 关闭反馈弹窗
  const closeFeedbackDialog = useCallback(() => {
    setFeedbackDialogOpen(false);
    setPendingFeedback(null);
  }, []);

  // 手动触发反馈
  const triggerFeedback = useCallback((recommendation: {
    id: string;
    title: string;
    category: string;
  }) => {
    setPendingFeedback({
      id: recommendation.id,  // 使用 id 字段名
      title: recommendation.title,
      category: recommendation.category
    });
    setFeedbackDialogOpen(true);
  }, []);

  return {
    trackClick,
    trackReturn,
    pendingFeedback,
    feedbackDialogOpen,
    closeFeedbackDialog,
    triggerFeedback
  };
}

/**
 * 页面离开时间追踪 Hook
 * 用于追踪用户从外部网站返回的时间
 */
export function usePageVisibility(
  onReturn: (timeAway: number) => void
) {
  const [lastHiddenTime, setLastHiddenTime] = useState<number | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏，记录时间
        setLastHiddenTime(Date.now());
      } else {
        // 页面可见，计算离开时间
        if (lastHiddenTime) {
          const timeAway = Math.floor((Date.now() - lastHiddenTime) / 1000);
          onReturn(timeAway);
          setLastHiddenTime(null);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastHiddenTime, onReturn]);

  return { lastHiddenTime };
}

export default useOnboarding;

