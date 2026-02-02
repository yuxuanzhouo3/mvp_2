"use client";

/**
 * Random Travel 专用推荐卡片
 * 展示具体的旅游目的地信息
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AIRecommendation, CandidateLink } from "@/lib/types/recommendation";
import { buildOutboundHref } from "@/lib/outbound/outbound-url";
import { getClientHint } from "@/lib/app/app-container";

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

const LocationIcon = () => (
  <svg
    className="w-5 h-5 text-blue-500"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
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

interface TravelRecommendationCardProps {
  recommendation: AIRecommendation;
  onLinkClick?: (recommendation: AIRecommendation) => void;
  onSave?: (recommendation: AIRecommendation) => void;
  onDismiss?: (recommendation: AIRecommendation) => void;
  locale?: "zh" | "en";
}

export function TravelRecommendationCard({
  recommendation,
  onLinkClick,
  onSave,
  onDismiss,
  locale = "zh",
}: TravelRecommendationCardProps) {
  const [isSaved, setIsSaved] = useState(false);

  const {
    title,
    description,
    link,
    linkType,
    platform,
    metadata,
    reason,
  } = recommendation;

  const buildFallbackCandidateLink = (rec: AIRecommendation): CandidateLink => {
    return {
      provider: rec.platform || "Web",
      title: rec.title,
      primary: { type: "web", url: rec.link, label: "Web" },
      fallbacks: [],
      metadata: {
        source: "client_fallback",
        category: rec.category,
        platform: rec.platform,
      },
    };
  };

  const handleLinkClick = () => {
    onLinkClick?.(recommendation);
    const inAppContainer = getClientHint() === "app";
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isMobile =
      /iphone|ipad|ipod|android/i.test(ua) ||
      (typeof window !== "undefined" && window.innerWidth < 768);
    if (inAppContainer) {
      const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
      const candidateLink = recommendation.candidateLink ?? buildFallbackCandidateLink(recommendation);
      window.location.href = buildOutboundHref(candidateLink, returnTo);
      return;
    }
    if (isMobile && recommendation.candidateLink) {
      const returnTo = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/";
      window.location.href = buildOutboundHref(recommendation.candidateLink, returnTo);
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
    if (!isSaved) {
      onSave?.(recommendation);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(recommendation);
  };

  // 提取国家信息
  const extractCountryFromTitle = (title: string): string | null => {
    const countryPatterns = [
      { name: "日本", patterns: ["日本", "Japan", "东京", "Tokyo", "京都", "Kyoto", "大阪", "Osaka"] },
      { name: "泰国", patterns: ["泰国", "Thailand", "普吉", "Phuket", "曼谷", "Bangkok"] },
      { name: "法国", patterns: ["法国", "France", "巴黎", "Paris", "尼斯", "Nice"] },
      { name: "美国", patterns: ["美国", "USA", "纽约", "New York", "洛杉矶", "LA", "旧金山", "San Francisco"] },
      { name: "英国", patterns: ["英国", "UK", "伦敦", "London"] },
      { name: "意大利", patterns: ["意大利", "Italy", "罗马", "Rome", "威尼斯", "Venice", "米兰", "Milan"] },
      { name: "西班牙", patterns: ["西班牙", "Spain", "巴塞罗那", "Barcelona", "马德里", "Madrid"] },
      { name: "印度尼西亚", patterns: ["印度尼西亚", "Indonesia", "巴厘岛", "Bali"] },
      { name: "韩国", patterns: ["韩国", "Korea", "首尔", "Seoul", "釜山", "Busan"] },
      { name: "新加坡", patterns: ["新加坡", "Singapore"] },
    ];

    for (const country of countryPatterns) {
      if (country.patterns.some(pattern => title.includes(pattern))) {
        return country.name;
      }
    }
    return null;
  };

  const country = (metadata.destination as any)?.country || extractCountryFromTitle(title);

  // 获取国家对应的国旗 emoji
  const getCountryFlag = (countryName: string | null): string => {
    const flags: Record<string, string> = {
      "日本": "🇯🇵",
      "泰国": "🇹🇭",
      "法国": "🇫🇷",
      "美国": "🇺🇸",
      "英国": "🇬🇧",
      "意大利": "🇮🇹",
      "西班牙": "🇪🇸",
      "印度尼西亚": "🇮🇩",
      "韩国": "🇰🇷",
      "新加坡": "🇸🇬",
    };
    return countryName ? flags[countryName] || "🌍" : "🌍";
  };

  // 渲染评分
  const renderRating = (rating: number | string | undefined) => {
    if (!rating) return null;
    const ratingNum = typeof rating === 'string' ? parseFloat(rating) : rating;
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) return null;

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

  // 渲染亮点
  const renderHighlights = () => {
    const highlights = metadata.highlights as string[] | undefined;
    if (!highlights || highlights.length === 0) return null;

    return (
      <div className="mt-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          {locale === "zh" ? "✨ 亮点" : "✨ Highlights"}
        </h4>
        <div className="flex flex-wrap gap-2">
          {highlights.slice(0, 4).map((highlight, index) => (
            <span
              key={index}
              className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
            >
              {highlight}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
        {/* 顶部图片区域（渐变背景） */}
        <div className="h-32 bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400 relative">
          <div className="absolute inset-0 bg-black bg-opacity-20" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center justify-between">
              <Badge className="bg-white text-gray-800 text-xs font-medium">
                <LocationIcon />
                <span className="ml-1">
                  {locale === "zh" ? "旅游目的地" : "Travel Destination"}
                </span>
              </Badge>
              {country && (
                <div className="flex items-center gap-1">
                  <span className="text-lg">{getCountryFlag(country)}</span>
                  <span className="text-white text-sm font-medium bg-black bg-opacity-30 px-2 py-1 rounded">
                    {country}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-4">
          {/* 标题和操作按钮 */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-bold text-gray-800 line-clamp-1 flex-1 mr-2">
              {title}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={handleSave}
                className={`p-2 rounded-full transition-colors ${isSaved
                    ? "bg-red-100 text-red-500"
                    : "bg-gray-100 text-gray-400 hover:text-red-500"
                  }`}
                title={locale === "zh" ? "收藏" : "Save"}
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
                className="p-2 rounded-full bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title={locale === "zh" ? "不感兴趣" : "Not interested"}
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

          {/* 描述 */}
          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{description}</p>

          {/* 元数据 */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {metadata.rating && renderRating(metadata.rating)}
            {metadata.price && (
              <span className="text-sm font-semibold text-orange-500">
                {metadata.price}
              </span>
            )}
            {(metadata.bestSeason as any) && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                🗓️ {locale === "zh" ? "最佳季节" : "Best Season"}: {(metadata.bestSeason as any)}
              </span>
            )}
          </div>

          {/* 亮点 */}
          {renderHighlights()}

          {/* 推荐理由 */}
          {reason && (
            <div className="mt-3 p-3 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700">
                <span className="font-semibold">
                  {locale === "zh" ? "💡 推荐：" : "💡 Why visit: "}
                </span>
                {reason}
              </p>
            </div>
          )}

          {/* 平台信息 */}
          {platform && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>
                {locale === "zh" ? "通过" : "Via"} {platform}
                {linkType === 'search' && (
                  <span> {locale === "zh" ? "搜索" : "Search"}</span>
                )}
              </span>
              <span>
                {locale === "zh" ? "AI 推荐" : "AI Recommended"}
              </span>
            </div>
          )}
        </div>

        {/* 底部操作按钮 */}
        <div className="px-4 pb-4">
          <Button
            onClick={handleLinkClick}
            className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-medium"
            size="sm"
          >
            {locale === "zh" ? "查看详情" : "View Details"}
            <ExternalLinkIcon />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

export default TravelRecommendationCard;
