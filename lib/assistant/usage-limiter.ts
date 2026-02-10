/**
 * AI 助手使用次数限制器
 *
 * 功能描述：追踪和限制 AI 助手的使用次数
 * - 免费用户：总计 3 次
 * - Pro 会员：每日 10 次
 * - Enterprise：无限制
 *
 * 支持双环境：INTL (Supabase) / CN (CloudBase)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { ASSISTANT_USAGE_LIMITS } from "./types";
import type { AssistantUsageStats } from "./types";

type UserPlanType = "free" | "pro" | "enterprise";

// ==========================================
// 数据库客户端
// ==========================================

let supabaseAdminInstance: SupabaseClient | null = null;

/**
 * 获取 Supabase Admin 客户端（单例）
 * @returns Supabase Client
 */
function getSupabaseAdmin() {
  if (supabaseAdminInstance) return supabaseAdminInstance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  supabaseAdminInstance = createClient(url, key);
  return supabaseAdminInstance;
}

/**
 * 获取 CloudBase 数据库实例
 * @returns CloudBase DB
 */
async function getCloudBaseDb() {
  const cloudbase = (await import("@cloudbase/node-sdk")).default;
  const app = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });
  return app.database();
}

function normalizePlanType(rawPlan: unknown): UserPlanType {
  if (typeof rawPlan !== "string") {
    return "free";
  }

  const plan = rawPlan.trim().toLowerCase();
  if (!plan) {
    return "free";
  }

  if (plan.includes("enterprise") || plan.includes("企业")) {
    return "enterprise";
  }

  if (plan.includes("pro") || plan.includes("专业")) {
    return "pro";
  }

  return "free";
}

function parseDateToTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  return null;
}

function resolvePlanFromUserRecord(record: unknown): UserPlanType {
  if (!record || typeof record !== "object") {
    return "free";
  }

  const userRecord = record as Record<string, unknown>;
  const planCandidates = [
    userRecord.subscription_plan,
    userRecord.subscription_tier,
    userRecord.plan_type,
    userRecord.plan,
    userRecord.tier,
  ];

  for (const candidate of planCandidates) {
    const normalized = normalizePlanType(candidate);
    if (normalized !== "free") {
      return normalized;
    }
  }

  if (userRecord.enterprise === true) {
    return "enterprise";
  }

  if (userRecord.pro === true) {
    return "pro";
  }

  return "free";
}

async function getUserPlanTypeFromCNUserRecord(db: any, userId: string): Promise<UserPlanType> {
  const usersCollection = db.collection("users");

  try {
    const userResult = await usersCollection.doc(userId).get();
    const userData = Array.isArray(userResult?.data)
      ? userResult.data[0]
      : userResult?.data;
    const planType = resolvePlanFromUserRecord(userData);

    if (planType !== "free") {
      return planType;
    }
  } catch {
    // Ignore and continue fallback lookup.
  }

  try {
    const byUserIdResult = await usersCollection.where({ user_id: userId }).limit(1).get();
    const userData = byUserIdResult?.data?.[0];
    const planType = resolvePlanFromUserRecord(userData);

    if (planType !== "free") {
      return planType;
    }
  } catch {
    // Ignore and return free.
  }

  return "free";
}

// ==========================================
// 获取用户计划
// ==========================================

/**
 * 获取用户当前订阅计划类型
 * @param userId - 用户 ID
 * @returns 计划类型 free/pro/enterprise
 */
async function getUserPlanType(userId: string): Promise<UserPlanType> {
  if (isChinaDeployment()) {
    return getUserPlanTypeCN(userId);
  }
  return getUserPlanTypeINTL(userId);
}

async function getUserPlanTypeINTL(userId: string): Promise<UserPlanType> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("user_subscriptions")
    .select("plan_type")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("subscription_end", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return "free";
  }

  const row = data as { plan_type?: string } | null;
  return normalizePlanType(row?.plan_type);
}

async function getUserPlanTypeCN(userId: string): Promise<UserPlanType> {
  const db = await getCloudBaseDb();
  const now = Date.now();

  try {
    const result = await db
      .collection("user_subscriptions")
      .where({ user_id: userId, status: "active" })
      .get();

    const subscriptions = Array.isArray(result?.data) ? result.data : [];

    const latestActiveSubscription = subscriptions
      .filter((item: unknown) => {
        const subscription = item as Record<string, unknown>;
        const expiresAt = parseDateToTimestamp(subscription.subscription_end);
        return expiresAt === null || expiresAt > now;
      })
      .sort((left: unknown, right: unknown) => {
        const leftExpires =
          parseDateToTimestamp((left as Record<string, unknown>).subscription_end) ??
          Number.MAX_SAFE_INTEGER;
        const rightExpires =
          parseDateToTimestamp((right as Record<string, unknown>).subscription_end) ??
          Number.MAX_SAFE_INTEGER;
        return rightExpires - leftExpires;
      })[0];

    if (latestActiveSubscription) {
      const subscriptionRecord = latestActiveSubscription as Record<string, unknown>;
      const subscriptionPlanCandidates = [
        subscriptionRecord.plan_type,
        subscriptionRecord.subscription_plan,
        subscriptionRecord.subscription_tier,
      ];

      for (const candidate of subscriptionPlanCandidates) {
        const subscriptionPlan = normalizePlanType(candidate);
        if (subscriptionPlan !== "free") {
          return subscriptionPlan;
        }
      }
    }
  } catch {
    // Ignore and fallback to users collection lookup.
  }

  return getUserPlanTypeFromCNUserRecord(db, userId);
}

