// app/api/auth/refresh-subscription/route.ts - 刷新用户订阅状态
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";

function normalizePlan(plan?: string | null): "enterprise" | "pro" | "free" {
  const val = (plan || "").toLowerCase();
  if (val.includes("enterprise")) return "enterprise";
  if (val.includes("pro")) return "pro";
  return "free";
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

    // 查询用户的订阅状态
    console.log("[API] Checking subscription for user:", user.id);
    let subscription;
    let subscriptionError;

    try {
      const result = await supabaseAdmin
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
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

    // 查找最近一条已完成的支付（用于兜底判定档位）
    const { data: latestPayment } = await supabaseAdmin
      .from("payments")
      .select("metadata, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 以用户当前元数据为回退，避免误降级
    let subscriptionPlan = normalizePlan(user.user_metadata?.subscription_plan as string);
    let subscriptionStatus = (user.user_metadata?.subscription_status as string) || "inactive";
    let subscriptionEnd: string | null = (user.user_metadata?.subscription_end as string) || null;
    let billingCycle: string | null = (user.user_metadata?.subscription_billing_cycle as string) || null;

    if (subscription) {
      // plan_type 记录档位（pro / enterprise），默认回落到 pro
      subscriptionPlan = normalizePlan(subscription.plan_type || "pro");

      subscriptionStatus = subscription.status;
      subscriptionEnd = subscription.subscription_end;
      billingCycle = subscription.billing_cycle || null;
    }

    // 兜底使用最近一次支付的 planType 元数据（即使 subscription 记录存在但 plan_type 异常，也用支付信息纠正）
    const paymentPlanType = normalizePlan(latestPayment?.metadata?.planType);
    if (paymentPlanType !== "free" && (subscriptionPlan === "free" || !subscription)) {
      subscriptionPlan = paymentPlanType;
      if (!subscriptionStatus || subscriptionStatus === "inactive") {
        subscriptionStatus = "active";
      }
    }

    // 如果数据库中的 plan_type 异常，但支付兜底识别为 enterprise/pro，则顺便纠正数据库记录
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

    // 更新用户元数据
    console.log("[API] Updating user metadata for user:", user.id);
    let updateError;

    try {
      const result = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        {
          user_metadata: {
            subscription_plan: subscriptionPlan,
            subscription_status: subscriptionStatus,
            subscription_end: subscriptionEnd,
            subscription_billing_cycle: billingCycle,
          }
        }
      );
      updateError = result.error;

      if (updateError) {
        console.error("[API] Error updating user metadata:", updateError);
        // Don't return error immediately, continue with response
        console.log("[API] Will continue despite metadata update error");
      } else {
        console.log("[API] User metadata updated successfully");
      }
    } catch (error) {
      console.error("[API] Metadata update exception:", error);
      updateError = error;
      // Don't return error immediately, continue with response
      console.log("[API] Will continue despite metadata update exception");
    }

    console.log("[API] Sending response:", {
      success: true,
      subscriptionPlan,
      subscriptionStatus,
      hasSubscription: !!subscription
    });

    return NextResponse.json({
      success: true,
      subscriptionPlan,
      subscriptionStatus,
      subscription,
    });
  } catch (error) {
    console.error("[API] Refresh subscription error:", error);
    console.error("[API] Error stack:", error instanceof Error ? error.stack : 'No stack trace');

    // Always return a valid JSON response to prevent 502 errors
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
