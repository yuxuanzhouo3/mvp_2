"use client"

/**
 * 历史记录卡片组件
 * 显示单条推荐历史，支持滑动删除和点击删除
 */

import { useState, forwardRef } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CandidateLink, RecommendationHistory, RecommendationCategory } from "@/lib/types/recommendation"
import { buildOutboundHref } from "@/lib/outbound/outbound-url"
import { getClientHint } from "@/lib/app/app-container"
import { X, ExternalLink } from "lucide-react"

interface HistoryCardProps {
    item: RecommendationHistory
    onDelete?: (itemId: string) => Promise<void>
    onLink?: (item: RecommendationHistory) => void
    isDeleting?: boolean
    locale?: "zh" | "en"
}

/**
 * 分类图标
 */
const categoryIcons: Record<RecommendationCategory, string> = {
    entertainment: "🎭",
    shopping: "🛍️",
    food: "🍜",
    travel: "✈️",
    fitness: "💪",
}

/**
 * 链接类型标签
 */
const linkTypeLabels: Record<string, { zh: string; en: string }> = {
    product: { zh: "商品", en: "Product" },
    video: { zh: "视频", en: "Video" },
    book: { zh: "图书", en: "Book" },
    location: { zh: "地点", en: "Location" },
    article: { zh: "文章", en: "Article" },
    app: { zh: "应用", en: "App" },
    music: { zh: "音乐", en: "Music" },
    movie: { zh: "电影", en: "Movie" },
    game: { zh: "游戏", en: "Game" },
    restaurant: { zh: "餐厅", en: "Restaurant" },
    recipe: { zh: "食谱", en: "Recipe" },
    hotel: { zh: "酒店", en: "Hotel" },
    course: { zh: "课程", en: "Course" },
    search: { zh: "搜索", en: "Search" },
}

/**
 * 格式化日期
 */
function formatDate(dateString: string, locale: "zh" | "en" = "zh"): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (locale === "zh") {
        if (diffDays === 0) {
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffTime / (1000 * 60))
                return diffMinutes === 0 ? "刚刚" : `${diffMinutes}分钟前`
            }
            return `${diffHours}小时前`
        }
        if (diffDays === 1) return "昨天"
        if (diffDays < 7) return `${diffDays}天前`
        return date.toLocaleDateString("zh-CN")
    } else {
        if (diffDays === 0) {
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
            if (diffHours === 0) {
                const diffMinutes = Math.floor(diffTime / (1000 * 60))
                return diffMinutes === 0 ? "just now" : `${diffMinutes}m ago`
            }
            return `${diffHours}h ago`
        }
        if (diffDays === 1) return "yesterday"
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString("en-US")
    }
}

