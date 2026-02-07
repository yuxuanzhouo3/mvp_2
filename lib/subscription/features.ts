/**
 * 订阅功能限制配置 - 国际版 (INTL)
 *
 * 定义各个订阅等级的功能限制和权限
 */

import { PlanType } from "../payment/payment-config";

/**
 * 功能限制配置接口
 */
export interface PlanFeatures {
  // 推荐次数限制
  recommendationLimit: number; // -1 表示无限
  recommendationPeriod: "daily" | "monthly"; // 计数周期

  // 人物画像维度
  profileDimensions: number;

  // 推荐理由详细程度
  recommendationReasonLevel: "basic" | "enhanced" | "full";

  // 历史记录保留天数
  historyRetentionDays: number;

  // 支持的功能类别
  categories: string[];

  // 是否支持批量推荐
  batchRecommendation: boolean;

  // 是否支持数据导出
  dataExport: boolean;
  exportFormats: string[];

  // 是否支持增强搜索
  enhancedSearch: boolean;

  // 是否可查看推荐决策过程
  viewDecisionProcess: boolean;

  // 响应优先级 (1=最高, 3=最低)
  responsePriority: number;
  responseTimeHours: number;

  // AI 超级助手使用次数限制（-1 无限）
  assistantLimit: number;
  // AI 超级助手计数周期
  assistantPeriod: "total" | "daily";
}

/**
 * 各计划的功能配置
 */
export const PLAN_FEATURES: Record<PlanType, PlanFeatures> = {
  free: {
    recommendationLimit: 30,
    recommendationPeriod: "monthly",
    profileDimensions: 3,
    recommendationReasonLevel: "basic",
    historyRetentionDays: 7,
    categories: ["entertainment", "shopping", "food", "travel", "fitness"],
    batchRecommendation: false,
    dataExport: false,
    exportFormats: [],
    enhancedSearch: false,
    viewDecisionProcess: false,
    responsePriority: 3,
    responseTimeHours: 72,
    assistantLimit: 3,
    assistantPeriod: "total",
  },
  pro: {
    recommendationLimit: 30,
    recommendationPeriod: "daily",
    profileDimensions: 15,
    recommendationReasonLevel: "enhanced",
    historyRetentionDays: 90,
    categories: ["entertainment", "shopping", "food", "travel", "fitness", "education", "health", "technology", "finance", "lifestyle"],
    batchRecommendation: true,
    dataExport: true,
    exportFormats: ["json", "csv"],
    enhancedSearch: true,
    viewDecisionProcess: false,
    responsePriority: 2,
    responseTimeHours: 24,
    assistantLimit: 10,
    assistantPeriod: "daily",
  },
  enterprise: {
    recommendationLimit: -1, // 无限
    recommendationPeriod: "daily",
    profileDimensions: 30,
    recommendationReasonLevel: "full",
    historyRetentionDays: 365,
    categories: ["entertainment", "shopping", "food", "travel", "fitness", "education", "health", "technology", "finance", "lifestyle", "business", "investment"],
    batchRecommendation: true,
    dataExport: true,
    exportFormats: ["json", "csv", "pdf"],
    enhancedSearch: true,
    viewDecisionProcess: true,
    responsePriority: 1,
    responseTimeHours: 4,
    assistantLimit: -1,
    assistantPeriod: "daily",
  },
};

/**
 * 人物画像维度定义
 */
