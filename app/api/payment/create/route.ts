// app/api/payment/create/route.ts - 创建支付订单API
import { NextRequest, NextResponse } from "next/server";
import { getPayment } from "@/lib/payment/adapter";
import { requireAuth } from "@/lib/auth/auth";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { z } from "zod";
import { getPricingByMethod, getDaysByBillingCycle } from "@/lib/payment/payment-config";
import type { PaymentMethod, BillingCycle } from "@/lib/payment/payment-config";

// 支付创建请求验证schema
const createPaymentSchema = z.object({
  method: z.enum(["stripe", "paypal"]),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().min(1, "Currency is required"),
  description: z.string().optional(),
  planType: z.string().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  idempotencyKey: z.string().optional(),
});

/**
 * POST /api/payment/create
 * 创建支付订单
 */
export async function POST(request: NextRequest) {
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

    // 验证请求参数
    const body = await request.json();
    const validationResult = createPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      method,
      amount,
      currency,
      description,
      planType,
      billingCycle,
      idempotencyKey,
    } = validationResult.data;

    // 使用验证的用户ID
    const userId = user.id;

    // 检查重复支付请求（1分钟内）
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentPayments, error: checkError } = await supabaseAdmin
      .from("payments")
      .select("id, status, created_at, transaction_id")
      .eq("user_id", userId)
      .eq("amount", amount)
      .eq("currency", currency)
      .eq("payment_method", method)
      .gte("created_at", oneMinuteAgo)
      .in("status", ["pending", "completed"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (checkError) {
      console.error("Error checking existing payment:", checkError);
      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify payment uniqueness, please try again",
        },
        { status: 500 }
      );
    }

    // 处理重复支付请求
    if (recentPayments && recentPayments.length > 0) {
      const latestPayment = recentPayments[0];
      const paymentAge =
        Date.now() - new Date(latestPayment.created_at).getTime();

      console.warn(
        `Duplicate payment request blocked: User ${userId} tried to create payment within ${Math.floor(
          paymentAge / 1000
        )}s of existing payment ${latestPayment.id} (status: ${latestPayment.status})`
      );

      return NextResponse.json(
        {
          success: false,
          error: "You have a recent payment request. Please wait a moment before trying again.",
          code: "DUPLICATE_PAYMENT_REQUEST",
          existingPaymentId: latestPayment.id,
          waitTime: Math.ceil((60000 - paymentAge) / 1000),
        },
        { status: 429 }
      );
    }

    // 获取支付适配器
    const payment = getPayment(method);

    // 创建支付订单
    const order = {
      amount,
      currency,
      description:
        description ||
        `${billingCycle === "monthly" ? "1 Month" : "1 Year"} Premium Membership`,
      userId,
      planType: planType || "pro",
      billingCycle: billingCycle || "monthly",
      method,
    };

    console.log(`Creating payment with method: ${method}`);

    // 使用适配器创建支付订单
    const orderResult = await payment.createOrder(amount, userId, method, {
      currency,
      description: order.description,
      billingCycle,
      planType,
    });

    // 记录支付到数据库
    const days = billingCycle ? getDaysByBillingCycle(billingCycle) : 30;
    const metadataObj = {
      days,
      billingCycle: billingCycle || "monthly",
      planType: planType || "pro",
    };

    console.log("[Payment Create] Inserting payment record:", {
      user_id: userId,
      amount,
      currency,
      transaction_id: orderResult.orderId,
    });

    const { data: insertedPayment, error: recordError } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      amount,
      currency,
      status: "pending",
      payment_method: method,
      transaction_id: orderResult.orderId,
      metadata: metadataObj,
    }).select().single();

    if (recordError) {
      console.error("[Payment Create] Error recording payment:", recordError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to record payment",
        },
        { status: 500 }
      );
    }

    console.log("✅ Payment recorded:", {
      paymentId: insertedPayment?.id,
      userId: insertedPayment?.user_id,
      transactionId: orderResult.orderId,
      metadata: metadataObj,
    });

    // 返回支付信息
    const response = {
      success: true,
      orderId: orderResult.orderId,
      paymentUrl: orderResult.paymentUrl,
      clientSecret: orderResult.clientSecret,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Payment creation error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
