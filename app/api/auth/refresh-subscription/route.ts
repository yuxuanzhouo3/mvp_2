// app/api/auth/refresh-subscription/route.ts - 刷新用户订阅状态
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { CloudBaseUserAdapter } from "@/lib/database/adapters/cloudbase-user";

function normalizePlan(plan?: string | null): "enterprise" | "pro" | "free" {
  const val = (plan || "").toLowerCase();
  if (val.includes("enterprise")) return "enterprise";
  if (val.includes("pro")) return "pro";
  return "free";
}

function resolvePlanFromMetadata(meta?: Record<string, any> | null) {
  return normalizePlan(
    meta?.planType ||
    meta?.tier ||
    meta?.plan ||
    meta?.plan_type ||
    meta?.subscription_plan
  );
}

// Supabase 版本的同步配置表
async function syncProfileTablesSupabase(userId: string, plan: "enterprise" | "pro" | "free", status: string) {
  const now = new Date().toISOString();
  const updates = {
    subscription_tier: plan,
    subscription_status: status,
    updated_at: now,
  };

  try {
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, ...updates }, { onConflict: "id" });
  } catch (error) {
    console.error("[API] Failed to sync profiles table:", error);
  }

  try {
    await supabaseAdmin
      .from("user_profiles")
      .upsert({ id: userId, ...updates, created_at: now }, { onConflict: "id" });
  } catch (error) {
    console.error("[API] Failed to sync user_profiles table:", error);
  }
}

// CN 环境：使用 CloudBase
async function refreshSubscriptionCN(userId: string, user: any) {
  console.log("[API] CN environment - using CloudBase");
  const cloudbaseAdapter = new CloudBaseUserAdapter();

  // 查询用户的活跃订阅
  const { data: subscription, error: subscriptionError } = await cloudbaseAdapter.getActiveSubscription(userId);

  if (subscriptionError) {
    console.error("[API] Error checking subscription:", subscriptionError);
  }

  // 查找最近一条已完成的支付
  const { data: payments } = await cloudbaseAdapter.getPaymentHistory(userId, { limit: 1 });
  const latestPayment = payments?.[0];

  // 以用户当前元数据为回退
  let subscriptionPlan = normalizePlan(user.user_metadata?.subscription_plan as string);
  let subscriptionStatus = (user.user_metadata?.subscription_status as string) || "inactive";
  let subscriptionEnd: string | null = (user.user_metadata?.subscription_end as string) || null;
  let billingCycle: string | null = (user.user_metadata?.subscription_billing_cycle as string) || null;

  if (subscription) {
    subscriptionPlan = normalizePlan(subscription.plan_type || "pro");
    subscriptionStatus = subscription.status;
    subscriptionEnd = subscription.subscription_end;
  }

  // 兜底使用最近一次支付的 planType
  if (latestPayment?.status === "completed") {
    const paymentPlanType = resolvePlanFromMetadata(latestPayment.metadata);
    if (paymentPlanType !== "free" && paymentPlanType !== subscriptionPlan) {
      subscriptionPlan = paymentPlanType;
      if (!subscriptionStatus || subscriptionStatus === "inactive") {
        subscriptionStatus = "active";
      }
    }
    if (!billingCycle && latestPayment.metadata?.billingCycle) {
      billingCycle = latestPayment.metadata.billingCycle;
    }
  }

  // 更新用户信息（CloudBase）
  console.log("[API] Updating user in CloudBase:", { userId, subscriptionPlan, subscriptionStatus });
  const updateResult = await cloudbaseAdapter.updateUser(userId, {
    subscription_plan: subscriptionPlan,
    subscription_status: subscriptionStatus,
  });

  if (!updateResult.success) {
    console.error("[API] Failed to update user in CloudBase:", updateResult.error);
  } else {
    console.log("[API] User updated successfully in CloudBase");
  }

  return {
    success: true,
    subscriptionPlan,
    subscriptionStatus,
    subscription,
    billingCycle,
    subscriptionEnd,
  };
}

