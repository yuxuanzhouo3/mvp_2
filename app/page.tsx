"use client"

import { useEffect, useCallback, useState } from "react"
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
import { isChinaRegion } from "@/lib/config/region"
import {
  parseWxMpLoginCallback,
  clearWxMpLoginParams,
} from "@/lib/wechat-mp"
import { saveAuthState } from "@/lib/auth/auth-state-manager"

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
  const { user, isAuthenticated, signOut, refreshUser } = useAuth()
  const { language, toggleLanguage } = useLanguage()
  const t = useTranslations(language)
  const [mpLoginProcessing, setMpLoginProcessing] = useState(false)
  const subscriptionTierLabel =
    (user?.subscriptionTier && t.settingsPage.account.tiers[user.subscriptionTier]) ||
    t.settingsPage.account.tiers.free

  // 用户画像状态
  const {
    loading: onboardingLoading,
    profileCompleteness,
    redirectToOnboarding,
    shouldShowOnboardingPrompt
  } = useOnboarding(user?.id)

  // 处理小程序登录回调
  const handleMpLoginCallback = useCallback(async () => {
    const callback = parseWxMpLoginCallback()
    if (!callback) return

    setMpLoginProcessing(true)
    console.log('[HomePage] Processing MP login callback:', {
      hasToken: !!callback.token,
      hasOpenid: !!callback.openid,
      hasCode: !!callback.code
    })

    try {
      // 情况1：直接收到 token（推荐流程）
      if (callback.token && callback.openid) {
        const res = await fetch('/api/auth/mp-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            token: callback.token,
            openid: callback.openid,
            expiresIn: callback.expiresIn,
            nickName: callback.nickName,
            avatarUrl: callback.avatarUrl,
            userId: callback.userId,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          console.log('[HomePage] MP callback success:', data)

          // 保存认证状态到 localStorage
          if (data.user) {
            const refreshToken = callback.refreshToken || callback.token
            saveAuthState(
              callback.token,
              refreshToken,
              data.user,
              data.tokenMeta || {
                accessTokenExpiresIn: parseInt(callback.expiresIn || '604800', 10),
                refreshTokenExpiresIn: 604800,
              }
            )
            console.log('[HomePage] MP login state saved to localStorage')
          }

          clearWxMpLoginParams()
          // 刷新页面以更新认证状态
          window.location.reload()
          return
        } else {
          console.error('[HomePage] MP callback failed:', await res.text())
        }
      }

      // 情况2：收到 code（兜底流程）
      if (callback.code) {
        console.log('[HomePage] Processing code flow')
        const response = await fetch('/api/wxlogin/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code: callback.code }),
        })

        const data = await response.json()

        if (response.ok && data.success) {
          // 设置 cookie
          const callbackRes = await fetch('/api/auth/mp-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              token: data.token,
              refreshToken: data.refreshToken,
              openid: data.openid,
              expiresIn: data.expiresIn,
              nickName: callback.nickName,
              avatarUrl: callback.avatarUrl,
              userId: data.userId,
            }),
          })

          if (callbackRes.ok) {
            const callbackData = await callbackRes.json()

            // 保存认证状态到 localStorage
            if (callbackData.user) {
              saveAuthState(
                data.token,
                data.refreshToken || data.token,
                callbackData.user,
                callbackData.tokenMeta || {
                  accessTokenExpiresIn: data.expiresIn || 604800,
                  refreshTokenExpiresIn: 604800,
                }
              )
              console.log('[HomePage] MP login state saved (code flow)')
            }
          }

          clearWxMpLoginParams()
          window.location.reload()
          return
        } else {
          console.error('[HomePage] Code exchange failed:', data)
        }
      }

      clearWxMpLoginParams()
    } catch (err) {
      console.error('[HomePage] MP callback error:', err)
      clearWxMpLoginParams()
    } finally {
      setMpLoginProcessing(false)
    }
  }, [])

  // 页面加载时检查小程序登录回调
  useEffect(() => {
    if (isChinaRegion()) {
      handleMpLoginCallback()
    }
  }, [handleMpLoginCallback])

  // 显示登录处理中状态
  if (mpLoginProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">正在登录...</p>
        </div>
      </div>
    )
  }

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

                {/* Download Button */}
                <Link href="/download">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 hover:bg-white/30 transition-colors"
                    title={t.header.download || "Download"}
                  >
                    <Download className="h-4 w-4 text-gray-600" />
                  </Button>
                </Link>

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
                        {subscriptionTierLabel}
                      </span>
                    ) : user?.subscriptionTier === "pro" ? (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
                        {subscriptionTierLabel}
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                        {subscriptionTierLabel}
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
