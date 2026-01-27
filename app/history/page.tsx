"use client"

/**
 * 推荐历史记录查看页面
 * 显示用户的所有推荐历史，支持筛选、排序和删除
 */

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { HistoryCard } from "@/components/HistoryCard"
import { ArrowLeft, Trash2, Search, Download, FileJson, FileText, FileType2, Loader2, Lock, Crown } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useLanguage } from "@/components/language-provider"
import { useTranslations } from "@/lib/i18n"
import { useIsIPhone } from "@/hooks/use-device"
import { RegionConfig } from "@/lib/config/region"
import type { RecommendationHistory, RecommendationCategory } from "@/lib/types/recommendation"
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth"
import { useToast } from "@/hooks/use-toast"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

/**
 * 分类配置
 */
const categoryConfig: Record<
    RecommendationCategory,
    { label: { zh: string; en: string }; icon: string; color: string }
> = {
    entertainment: {
        label: { zh: "娱乐", en: "Entertainment" },
        icon: "🎭",
        color: "purple",
    },
    shopping: {
        label: { zh: "购物", en: "Shopping" },
        icon: "🛍️",
        color: "blue",
    },
    food: {
        label: { zh: "美食", en: "Food" },
        icon: "🍜",
        color: "green",
    },
    travel: {
        label: { zh: "旅行", en: "Travel" },
        icon: "✈️",
        color: "yellow",
    },
    fitness: {
        label: { zh: "健身", en: "Fitness" },
        icon: "💪",
        color: "red",
    },
}