export const PROFILE_DIMENSIONS = {
  // 核心维度 (Free 可用)
  core: [
    { id: "interest_category", name: "Interest Category", nameZh: "兴趣类别" },
    { id: "spending_level", name: "Spending Level", nameZh: "消费水平" },
    { id: "active_time", name: "Active Time", nameZh: "活跃时间" },
  ],
  // 扩展维度 (Pro 可用)
  extended: [
    { id: "age_group", name: "Age Group", nameZh: "年龄段" },
    { id: "location_preference", name: "Location Preference", nameZh: "位置偏好" },
    { id: "brand_preference", name: "Brand Preference", nameZh: "品牌偏好" },
    { id: "price_sensitivity", name: "Price Sensitivity", nameZh: "价格敏感度" },
    { id: "quality_preference", name: "Quality Preference", nameZh: "质量偏好" },
    { id: "convenience_priority", name: "Convenience Priority", nameZh: "便利性优先" },
    { id: "novelty_seeking", name: "Novelty Seeking", nameZh: "新鲜感追求" },
    { id: "social_influence", name: "Social Influence", nameZh: "社交影响" },
    { id: "review_importance", name: "Review Importance", nameZh: "评价重要性" },
    { id: "sustainability", name: "Sustainability", nameZh: "可持续性偏好" },
    { id: "seasonal_preference", name: "Seasonal Preference", nameZh: "季节偏好" },
    { id: "occasion_based", name: "Occasion Based", nameZh: "场景导向" },
  ],
  // 高级维度 (Enterprise 可用)
  advanced: [
    { id: "decision_style", name: "Decision Style", nameZh: "决策风格" },
    { id: "risk_tolerance", name: "Risk Tolerance", nameZh: "风险承受" },
    { id: "loyalty_tendency", name: "Loyalty Tendency", nameZh: "忠诚度倾向" },
    { id: "impulse_buying", name: "Impulse Buying", nameZh: "冲动消费" },
    { id: "research_depth", name: "Research Depth", nameZh: "研究深度" },
    { id: "value_orientation", name: "Value Orientation", nameZh: "价值取向" },
    { id: "lifestyle_stage", name: "Lifestyle Stage", nameZh: "生活阶段" },
    { id: "cultural_preference", name: "Cultural Preference", nameZh: "文化偏好" },
    { id: "tech_adoption", name: "Tech Adoption", nameZh: "技术采纳" },
    { id: "health_consciousness", name: "Health Consciousness", nameZh: "健康意识" },
    { id: "environmental_impact", name: "Environmental Impact", nameZh: "环境影响" },
    { id: "social_responsibility", name: "Social Responsibility", nameZh: "社会责任" },
    { id: "personalization_level", name: "Personalization Level", nameZh: "个性化程度" },
    { id: "feedback_propensity", name: "Feedback Propensity", nameZh: "反馈倾向" },
    { id: "engagement_depth", name: "Engagement Depth", nameZh: "参与深度" },
  ],
};

/**
 * 获取指定计划可用的画像维度
 */
export function getAvailableDimensions(planType: PlanType) {
  const features = PLAN_FEATURES[planType];
  const maxDimensions = features.profileDimensions;

  let dimensions = [...PROFILE_DIMENSIONS.core];

  if (planType === "pro" || planType === "enterprise") {
    dimensions = [...dimensions, ...PROFILE_DIMENSIONS.extended];
  }

  if (planType === "enterprise") {
    dimensions = [...dimensions, ...PROFILE_DIMENSIONS.advanced];
  }

  return dimensions.slice(0, maxDimensions);
}

/**
 * 推荐理由配置
 */
export const RECOMMENDATION_REASON_CONFIG = {
  basic: {
    fields: ["summary"],
    maxLength: 100,
    description: "Simple one-line explanation",
    descriptionZh: "简单的一句话解释",
  },
  enhanced: {
    fields: ["why_recommend", "why_suitable", "best_experience"],
    maxLength: 300,
    description: "Three dimensions: Why recommend, Why suitable for you, How to get the best experience",
    descriptionZh: "三个维度：为什么推荐、为什么适合你、如何获得最佳体验",
  },
  full: {
    fields: ["why_recommend", "why_suitable", "best_experience", "profile_analysis", "feature_match", "decision_factors"],
    maxLength: 500,
    description: "Full analysis including profile analysis, feature matching, and decision factors",
    descriptionZh: "完整分析，包括画像分析、特征匹配和决策因素",
  },
};

/**
 * 检查用户是否有权限使用某功能
 */
export function hasFeatureAccess(
  planType: PlanType,
  feature: keyof PlanFeatures
): boolean {
  const features = PLAN_FEATURES[planType];
  const value = features[feature];

  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0 || value === -1;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

/**
 * 获取功能限制值
 */
export function getFeatureLimit(
  planType: PlanType,
  feature: keyof PlanFeatures
): number | string | boolean | string[] {
  return PLAN_FEATURES[planType][feature];
}

/**
 * 比较两个计划的功能差异
 */
export function comparePlans(plan1: PlanType, plan2: PlanType) {
  const features1 = PLAN_FEATURES[plan1];
  const features2 = PLAN_FEATURES[plan2];

  const differences: Array<{
    feature: keyof PlanFeatures;
    plan1Value: unknown;
    plan2Value: unknown;
    improved: boolean;
  }> = [];

  (Object.keys(features1) as Array<keyof PlanFeatures>).forEach((feature) => {
    const val1 = features1[feature];
    const val2 = features2[feature];

    if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      let improved = false;

      if (typeof val1 === "number" && typeof val2 === "number") {
        // -1 表示无限，是更好的
        improved = val2 === -1 || (val1 !== -1 && val2 > val1);
      } else if (typeof val1 === "boolean" && typeof val2 === "boolean") {
        improved = val2 && !val1;
      } else if (Array.isArray(val1) && Array.isArray(val2)) {
        improved = val2.length > val1.length;
      }

      differences.push({
        feature,
        plan1Value: val1,
        plan2Value: val2,
        improved,
      });
    }
  });

  return differences;
}
