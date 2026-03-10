"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RecommendationCard, RecommendationList } from "@/components/RecommendationCard"
import { FeedbackDialog } from "@/components/FeedbackDialog"
import { OnboardingPrompt } from "@/components/OnboardingPrompt"
import { LocationPermissionDialog } from "@/components/LocationPermissionDialog"
import { useOnboarding, useFeedbackTrigger, usePageVisibility } from "@/hooks/use-onboarding"
import { useIsIPhone } from "@/hooks/use-device"
import { useAuth } from "@/hooks/use-auth"
import type {
  AIRecommendation,
  RecommendationCategory,
  RecommendationHistory,
} from "@/lib/types/recommendation"
import { RegionConfig } from "@/lib/config/region"
import { getClientLocale } from "@/lib/utils/locale"
import { isValidUserId } from "@/lib/utils"
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth"
import { trackClientEvent } from "@/lib/analytics/client"
import { getClientHint } from "@/lib/app/app-container"
import { resolveCandidateLink } from "@/lib/outbound/link-resolver"
import { mapSearchPlatformToProvider } from "@/lib/outbound/provider-mapping"

// 使用量信息类型
interface UsageInfo {
  current: number;
  limit: number;
  remaining: number;
  periodType: "daily" | "monthly" | "total";
  periodEnd: string | null;
  isUnlimited: boolean;
  quotaType: "count" | "token";
  model: string | null;
}

// 分类配置
const categoryConfig: Record<
  RecommendationCategory,
  {
    title: { zh: string; en: string }
    icon: string
    color: string
    description: { zh: string; en: string }
  }
> = {
  entertainment: {
    title: { zh: "随机娱乐", en: "Random Entertainment" },
    icon: "🎲",
    color: "from-purple-400 to-pink-400",
    description: { zh: "发现精彩娱乐内容", en: "Discover amazing entertainment" },
  },
  shopping: {
    title: { zh: "随机购物", en: "Random Shopping" },
    icon: "🛍️",
    color: "from-blue-400 to-cyan-400",
    description: { zh: "发现心仪好物", en: "Find products you'll love" },
  },
  food: {
    title: { zh: "随机吃", en: "Random Food" },
    icon: "🍜",
    color: "from-green-400 to-teal-400",
    description: { zh: "探索美食世界", en: "Explore culinary delights" },
  },
  travel: {
    title: { zh: "随机出行", en: "Random Travel" },
    icon: "🏞️",
    color: "from-yellow-400 to-orange-400",
    description: { zh: "发现旅行目的地", en: "Discover travel destinations" },
  },
  fitness: {
    title: { zh: "随机健身", en: "Random Fitness" },
    icon: "💪",
    color: "from-red-400 to-pink-400",
    description: { zh: "开启健康生活", en: "Start your fitness journey" },
  },
}

// Map history records into AI recommendation card shape
type HistoryItem = AIRecommendation & { historyId?: string }

function mapHistoryRecordToRecommendation(
  record: RecommendationHistory,
  locale: "zh" | "en",
  region: "CN" | "INTL",
  isMobile?: boolean,
  os?: "ios" | "android"
): HistoryItem {
  const storedCandidateLink = (record.metadata as any)?.candidateLink as AIRecommendation["candidateLink"] | undefined
  const searchQuery = (record.metadata as any)?.searchQuery as string | undefined
  const originalPlatform = (record.metadata as any)?.originalPlatform as string | undefined

  const candidateLink =
    storedCandidateLink ||
    resolveCandidateLink({
      title: record.title,
      query: searchQuery || record.title,
      category: record.category,
      locale,
      region,
      provider: originalPlatform ? mapSearchPlatformToProvider(originalPlatform, locale) : undefined,
      isMobile,
      os,
    })

  return {
    historyId: record.id,
    title: record.title,
    description: record.description || "",
    category: record.category,
    link: record.link,
    linkType: record.link_type || "search",
    candidateLink,
    metadata: record.metadata || {},
    reason: record.reason || "",
    tags: (record.metadata?.tags as string[] | undefined) || undefined,
  }
}

function dedupeHistory(items: HistoryItem[]): HistoryItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.title}-${item.link}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

type EntertainmentType = "video" | "game" | "music" | "review"

function getEntertainmentType(item: AIRecommendation): EntertainmentType | null {
  const raw = (item as any)?.entertainmentType ?? (item.metadata as any)?.entertainmentType
  if (raw === "video" || raw === "game" || raw === "music" || raw === "review") {
    return raw
  }
  return null
}

function prioritizeEntertainmentRecommendations<T extends AIRecommendation>(items: T[]): T[] {
  const order: EntertainmentType[] = ["video", "game", "music", "review"]
  const pickedKeys = new Set<string>()
  const picks: T[] = []
  const firstByType = new Map<EntertainmentType, T>()

  for (const item of items) {
    const type = getEntertainmentType(item)
    if (type && !firstByType.has(type)) {
      firstByType.set(type, item)
    }
  }

  for (const type of order) {
    const item = firstByType.get(type)
    if (!item) continue
    const key = `${item.title}-${item.link}`
    if (pickedKeys.has(key)) continue
    pickedKeys.add(key)
    picks.push(item)
  }

  const rest = items.filter((item) => {
    const key = `${item.title}-${item.link}`
    if (pickedKeys.has(key)) return false
    pickedKeys.add(key)
    return true
  })

  return [...picks, ...rest]
}

