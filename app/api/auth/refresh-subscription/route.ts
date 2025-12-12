// app/api/auth/refresh-subscription/route.ts - 刷新用户订阅状态
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";

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

    // 确定订阅计划
    let subscriptionPlan = "free";
    let subscriptionStatus = "inactive";

    if (subscription) {
      subscriptionPlan = subscription.plan_type === "yearly" ? "pro" : "pro";
      subscriptionStatus = subscription.status;
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