// ==========================================
// 获取本周期已用次数
// ==========================================

/**
 * 获取当前周期使用次数
 * @param userId - 用户 ID
 * @param periodType - 周期类型 total|daily
 * @returns 使用次数
 */
async function getUsageCount(userId: string, periodType: "total" | "daily"): Promise<number> {
  if (isChinaDeployment()) {
    return getUsageCountCN(userId, periodType);
  }
  return getUsageCountINTL(userId, periodType);
}

async function getUsageCountINTL(userId: string, periodType: "total" | "daily"): Promise<number> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("assistant_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (periodType === "daily") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query = query.gte("created_at", today.toISOString());
  }

  const { count, error } = await query;
  if (error) {
    console.error("[AssistantUsage] Failed to get INTL usage count:", error);
    return 0;
  }
  return count || 0;
}

async function getUsageCountCN(userId: string, periodType: "total" | "daily"): Promise<number> {
  const db = await getCloudBaseDb();
  try {
    const whereCondition: Record<string, unknown> = { user_id: userId };

    if (periodType === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const _ = db.command;
      whereCondition.created_at = _.gte(today.toISOString());
    }

    const result = await db
      .collection("assistant_usage")
      .where(whereCondition)
      .count();

    return result.total || 0;
  } catch {
    return 0;
  }
}

// ==========================================
// 公开 API
// ==========================================

/**
 * 获取用户 AI 助手使用统计
 * @param userId - 用户 ID
 * @returns 使用统计信息
 */
export async function getAssistantUsageStats(userId: string): Promise<AssistantUsageStats> {
  const planType = await getUserPlanType(userId);

  let limit: number;
  let periodType: "total" | "daily";

  switch (planType) {
    case "enterprise":
      limit = ASSISTANT_USAGE_LIMITS.enterpriseDailyLimit;
      periodType = "daily";
      break;
    case "pro":
      limit = ASSISTANT_USAGE_LIMITS.proDailyLimit;
      periodType = "daily";
      break;
    default:
      limit = ASSISTANT_USAGE_LIMITS.freeTotal;
      periodType = "total";
  }

  const used = await getUsageCount(userId, periodType);
  const isUnlimited = limit === -1;
  const remaining = isUnlimited ? -1 : Math.max(0, limit - used);

  return { userId, planType, used, limit, remaining, periodType };
}

/**
 * 检查用户是否可以使用 AI 助手
 * @param userId - 用户 ID
 * @returns {allowed, reason, stats}
 */
export async function canUseAssistant(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  stats: AssistantUsageStats;
}> {
  const stats = await getAssistantUsageStats(userId);

  if (stats.remaining === -1) {
    return { allowed: true, stats };
  }

  if (stats.remaining <= 0) {
    const reason =
      stats.periodType === "total"
        ? "free_limit_reached"
        : "daily_limit_reached";
    return { allowed: false, reason, stats };
  }

  return { allowed: true, stats };
}

/**
 * 记录一次 AI 助手使用
 * @param userId - 用户 ID
 * @param metadata - 附加元数据
 * @returns {success, error?}
 */
export async function recordAssistantUsage(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const { allowed, reason } = await canUseAssistant(userId);
  if (!allowed) {
    return { success: false, error: reason };
  }

  if (isChinaDeployment()) {
    return recordUsageCN(userId, metadata);
  }
  return recordUsageINTL(userId, metadata);
}

async function recordUsageINTL(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("assistant_usage").insert({
    user_id: userId,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[AssistantUsage] Failed to record INTL usage:", error);
    return { success: false, error: "Failed to record usage" };
  }
  return { success: true };
}

async function recordUsageCN(
  userId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const db = await getCloudBaseDb();
  try {
    await db.collection("assistant_usage").add({
      user_id: userId,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
    return { success: true };
  } catch (err) {
    console.error("[AssistantUsage] Failed to record CN usage:", err);
    return { success: false, error: "Failed to record usage" };
  }
}