export default function HistoryPage() {
    const router = useRouter()
    const { user, isAuthenticated } = useAuth()
    const isIPhone = useIsIPhone()
    const { language } = useLanguage()
    const locale = language as "zh" | "en"
    const t = useTranslations(locale)
    const historyProvider = RegionConfig.database.provider

    // 状态管理
    const [history, setHistory] = useState<RecommendationHistory[]>([])
    const [filteredHistory, setFilteredHistory] = useState<RecommendationHistory[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedCategories, setSelectedCategories] = useState<RecommendationCategory[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [deleteState, setDeleteState] = useState<{
        isDeleting: boolean
        deletingId: string | null
    }>({
        isDeleting: false,
        deletingId: null,
    })
    const [showClearAll, setShowClearAll] = useState(false)
    const [exportLoading, setExportLoading] = useState<string | null>(null)
    const { toast } = useToast()

    // 获取用户订阅等级
    const userTier = user?.subscriptionTier || "free"
    const canExportCSV = userTier === "pro" || userTier === "enterprise"
    const canExportJSON = userTier === "pro" || userTier === "enterprise"
    const canExportPDF = userTier === "enterprise"

    // 导出数据
    const handleExport = async (format: "json" | "csv" | "pdf") => {
        if (!isAuthenticated || !user?.id) return

        setExportLoading(format)
        try {
            const response = await fetchWithAuth(`/api/subscription/export?format=${format}`)

            if (!response.ok) {
                const data = await response.json()
                if (data.upgradeRequired) {
                    toast({
                        title: locale === "zh" ? "需要升级" : "Upgrade Required",
                        description: locale === "zh"
                            ? "请升级到Pro或Enterprise以使用导出功能"
                            : "Please upgrade to Pro or Enterprise to use export feature",
                        variant: "destructive",
                    })
                    return
                }
                throw new Error(data.error || "Export failed")
            }

            if (format === "json") {
                const data = await response.json()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
                downloadBlob(blob, `recommendations_${new Date().toISOString().split("T")[0]}.json`)
            } else if (format === "csv") {
                const blob = await response.blob()
                downloadBlob(blob, `recommendations_${new Date().toISOString().split("T")[0]}.csv`)
            } else if (format === "pdf") {
                const blob = await response.blob()
                downloadBlob(blob, `recommendations_${new Date().toISOString().split("T")[0]}.pdf`)
            }

            toast({
                title: locale === "zh" ? "导出成功" : "Export Successful",
                description: locale === "zh"
                    ? `数据已导出为 ${format.toUpperCase()} 格式`
                    : `Data exported as ${format.toUpperCase()} format`,
            })
        } catch (error: any) {
            console.error("Export error:", error)
            toast({
                title: locale === "zh" ? "导出失败" : "Export Failed",
                description: error.message || (locale === "zh" ? "请重试" : "Please try again"),
                variant: "destructive",
            })
        } finally {
            setExportLoading(null)
        }
    }

    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    // 获取历史记录
    const fetchHistory = useCallback(async () => {
        if (!isAuthenticated || !user?.id) {
            setHistory([])
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        try {
            const response = await fetchWithAuth(
                `/api/recommend/history?userId=${user.id}&limit=500&provider=${historyProvider}`
            )

            if (!response.ok) {
                if (response.status === 401) {
                    // Token 过期或无效，清空历史并提示用户登录
                    setHistory([])
                    console.warn("Auth required to fetch history")
                    return
                }
                throw new Error(`Failed to fetch history: ${response.statusText}`)
            }

            const data = await response.json()
            if (data.success) {
                setHistory(data.data || [])
            } else {
                console.error("Error fetching history:", data.error)
            }
        } catch (error) {
            console.error("Error fetching history:", error)
        } finally {
            setIsLoading(false)
        }
    }, [isAuthenticated, user?.id])

    // 初始化时获取数据
    useEffect(() => {
        fetchHistory()
    }, [fetchHistory])

    // 筛选历史记录
    useEffect(() => {
        let filtered = history

        // 按分类筛选
        if (selectedCategories.length > 0) {
            filtered = filtered.filter((item) => selectedCategories.includes(item.category))
        }

        // 按搜索词筛选
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(
                (item) =>
                    item.title.toLowerCase().includes(query) ||
                    item.description?.toLowerCase().includes(query) ||
                    item.reason?.toLowerCase().includes(query)
            )
        }

        setFilteredHistory(filtered)
    }, [history, selectedCategories, searchQuery])

    // 切换分类筛选
    const toggleCategory = (category: RecommendationCategory) => {
        setSelectedCategories((prev) =>
            prev.includes(category)
                ? prev.filter((c) => c !== category)
                : [...prev, category]
        )
    }

    // 删除单条记录
    const handleDeleteItem = async (itemId: string) => {
        if (!user?.id) return

        setDeleteState({ isDeleting: true, deletingId: itemId })
        try {
            const response = await fetchWithAuth("/api/recommend/history", {
                method: "DELETE",
                body: JSON.stringify({
                    userId: user.id,
                    historyIds: [itemId],
                    provider: historyProvider,
                }),
            })

            if (response.ok) {
                setHistory((prev) => prev.filter((item) => item.id !== itemId))
            } else {
                console.error("Failed to delete item")
            }
        } catch (error) {
            console.error("Error deleting item:", error)
        } finally {
            setDeleteState({ isDeleting: false, deletingId: null })
        }
    }

    // 清空所有历史记录
    const handleClearAll = async () => {
        if (!user?.id) return

        const confirmed = window.confirm(
            locale === "zh"
                ? "确定要清空所有历史记录吗？此操作无法撤销。"
                : "Are you sure you want to clear all history? This action cannot be undone."
        )

        if (!confirmed) return

        setDeleteState({ isDeleting: true, deletingId: null })
        try {
            const response = await fetchWithAuth("/api/recommend/history", {
                method: "PUT",
                body: JSON.stringify({
                    userId: user.id,
                    action: "clear-all",
                    provider: historyProvider,
                }),
            })

            if (response.ok) {
                setHistory([])
                setShowClearAll(false)
            } else {
                console.error("Failed to clear history")
            }
        } catch (error) {
            console.error("Error clearing history:", error)
        } finally {
            setDeleteState({ isDeleting: false, deletingId: null })
        }
    }

    // 清空该分类的历史记录
    const handleClearCategory = async (category: RecommendationCategory) => {
        if (!user?.id) return

        const confirmed = window.confirm(
            locale === "zh"
                ? `确定要删除所有${categoryConfig[category].label.zh}相关的历史记录吗？`
                : `Delete all ${categoryConfig[category].label.en} records?`
        )

        if (!confirmed) return

        setDeleteState({ isDeleting: true, deletingId: null })
        try {
            const response = await fetchWithAuth("/api/recommend/history", {
                method: "DELETE",
                body: JSON.stringify({
                    userId: user.id,
                    category,
                    provider: historyProvider,
                }),
            })

            if (response.ok) {
                setHistory((prev) => prev.filter((item) => item.category !== category))
            } else {
                console.error("Failed to delete category records")
            }
        } catch (error) {
            console.error("Error deleting category records:", error)
        } finally {
            setDeleteState({ isDeleting: false, deletingId: null })
        }
    }

    // 未认证用户处理
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#F7F9FC] p-4">
                <div className="max-w-2xl mx-auto">
                    {/* 返回按钮 */}
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="mb-6">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            {locale === "zh" ? "返回" : "Back"}
                        </Button>
                    </Link>

                    {/* 未登录提示 */}
                    <Card className="p-8 text-center">
                        <h2 className="text-xl font-semibold mb-4">
                            {locale === "zh" ? "需要登录" : "Login Required"}
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {locale === "zh"
                                ? "请登录后查看推荐历史记录"
                                : "Please log in to view your recommendation history"}
                        </p>
                        <Link href="/login">
                            <Button>{locale === "zh" ? "前去登录" : "Go to Login"}</Button>
                        </Link>
                    </Card>
                </div>
            </div>
        )
    }

    const categoryList = Object.keys(categoryConfig) as RecommendationCategory[]
    const categoryCounts = categoryList.map(
        (cat) => history.filter((h) => h.category === cat).length
    )

    return (
        <div className="min-h-screen bg-[#F7F9FC] p-4 pb-20">
            <div className="max-w-3xl mx-auto">
                {/* 头部 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                {locale === "zh" ? "推荐历史" : "Recommendation History"}
                            </h1>
                            <p className="text-gray-600 text-sm">
                                {locale === "zh"
                                    ? `共 ${history.length} 条记录`
                                    : `${history.length} records`}
                            </p>
                        </div>
                    </div>

                    {/* 清空和导出按钮 */}
                    <div className="flex items-center gap-2">
                        {/* 导出按钮 */}
                        {history.length > 0 && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!canExportCSV && !canExportJSON}
                                        className={!canExportCSV && !canExportJSON ? "opacity-50" : ""}
                                    >
                                        {exportLoading ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <Download className="h-4 w-4 mr-2" />
                                        )}
                                        {locale === "zh" ? "导出" : "Export"}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {!canExportCSV && !canExportJSON ? (
                                        <>
                                            <DropdownMenuItem
                                                disabled
                                                className="text-gray-500"
                                            >
                                                <Lock className="h-4 w-4 mr-2" />
                                                {locale === "zh" ? "需要Pro或Enterprise" : "Pro or Enterprise required"}
                                            </DropdownMenuItem>
                                            {!isIPhone && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem asChild>
                                                        <Link href="/pro" className="cursor-pointer">
                                                            <Crown className="h-4 w-4 mr-2 text-amber-500" />
                                                            {locale === "zh" ? "升级计划" : "Upgrade Plan"}
                                                        </Link>
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <DropdownMenuItem
                                                onClick={() => handleExport("csv")}
                                                disabled={!canExportCSV || exportLoading === "csv"}
                                            >
                                                <FileText className="h-4 w-4 mr-2" />
                                                CSV
                                                {!canExportCSV && <Lock className="h-3 w-3 ml-2 text-gray-400" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleExport("json")}
                                                disabled={!canExportJSON || exportLoading === "json"}
                                            >
                                                <FileJson className="h-4 w-4 mr-2" />
                                                JSON
                                                {!canExportJSON && <Lock className="h-3 w-3 ml-2 text-gray-400" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleExport("pdf")}
                                                disabled={!canExportPDF || exportLoading === "pdf"}
                                            >
                                                <FileType2 className="h-4 w-4 mr-2" />
                                                PDF
                                                {!canExportPDF && (
                                                    <Badge variant="outline" className="ml-2 text-xs">Enterprise</Badge>
                                                )}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {/* 清空按钮 */}
                        {history.length > 0 && (
                            <motion.div
                                animate={{
                                    opacity: showClearAll ? 1 : 0.5,
                                }}
                            >
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setShowClearAll(!showClearAll)}
                                    disabled={deleteState.isDeleting}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {locale === "zh" ? "清空" : "Clear"}
                                </Button>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* 搜索框 */}
                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder={locale === "zh" ? "搜索历史记录..." : "Search history..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* 分类筛选 */}
                <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">
                        {locale === "zh" ? "按分类筛选" : "Filter by Category"}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                        {categoryList.map((category, index) => {
                            const config = categoryConfig[category]
                            const count = categoryCounts[index]

                            return (
                                <motion.button
                                    key={category}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => toggleCategory(category)}
                                    className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium transition-all ${selectedCategories.includes(category)
                                            ? "bg-blue-500 text-white shadow-md"
                                            : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                                        }`}
                                >
                                    <span>{config.icon}</span>
                                    {config.label[locale]}
                                    {count > 0 && (
                                        <Badge
                                            variant={
                                                selectedCategories.includes(category) ? "secondary" : "outline"
                                            }
                                            className="text-xs ml-1"
                                        >
                                            {count}
                                        </Badge>
                                    )}
                                </motion.button>
                            )
                        })}
                    </div>
                </div>

                {/* 清空确认 */}
                <AnimatePresence>
                    {showClearAll && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
                        >
                            <p className="text-sm text-red-800 mb-3">
                                {locale === "zh"
                                    ? "确定要清空所有历史记录吗？此操作无法撤销。"
                                    : "Delete all records? This action cannot be undone."}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={handleClearAll}
                                    disabled={deleteState.isDeleting}
                                >
                                    {deleteState.isDeleting ? (
                                        <span className="animate-spin">⏳</span>
                                    ) : null}
                                    {locale === "zh" ? "确认删除" : "Confirm Delete"}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowClearAll(false)}
                                    disabled={deleteState.isDeleting}
                                >
                                    {locale === "zh" ? "取消" : "Cancel"}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 历史列表 */}
                <div className="space-y-3">
                    {isLoading ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-12 text-center"
                        >
                            <div className="inline-block">
                                <div className="animate-spin text-2xl">⏳</div>
                            </div>
                            <p className="text-gray-500 mt-4">
                                {locale === "zh" ? "加载中..." : "Loading..."}
                            </p>
                        </motion.div>
                    ) : filteredHistory.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-12 text-center"
                        >
                            <div className="text-4xl mb-4">📭</div>
                            <h3 className="text-lg font-medium text-gray-700 mb-2">
                                {locale === "zh"
                                    ? searchQuery
                                        ? "没有找到匹配的记录"
                                        : "暂无推荐历史"
                                    : searchQuery
                                        ? "No matching records"
                                        : "No recommendation history"}
                            </h3>
                            <p className="text-gray-500 mb-6">
                                {locale === "zh"
                                    ? searchQuery
                                        ? "尝试不同的搜索词"
                                        : "开始推荐以生成历史记录"
                                    : searchQuery
                                        ? "Try different search terms"
                                        : "Start exploring recommendations"}
                            </p>
                            <Link href="/">
                                <Button variant="outline">
                                    {locale === "zh" ? "去推荐" : "Go to Explore"}
                                </Button>
                            </Link>
                        </motion.div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {filteredHistory.map((item, index) => (
                                <HistoryCard
                                    key={item.id}
                                    item={item}
                                    onDelete={handleDeleteItem}
                                    isDeleting={deleteState.deletingId === item.id && deleteState.isDeleting}
                                    locale={locale}
                                />
                            ))}
                        </AnimatePresence>
                    )}
                </div>

                {/* 统计信息 */}
                {history.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-12 p-6 bg-white rounded-lg border border-gray-200"
                    >
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">
                            {locale === "zh" ? "统计信息" : "Statistics"}
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {categoryList.map((category, index) => {
                                const config = categoryConfig[category]
                                const count = categoryCounts[index]
                                const clickedCount = history.filter(
                                    (h) => h.category === category && h.clicked
                                ).length
                                const savedCount = history.filter(
                                    (h) => h.category === category && h.saved
                                ).length

                                return (
                                    <motion.div
                                        key={category}
                                        whileHover={{ scale: 1.05 }}
                                        className="p-4 bg-gray-50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">{config.icon}</span>
                                            <span className="font-semibold text-gray-700">
                                                {config.label[locale]}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-600 space-y-1">
                                            <p>
                                                {locale === "zh" ? "推荐" : "Total"}:{" "}
                                                <span className="font-bold text-gray-800">{count}</span>
                                            </p>
                                            {count > 0 && (
                                                <>
                                                    <p>
                                                        {locale === "zh" ? "点击" : "Clicked"}:{" "}
                                                        <span className="font-bold text-blue-600">
                                                            {clickedCount}
                                                        </span>
                                                    </p>
                                                    <p>
                                                        {locale === "zh" ? "收藏" : "Saved"}:{" "}
                                                        <span className="font-bold text-green-600">
                                                            {savedCount}
                                                        </span>
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
