'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { getLocalizedQuestions, type Question, type CategoryQuestions } from '@/lib/onboarding/questions';
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { useTranslations } from '@/lib/i18n';

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = useTranslations(language);

  // 获取国际化的问卷
  const allQuestions = useMemo(() => getLocalizedQuestions(t), [t]);

  // State management
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [aiProfile, setAiProfile] = useState<any>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  // 保存进度到数据库
  const saveProgress = useCallback(async (
    newAnswers: Record<string, any>,
    catIndex: number,
    qIndex: number
  ) => {
    if (!user?.id) return;

    try {
      await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          answers: newAnswers,
          currentCategoryIndex: catIndex,
          currentQuestionIndex: qIndex,
        })
      });
    } catch (error) {
      console.error('保存问卷进度失败:', error);
    }
  }, [user?.id]);

  // 恢复进度
  useEffect(() => {
    const loadProgress = async () => {
      if (!user?.id || hasRestoredProgress) {
        setIsLoadingProgress(false);
        return;
      }

      try {
        const response = await fetch(`/api/onboarding/progress?userId=${user.id}`);
        const data = await response.json();

        if (data.success && data.hasProgress && !data.data.isCompleted) {
          setAnswers(data.data.answers || {});
          setCurrentCategoryIndex(data.data.currentCategoryIndex || 0);
          setCurrentQuestionIndex(data.data.currentQuestionIndex || 0);
          console.log('[Onboarding] 进度已恢复');
        }
      } catch (error) {
        console.error('恢复问卷进度失败:', error);
      } finally {
        setIsLoadingProgress(false);
        setHasRestoredProgress(true);
      }
    };

    loadProgress();
  }, [user?.id, hasRestoredProgress]);

  // 当前分类和问题
  const currentCategory = allQuestions[currentCategoryIndex];
  const currentQuestion = currentCategory?.questions[currentQuestionIndex];

  // 计算总进度
  const totalQuestions = allQuestions.reduce((sum, cat) => sum + cat.questions.length, 0);
  const answeredQuestions = Object.keys(answers).length;
  const progressPercent = Math.round((answeredQuestions / totalQuestions) * 100);

  // 获取当前问题的答案键
  const getAnswerKey = (category: CategoryQuestions, question: Question) => {
    return `${category.category}_${question.id}`;
  };

  // 处理答案选择
  const handleAnswer = (optionId: string) => {
    if (!currentQuestion || !currentCategory) return;

    const key = getAnswerKey(currentCategory, currentQuestion);
    let newAnswers: Record<string, any>;

    if (currentQuestion.type === 'multiple') {
      // 多选
      const current = answers[key] || [];
      const updated = current.includes(optionId)
        ? current.filter((id: string) => id !== optionId)
        : [...current, optionId];
      newAnswers = { ...answers, [key]: updated };
      setAnswers(newAnswers);
      // 保存进度
      saveProgress(newAnswers, currentCategoryIndex, currentQuestionIndex);
    } else {
      // 单选或量表
      newAnswers = { ...answers, [key]: optionId };
      setAnswers(newAnswers);

      // 自动跳转到下一题
      setTimeout(() => {
        let nextCatIndex = currentCategoryIndex;
        let nextQIndex = currentQuestionIndex;

        if (currentQuestionIndex < currentCategory.questions.length - 1) {
          nextQIndex = currentQuestionIndex + 1;
          setCurrentQuestionIndex(nextQIndex);
        } else if (currentCategoryIndex < allQuestions.length - 1) {
          nextCatIndex = currentCategoryIndex + 1;
          nextQIndex = 0;
          setCurrentCategoryIndex(nextCatIndex);
          setCurrentQuestionIndex(0);
        }

        // 保存进度
        saveProgress(newAnswers, nextCatIndex, nextQIndex);
      }, 300);
    }
  };

  // 检查当前问题是否已回答
  const isCurrentQuestionAnswered = () => {
    if (!currentQuestion || !currentCategory) return false;
    const key = getAnswerKey(currentCategory, currentQuestion);
    const answer = answers[key];

    if (currentQuestion.type === 'multiple') {
      return Array.isArray(answer) && answer.length > 0;
    }
    return !!answer;
  };

  // 下一题
  const goNext = () => {
    if (currentQuestionIndex < currentCategory.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else if (currentCategoryIndex < allQuestions.length - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
      setCurrentQuestionIndex(0);
    }
  };

  // 上一题
  const goPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    } else if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex(prev => prev - 1);
      const prevCategory = allQuestions[currentCategoryIndex - 1];
      setCurrentQuestionIndex(prevCategory.questions.length - 1);
    }
  };

  // 检查是否为最后一题
  const isLastQuestion = () => {
    return (
      currentCategoryIndex === allQuestions.length - 1 &&
      currentQuestionIndex === currentCategory?.questions.length - 1
    );
  };

  // 检查是否为第一题
  const isFirstQuestion = () => {
    return currentCategoryIndex === 0 && currentQuestionIndex === 0;
  };

  // Submit questionnaire
  const handleSubmit = async () => {
    if (!user?.id) {
      alert(t.onboarding.page.loginRequired);
      router.push('/login');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/onboarding/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          answers
        })
      });

      const data = await response.json();

      if (data.success) {
        setAiProfile(data.profile);
        setShowSuccess(true);

        // Mark progress as completed
        try {
          await fetch(`/api/onboarding/progress?userId=${user.id}`, {
            method: 'DELETE',
          });
        } catch (e) {
          console.error('Failed to mark progress as completed:', e);
        }

        // Redirect to home after 5 seconds (give user time to view profile)
        setTimeout(() => {
          router.push('/');
        }, 5000);
      } else {
        throw new Error(data.error || t.onboarding.page.submitFailed);
      }
    } catch (error) {
      console.error('Submit questionnaire failed:', error);
      alert(t.onboarding.page.submitFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 跳过问卷
  const handleSkip = () => {
    router.push('/');
  };

  // Success page - 浅色调
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <CheckCircle2 className="w-14 h-14 text-white" />
          </motion.div>

          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            {t.onboarding.page.profileComplete}
          </h1>

          {aiProfile && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-gray-200 shadow-sm"
            >
              <p className="text-gray-700 mb-4">{aiProfile.summary}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {aiProfile.tags?.slice(0, 6).map((tag: string, i: number) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="bg-violet-100 text-violet-700 border-violet-200"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}

          <p className="text-gray-500 text-sm">
            {t.onboarding.page.redirecting}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Top navigation - 浅色调 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-violet-500" />
            <span className="text-gray-800 font-semibold">{t.onboarding.page.title}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {progressPercent}% {t.onboarding.page.completed}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700"
            >
              {t.onboarding.page.skip}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <Progress
          value={progressPercent}
          className="h-1 bg-gray-100"
        />
      </header>

      {/* 主内容 */}
      <main className="pt-20 pb-24 px-4 container mx-auto max-w-2xl">
        {/* 分类标题 */}
        <motion.div
          key={currentCategory?.category}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {currentCategory?.title}
          </h1>
          <p className="text-gray-500">
            {currentCategory?.description}
          </p>
        </motion.div>

        {/* 分类指示器 */}
        <div className="flex justify-center gap-2 mb-8">
          {allQuestions.map((cat, idx) => (
            <button
              key={cat.category}
              onClick={() => {
                setCurrentCategoryIndex(idx);
                setCurrentQuestionIndex(0);
              }}
              className={`w-3 h-3 rounded-full transition-all ${
                idx === currentCategoryIndex
                  ? 'bg-violet-500 scale-125'
                  : idx < currentCategoryIndex
                  ? 'bg-violet-300'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* 问题卡片 - 浅色调 */}
        <AnimatePresence mode="wait">
          {currentQuestion && (
            <motion.div
              key={`${currentCategory.category}-${currentQuestion.id}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white/90 backdrop-blur-lg border-gray-200 shadow-sm">
                <CardContent className="p-6">
                  {/* 问题文本 */}
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {currentQuestion.question}
                  </h2>
                  {currentQuestion.description && (
                    <p className="text-gray-400 text-sm mb-6">
                      {currentQuestion.description}
                    </p>
                  )}

                  {/* 选项 */}
                  <div className={`grid gap-3 ${
                    currentQuestion.type === 'scale'
                      ? 'grid-cols-5'
                      : currentQuestion.options.length > 6
                      ? 'grid-cols-2 md:grid-cols-3'
                      : 'grid-cols-1'
                  }`}>
                    {currentQuestion.options.map((option) => {
                      const key = getAnswerKey(currentCategory, currentQuestion);
                      const currentAnswer = answers[key];
                      const isSelected = currentQuestion.type === 'multiple'
                        ? (currentAnswer || []).includes(option.id)
                        : currentAnswer === option.id;

                      return (
                        <motion.button
                          key={option.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleAnswer(option.id)}
                          className={`p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'bg-violet-50 border-violet-400 text-violet-700'
                              : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                          } ${currentQuestion.type === 'scale' ? 'text-center' : ''}`}
                        >
                          {option.icon && (
                            <span className="text-2xl mb-2 block">
                              {option.icon}
                            </span>
                          )}
                          <span className={currentQuestion.type === 'scale' ? 'text-xs' : ''}>
                            {option.label}
                          </span>
                          {isSelected && currentQuestion.type === 'multiple' && (
                            <CheckCircle2 className="w-5 h-5 text-violet-500 ml-auto inline" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Multiple select hint */}
                  {currentQuestion.type === 'multiple' && (
                    <p className="text-gray-400 text-sm mt-4 text-center">
                      {t.onboarding.page.multipleSelect}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 问题进度指示 */}
        <div className="flex justify-center gap-1 mt-6">
          {currentCategory?.questions.map((_, idx) => (
            <div
              key={idx}
              className={`w-2 h-2 rounded-full ${
                idx === currentQuestionIndex
                  ? 'bg-violet-500'
                  : idx < currentQuestionIndex
                  ? 'bg-violet-300'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </main>

      {/* Bottom navigation - 浅色调 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200 p-4">
        <div className="container mx-auto max-w-2xl flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={goPrevious}
            disabled={isFirstQuestion()}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            {t.onboarding.page.previous}
          </Button>

          {isLastQuestion() ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !isCurrentQuestionAnswered()}
              className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white px-8"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t.onboarding.page.generating}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  {t.onboarding.page.generateProfile}
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={currentQuestion?.type !== 'multiple' && !isCurrentQuestionAnswered()}
              className="bg-violet-500 hover:bg-violet-600 text-white"
            >
              {currentQuestion?.type === 'multiple' ? t.onboarding.page.next : t.onboarding.page.continue}
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
