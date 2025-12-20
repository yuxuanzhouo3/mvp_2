/**
 * 订阅使用次数追踪服务
 * 支持双环境架构：INTL (Supabase) 和 CN (CloudBase)
 *
 * 追踪用户的推荐使用次数并检查是否超出限制
 */

import { createClient } from "@supabase/supabase-js";
import cloudbase from "@cloudbase/node-sdk";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { PlanType } from "../payment/payment-config";
import { PLAN_FEATURES } from "./features";

// ==========================================
// 数据库客户端
// ==========================================

// Supabase 客户端缓存
let supabaseAdminInstance: any = null;

function getSupabaseAdmin() {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey);
  return supabaseAdminInstance;
}

// CloudBase 客户端缓存
let cloudbaseAppInstance: any = null;

function getCloudBaseApp() {
  if (cloudbaseAppInstance) {
    return cloudbaseAppInstance;
  }
  cloudbaseAppInstance = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });
  return cloudbaseAppInstance;
}

function getCloudBaseDb() {
  return getCloudBaseApp().database();
}

// ==========================================
// 类型定义
// ==========================================

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

// ==========================================
// 获取用户订阅计划
// ==========================================

/**
 * 获取用户当前订阅计划
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
  if (isChinaDeployment()) {
    return getUserPlanCloudBase(userId);
  } else {
    return getUserPlanSupabase(userId);
  }
}

async function getUserPlanSupabase(userId: string): Promise<PlanType> {
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

async function getUserPlanCloudBase(userId: string): Promise<PlanType> {
  const db = getCloudBaseDb();
  const now = new Date().toISOString();

  try {
    // 查询活跃订阅
    const result = await db
      .collection("user_subscriptions")
      .where({
        user_id: userId,
        status: "active",
      })
      .orderBy("subscription_end", "desc")
      .limit(1)
      .get();

    if (!result.data || result.data.length === 0) {
      // 如果没有订阅记录，检查 users 集合中的 pro 字段
      const userResult = await db.collection("users").doc(userId).get();
      const userData = userResult.data?.[0] || userResult.data;
      
      if (userData?.pro === true) {
        return "pro";
      }
      if (userData?.subscription_plan) {
        const plan = (userData.subscription_plan as string).toLowerCase();
        if (plan.includes("enterprise")) return "enterprise";
        if (plan.includes("pro")) return "pro";
      }
      return "free";
    }

    const subscription = result.data[0];
    
    // 检查是否过期
    if (subscription.subscription_end < now) {
      return "free";
    }

    const planType = (subscription.plan_type as string || "").toLowerCase();
    if (planType.includes("enterprise")) return "enterprise";
    if (planType.includes("pro")) return "pro";
    return "free";
  } catch (error) {
    console.error("[getUserPlanCloudBase] Error:", error);
    return "free";
  }
}

// ==========================================
// 周期计算
// ==========================================

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

// ==========================================
// 获取使用统计
// ==========================================

/**
 * 获取用户使用统计
 */
export async function getUserUsageStats(userId: string): Promise<UsageStats> {
  if (isChinaDeployment()) {
    return getUserUsageStatsCloudBase(userId);
  } else {
    return getUserUsageStatsSupabase(userId);
  }
}

async function getUserUsageStatsSupabase(userId: string): Promise<UsageStats> {
  const supabase = getSupabaseAdmin();
  const planType = await getUserPlanSupabase(userId);
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

async function getUserUsageStatsCloudBase(userId: string): Promise<UsageStats> {
  const db = getCloudBaseDb();
  const planType = await getUserPlanCloudBase(userId);
  const features = PLAN_FEATURES[planType];

  const periodType = features.recommendationPeriod;
  const periodLimit = features.recommendationLimit;
  const isUnlimited = periodLimit === -1;

  const { start, end } = getPeriodBounds(periodType);

  // 查询当前周期的使用次数
  let currentPeriodUsage = 0;
  try {
    const _ = db.command;
    const result = await db
      .collection("recommendation_usage")
      .where({
        user_id: userId,
        created_at: _.gte(start.toISOString()).and(_.lte(end.toISOString())),
      })
      .count();
    
    currentPeriodUsage = result.total || 0;
  } catch (error) {
    console.error("[getUserUsageStatsCloudBase] Error counting usage:", error);
    // 如果集合不存在，返回 0
    currentPeriodUsage = 0;
  }

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

// ==========================================
// 检查使用权限
// ==========================================

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

// ==========================================
// 记录使用
// ==========================================

/**
 * 记录一次推荐使用
 */
export async function recordRecommendationUsage(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  // 首先检查是否可以使用
  const { allowed, reason } = await canUseRecommendation(userId);

  if (!allowed) {
    return { success: false, error: reason };
  }

  if (isChinaDeployment()) {
    return recordRecommendationUsageCloudBase(userId, metadata);
  } else {
    return recordRecommendationUsageSupabase(userId, metadata);
  }
}

async function recordRecommendationUsageSupabase(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

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

async function recordRecommendationUsageCloudBase(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const db = getCloudBaseDb();

  try {
    await db.collection("recommendation_usage").add({
      user_id: userId,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error recording recommendation usage:", error);
    return { success: false, error: "Failed to record usage" };
  }
}

// ==========================================
// 获取推荐历史
// ==========================================

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
  if (isChinaDeployment()) {
    return getUserRecommendationHistoryCloudBase(userId, options);
  } else {
    return getUserRecommendationHistorySupabase(userId, options);
  }
}

async function getUserRecommendationHistorySupabase(
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
  const planType = await getUserPlanSupabase(userId);
  const features = PLAN_FEATURES[planType];
  const retentionDays = features.historyRetentionDays;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // 查询 recommendation_history 表
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
    console.error("[getUserRecommendationHistorySupabase] Error:", error);
  }

  // 转换数据格式
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
      content: item.title,
    },
    created_at: item.created_at,
  }));

  return {
    data: formattedData,
    total: count || 0,
    retentionDays,
  };
}

async function getUserRecommendationHistoryCloudBase(
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
  const db = getCloudBaseDb();
  const planType = await getUserPlanCloudBase(userId);
  const features = PLAN_FEATURES[planType];
  const retentionDays = features.historyRetentionDays;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const _ = db.command;
    
    // 获取总数
    const countResult = await db
      .collection("recommendation_history")
      .where({
        user_id: userId,
        created_at: _.gte(cutoffDate.toISOString()),
      })
      .count();

    const total = countResult.total || 0;

    // 查询数据
    const result = await db
      .collection("recommendation_history")
      .where({
        user_id: userId,
        created_at: _.gte(cutoffDate.toISOString()),
      })
      .orderBy("created_at", "desc")
      .skip(options?.offset || 0)
      .limit(options?.limit || 20)
      .get();

    // 转换数据格式
    const formattedData = (result.data || []).map((item: any) => ({
      id: item._id || item.id,
      recommendation: {
        category: item.category,
        title: item.title,
        description: item.description,
        link: item.link,
        linkType: item.link_type,
        metadata: item.metadata,
        reason: item.reason,
        content: item.title,
      },
      created_at: item.created_at,
    }));

    return {
      data: formattedData,
      total,
      retentionDays,
    };
  } catch (error) {
    console.error("[getUserRecommendationHistoryCloudBase] Error:", error);
    return {
      data: [],
      total: 0,
      retentionDays,
    };
  }
}

// ==========================================
// 检查导出权限
// ==========================================

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
