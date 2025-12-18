'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/components/language-provider';
import { useTranslations } from '@/lib/i18n';

interface OnboardingPromptProps {
  profileCompleteness: number;
  onStartOnboarding: () => void;
  onDismiss?: () => void;
  variant?: 'banner' | 'card' | 'modal';
}

export function OnboardingPrompt({
  profileCompleteness,
  onStartOnboarding,
  onDismiss,
  variant = 'card'
}: OnboardingPromptProps) {
  const { language } = useLanguage();
  const t = useTranslations(language);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Banner style
  if (variant === 'banner') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-3"
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">
              {t.onboarding.prompt.bannerText}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onStartOnboarding}
              className="bg-white/20 hover:bg-white/30 text-white border-0"
            >
              {t.onboarding.prompt.startButton}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            {onDismiss && (
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-white/20 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Card style (default)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border-violet-500/20 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {t.onboarding.prompt.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t.onboarding.prompt.description}
              </p>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{t.onboarding.prompt.profileCompleteness}</span>
                  <span>{profileCompleteness}%</span>
                </div>
                <Progress value={profileCompleteness} className="h-2" />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={onStartOnboarding}
                  className="bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white"
                >
                  {t.onboarding.prompt.startButton}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="text-muted-foreground"
                  >
                    {t.onboarding.prompt.later}
                  </Button>
                )}
              </div>
            </div>

            {/* Close button */}
            {onDismiss && (
              <button
                onClick={handleDismiss}
                className="p-1 hover:bg-foreground/10 rounded text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Decorative element */}
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl" />
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Profile Completeness Indicator Component
 */
export function ProfileCompletenessIndicator({
  completeness,
  onClick,
  compact = false
}: {
  completeness: number;
  onClick?: () => void;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const t = useTranslations(language);

  const getStatusColor = () => {
    if (completeness >= 80) return 'text-emerald-500';
    if (completeness >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getStatusText = () => {
    if (completeness >= 80) return t.onboarding.profile.complete;
    if (completeness >= 50) return t.onboarding.profile.moderate;
    return t.onboarding.profile.needsWork;
  };

  // Compact version for header
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="relative w-7 h-7 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors flex items-center justify-center"
        title={`${completeness}% - ${getStatusText()}`}
      >
        <svg className="w-7 h-7 -rotate-90 absolute" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-foreground/10"
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${completeness * 0.628} 62.8`}
            className={getStatusColor()}
            strokeLinecap="round"
          />
        </svg>
        <span className="text-xs font-medium relative z-10">
          {completeness}
        </span>
      </button>
    );
  }

  // Full version for cards
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors"
    >
      <div className="relative w-6 h-6">
        <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-foreground/10"
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${completeness * 0.628} 62.8`}
            className={getStatusColor()}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
          {completeness}
        </span>
      </div>
      <span className={`text-xs font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
    </button>
  );
}

export default OnboardingPrompt;

