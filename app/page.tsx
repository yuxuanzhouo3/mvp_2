"use client"

import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Settings, Globe, Crown, History, Sparkles, Download } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import { useTranslations } from "@/lib/i18n"
import { OnboardingPrompt, ProfileCompletenessIndicator } from "@/components/OnboardingPrompt"
import { useOnboarding } from "@/hooks/use-onboarding"

const categoryIds = ["entertainment", "shopping", "food", "travel", "fitness"] as const

const categoryIcons: Record<string, string> = {
  entertainment: "🎲",
  shopping: "🛍️",
  food: "🍜",
  travel: "🏞️",
  fitness: "💪",
}

const categoryColors: Record<string, string> = {
  entertainment: "from-purple-400 to-pink-400",
  shopping: "from-blue-400 to-cyan-400",
  food: "from-green-400 to-teal-400",
  travel: "from-yellow-400 to-orange-400",
  fitness: "from-red-400 to-pink-400",
}

export default function HomePage() {
  const { user, isAuthenticated, signOut } = useAuth()
  const { language, toggleLanguage } = useLanguage()
  const t = useTranslations(language)
  
  // 用户画像状态
  const {
    loading: onboardingLoading,
    profileCompleteness,
    redirectToOnboarding,
    shouldShowOnboardingPrompt
  } = useOnboarding(user?.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Nav + Header */}
        <div className="sticky top-0 z-20 pt-3 pb-5 bg-gradient-to-br from-gray-50/95 via-white/95 to-gray-50/95 backdrop-blur">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white/85 backdrop-blur-sm shadow-sm">
            <div className="pointer-events-none absolute inset-0 border border-white/60 rounded-2xl" aria-hidden="true" />
            <div className="px-4 pt-3 pb-2 flex justify-center">
              <div className="inline-flex items-center justify-between gap-2 px-3 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-gray-200/30 w-full max-w-sm">
                {/* Language Toggle Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 hover:bg-white/30 transition-colors"
                  onClick={toggleLanguage}
                  title={t.header.switchLanguage}
                >
                  <Globe className="h-4 w-4 text-gray-600" />
                </Button>

                {/* Download Button Placeholder */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 hover:bg-white/30 transition-colors"
                  title="Download"
                  disabled
                >
                  <Download className="h-4 w-4 text-gray-400" />
                </Button>

                {isAuthenticated ? (
                  <>
                    <Link href="/history">
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 hover:bg-white/30 transition-colors">
                        <History className="h-4 w-4 text-gray-600" />
                      </Button>
                    </Link>
                    <Link href="/settings">
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 hover:bg-white/30 transition-colors">
                        <Settings className="h-4 w-4 text-gray-600" />
                      </Button>
                    </Link>
                    <Link href="/pro">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50/30 transition-all flex-shrink-0">
                        <Crown className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => signOut()} className="flex-shrink-0 text-gray-600 hover:text-gray-800 hover:bg-white/30 transition-colors">
                      {t.auth.logout}
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button size="sm" variant="ghost" className="flex-shrink-0 text-gray-600 hover:text-gray-800 hover:bg-white/30 transition-all">{t.auth.login}</Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm" className="flex-shrink-0 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 transition-all">{t.auth.register}</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="h-px bg-gray-100" />
            <div className="px-5 py-4">
              <div className={`flex items-center gap-4 ${isAuthenticated ? 'justify-between' : 'justify-center'}`}>
                {/* Title - centered when not authenticated */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/90 shadow-sm flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-gray-600" />
                  </span>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-800">{t.randomLife.title}</h1>
                    <p className="text-gray-600 text-sm">{t.randomLife.subtitle}</p>
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/90 shadow-sm flex-shrink-0">
                    <Sparkles className="h-4 w-4 text-gray-600" />
                  </span>
                </div>

                {/* User profile on the right */}
                {isAuthenticated && (
                  <div className="flex items-center gap-3 shrink-0">
                    {!onboardingLoading && (
                      <ProfileCompletenessIndicator
                        completeness={profileCompleteness}
                        onClick={redirectToOnboarding}
                        compact={true}
                      />
                    )}
                    {user?.subscriptionTier === "enterprise" ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 whitespace-nowrap">
                        Enterprise
                      </span>
                    ) : user?.subscriptionTier === "pro" ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
                        Pro
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                        Free
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 0.7, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex items-center gap-4 mb-6"
        >
          <div className="flex-1 h-px bg-gray-200" />
          <p className="text-gray-500 text-sm font-light tracking-wide px-2 bg-gradient-to-br from-gray-50 via-white to-gray-50">{t.randomLife.chooseCategory}</p>
          <div className="flex-1 h-px bg-gray-200" />
        </motion.div>

        {/* Onboarding Prompt - 引导新用户完成问卷 */}
        <AnimatePresence>
          {shouldShowOnboardingPrompt() && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3 }}
            >
              <OnboardingPrompt
                profileCompleteness={profileCompleteness}
                onStartOnboarding={redirectToOnboarding}
                onDismiss={() => {
                  // 记录关闭时间，24小时后可再次显示
                  localStorage.setItem('onboarding_prompt_dismissed', Date.now().toString())
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Cards */}
        <div className="space-y-4">
          {categoryIds.map((categoryId, index) => {
            const categoryTranslation = t.randomLife.categories[categoryId]
            return (
              <motion.div
                key={categoryId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link href={`/category/${categoryId}`}>
                  <Card className="p-6 cursor-pointer hover:shadow-lg transition-all duration-300 border-0 overflow-hidden relative">
                    <div className={`absolute inset-0 bg-gradient-to-r ${categoryColors[categoryId]} opacity-10`} />
                    <div className="relative flex items-center space-x-4">
                      <motion.div
                        animate={{
                          y: [0, -5, 0],
                          rotate: [0, 5, -5, 0],
                        }}
                        transition={{
                          duration: 3,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "easeInOut",
                        }}
                        className="text-4xl"
                      >
                        {categoryIcons[categoryId]}
                      </motion.div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-800 mb-1">{categoryTranslation.title}</h3>
                        <p className="text-gray-600 text-sm">{categoryTranslation.subtitle}</p>
                      </div>
                      <div className="text-gray-400">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-12 pb-8"
        >
          <p className="text-gray-500 text-sm">{t.randomLife.discoverNew}</p>
        </motion.div>
      </div>
    </div>
  )
}
