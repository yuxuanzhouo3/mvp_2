'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  ThumbsUp, 
  ThumbsDown, 
  ShoppingCart, 
  Eye, 
  Star, 
  X,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { useTranslations } from '@/lib/i18n';

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  recommendation: {
    id: string;
    title: string;
    category: string;
  } | null;
  userId: string;
}

type FeedbackStep = 'interest' | 'purchase' | 'rating' | 'complete';

export function FeedbackDialog({ 
  open, 
  onClose, 
  recommendation,
  userId 
}: FeedbackDialogProps) {
  const { language } = useLanguage();
  const t = useTranslations(language);
  const [step, setStep] = useState<FeedbackStep>('interest');
  const [isInterested, setIsInterested] = useState<boolean | null>(null);
  const [hasPurchased, setHasPurchased] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  // 重置状态
  const resetState = () => {
    setStep('interest');
    setIsInterested(null);
    setHasPurchased(null);
    setRating(0);
    setComment('');
    setIsSubmitting(false);
    setHoverRating(0);
  };

  // 处理关闭
  const handleClose = () => {
    resetState();
    onClose();
  };

  // 处理感兴趣选择
  const handleInterestSelect = (interested: boolean) => {
    setIsInterested(interested);
    if (interested) {
      setStep('purchase');
    } else {
      // 不感兴趣直接提交
      submitFeedback({
        isInterested: false,
        feedbackType: 'interest'
      });
    }
  };

  // 处理购买选择
  const handlePurchaseSelect = (purchased: boolean) => {
    setHasPurchased(purchased);
    setStep('rating');
  };

  // 处理评分选择
  const handleRatingSelect = async (selectedRating: number) => {
    setRating(selectedRating);
    await submitFeedback({
      isInterested: true,
      hasPurchased,
      rating: selectedRating,
      feedbackType: 'rating'
    });
  };

  // 提交反馈
  const submitFeedback = async (data: {
    isInterested?: boolean;
    hasPurchased?: boolean | null;
    rating?: number;
    feedbackType: string;
  }) => {
    if (!recommendation) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/recommend/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          recommendationId: recommendation.id,
          ...data,
          comment: comment || undefined,
          triggeredBy: 'dialog'
        })
      });

      const result = await response.json();

      if (result.success) {
        setStep('complete');
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(t.feedback.submitFailed + ':', error);
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 跳过
  const handleSkip = () => {
    submitFeedback({
      feedbackType: 'skip'
    });
  };

  if (!recommendation) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            {step === 'complete' ? t.feedback.thankYou : t.feedback.title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {step !== 'complete' && (
              <span className="text-violet-300 font-medium">
                {recommendation.title}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* 步骤 1: 感兴趣吗? */}
          {step === 'interest' && (
            <motion.div
              key="interest"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="py-6 space-y-4"
            >
              <p className="text-slate-300 text-center mb-4">
                {t.feedback.helpful}
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleInterestSelect(true)}
                  className="flex-1 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400"
                >
                  <ThumbsUp className="w-5 h-5 mr-2" />
                  {t.feedback.interested}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleInterestSelect(false)}
                  className="flex-1 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20 text-rose-400"
                >
                  <ThumbsDown className="w-5 h-5 mr-2" />
                  {t.feedback.notInterested}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="w-full text-slate-500 hover:text-slate-400"
              >
                {t.feedback.skip}
              </Button>
            </motion.div>
          )}

          {/* Step 2: Purchased? */}
          {step === 'purchase' && (
            <motion.div
              key="purchase"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="py-6 space-y-4"
            >
              <p className="text-slate-300 text-center mb-4">
                {t.feedback.purchased}
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handlePurchaseSelect(true)}
                  className="flex-1 bg-violet-500/10 border-violet-500/30 hover:bg-violet-500/20 text-violet-400"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {t.feedback.yesPurchased}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handlePurchaseSelect(false)}
                  className="flex-1 bg-slate-500/10 border-slate-500/30 hover:bg-slate-500/20 text-slate-400"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  {t.feedback.justLooking}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Rating */}
          {step === 'rating' && (
            <motion.div
              key="rating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="py-6 space-y-4"
            >
              <p className="text-slate-300 text-center mb-4">
                {t.feedback.rateIt}
              </p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRatingSelect(star)}
                    disabled={isSubmitting}
                    className="p-1 transition-transform hover:scale-110 disabled:opacity-50"
                  >
                    <Star
                      className={`w-10 h-10 ${
                        star <= (hoverRating || rating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-600'
                      } transition-colors`}
                    />
                  </button>
                ))}
              </div>
              
              {/* Optional comment */}
              <div className="mt-4">
                <Textarea
                  placeholder={t.feedback.commentPlaceholder}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 resize-none"
                  rows={2}
                />
              </div>

              {isSubmitting && (
                <div className="flex items-center justify-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {t.feedback.submitting}
                </div>
              )}
            </motion.div>
          )}

          {/* Complete */}
          {step === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center"
              >
                <Sparkles className="w-8 h-8 text-white" />
              </motion.div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {t.feedback.thankYouTitle}
              </h3>
              <p className="text-slate-400 text-sm">
                {t.feedback.thankYouMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default FeedbackDialog;