// Get current user ID
function getUserId(): string {
  if (typeof window !== "undefined") {
    const isCN = RegionConfig.database.provider === "cloudbase";

    if (isCN) {
      // CN 环境：优先使用 CloudBase 认证状态
      // 1. 新的统一认证状态 (app-auth-state)
      try {
        const authState = localStorage.getItem("app-auth-state");
        if (authState) {
          const state = JSON.parse(authState);
          if (state?.user?.id) {
            console.log(`[Auth] Got userId from app-auth-state (CN): ${state.user.id.slice(0, 8)}...`);
            return state.user.id;
          }
        }
      } catch (error) {
        console.warn("[Auth] Failed to parse app-auth-state:", error);
      }

      // 2. 旧的 CloudBase 缓存 (auth-state)
      try {
        const cloudbaseCache = localStorage.getItem("auth-state");
        if (cloudbaseCache) {
          const state = JSON.parse(cloudbaseCache);
          if (state?.user?.id) {
            console.log(`[Auth] Got userId from CloudBase cache (CN): ${state.user.id.slice(0, 8)}...`);
            return state.user.id;
          }
        }
      } catch (error) {
        console.warn("[Auth] Failed to parse CloudBase cache:", error);
      }
    } else {
      // INTL 环境：优先使用 Supabase 认证状态
      // 1. Supabase 用户缓存
      try {
        const supabaseCache = localStorage.getItem("supabase-user-cache");
        if (supabaseCache) {
          const cache = JSON.parse(supabaseCache);
          if (cache?.user?.id) {
            console.log(`[Auth] Got userId from Supabase cache (INTL): ${cache.user.id.slice(0, 8)}...`);
            return cache.user.id;
          }
        }
      } catch (error) {
        console.warn("[Auth] Failed to parse Supabase cache:", error);
      }

      // 2. Supabase SDK 的默认存储 (sb-<project-ref>-auth-token)
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
            const tokenData = localStorage.getItem(key);
            if (tokenData) {
              const parsed = JSON.parse(tokenData);
              const userId = parsed?.user?.id;
              if (userId) {
                console.log(`[Auth] Got userId from Supabase SDK storage (INTL): ${userId.slice(0, 8)}...`);
                return userId;
              }
            }
          }
        }
      } catch (error) {
        console.warn("[Auth] Failed to parse Supabase SDK storage:", error);
      }
    }

    // 备选：旧的用户缓存 key（兼容性）
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user?.id || user?.uid) {
          const userId = user.id || user.uid;
          console.log(`[Auth] Got userId from legacy cache: ${userId.slice(0, 8)}...`);
          return userId;
        }
      }
    } catch (error) {
      console.warn("[Auth] Failed to parse legacy user cache:", error);
    }
  }

  console.warn("[Auth] No authenticated user found, using anonymous");
  return "anonymous";
}