// INTL 环境：使用 Supabase
async function refreshSubscriptionINTL(userId: string, user: any) {
  console.log("[API] INTL environment - using Supabase");

  // 查询用户的订阅状态
  let subscription;
  let subscriptionError;

  try {
    const result = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("subscription_end", new Date().toISOString())
      .single();

    subscription = result.data;
    subscriptionError = result.error;

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error("[API] Error checking subscription:", subscriptionError);
    }
  } catch (error) {
    console.error("[API] Database query error:", error);
    subscriptionError = error;
  }

  // 查找最近一条已完成的支付
  const { data: latestPayment } = await supabaseAdmin
    .from("payments")
    .select("metadata, status, created_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 以用户当前元数据为回退
  let subscriptionPlan = normalizePlan(user.user_metadata?.subscription_plan as string);
  let subscriptionStatus = (user.user_metadata?.subscription_status as string) || "inactive";
  let subscriptionEnd: string | null = (user.user_metadata?.subscription_end as string) || null;
  let billingCycle: string | null = (user.user_metadata?.subscription_billing_cycle as string) || null;

  if (subscription) {
    subscriptionPlan = normalizePlan(subscription.plan_type || "pro");
    subscriptionStatus = subscription.status;
    subscriptionEnd = subscription.subscription_end;
    billingCycle = subscription.billing_cycle || null;
  }

  // 兜底使用最近一次支付的 planType
  const paymentPlanType = resolvePlanFromMetadata(latestPayment?.metadata || null);
  if (paymentPlanType !== "free" && paymentPlanType !== subscriptionPlan) {
    subscriptionPlan = paymentPlanType;
    if (!subscriptionStatus || subscriptionStatus === "inactive") {
      subscriptionStatus = "active";
    }
  }

  // 如果数据库中的 plan_type 异常，则纠正
  if (subscription && subscriptionPlan !== normalizePlan(subscription.plan_type)) {
    try {
      await supabaseAdmin
        .from("user_subscriptions")
        .update({ plan_type: subscriptionPlan })
        .eq("id", subscription.id);
      console.log("[API] Fixed subscription plan_type to:", subscriptionPlan);
    } catch (fixError) {
      console.error("[API] Failed to fix subscription plan_type:", fixError);
    }
  }

  // 兜底账单周期
  if (!billingCycle && latestPayment?.metadata?.billingCycle) {
    billingCycle = latestPayment.metadata.billingCycle;
  }

  // 更新用户元数据 (Supabase)
  console.log("[API] Updating user metadata for user:", userId);
  try {
    const result = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          subscription_plan: subscriptionPlan,
          subscription_status: subscriptionStatus,
          subscription_end: subscriptionEnd,
          subscription_billing_cycle: billingCycle,
        }
      }
    );

    if (result.error) {
      console.error("[API] Error updating user metadata:", result.error);
    } else {
      console.log("[API] User metadata updated successfully");
    }
  } catch (error) {
    console.error("[API] Metadata update exception:", error);
  }

  await syncProfileTablesSupabase(userId, subscriptionPlan, subscriptionStatus);

  return {
    success: true,
    subscriptionPlan,
    subscriptionStatus,
    subscription,
    billingCycle,
    subscriptionEnd,
  };
}

export async function POST(request: NextRequest) {
  console.log("[API] POST /api/auth/refresh-subscription - Start");

  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      console.log("[API] Auth verification failed");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = authResult;
    console.log("[API] Auth verified for user:", user.id);

    // 根据部署区域选择不同的处理逻辑
    const isCN = isChinaDeployment();
    let result;

    if (isCN) {
      result = await refreshSubscriptionCN(user.id, user);
    } else {
      result = await refreshSubscriptionINTL(user.id, user);
    }

    console.log("[API] Sending response:", {
      success: result.success,
      subscriptionPlan: result.subscriptionPlan,
      subscriptionStatus: result.subscriptionStatus,
      hasSubscription: !!result.subscription
    });

    return NextResponse.json({
      success: result.success,
      subscriptionPlan: result.subscriptionPlan,
      subscriptionStatus: result.subscriptionStatus,
      subscription: result.subscription,
    });
  } catch (error) {
    console.error("[API] Refresh subscription error:", error);
    console.error("[API] Error stack:", error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' ? error?.toString() : undefined
      },
      { status: 500 }
    );
  }
}
