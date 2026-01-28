// app/api/payment/confirm/route.ts - 备用支付确认API（当webhook失败时使用）
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { requireAuth } from "@/lib/auth/auth";

/**
 * POST /api/payment/confirm
 * 手动确认 Stripe 支付状态（当 webhook 未能更新数据库时使用）
 */
export async function POST(request: NextRequest) {
  console.log("[Payment Confirm] ===== Starting payment confirmation =====");

  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const body = await request.json();
    const { paymentIntentId, transactionId } = body;

    const targetTransactionId = paymentIntentId || transactionId;

    if (!targetTransactionId) {
      return NextResponse.json(
        { success: false, error: "Missing paymentIntentId or transactionId" },
        { status: 400 }
      );
    }

    console.log(`[Payment Confirm] User ${user.id} confirming payment: ${targetTransactionId}`);

    // 从 Stripe 获取 PaymentIntent 状态
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(targetTransactionId);
      console.log(`[Payment Confirm] Stripe PaymentIntent status: ${paymentIntent.status}`);
    } catch (stripeError: any) {
      console.error(`[Payment Confirm] Failed to retrieve PaymentIntent:`, stripeError.message);
      return NextResponse.json(
        { success: false, error: "Unable to verify payment with Stripe" },
        { status: 400 }
      );
    }

    // 验证这笔支付属于当前用户
    const { data: existingPayment, error: queryError } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, status, metadata")
      .eq("transaction_id", targetTransactionId)
      .single();

    if (queryError && queryError.code !== "PGRST116") {
      console.error("[Payment Confirm] Error querying payment:", queryError);
      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      );
    }

    if (existingPayment && existingPayment.user_id !== user.id) {
      console.warn(`[Payment Confirm] User ${user.id} attempted to confirm payment belonging to ${existingPayment.user_id}`);
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // 检查 Stripe 支付状态
    if (paymentIntent.status !== "succeeded") {
      console.log(`[Payment Confirm] Payment not yet succeeded, status: ${paymentIntent.status}`);
      return NextResponse.json({
        success: false,
        status: paymentIntent.status,
        message: "Payment has not succeeded yet",
      });
    }

    // 如果数据库记录已经是 completed，直接返回成功
    if (existingPayment?.status === "completed") {
      console.log(`[Payment Confirm] Payment ${targetTransactionId} already marked as completed`);
      return NextResponse.json({
        success: true,
        message: "Payment already confirmed",
        alreadyCompleted: true,
      });
    }

    const now = new Date().toISOString();
    const amount = paymentIntent.amount_received
      ? paymentIntent.amount_received / 100
      : paymentIntent.amount / 100;
    const currency = (paymentIntent.currency || "usd").toUpperCase();
    const metadata = paymentIntent.metadata || {};
    const billingCycle =
      (metadata as any).billingCycle ||
      (metadata as any).billing_cycle ||
      (amount >= 20 ? "yearly" : "monthly"); // Pro yearly: $29.99, Enterprise yearly: $69.99
    const planType =
      (metadata as any).planType ||
      (metadata as any).tier ||
      (metadata as any).plan ||
      (billingCycle === "yearly"
        ? amount >= 300
          ? "enterprise"
          : "pro"
        : amount >= 30
        ? "enterprise"
        : "pro");

    if (existingPayment) {
      // 更新现有记录
      console.log(`[Payment Confirm] Updating existing payment ${existingPayment.id} to completed`);
      
      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", existingPayment.id);

      if (updateError) {
        console.error("[Payment Confirm] Failed to update payment:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update payment record" },
          { status: 500 }
        );
      }
    } else {
      // 创建新记录（理论上不应该发生，但作为保险）
      console.log(`[Payment Confirm] Creating new payment record for ${targetTransactionId}`);
      
      const { error: insertError } = await supabaseAdmin.from("payments").insert({
        user_id: user.id,
        amount,
        currency,
        status: "completed",
        payment_method: "stripe",
        transaction_id: targetTransactionId,
        metadata: { billingCycle, planType },
        completed_at: now,
        updated_at: now,
      });

      if (insertError) {
        console.error("[Payment Confirm] Failed to insert payment:", insertError);
        return NextResponse.json(
          { success: false, error: "Failed to create payment record" },
          { status: 500 }
        );
      }
    }

    // 更新用户订阅状态
    const daysToAdd = billingCycle === "yearly" ? 365 : 30;
    const daysInMs = daysToAdd * 24 * 60 * 60 * 1000;

    // 检查用户是否已有订阅记录（不区分 plan_type，因为数据库有 user_id 唯一约束）
    const { data: existingSubscription, error: fetchError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let subscriptionEnd: Date;
    let isNewSubscription = false;

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("[Payment Confirm] Error checking existing subscription:", fetchError);
    }

    if (existingSubscription) {
      // 有现有订阅记录
      const existingPlanType = existingSubscription.plan_type;
      const existingEnd = new Date(existingSubscription.subscription_end);
      const nowDate = new Date();
      const isStillActive = existingEnd > nowDate && existingSubscription.status === "active";

      // 判断是否是升级（从低级别到高级别）
      if (planType === "enterprise" && existingPlanType === "pro") {
        // 升级时，从当前时间开始计算新订阅
        subscriptionEnd = new Date(Date.now() + daysInMs);
        console.log(`[Payment Confirm] User ${user.id} upgrading from pro to enterprise. New subscription ending at: ${subscriptionEnd.toISOString()}`);
      } else if (planType === existingPlanType && isStillActive) {
        // 相同类型且未过期，叠加时间
        subscriptionEnd = new Date(existingEnd.getTime() + daysInMs);
        console.log(`[Payment Confirm] User ${user.id} has existing ${planType} subscription ending at: ${existingEnd.toISOString()}`);
        console.log(`[Payment Confirm] Extended ${planType} subscription to: ${subscriptionEnd.toISOString()}`);
      } else {
        // 其他情况（过期、降级等），从当前时间开始
        subscriptionEnd = new Date(Date.now() + daysInMs);
        console.log(`[Payment Confirm] User ${user.id} renewing/changing subscription from ${existingPlanType} to ${planType}, ending at: ${subscriptionEnd.toISOString()}`);
      }
    } else {
      // 用户没有订阅，创建新订阅
      isNewSubscription = true;
      subscriptionEnd = new Date(Date.now() + daysInMs);
      console.log(`[Payment Confirm] Created new ${planType} subscription for user ${user.id} ending at: ${subscriptionEnd.toISOString()}`);
    }

    // 更新或创建订阅记录
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert({
        user_id: user.id,
        status: "active",
        subscription_end: subscriptionEnd.toISOString(),
        plan_type: planType,
        currency,
        updated_at: now,
        // 只在创建新订阅时设置 created_at
        ...(isNewSubscription && { created_at: now })
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error("[Payment Confirm] Error upserting subscription:", error);
    } else {
      console.log(`[Payment Confirm] ${isNewSubscription ? 'Created' : 'Extended'} subscription for user ${user.id}: ${planType} plan ${daysToAdd} days, expires at ${subscriptionEnd.toISOString()}`);
    }

    // 更新用户元数据
    try {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          subscription_plan: planType,
          subscription_status: "active",
          subscription_end: subscriptionEnd.toISOString(),
          subscription_billing_cycle: billingCycle,
        },
      });
      console.log(`[Payment Confirm] User metadata updated`);
    } catch (metaError) {
      console.error("[Payment Confirm] Error updating user metadata:", metaError);
    }

    try {
      const profileUpdates = {
        subscription_tier: planType,
        subscription_status: "active",
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin
        .from("profiles")
        .upsert({ id: user.id, ...profileUpdates }, { onConflict: "id" });
      await supabaseAdmin
        .from("user_profiles")
        .upsert({ id: user.id, ...profileUpdates, created_at: new Date().toISOString() }, { onConflict: "id" });
    } catch (profileError) {
      console.error("[Payment Confirm] Failed to sync profile tables:", profileError);
    }

    console.log(`[Payment Confirm] ✅ Payment ${targetTransactionId} confirmed successfully`);

    return NextResponse.json({
      success: true,
      message: "Payment confirmed and subscription updated",
      subscriptionEnd: subscriptionEnd.toISOString(),
      planType,
      billingCycle,
    });
  } catch (error) {
    console.error("[Payment Confirm] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