export default function CategoryPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const isIPhone = useIsIPhone()
  const { user: authUser } = useAuth()
  const [currentRecommendations, setCurrentRecommendations] = useState<AIRecommendation[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historySource, setHistorySource] = useState<"local" | "supabase" | "cloudbase">("local")
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isShaking, setIsShaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [source, setSource] = useState<"ai" | "fallback" | "cache" | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 使用量限制状态
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)
  const [limitExceeded, setLimitExceeded] = useState(false)
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null)
  // 使用环境变量中的地区设置
  const [locale] = useState<"zh" | "en">(() => getClientLocale())
  const region = RegionConfig.database.provider === "cloudbase" ? "CN" : "INTL"
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [locationRequestPending, setLocationRequestPending] = useState(false)
  const [locationConsent, setLocationConsent] = useState<"unknown" | "granted" | "denied">("unknown")
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null)

  const getUsagePeriodLabel = useCallback((usage: UsageInfo) => {
    if (usage.periodType === "total") {
      return locale === "zh" ? "（总计）" : " (total)"
    }

    if (usage.periodType === "monthly") {
      return locale === "zh" ? "（本月）" : " this month"
    }

    return locale === "zh" ? "（今日）" : " today"
  }, [locale])

  const isLowUsageRemaining = useCallback((usage: UsageInfo) => {
    if (usage.quotaType === "token") {
      return usage.remaining > 0 && usage.remaining <= 20000
    }

    return usage.remaining > 0 && usage.remaining <= 5
  }, [])


  // 用户画像状态
  const {
    profileCompleteness,
    redirectToOnboarding,
    shouldShowOnboardingPrompt
  } = useOnboarding(userId)

  // 反馈触发管理
  const {
    trackClick,
    trackReturn,
    pendingFeedback,
    feedbackDialogOpen,
    closeFeedbackDialog,
  } = useFeedbackTrigger(userId)

  // 记录最近点击的推荐，用于返回时追踪
  const lastClickedRef = useRef<{
    recommendationId: string;
    title: string;
    category: string;
    clickTime: number;
  } | null>(null)

  // 会话 ID
  const sessionIdRef = useRef<string>(`session_${Date.now()}`)
  const viewedBatchKeyRef = useRef<string | null>(null)

  const categoryId = params.id as RecommendationCategory
  const category = categoryConfig[categoryId]

  const normalizeRecommendationsForUI = useCallback(
    (items: HistoryItem[]) => {
      if (categoryId !== "entertainment" || region !== "CN") return items
      return prioritizeEntertainmentRecommendations(items)
    },
    [categoryId, region]
  )

  useEffect(() => {
    if (currentRecommendations.length > 0) return
    try {
      const raw = sessionStorage.getItem(`ai_last_results:${categoryId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      setCurrentRecommendations(normalizeRecommendationsForUI(parsed as AIRecommendation[]))
    } catch {}
  }, [categoryId, currentRecommendations.length, normalizeRecommendationsForUI])

  useEffect(() => {
    if (currentRecommendations.length === 0) return
    try {
      sessionStorage.setItem(`ai_last_results:${categoryId}`, JSON.stringify(currentRecommendations))
    } catch {}
  }, [categoryId, currentRecommendations])
  const historyProvider = RegionConfig.database.provider

  useEffect(() => {
    if (authUser?.id) {
      setUserId(authUser.id)
      return
    }

    const resolvedId = getUserId()
    if (resolvedId !== "anonymous") {
      setUserId(resolvedId)
      return
    }

    setUserId(null)
  }, [authUser?.id])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("geo-consent")
      if (raw === "granted" || raw === "denied") {
        setLocationConsent(raw)
      }
      const coordsRaw = localStorage.getItem("geo-coords")
      if (coordsRaw) {
        const parsed = JSON.parse(coordsRaw) as { lat: number; lng: number } | null
        if (parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number") {
          setLocationCoords(parsed)
        }
      }
    } catch {
      setLocationConsent("unknown")
      setLocationCoords(null)
    }
  }, [])

  // 健身类目：页面加载时主动请求位置权限
  // 确保推荐附近健身房时有准确的位置信息
  useEffect(() => {
    if (categoryId !== "fitness") return
    // 如果已经有位置或者用户已拒绝，不再请求
    if (locationConsent === "denied") return
    if (locationConsent === "granted" && locationCoords) return

    // 延迟显示位置权限弹窗，等待页面完全加载
    const timer = setTimeout(() => {
      if (locationConsent === "unknown") {
        setLocationDialogOpen(true)
      } else if (locationConsent === "granted" && !locationCoords) {
        // 已授权但没有坐标，重新获取
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
              setLocationCoords(coords)
              try {
                localStorage.setItem("geo-coords", JSON.stringify(coords))
              } catch {}
            },
            () => {
              // 获取失败，静默处理
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
          )
        }
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [categoryId, locationConsent, locationCoords])

  // 页面可见性追踪 - 当用户从外部网站返回时触发
  usePageVisibility(
    useCallback(async (timeAway: number) => {
      if (!lastClickedRef.current || !userId) return
      
      const { recommendationId } = lastClickedRef.current
      
      // 只有离开时间超过 5 秒才认为是真正的外部访问
      if (timeAway < 5) return

      console.log(`[Return] 用户返回，离开时间: ${timeAway}秒`)

      // 追踪返回并可能触发反馈
      const result = await trackReturn(recommendationId, timeAway, sessionIdRef.current)

      trackClientEvent({
        eventType: "recommend_return",
        userId,
        path: `/category/${categoryId}`,
        step: null,
        properties: {
          recommendationId,
          timeAway,
          sessionId: sessionIdRef.current,
        },
      })
      
      if (result.triggerFeedback && result.recommendation) {
        // 反馈弹窗已经由 trackReturn 内部处理
        console.log('[Feedback] 触发反馈弹窗')
      }

      // 清除上次点击记录
      lastClickedRef.current = null
    }, [userId, trackReturn, categoryId])
  )

  const loadLocalHistory = useCallback(() => {
    // 在CN环境下，未登录用户不显示历史记录
    if (!userId || userId === "anonymous") {
      setHistory([])
      return
    }
    
    const savedHistory = localStorage.getItem(`ai_history_${params.id}`)
    if (savedHistory) {
      try {
        const parsedHistory: HistoryItem[] = JSON.parse(savedHistory)
        setHistory(dedupeHistory(parsedHistory).slice(0, 10))
        setHistorySource("local")
      } catch {
        // ignore parse errors
      }
    }
  }, [params.id, userId])

  const fetchRemoteHistory = useCallback(
    async (targetUserId: string) => {
      // 在CN环境下，未登录用户不获取历史记录
      if (!isValidUserId(targetUserId) || targetUserId === "anonymous") {
        setHistory([])
        setHistorySource("local")
        return
      }

      setIsHistoryLoading(true)
      try {
        // 使用 fetchWithAuth 携带认证 token，确保后端能验证用户身份
        const response = await fetchWithAuth(
          `/api/recommend/history?userId=${targetUserId}&category=${categoryId}&limit=10&provider=${historyProvider}`
        )
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load history")
        }

        const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
        const isAndroid = /android/i.test(ua)
        const isMobile = isIPhone || isAndroid
        const mappedHistory: HistoryItem[] = dedupeHistory(
          (result.data || []).map((record: RecommendationHistory) =>
            mapHistoryRecordToRecommendation(record, locale, region, isMobile, isAndroid ? "android" : isIPhone ? "ios" : undefined)
          )
        )
        setHistory(mappedHistory)
        setHistorySource(historyProvider)
        localStorage.setItem(`ai_history_${params.id}`, JSON.stringify(mappedHistory))
      } catch (err) {
        console.warn("Failed to load remote history, falling back to local cache:", err)
        setHistorySource("local")
        loadLocalHistory()
      } finally {
        setIsHistoryLoading(false)
      }
    },
    [categoryId, historyProvider, isIPhone, loadLocalHistory, locale, params.id, region]
  )

  // 初始化加载本地历史缓存（仅对已登录用户）
  useEffect(() => {
    // 在CN环境下，未登录用户不显示历史记录
    if (userId && userId !== "anonymous") {
      loadLocalHistory()
    }
  }, [loadLocalHistory, userId])

  // 有登录用户时从远端查询历史（Supabase 或 CloudBase）
  useEffect(() => {
    // 在CN环境下，未登录用户不获取远程历史记录
    if (!userId || userId === "anonymous") return
    fetchRemoteHistory(userId)
  }, [userId, fetchRemoteHistory])

  // 删除单条历史记录
  const deleteHistoryItem = useCallback(
    async (index: number) => {
      const item = history[index]
      const newHistory = history.filter((_, i) => i !== index)
      setHistory(newHistory)
      localStorage.setItem(`ai_history_${params.id}`, JSON.stringify(newHistory))

      const resolvedUserId = userId || getUserId()
      if (item?.historyId && isValidUserId(resolvedUserId)) {
        try {
          // 使用 fetchWithAuth 携带认证 token
          await fetchWithAuth("/api/recommend/history", {
            method: "DELETE",
            body: JSON.stringify({
              userId: resolvedUserId,
              historyIds: [item.historyId],
              category: categoryId,
              provider: historyProvider,
            }),
          })
        } catch (err) {
          console.error("Failed to delete remote history item:", err)
        }
      }
    },
    [history, params.id, userId, categoryId, historyProvider]
  )

    const clearHistory = useCallback(async () => {
      setHistory([])
      localStorage.removeItem(`ai_history_${params.id}`)

      const resolvedUserId = userId || getUserId()
      if (isValidUserId(resolvedUserId)) {
        try {
          // 使用 fetchWithAuth 携带认证 token
          await fetchWithAuth("/api/recommend/history", {
            method: "PUT",
            body: JSON.stringify({
              userId: resolvedUserId,
              action: "clear-all",
              provider: historyProvider,
            }),
          })
        } catch (err) {
          console.error("Failed to clear remote history:", err)
        }
      }
  }, [params.id, userId, historyProvider])

  // 记录用户行为
  const recordAction = useCallback(
    async (
      recommendation: AIRecommendation,
      action: "view" | "click" | "save" | "dismiss"
    ): Promise<string | undefined> => {
      const resolvedUserId = userId || getUserId()
      if (!isValidUserId(resolvedUserId)) return

      try {
        const response = await fetch("/api/recommend/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: resolvedUserId,
            category: categoryId,
            recommendation,
            action,
          }),
        })

        const result = await response.json().catch(() => null)
        return result?.historyId as string | undefined
      } catch (err) {
        console.error("Failed to record action:", err)
        return
      }
    },
    [categoryId, userId]
  )

  useEffect(() => {
    if (!userId || userId === "anonymous") return
    if (currentRecommendations.length === 0) return

    const key = `${categoryId}:${currentRecommendations
      .map((r) => r.title)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .join("|")}`

    if (viewedBatchKeyRef.current === key) return
    viewedBatchKeyRef.current = key

    const recsToRecord = currentRecommendations.slice(0, 10)
    void Promise.allSettled(recsToRecord.map((rec) => recordAction(rec, "view")))
  }, [categoryId, currentRecommendations, recordAction, userId])

  const requestRecommendations = useCallback(
    async (coordsOverride: { lat: number; lng: number } | null) => {
      if (!userId || userId === "anonymous") {
        router.push("/login")
        return
      }

      setIsShaking(true)
      setIsLoading(true)
      setError(null)
      setLimitExceeded(false)
      setUpgradeMessage(null)

      try {
        const resolvedUserId = userId || getUserId()
        const queryUserId = isValidUserId(resolvedUserId) ? resolvedUserId : "anonymous"

        trackClientEvent({
          eventType: "recommend_request",
          userId: resolvedUserId,
          path: `/category/${categoryId}`,
          step: null,
          properties: {
            categoryId,
            locale,
            count: 5,
            skipCache: true,
            hasGeo: !!coordsOverride,
          },
        })

        const url = new URL(`/api/recommend/ai/${categoryId}`, window.location.origin)
        url.searchParams.set("userId", queryUserId)
        url.searchParams.set("count", "5")
        url.searchParams.set("locale", locale)
        url.searchParams.set("skipCache", "true")
        url.searchParams.set("client", getClientHint())
        const excludeTitles = (() => {
          const mergedTitles = [
            ...currentRecommendations.map((r) => r.title),
            ...history.map((h) => h.title),
          ].filter((t): t is string => typeof t === "string" && t.trim().length > 0)

          const seen = new Set<string>()
          const unique: string[] = []
          for (const title of mergedTitles) {
            if (seen.has(title)) continue
            seen.add(title)
            unique.push(title)
          }
          return unique.slice(0, 40)
        })()
        if (excludeTitles.length > 0) {
          url.searchParams.set("excludeTitles", JSON.stringify(excludeTitles))
        }
        if (coordsOverride) {
          url.searchParams.set("lat", String(coordsOverride.lat))
          url.searchParams.set("lng", String(coordsOverride.lng))
        }

        url.searchParams.set("stream", "true")

        const response = await fetch(`${url.pathname}?${url.searchParams.toString()}`, { method: "GET" })

        if (response.status === 429) {
          const data = await response.json().catch(() => null)
          trackClientEvent({
            eventType: "recommend_error",
            userId: resolvedUserId,
            path: `/category/${categoryId}`,
            step: null,
            properties: {
              categoryId,
              locale,
              reason: "limit",
              status: response.status,
            },
          })
          setLimitExceeded(true)
          setError(data?.error || (locale === "zh" ? "已达到使用限制" : "Usage limit reached"))
          setUpgradeMessage(data?.upgradeMessage || null)
          if (data?.usage) {
            setUsageInfo(data.usage as UsageInfo)
          }
          setIsShaking(false)
          setIsLoading(false)
          return
        }

        const contentType = response.headers.get("content-type") || ""
        if (contentType.includes("text/event-stream") && response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ""
          let aiStarted = false
          let collected: HistoryItem[] = []
          let warmup: HistoryItem[] = []

          const flushMessage = (raw: string) => {
            const lines = raw.split("\n").map((l) => l.trimEnd())
            let eventName = "message"
            const dataLines: string[] = []
            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventName = line.slice("event:".length).trim()
              } else if (line.startsWith("data:")) {
                dataLines.push(line.slice("data:".length).trim())
              }
            }
            const dataRaw = dataLines.join("\n").trim()
            if (!dataRaw) return
            let payload: any = null
            try {
              payload = JSON.parse(dataRaw)
            } catch {
              return
            }

            if (eventName === "error" || payload?.type === "error") {
              setError(payload?.message || (locale === "zh" ? "获取推荐失败，请重试" : "Failed to get recommendations"))
              setIsShaking(false)
              setIsLoading(false)
              return
            }

            if (payload?.type === "partial" && Array.isArray(payload?.recommendations)) {
              console.log('[Stream] Received partial:', payload.phase, payload.recommendations.length, 'items')
              if (payload?.phase === "ai") {
                if (!aiStarted) {
                  aiStarted = true
                  collected = []
                }
                const merged = dedupeHistory([...collected, ...payload.recommendations])
                collected = merged
                console.log('[Stream] Setting AI recommendations:', merged.length, 'items')
                setCurrentRecommendations(normalizeRecommendationsForUI(merged))
                setSource(payload?.source || "ai")
                return
              }

              const warm = dedupeHistory(payload.recommendations)
              warmup = warm
              if (!aiStarted) {
                console.log('[Stream] Setting warmup recommendations:', warm.length, 'items')
                setCurrentRecommendations(normalizeRecommendationsForUI(warm))
                setSource(payload?.source || "warmup")
              }
              return
            }

            if (payload?.type === "complete") {
              const payloadRecs = Array.isArray(payload?.recommendations) ? payload.recommendations : null
              let finalRecs = payloadRecs && payloadRecs.length > 0 ? payloadRecs : collected
              if (finalRecs.length === 0 && warmup.length > 0) {
                finalRecs = warmup
              }

              const uniqueRecs = dedupeHistory(finalRecs)
              const normalizedRecs = normalizeRecommendationsForUI(uniqueRecs)
              setCurrentRecommendations(normalizedRecs)
              if (!aiStarted && normalizedRecs.length > 0 && payloadRecs && payloadRecs.length === 0) {
                setSource("fallback")
              } else {
                setSource(payload?.source || (aiStarted ? "ai" : "fallback"))
              }

              if (payload?.usage) {
                setUsageInfo(payload.usage as UsageInfo)
              }

              trackClientEvent({
                eventType: "recommend_success",
                userId: resolvedUserId,
                path: `/category/${categoryId}`,
                step: null,
                properties: {
                  categoryId,
                  locale,
                  returned: normalizedRecs.length,
                  source: payload?.source || null,
                },
              })

              trackClientEvent({
                eventType: "recommend_result_view",
                userId: resolvedUserId,
                path: `/category/${categoryId}`,
                step: null,
                properties: {
                  categoryId,
                  locale,
                  shown: normalizedRecs.length,
                  source: payload?.source || null,
                },
              })

              const newHistory: HistoryItem[] = dedupeHistory([...normalizedRecs, ...history]).slice(0, 10)
              setHistory(newHistory)
              localStorage.setItem(`ai_history_${params.id}`, JSON.stringify(newHistory))

              if (isValidUserId(resolvedUserId)) {
                fetchRemoteHistory(resolvedUserId)
              }

              setIsShaking(false)
              setIsLoading(false)
            }
          }

          try {
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              buffer += decoder.decode(value, { stream: true })
              let idx = buffer.indexOf("\n\n")
              while (idx !== -1) {
                const msg = buffer.slice(0, idx)
                buffer = buffer.slice(idx + 2)
                flushMessage(msg)
                idx = buffer.indexOf("\n\n")
              }
            }
          } finally {
            try {
              reader.releaseLock()
            } catch {}
          }

          setIsShaking(false)
          setIsLoading(false)
          return
        }

        const data = await response.json().catch(() => null)
        if (!data?.success || !Array.isArray(data?.recommendations) || data.recommendations.length === 0) {
          throw new Error(data?.error || "No recommendations received")
        }

        trackClientEvent({
          eventType: "recommend_success",
          userId: resolvedUserId,
          path: `/category/${categoryId}`,
          step: null,
          properties: {
            categoryId,
            locale,
            returned: Array.isArray(data.recommendations) ? data.recommendations.length : 0,
            source: data.source || null,
          },
        })

        if (data.usage) {
          setUsageInfo(data.usage as UsageInfo)
        }

        const uniqueRecs = dedupeHistory(data.recommendations)
        const normalizedRecs = normalizeRecommendationsForUI(uniqueRecs)
        setCurrentRecommendations(normalizedRecs)
        setSource(data.source)

        trackClientEvent({
          eventType: "recommend_result_view",
          userId: resolvedUserId,
          path: `/category/${categoryId}`,
          step: null,
          properties: {
            categoryId,
            locale,
            shown: normalizedRecs.length,
            source: data.source || null,
          },
        })

        const newHistory: HistoryItem[] = dedupeHistory([...normalizedRecs, ...history]).slice(0, 10)
        setHistory(newHistory)
        localStorage.setItem(`ai_history_${params.id}`, JSON.stringify(newHistory))

        if (isValidUserId(resolvedUserId)) {
          fetchRemoteHistory(resolvedUserId)
        }

        setIsShaking(false)
        setIsLoading(false)
      } catch (err) {
        console.error("Error fetching recommendations:", err)
        trackClientEvent({
          eventType: "recommend_error",
          userId,
          path: `/category/${categoryId}`,
          step: null,
          properties: {
            categoryId,
            locale,
            reason: "exception",
            message: err instanceof Error ? err.message : String(err || ""),
          },
        })
        setError(err instanceof Error ? err.message : "Failed to get recommendations")
        setIsShaking(false)
        setIsLoading(false)
      }
    },
    [categoryId, currentRecommendations, fetchRemoteHistory, history, locale, normalizeRecommendationsForUI, params.id, router, userId]
  )

  const fetchRecommendations = useCallback(async () => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
    const isMobile = isIPhone || /android/i.test(ua) || (typeof window !== "undefined" && window.innerWidth < 768)
    const needsLocation = categoryId === "food" || categoryId === "fitness"

    if (needsLocation && isMobile) {
      if (locationConsent === "unknown") {
        setLocationRequestPending(true)
        setLocationDialogOpen(true)
        return
      }
      if (locationConsent === "granted" && !locationCoords) {
        setLocationRequestPending(true)
        setLocationDialogOpen(true)
        return
      }
    }

    const coordsToUse = needsLocation && isMobile && locationConsent === "granted" ? locationCoords : null
    await requestRecommendations(coordsToUse)
  }, [categoryId, isIPhone, locationConsent, locationCoords, requestRecommendations])

  const handleLocationAllow = useCallback(() => {
    setLocationDialogOpen(false)
    setLocationConsent("granted")
    try {
      localStorage.setItem("geo-consent", "granted")
    } catch {}

    if (!navigator.geolocation) {
      setLocationConsent("denied")
      try {
        localStorage.setItem("geo-consent", "denied")
      } catch {}
      const shouldContinue = locationRequestPending
      setLocationRequestPending(false)
      if (shouldContinue) {
        requestRecommendations(null)
      }
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocationCoords(coords)
        try {
          localStorage.setItem("geo-coords", JSON.stringify(coords))
        } catch {}
        const shouldContinue = locationRequestPending
        setLocationRequestPending(false)
        if (shouldContinue) {
          requestRecommendations(coords)
        }
      },
      () => {
        setLocationConsent("denied")
        try {
          localStorage.setItem("geo-consent", "denied")
        } catch {}
        const shouldContinue = locationRequestPending
        setLocationRequestPending(false)
        if (shouldContinue) {
          requestRecommendations(null)
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    )
  }, [locationRequestPending, requestRecommendations])

  const handleLocationDeny = useCallback(() => {
    setLocationDialogOpen(false)
    setLocationConsent("denied")
    try {
      localStorage.setItem("geo-consent", "denied")
    } catch {}
    const shouldContinue = locationRequestPending
    setLocationRequestPending(false)
    if (shouldContinue) {
      requestRecommendations(null)
    }
  }, [locationRequestPending, requestRecommendations])

  // 处理链接点击 - 增强版，包含追踪功能
  const handleLinkClick = useCallback(
    async (recommendation: AIRecommendation) => {
      // 记录原有的行为
      const historyId = await recordAction(recommendation, "click")

      // 记录点击时间和推荐信息，用于返回时追踪
      lastClickedRef.current = {
        recommendationId: historyId || recommendation.title, // 使用 historyId 或 title 作为标识
        title: recommendation.title,
        category: categoryId,
        clickTime: Date.now()
      }

      trackClientEvent({
        eventType: "recommend_click",
        userId,
        path: `/category/${categoryId}`,
        step: null,
        properties: {
          recommendationId: historyId || null,
          title: recommendation.title,
          categoryId,
        },
      })

      // 如果用户已登录，追踪点击行为
      if (userId && historyId) {
        trackClick(historyId, sessionIdRef.current).then(result => {
          console.log(`[Track] 点击追踪结果:`, result)
        })
      }
    },
    [recordAction, userId, trackClick, categoryId]
  )

  // 处理保存
  const handleSave = useCallback(
    (recommendation: AIRecommendation) => {
      recordAction(recommendation, "save")
    },
    [recordAction]
  )

  // 处理不感兴趣
  const handleDismiss = useCallback(
    async (recommendation: AIRecommendation) => {
      const historyId = await recordAction(recommendation, "dismiss")
      if (userId && historyId && isValidUserId(userId)) {
        void fetch("/api/recommend/submit-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            recommendationId: historyId,
            feedbackType: "interest",
            isInterested: false,
            triggeredBy: "dismiss",
          }),
        })
      }
      // 从当前推荐中移除
      setCurrentRecommendations((prev) =>
        prev.filter((r) => r.title !== recommendation.title)
      )
    },
    [recordAction, userId]
  )

  // 如果分类不存在
  if (!category) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {locale === "zh" ? "分类不存在" : "Category not found"}
          </h2>
          <Link href="/">
            <Button>{locale === "zh" ? "返回首页" : "Go Home"}</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] p-4">
      <div className="max-w-md mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6 pt-8">
          <div className="flex items-center">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mr-4">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </Button>
            </Link>
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{category.icon}</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  {category.title[locale]}
                </h1>
                <p className="text-sm text-gray-500">{category.description[locale]}</p>
              </div>
            </div>
          </div>
        </div>

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
                variant="banner"
                onDismiss={() => {
                  // 记录关闭时间，24小时后可再次显示
                  localStorage.setItem('onboarding_prompt_dismissed', Date.now().toString())
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 摇一摇按钮 */}
        <div className="text-center mb-8">
          <motion.div
            animate={
              isShaking
                ? {
                  rotate: [0, -10, 10, -10, 10, 0],
                  scale: [1, 1.1, 1, 1.1, 1],
                }
                : {}
            }
            transition={{ duration: 0.5, repeat: isShaking ? Infinity : 0 }}
          >
            <Button
              onClick={() => {
                // 检查用户是否登录，未登录则跳转到登录页
                if (!userId || userId === "anonymous") {
                  router.push("/login");
                  return;
                }
                // 已登录用户获取推荐
                fetchRecommendations();
              }}
              disabled={isLoading}
              className={`w-32 h-32 rounded-full bg-gradient-to-r ${category.color} hover:opacity-90 text-white text-lg font-semibold shadow-lg`}
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  ⏳
                </motion.div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-2xl mb-1">🎲</span>
                  <span>{locale === "zh" ? "摇一摇" : "Shake"}</span>
                </div>
              )}
            </Button>
          </motion.div>
          <p className="text-gray-600 mt-4">
            {!userId || userId === "anonymous"
              ? locale === "zh"
                ? "请先登录后使用推荐功能"
                : "Please log in to use the recommendation feature"
              : locale === "zh"
                ? "点击获取 AI 个性化推荐"
                : "Tap for AI-powered recommendations"}
          </p>
        </div>

        {/* 来源标签 */}
        {source && currentRecommendations.length > 0 && (
          <div className="flex justify-center mb-4">
            <Badge
              variant={source === "ai" ? "default" : "secondary"}
              className={
                source === "ai"
                  ? "bg-gradient-to-r from-purple-500 to-pink-500"
                  : ""
              }
            >
              {source === "ai" && "🤖 "}
              {source === "ai"
                ? locale === "zh"
                  ? "AI 智能推荐"
                  : "AI Powered"
                : source === "cache"
                  ? locale === "zh"
                    ? "缓存推荐"
                    : "Cached"
                  : locale === "zh"
                    ? "精选推荐"
                    : "Curated"}
            </Badge>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Card className={`p-4 ${limitExceeded ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-center">
                {limitExceeded && (
                  <div className="text-3xl mb-2">
                    {usageInfo?.quotaType === "token" ? "🪙" : usageInfo?.periodType === "monthly" ? "📅" : "⏰"}
                  </div>
                )}
                <p className={`${limitExceeded ? 'text-amber-700' : 'text-red-600'} text-sm font-medium`}>
                  {error}
                </p>
                {upgradeMessage && (
                  <p className="text-gray-600 text-xs mt-2">{upgradeMessage}</p>
                )}
                {limitExceeded && usageInfo && (
                  <div className="mt-3 text-xs text-gray-500">
                    {usageInfo.model ? (
                      <div>{locale === "zh" ? `当前模型：${usageInfo.model}` : `Model: ${usageInfo.model}`}</div>
                    ) : null}
                    <div>
                      {usageInfo.quotaType === "token"
                        ? (locale === "zh"
                          ? `已使用 ${usageInfo.current}/${usageInfo.limit} token${getUsagePeriodLabel(usageInfo)}`
                          : `Used ${usageInfo.current}/${usageInfo.limit} tokens${getUsagePeriodLabel(usageInfo)}`)
                        : (locale === "zh"
                          ? `已使用 ${usageInfo.current}/${usageInfo.limit} 次${getUsagePeriodLabel(usageInfo)}`
                          : `Used ${usageInfo.current}/${usageInfo.limit}${getUsagePeriodLabel(usageInfo)}`)}
                    </div>
                  </div>
                )}
                {limitExceeded && !isIPhone && (
                  <Link href="/pro" className="inline-block mt-4">
                    <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                      {locale === "zh" ? "升级获取更多" : "Upgrade for More"}
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* 使用量信息显示（正常情况下） */}
        {usageInfo && !limitExceeded && !usageInfo.isUnlimited && (
          <div className="mb-4 text-center">
            {usageInfo.model ? (
              <div className="text-xs text-gray-500 mb-1">
                {locale === "zh" ? `当前模型：${usageInfo.model}` : `Model: ${usageInfo.model}`}
              </div>
            ) : null}
            <span className="text-xs text-gray-500">
              {usageInfo.quotaType === "token"
                ? (locale === "zh"
                  ? `剩余 ${usageInfo.remaining} token${getUsagePeriodLabel(usageInfo)}`
                  : `${usageInfo.remaining} tokens remaining${getUsagePeriodLabel(usageInfo)}`)
                : (locale === "zh"
                  ? `剩余 ${usageInfo.remaining} 次${getUsagePeriodLabel(usageInfo)}`
                  : `${usageInfo.remaining} remaining${getUsagePeriodLabel(usageInfo)}`)}
            </span>
            {isLowUsageRemaining(usageInfo) && !isIPhone && (
              <Link href="/pro" className="ml-2 text-xs text-purple-600 hover:underline">
                {locale === "zh" ? "升级获取更多" : "Upgrade for more"}
              </Link>
            )}
          </div>
        )}

        {/* 当前推荐 */}
        <AnimatePresence mode="wait">
          {currentRecommendations.length > 0 && (
            <motion.div
              key="recommendations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <RecommendationList
                recommendations={currentRecommendations}
                category={categoryId}
                onLinkClick={handleLinkClick}
                onSave={handleSave}
                onDismiss={handleDismiss}
                showReason={true}
                locale={locale}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 欢迎提示（首次访问时显示） */}
        {currentRecommendations.length === 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="text-6xl mb-4">{category.icon}</div>
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              {!userId || userId === "anonymous"
                ? locale === "zh"
                  ? "请先登录使用推荐功能"
                  : "Please log in to use recommendations"
                : locale === "zh"
                  ? "点击上方按钮获取推荐"
                  : "Tap the button above for recommendations"}
            </h3>
            <p className="text-gray-500 text-sm">
              {!userId || userId === "anonymous"
                ? locale === "zh"
                  ? "登录后即可享受个性化推荐体验"
                  : "Log in to enjoy personalized recommendations"
                : locale === "zh"
                  ? "AI 将根据你的喜好推荐内容"
                  : "AI will recommend content based on your preferences"}
            </p>
            {!userId || userId === "anonymous" && (
              <Link href="/login" className="inline-block mt-4">
                <Button>
                  {locale === "zh" ? "立即登录" : "Log In Now"}
                </Button>
              </Link>
            )}
          </motion.div>
        )}

        {/* 历史记录 - 只对已登录用户显示 */}
        {userId && userId !== "anonymous" && history.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-800">
                  {locale === "zh" ? "最近推荐" : "Recent History"}
                </h2>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  {historySource === "supabase"
                    ? "Supabase"
                    : historySource === "cloudbase"
                      ? "CloudBase"
                      : locale === "zh"
                        ? "本地"
                        : "Local"}
                </Badge>
                {isHistoryLoading && (
                  <span className="text-xs text-gray-500">
                    {locale === "zh" ? "同步中..." : "Syncing..."}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                disabled={isHistoryLoading}
                className="text-gray-500 text-xs"
              >
                {locale === "zh" ? "清空全部" : "Clear All"}
              </Button>
            </div>
            {/* 可滚动的历史记录容器 */}
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-2">
              {history.map((item, index) => (
                <motion.div
                  key={item.historyId || `${item.title}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-300 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <RecommendationCard
                      recommendation={item}
                      category={categoryId}
                      onLinkClick={() => handleLinkClick(item)}
                      showReason={false}
                      compact={true}
                      locale={locale}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteHistoryItem(index)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-gray-400 hover:text-red-500"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                    </svg>
                  </Button>
                </motion.div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {locale === "zh"
                ? `显示最近 ${history.length}/10 条推荐`
                : `Showing ${history.length}/10 recent recommendations`}
            </p>
          </div>
        )}

        {/* 底部提示 */}
        <div className="mt-8 pb-8 text-center">
          <p className="text-xs text-gray-400">
            {locale === "zh"
              ? "推荐内容由 AI 生成，链接来自第三方平台"
              : "Recommendations powered by AI, links from third-party platforms"}
          </p>
        </div>
      </div>

      <LocationPermissionDialog
        open={locationDialogOpen}
        locale={locale}
        onAllow={handleLocationAllow}
        onDeny={handleLocationDeny}
      />

      {/* 反馈弹窗 */}
      <FeedbackDialog
        open={feedbackDialogOpen}
        onClose={closeFeedbackDialog}
        recommendation={pendingFeedback}
        userId={userId || ""}
      />
    </div>
  )
}
