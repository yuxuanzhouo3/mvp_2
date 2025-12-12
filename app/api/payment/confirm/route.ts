// app/api/payment/confirm/route.ts - 支付确认API路由
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { getPayment } from "@/lib/payment/adapter";
import type { PaymentMethod } from "@/lib/payment/payment-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, paymentMethod, userId } = body;

    if (!orderId || !paymentMethod || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters" },
        { status: 400 }
      );
    }

    console.log(`Confirming payment: ${orderId} with method: ${paymentMethod}`);

    // 获取支付适配器
    const payment = getPayment(paymentMethod as PaymentMethod);

    // 验证支付
    const verificationResult = await payment.verifyPayment({ orderId, userId });

    if (!verificationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment verification failed",
          details: verificationResult.error
        },
        { status: 400 }
      );
    }

    // 更新支付记录状态
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        transaction_id: verificationResult.transactionId,
      })
      .eq("transaction_id", orderId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating payment status:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update payment status" },
        { status: 500 }
      );
    }

    // 更新用户订阅状态
    const { data: paymentRecord } = await supabaseAdmin
      .from("payments")
      .select("amount, currency, metadata")
      .eq("transaction_id", orderId)
      .eq("user_id", userId)
      .single();

    if (paymentRecord) {
      const { amount, currency, metadata } = paymentRecord;
      const days = metadata?.days || (amount >= 99 ? 365 : 30);

      const subscriptionEnd = new Date();
      subscriptionEnd.setDate(subscriptionEnd.getDate() + days);

      const { error: subscriptionError } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert({
          user_id: userId,
          status: "active",
          subscription_end: subscriptionEnd.toISOString(),
          plan_type: metadata?.planType || "pro",
          currency,
          updated_at: new Date().toISOString(),
        });

      if (subscriptionError) {
        console.error("Error updating user subscription:", subscriptionError);
        // 不返回错误，因为支付已经成功
      }
    }

    console.log(`Payment confirmed successfully: ${orderId}`);

    return NextResponse.json({
      success: true,
      transactionId: verificationResult.transactionId,
      orderId: verificationResult.orderId,
    });
  } catch (error) {
    console.error("Payment confirmation error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
