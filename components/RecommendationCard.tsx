"use client";

/**
 * AI 推荐卡片组件
 * 显示推荐内容，包含可点击的外部链接
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AIRecommendation, RecommendationCategory } from "@/lib/types/recommendation";
import { TravelRecommendationCard } from "./TravelRecommendationCard";
import { getIconForLinkType } from "@/lib/utils/icon-mapping";
import { buildOutboundHref } from "@/lib/outbound/outbound-url";
import { getClientHint } from "@/lib/app/app-container";
import { normalizeLegacyEntertainmentRecommendation } from "@/lib/recommendation/legacy-entertainment-normalizer";
import {
  buildFallbackCandidateLink,
  launchRecommendationViaGestureOrOutbound,
} from "@/lib/outbound/client-gesture-launch";

// 图标组件
const ExternalLinkIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg
    className={`w-4 h-4 ${filled ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
    viewBox="0 0 24 24"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const LinkTypeIcon = ({ linkType, metadata }: { linkType: string; metadata?: any }) => {
  const icon = getIconForLinkType(linkType, metadata);
  return <span className="text-lg">{icon}</span>;
};

interface RecommendationCardProps {
  recommendation: AIRecommendation;
  category: RecommendationCategory;
  onLinkClick?: (recommendation: AIRecommendation) => void;
  onSave?: (recommendation: AIRecommendation) => void;
  onDismiss?: (recommendation: AIRecommendation) => void;
  showReason?: boolean;
  compact?: boolean;
  locale?: "zh" | "en";
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
};

const recommendationCardText = {
  zh: {
    recipe: "食谱",
    delivery: "外卖",
    review: "点评",
    nearby: "附近餐厅",
    restaurant: "餐厅",
    food: "美食",
    calories: "卡路里",
    bestSeason: "最佳季节：",
    highlights: "✨ 旅行亮点",
    aiPick: "推荐",
    save: "收藏",
    notInterested: "不感兴趣",
    viewDetails: "查看详情",
  },
  en: {
    recipe: "Recipe",
    delivery: "Delivery",
    review: "Review",
    nearby: "Nearby",
    restaurant: "Restaurant",
    food: "Food",
    calories: "cal",
    bestSeason: "Best Season: ",
    highlights: "✨ Highlights",
    aiPick: "Pick",
    save: "Save",
    notInterested: "Not interested",
    viewDetails: "View Details",
  },
} as const;

export function RecommendationCard({
  recommendation,
  category,
  onLinkClick,
  onSave,
  onDismiss,
  showReason = true,
  compact = false,
  locale = "zh",
}: RecommendationCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const normalizedRecommendation = normalizeLegacyEntertainmentRecommendation(recommendation);
  const text = recommendationCardText[locale];

  const {
    title,
    description,
    link,
    linkType,
    platform,
    metadata,
    reason,
    tags,
  } = normalizedRecommendation;
  const fitnessTypeLabel =
    category === "fitness" ? (metadata as any)?.fitnessTypeLabel : null;
  const badgeLabel = (() => {
    const fallback = linkTypeLabels[linkType]?.[locale] || linkType;
    if (category !== "food") return fallback;

    const platformText = platform || "";
    const tagList = tags || (metadata?.tags as string[] | undefined) || [];
    const tagText = tagList.join(" ");
    const combined = `${platformText} ${tagText}`.trim();

    const isRecipe =
      linkType === "recipe" ||
      /下厨房|Allrecipes/.test(platformText) ||
      /(食谱|菜谱|做法|recipe)/i.test(combined);
    if (isRecipe) return text.recipe;

    // 外卖平台：淘宝闪购、京东秒送、美团外卖
    const isDelivery = /淘宝闪购|京东秒送|美团外卖|DoorDash|Uber Eats|Fantuan|HungryPanda/.test(platformText);
    if (isDelivery) return text.delivery;

    // 点评平台：小红书、大众点评
    const isReview = /大众点评|小红书/.test(platformText) || /(点评|评价|口碑|评分)/.test(tagText);
    if (isReview) return text.review;

    // 附近餐厅：高德地图
    const isNearbyRestaurant = /高德地图/.test(platformText);
    if (isNearbyRestaurant) return text.nearby;

    const isRestaurant =
      linkType === "restaurant" ||
      /地图|美团|Google Maps|OpenTable|TripAdvisor/.test(platformText);
    if (isRestaurant) return text.restaurant;

    return text.food;
  })();

  const handleLinkClick = () => {
    onLinkClick?.(normalizedRecommendation);
    const inAppContainer = getClientHint() === "app";
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile =
      /iphone|ipad|ipod|android/i.test(ua) ||
      (typeof window !== "undefined" && window.innerWidth < 768);

    if (inAppContainer || isMobile) {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/";
      const candidateLink =
        normalizedRecommendation.candidateLink ?? buildFallbackCandidateLink(normalizedRecommendation);
      const outboundHref = buildOutboundHref(candidateLink, returnTo);

      if (candidateLink.primary.type === "web" && candidateLink.fallbacks.length === 0) {
        window.location.href = outboundHref;
        return;
      }

      launchRecommendationViaGestureOrOutbound(normalizedRecommendation, returnTo);
      return;
    }

    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
    if (!isSaved) {
      onSave?.(normalizedRecommendation);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(normalizedRecommendation);
  };

  // 渲染评分星星
  const renderRating = (rating: number | string | undefined) => {
    if (!rating) return null;

    // 转换为数字
    const ratingNum = typeof rating === 'string' ? parseFloat(rating) : rating;

    // 如果转换失败或不是有效的数字，返回 null
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      return null;
    }

    const fullStars = Math.floor(ratingNum);
    const hasHalfStar = ratingNum % 1 >= 0.5;
    const stars = [];

    for (let i = 0; i < 5; i++) {
      stars.push(
        <StarIcon key={i} filled={i < fullStars || (i === fullStars && hasHalfStar)} />
      );
    }

    return (
      <div className="flex items-center gap-1">
        {stars}
        <span className="text-sm text-gray-600 ml-1">{ratingNum.toFixed(1)}</span>
      </div>
    );
  };

  // 渲染元数据
  const renderMetadata = () => {
    const items: React.ReactNode[] = [];

    if (metadata.price) {
      items.push(
        <span key="price" className="text-lg font-bold text-[#FF6B6B]">
          {metadata.price}
        </span>
      );
    }

    if (metadata.rating) {
      items.push(
        <div key="rating">{renderRating(metadata.rating)}</div>
      );
    }

    if (metadata.duration) {
      items.push(
        <span key="duration" className="text-sm text-gray-500">
          ⏱️ {metadata.duration}
        </span>
      );
    }

    if (metadata.calories) {
      items.push(
        <span key="calories" className="text-sm text-[#4ECDC4]">
          🔥 {metadata.calories} {text.calories}
        </span>
      );
    }

    if (metadata.author) {
      items.push(
        <span key="author" className="text-sm text-gray-500">
          ✍️ {metadata.author}
        </span>
      );
    }

    if (metadata.address) {
      items.push(
        <span key="address" className="text-sm text-gray-500 truncate max-w-[200px]">
          📍 {metadata.address}
        </span>
      );
    }

    // 旅行推荐特殊信息显示
    if (category === 'travel' && metadata.destination) {
      const destination = metadata.destination as any;
      if (destination.country) {
        items.push(
          <span key="country" className="text-sm text-gray-500">
            🌍 {destination.country}
          </span>
        );
      }
      if (metadata.bestSeason) {
        const bestSeason = metadata.bestSeason as any;
        items.push(
            <span key="season" className="text-sm text-orange-500">
              🗓️ {text.bestSeason}{bestSeason}
            </span>
        );
      }
    }

    return items.length > 0 ? (
      <div className="flex flex-wrap items-center gap-3 mt-2">
        {items}
      </div>
    ) : null;
  };

  // 渲染旅行亮点
  const renderTravelHighlights = () => {
    if (category !== 'travel' || !metadata.highlights || !Array.isArray(metadata.highlights)) {
      return null;
    }

    return (
      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          {text.highlights}
        </h4>
        <div className="flex flex-wrap gap-2">
          {metadata.highlights.map((highlight: string, index: number) => (
            <span
              key={index}
              className="inline-block px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
            >
              {highlight}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // 渲染标签
  const renderTags = () => {
    // 使用 tags 属性或 metadata.tags 作为后备
    const tagList = tags || (metadata.tags as string[] | undefined);
    if (!tagList || tagList.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {tagList.slice(0, 4).map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="text-xs bg-gray-100 text-gray-600"
          >
            {tag}
          </Badge>
        ))}
      </div>
    );
  };

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card
          className="p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={handleLinkClick}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <LinkTypeIcon linkType={linkType} metadata={metadata} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-800 truncate">{title}</h4>
              <p className="text-sm text-gray-500 truncate">{description}</p>
            </div>
            <ExternalLinkIcon />
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card className="overflow-hidden">
        {/* 卡片头部 */}
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#4ECDC4] text-white">
                <LinkTypeIcon linkType={linkType} metadata={metadata} />
                <span className="ml-1">
                  {badgeLabel}
                </span>
              </Badge>
              {fitnessTypeLabel && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  {fitnessTypeLabel}
                </Badge>
              )}
              {showReason && reason && (
                <Badge variant="outline" className="text-xs">
                  AI {text.aiPick}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleSave}
                className={`p-1.5 rounded-full transition-colors ${isSaved
                  ? "bg-red-100 text-red-500"
                  : "bg-gray-100 text-gray-400 hover:text-red-500"
                  }`}
                title={text.save}
              >
                <svg
                  className="w-4 h-4"
                  fill={isSaved ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-full bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title={text.notInterested}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 卡片内容 */}
        <div className="px-4 pb-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
          <p className="text-gray-600 text-sm line-clamp-2">{description}</p>

          {renderMetadata()}
          {renderTags()}
          {renderTravelHighlights()}
        </div>

        {/* 推荐理由 */}
        {showReason && reason && (
          <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 border-t">
            <p className="text-sm text-purple-700">
              <span className="font-medium">
                {locale === "zh" ? "💡 推荐理由：" : "💡 Recommendation: "}
              </span>
              {reason}
            </p>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="p-4 pt-2 border-t bg-gray-50">
          {/* 显示平台信息（仅对搜索链接） */}
          {linkType === 'search' && platform && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2 bg-gray-100 p-2 rounded">
              <LinkTypeIcon linkType={linkType} metadata={metadata} />
              <span>
                {locale === "zh" ? `将在 ${platform} 中搜索` : `Search on ${platform}`}
              </span>
            </div>
          )}

          <Button
            onClick={handleLinkClick}
            className="w-full bg-[#FF6B6B] hover:bg-[#FF5252] text-white"
          >
            <span>
              {linkType === 'search' && platform
                ? (locale === "zh" ? `在 ${platform} 中搜索` : `Search on ${platform}`)
                : text.viewDetails
              }
            </span>
            <ExternalLinkIcon />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

/**
 * 推荐卡片列表组件
 */
interface RecommendationListProps {
  recommendations: AIRecommendation[];
  category: RecommendationCategory;
  onLinkClick?: (recommendation: AIRecommendation) => void;
  onSave?: (recommendation: AIRecommendation) => void;
  onDismiss?: (recommendation: AIRecommendation) => void;
  showReason?: boolean;
  compact?: boolean;
  locale?: "zh" | "en";
}

export function RecommendationList({
  recommendations,
  category,
  onLinkClick,
  onSave,
  onDismiss,
  showReason = true,
  compact = false,
  locale = "zh",
}: RecommendationListProps) {
  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {recommendations.map((rec, index) => {
        // Staggered animation delay for streaming effect
        const animationDelay = index * 0.1;

        // 如果是旅行类别且不是紧凑模式，使用专门的旅行卡片
        if (category === 'travel' && !compact) {
          return (
            <motion.div
              key={`${rec.title}-${index}`}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.4,
                delay: animationDelay,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
            >
              <TravelRecommendationCard
                recommendation={rec}
                onLinkClick={onLinkClick}
                onSave={onSave}
                onDismiss={onDismiss}
                locale={locale}
              />
            </motion.div>
          );
        }

        // 其他情况使用通用卡片，带有流式动画效果
        return (
          <motion.div
            key={`${rec.title}-${index}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.4,
              delay: animationDelay,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
          >
            <RecommendationCard
              recommendation={rec}
              category={category}
              onLinkClick={onLinkClick}
              onSave={onSave}
              onDismiss={onDismiss}
              showReason={showReason}
              compact={compact}
              locale={locale}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

export default RecommendationCard;

