/**
 * 订阅使用次数追踪服务 - 国际版 (INTL)
 *
 * 追踪用户的推荐使用次数并检查是否超出限制
 */

import { createClient } from "@supabase/supabase-js";
import { PlanType } from "../payment/payment-config";
import { PLAN_FEATURES } from "./features";

// 创建 Supabase 服务端客户端
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * 使用统计接口
 */
export interface UsageStats {
  userId: string;
  planType: PlanType;
  currentPeriodUsage: number;
  periodLimit: number;
  periodType: "daily" | "monthly";
  periodStart: Date;
  periodEnd: Date;
  remainingUsage: number;
  isUnlimited: boolean;
}

/**
 * 获取用户当前订阅计划
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
  const supabase = getSupabaseAdmin();

  const { data: subscription, error } = await supabase
    .from("user_subscriptions")
    .select("plan_type, status, subscription_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("subscription_end", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !subscription) {
    return "free";
  }

  return subscription.plan_type as PlanType;
}

/**
 * 获取周期开始和结束时间
 */
function getPeriodBounds(periodType: "daily" | "monthly"): { start: Date; end: Date } {
  const now = new Date();

  if (periodType === "daily") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  } else {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
}

/**
 * 获取用户使用统计
 */
export async function getUserUsageStats(userId: string): Promise<UsageStats> {
  const supabase = getSupabaseAdmin();
  const planType = await getUserPlan(userId);
  const features = PLAN_FEATURES[planType];

  const periodType = features.recommendationPeriod;
  const periodLimit = features.recommendationLimit;
  const isUnlimited = periodLimit === -1;

  const { start, end } = getPeriodBounds(periodType);

  // 查询当前周期的使用次数
  const { count, error } = await supabase
    .from("recommendation_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const currentPeriodUsage = count || 0;

  return {
    userId,
    planType,
    currentPeriodUsage,
    periodLimit,
    periodType,
    periodStart: start,
    periodEnd: end,
    remainingUsage: isUnlimited ? -1 : Math.max(0, periodLimit - currentPeriodUsage),
    isUnlimited,
  };
}

/**
 * 检查用户是否可以使用推荐功能
 */
export async function canUseRecommendation(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  stats: UsageStats;
}> {
  const stats = await getUserUsageStats(userId);

  if (stats.isUnlimited) {
    return { allowed: true, stats };
  }

  if (stats.remainingUsage <= 0) {
    const periodText = stats.periodType === "daily" ? "today" : "this month";
    return {
      allowed: false,
      reason: `You have reached your ${stats.periodLimit} recommendation limit for ${periodText}. Upgrade to Pro or Enterprise for more recommendations.`,
      stats,
    };
  }

  return { allowed: true, stats };
}

/**
 * 记录一次推荐使用
 */
export async function recordRecommendationUsage(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  // 首先检查是否可以使用
  const { allowed, reason } = await canUseRecommendation(userId);

  if (!allowed) {
    return { success: false, error: reason };
  }

  // 记录使用
  const { error } = await supabase.from("recommendation_usage").insert({
    user_id: userId,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error recording recommendation usage:", error);
    return { success: false, error: "Failed to record usage" };
  }

  return { success: true };
}

/**
 * 获取用户推荐历史（根据计划限制保留天数）
 */
export async function getUserRecommendationHistory(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<{
  data: Array<{
    id: string;
    recommendation: unknown;
    created_at: string;
  }>;
  total: number;
  retentionDays: number;
}> {
  const supabase = getSupabaseAdmin();
  const planType = await getUserPlan(userId);
  const features = PLAN_FEATURES[planType];
  const retentionDays = features.historyRetentionDays;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // 查询 recommendation_history 表（这是存储推荐数据的正确表）
  const { data, error, count } = await supabase
    .from("recommendation_history")
    .select("id, category, title, description, link, link_type, metadata, reason, created_at", { count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", cutoffDate.toISOString())
    .order("created_at", { ascending: false })
    .range(
      options?.offset || 0,
      (options?.offset || 0) + (options?.limit || 20) - 1
    );

  if (error) {
    console.error("[getUserRecommendationHistory] Error:", error);
  }

  // 转换数据格式以兼容导出API
  const formattedData = (data || []).map((item: any) => ({
    id: item.id,
    recommendation: {
      category: item.category,
      title: item.title,
      description: item.description,
      link: item.link,
      linkType: item.link_type,
      metadata: item.metadata,
      reason: item.reason,
      content: item.title, // 为PDF导出添加content字段
    },
    created_at: item.created_at,
  }));

  return {
    data: formattedData,
    total: count || 0,
    retentionDays,
  };
}

/**
 * 检查用户是否可以导出数据
 */
export async function canExportData(userId: string): Promise<{
  allowed: boolean;
  formats: string[];
  reason?: string;
}> {
  const planType = await getUserPlan(userId);
  const features = PLAN_FEATURES[planType];

  if (!features.dataExport) {
    return {
      allowed: false,
      formats: [],
      reason: "Data export is only available for Pro and Enterprise plans.",
    };
  }

  return {
    allowed: true,
    formats: features.exportFormats,
  };
}