const HistoryCardComponent = forwardRef<HTMLDivElement, HistoryCardProps>(
    (
        {
            item,
            onDelete,
            onLink,
            isDeleting = false,
            locale = "zh",
        },
        ref
    ) => {
        const [isDeletingLocal, setIsDeletingLocal] = useState(false)
        const [showDeleteButton, setShowDeleteButton] = useState(false)
        const [startX, setStartX] = useState(0)
        const [currentX, setCurrentX] = useState(0)

        const linkTypeLabel = item.link_type
            ? linkTypeLabels[item.link_type]?.[locale] || item.link_type
            : locale === "zh"
                ? "链接"
                : "Link"

        const buildFallbackCandidateLink = (): CandidateLink => {
            return {
                provider: (item.metadata as any)?.platform || "Web",
                title: item.title,
                primary: { type: "web", url: item.link, label: "Web" },
                fallbacks: [],
                metadata: {
                    source: "history_client_fallback",
                    category: item.category,
                    platform: (item.metadata as any)?.platform,
                },
            }
        }

        // 处理删除
        const handleDelete = async () => {
            setIsDeletingLocal(true)
            try {
                await onDelete?.(item.id)
            } finally {
                setIsDeletingLocal(false)
            }
        }

        // 处理链接点击
        const handleLinkClick = () => {
            onLink?.(item)
            if (item.link) {
                const inAppContainer = getClientHint() === "app"
                const ua = typeof navigator !== "undefined" ? navigator.userAgent : ""
                const isMobile =
                    /iphone|ipad|ipod|android/i.test(ua) ||
                    (typeof window !== "undefined" && window.innerWidth < 768)
                const candidateLink = ((item.metadata as any)?.candidateLink || buildFallbackCandidateLink()) as CandidateLink
                if (inAppContainer || isMobile) {
                    const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/"
                    window.location.href = buildOutboundHref(candidateLink, returnTo)
                    return
                }
                window.open(item.link, "_blank", "noopener,noreferrer")
            }
        }

        // 触摸开始
        const handleTouchStart = (e: React.TouchEvent) => {
            setStartX(e.touches[0].clientX)
        }

        // 触摸移动
        const handleTouchMove = (e: React.TouchEvent) => {
            const currentXPos = e.touches[0].clientX
            const diff = currentXPos - startX

            // 只处理向左滑动（负数）
            if (diff < 0) {
                setCurrentX(Math.max(diff, -100))
            }
        }

        // 触摸结束
        const handleTouchEnd = () => {
            if (currentX < -50) {
                // 滑动超过50px时显示删除按钮
                setShowDeleteButton(true)
                setCurrentX(-80)
            } else {
                // 恢复原位
                setCurrentX(0)
                setShowDeleteButton(false)
            }
        }

        // 鼠标滑动模拟（用于桌面端）
        const handleMouseDown = (e: React.MouseEvent) => {
            if (e.button !== 0) return // 只处理左键
            setStartX(e.clientX)
        }

        const handleMouseMove = (e: React.MouseEvent) => {
            if (startX === 0) return
            const diff = e.clientX - startX
            if (diff < 0) {
                setCurrentX(Math.max(diff, -100))
            }
        }

        const handleMouseUp = () => {
            if (currentX < -50) {
                setShowDeleteButton(true)
                setCurrentX(-80)
            } else {
                setCurrentX(0)
                setShowDeleteButton(false)
            }
            setStartX(0)
        }

        // 取消删除（点击卡片恢复）
        const handleCancel = (e: React.MouseEvent) => {
            e.stopPropagation()
            setShowDeleteButton(false)
            setCurrentX(0)
        }

        return (
            <motion.div
                layout
                initial={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="relative overflow-hidden"
            >
                <div
                    ref={ref}
                    className="relative"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* 删除按钮背景 */}
                    <motion.div
                        className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4 z-0"
                        style={{
                            opacity: Math.abs(currentX) / 100,
                        }}
                    >
                        <span className="text-white text-sm font-medium">
                            {locale === "zh" ? "删除" : "Delete"}
                        </span>
                    </motion.div>

                    {/* 卡片内容 */}
                    <motion.div
                        drag="x"
                        dragElastic={0.2}
                        dragConstraints={{ left: -100, right: 0 }}
                        onDragEnd={(e, info) => {
                            if (info.offset.x < -50) {
                                setShowDeleteButton(true)
                                setCurrentX(-80)
                            } else {
                                setShowDeleteButton(false)
                                setCurrentX(0)
                            }
                        }}
                        style={{
                            x: showDeleteButton ? -80 : 0,
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="relative z-10"
                    >
                        <Card
                            className={`p-4 cursor-pointer transition-colors ${isDeleting || isDeletingLocal
                                ? "opacity-50 bg-gray-100"
                                : "hover:bg-gray-50"
                                }`}
                            onClick={handleCancel}
                        >
                            {/* 内容容器 */}
                            <div className="flex items-start gap-3">
                                {/* 分类图标 */}
                                <div className="text-2xl flex-shrink-0">
                                    {categoryIcons[item.category]}
                                </div>

                                {/* 主要内容 */}
                                <div className="flex-1 min-w-0">
                                    {/* 标题和删除按钮 */}
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                                            {item.title}
                                        </h3>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-6 w-6 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ${showDeleteButton ? "opacity-100" : "opacity-0 hover:opacity-100"
                                                }`}
                                            disabled={isDeleting || isDeletingLocal}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleDelete()
                                            }}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* 描述 */}
                                    {item.description && (
                                        <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                                            {item.description}
                                        </p>
                                    )}

                                    {/* 标签和元数据 */}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        {/* 链接类型标签 */}
                                        <Badge variant="secondary" className="text-xs">
                                            {linkTypeLabel}
                                        </Badge>

                                        {/* 推荐理由（可选） */}
                                        {item.reason && (
                                            <span className="text-xs text-gray-500">
                                                {item.reason.length > 30
                                                    ? `${item.reason.slice(0, 30)}...`
                                                    : item.reason}
                                            </span>
                                        )}

                                        {/* 时间 */}
                                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                                            {formatDate(item.created_at, locale)}
                                        </span>
                                    </div>

                                    {/* 元数据显示 */}
                                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                            {(item.metadata as any).rating && (
                                                <span>⭐ {(item.metadata as any).rating}</span>
                                            )}
                                            {(item.metadata as any).price && (
                                                <span className="font-semibold text-orange-600">
                                                    {(item.metadata as any).price}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 打开链接按钮 */}
                                {!showDeleteButton && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-blue-500 hover:text-blue-700 transition-colors flex-shrink-0"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleLinkClick()
                                        }}
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </Card>
                    </motion.div>

                    {/* 删除确认提示 */}
                    {showDeleteButton && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-red-500 flex items-center justify-end pr-4 z-0 rounded-lg"
                        >
                            <div
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete()
                                }}
                            >
                                <span className="text-white text-sm font-medium">
                                    {locale === "zh" ? "确认删除？" : "Confirm delete?"}
                                </span>
                                <X className="w-4 h-4 text-white" />
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        )
    }
)

HistoryCardComponent.displayName = "HistoryCard"

export const HistoryCard = HistoryCardComponent
