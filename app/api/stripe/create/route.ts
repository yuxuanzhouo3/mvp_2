// app/api/stripe/create/route.ts - 创建 Stripe 支付意向
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireAuth } from "@/lib/auth/auth";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { getPricingByMethod } from "@/lib/payment/payment-config";

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
    const userId = user.id;

    const body = await request.json();
    const {
      amount,
      currency = "usd",
      description,
      billingCycle = "monthly",
      planType = "pro"
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    // 创建 Stripe 支付意向（以分为单位）
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // 转换为分
      currency,
      description: description || `${billingCycle === "monthly" ? "1 Month" : "1 Year"} Premium Membership`,
      metadata: {
        userId,
        billingCycle,
        planType,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // 记录支付到数据库
    const { error: recordError } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      amount,
      currency: currency.toUpperCase(),
      status: "pending",
      payment_method: "stripe",
      transaction_id: paymentIntent.id,
      metadata: {
        billingCycle,
        planType,
        description: paymentIntent.description,
      },
    });

    if (recordError) {
      console.error("Error recording Stripe payment:", recordError);
      return NextResponse.json(
        { success: false, error: "Failed to record payment" },
        { status: 500 }
      );
    }

    console.log(`Stripe payment intent created: ${paymentIntent.id}`);

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe create payment intent error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to create Stripe payment intent";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
