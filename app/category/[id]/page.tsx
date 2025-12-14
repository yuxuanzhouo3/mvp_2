"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RecommendationCard, RecommendationList } from "@/components/RecommendationCard"
import type {
  AIRecommendation,
  RecommendationCategory,
  AIRecommendResponse,
  RecommendationHistory,
} from "@/lib/types/recommendation"
import { RegionConfig } from "@/lib/config/region"
import { getClientLocale } from "@/lib/utils/locale"
import { isValidUserId } from "@/lib/utils"

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

// åŽ†å²è®°å½•å¡«å……ä¸º AI æŽ¨èæ ¼å¼ï¼Œç»Ÿä¸€ä¾é� å•ä¸ªæŽ¨èå¡
type HistoryItem = AIRecommendation & { historyId?: string }

function mapHistoryRecordToRecommendation(record: RecommendationHistory): HistoryItem {
  return {
    historyId: record.id,
    title: record.title,
    description: record.description || "",
    category: record.category,
    link: record.link,
    linkType: record.link_type || "search",
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

// èŽ·å–ç”¨æˆ· ID
function getUserId(): string {
  if (typeof window !== "undefined") {
    // 尝试 Supabase 国际版缓存 (新方式)
    try {
      const supabaseCache = localStorage.getItem("supabase-user-cache");
      if (supabaseCache) {
        const cache = JSON.parse(supabaseCache);
        if (cache?.user?.id) {
          console.log(`[Auth] Got userId from Supabase cache: ${cache.user.id.slice(0, 8)}...`);
          return cache.user.id;
        }
      }
    } catch (error) {
      console.warn("[Auth] Failed to parse Supabase cache:", error);
    }

    // 尝试 CloudBase 中国版缓存 (备选)
    try {
      const cloudbaseCache = localStorage.getItem("auth-state");
      if (cloudbaseCache) {
        const state = JSON.parse(cloudbaseCache);
        if (state?.user?.id) {
          console.log(`[Auth] Got userId from CloudBase cache: ${state.user.id.slice(0, 8)}...`);
          return state.user.id;
        }
      }
    } catch (error) {
      console.warn("[Auth] Failed to parse CloudBase cache:", error);
    }

    // 备选：旧的用户缓存 key
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
  const [currentRecommendations, setCurrentRecommendations] = useState<AIRecommendation[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historySource, setHistorySource] = useState<"local" | "supabase" | "cloudbase">("local")
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isShaking, setIsShaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [source, setSource] = useState<"ai" | "fallback" | "cache" | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 使用环境变量中的地区设置
  const [locale] = useState<"zh" | "en">(() => getClientLocale())

  const categoryId = params.id as RecommendationCategory
  const category = categoryConfig[categoryId]
  const historyProvider = RegionConfig.database.provider

  useEffect(() => {
    const resolvedId = getUserId()
    if (resolvedId !== "anonymous") {
      setUserId(resolvedId)
    }
  }, [])

  const loadLocalHistory = useCallback(() => {
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
  }, [params.id])

  const fetchRemoteHistory = useCallback(
    async (targetUserId: string) => {
      if (!isValidUserId(targetUserId)) {
        setHistorySource("local")
        return
      }

      setIsHistoryLoading(true)
      try {
        const response = await fetch(
          `/api/recommend/history?userId=${targetUserId}&category=${categoryId}&limit=10`
        )
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load history")
        }

        const mappedHistory: HistoryItem[] = dedupeHistory(
          (result.data || []).map(mapHistoryRecordToRecommendation)
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
    [categoryId, historyProvider, loadLocalHistory, params.id]
  )

  // 初始化加载本地历史缓存
  useEffect(() => {
    loadLocalHistory()
  }, [loadLocalHistory])

  // 有登录用户时从远端查询历史（Supabase 或 CloudBase）
  useEffect(() => {
    if (!userId) return
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
          await fetch("/api/recommend/history", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: resolvedUserId,
              historyIds: [item.historyId],
              category: categoryId,
            }),
          })
        } catch (err) {
          console.error("Failed to delete remote history item:", err)
        }
      }
    },
    [history, params.id, userId, categoryId]
  )

  const clearHistory = useCallback(async () => {
    setHistory([])
    localStorage.removeItem(`ai_history_${params.id}`)

    const resolvedUserId = userId || getUserId()
    if (isValidUserId(resolvedUserId)) {
      try {
        await fetch("/api/recommend/history", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: resolvedUserId,
            action: "clear-all",
          }),
        })
      } catch (err) {
        console.error("Failed to clear remote history:", err)
      }
    }
  }, [params.id, userId])

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

  // 获取 AI 推荐
  const fetchRecommendations = useCallback(async () => {
    setIsShaking(true)
    setIsLoading(true)
    setError(null)

    try {
      const resolvedUserId = userId || getUserId()
      const queryUserId = isValidUserId(resolvedUserId) ? resolvedUserId : "anonymous"
      const response = await fetch(
        `/api/recommend/ai/${categoryId}?userId=${queryUserId}&count=5&locale=${locale}&skipCache=true`,
        { method: "GET" }
      )

      const data: AIRecommendResponse = await response.json()

      if (!data.success || data.recommendations.length === 0) {
        throw new Error(data.error || "No recommendations received")
      }

      // 延迟显示结果以保持动画效果
      setTimeout(() => {
        const uniqueRecs = dedupeHistory(data.recommendations)
        setCurrentRecommendations(uniqueRecs)
        setSource(data.source)

        // 更新历史（保留最近 10 条）
        const newHistory: HistoryItem[] = dedupeHistory([
          ...uniqueRecs,
          ...history,
        ]).slice(0, 10)
        setHistory(newHistory)
        localStorage.setItem(`ai_history_${params.id}`, JSON.stringify(newHistory))

        // 同步远端历史记录（根据地区使用 Supabase 或 CloudBase）
        if (isValidUserId(resolvedUserId)) {
          fetchRemoteHistory(resolvedUserId)
        }

        setIsShaking(false)
        setIsLoading(false)
      }, 1500)
    } catch (err) {
      console.error("Error fetching recommendations:", err)
      setError(err instanceof Error ? err.message : "Failed to get recommendations")
      setIsShaking(false)
      setIsLoading(false)
    }
  }, [categoryId, locale, history, params.id, recordAction, fetchRemoteHistory, userId])

  // 处理链接点击
  const handleLinkClick = useCallback(
    (recommendation: AIRecommendation) => {
      recordAction(recommendation, "click")
    },
    [recordAction]
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
    (recommendation: AIRecommendation) => {
      recordAction(recommendation, "dismiss")
      // 从当前推荐中移除
      setCurrentRecommendations((prev) =>
        prev.filter((r) => r.title !== recommendation.title)
      )
    },
    [recordAction]
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
        <div className="flex items-center mb-6 pt-8">
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
              onClick={fetchRecommendations}
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
            {locale === "zh"
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
            <Card className="p-4 bg-red-50 border-red-200">
              <p className="text-red-600 text-sm text-center">{error}</p>
            </Card>
          </motion.div>
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
              {locale === "zh"
                ? "点击上方按钮获取推荐"
                : "Tap the button above for recommendations"}
            </h3>
            <p className="text-gray-500 text-sm">
              {locale === "zh"
                ? "AI 将根据你的喜好推荐内容"
                : "AI will recommend content based on your preferences"}
            </p>
          </motion.div>
        )}

        {/* 历史记录 */}
        {history.length > 0 && (
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
    </div>
  )
}
