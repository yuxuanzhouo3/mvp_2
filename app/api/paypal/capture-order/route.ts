// app/api/paypal/capture-order/route.ts - 捕获 PayPal 订单
import { NextRequest, NextResponse } from "next/server";
import paypal from '@paypal/checkout-server-sdk';
import { paypalClient } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";

export async function POST(request: NextRequest) {
  let orderId: string | undefined;

  try {
    const body = await request.json();
    orderId = body?.orderId;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Order ID is required" },
        { status: 400 }
      );
    }

    // 检查是否使用演示凭据
    const clientId = process.env.PAYPAL_CLIENT_ID || 'demo_client_id';
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'demo_client_secret';

    if (clientId === 'demo_client_id' || clientSecret === 'demo_client_secret') {
      console.error('PayPal capture attempted with demo credentials');
      return NextResponse.json(
        { success: false, error: "PayPal service not properly configured. Please check environment variables." },
        { status: 500 }
      );
    }

    // 先检查支付记录是否已经完成
    const { data: existingPayment, error: existingPaymentError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("transaction_id", orderId)
      .single();

    if (existingPaymentError && existingPaymentError.code !== 'PGRST116') {
      // PGRST116 是 "not found" 错误，这是正常的
      console.error("Error checking existing payment:", existingPaymentError);
      throw new Error(`Database error: ${existingPaymentError.message}`);
    }

    if (existingPayment && existingPayment.status === "completed") {
      // 如果已经完成，直接返回成功
      return NextResponse.json({
        success: true,
        captureId: existingPayment.transaction_id,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
      });
    }

    // 捕获 PayPal 订单
    console.log(`Attempting to capture PayPal order: ${orderId}`);
    const captureRequest = new paypal.orders.OrdersCaptureRequest(orderId);

    let capture;
    try {
      capture = await paypalClient.execute(captureRequest);
      console.log(`PayPal capture response:`, JSON.stringify(capture.result, null, 2));
    } catch (paypalError: any) {
      console.error(`PayPal API error for order ${orderId}:`, {
        message: paypalError.message,
        statusCode: paypalError.statusCode,
        details: paypalError.details,
        fullError: paypalError
      });

      // 检查是否是订单已捕获的错误
      if (paypalError.message?.includes('ORDER_ALREADY_CAPTURED') ||
          paypalError.details?.some((detail: any) => detail.issue === 'ORDER_ALREADY_CAPTURED')) {
        console.log(`Order ${orderId} already captured, treating as success`);

        // 查询现有支付记录
        const { data: existingCapture, error: existingCaptureError } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("transaction_id", orderId)
          .single();

        if (existingCaptureError) {
          console.error("Error fetching existing capture:", existingCaptureError);
          throw new Error(`Database error checking existing capture: ${existingCaptureError.message}`);
        }

        if (existingCapture && existingCapture.status === "completed") {
          return NextResponse.json({
            success: true,
            captureId: existingCapture.transaction_id,
            amount: existingCapture.amount,
            currency: existingCapture.currency,
          });
        }
      }

      throw paypalError;
    }

    // 安全地访问 PayPal 响应结构
    console.log(`[DEBUG] PayPal capture result structure:`, JSON.stringify(capture.result, null, 2));

    const purchaseUnit = capture.result.purchase_units?.[0];
    if (!purchaseUnit) {
      throw new Error('No purchase units found in PayPal response');
    }

    const payments = purchaseUnit.payments;
    if (!payments?.captures?.[0]) {
      throw new Error('No capture information found in PayPal response');
    }

    const captureInfo = payments.captures[0];
    const captureId = captureInfo.id;
    const amount = parseFloat(captureInfo.amount?.value || '0');
    const currency = captureInfo.amount?.currency_code || 'USD';

    console.log(`[DEBUG] Extracted capture info:`, { captureId, amount, currency });

    // 更新支付记录状态
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        transaction_id: captureId,
      })
      .eq("transaction_id", orderId);

    if (updateError) {
      console.error("Error updating PayPal payment status:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update payment status" },
        { status: 500 }
      );
    }

    // 更新用户订阅状态
    const { data: paymentRecord, error: paymentRecordError } = await supabaseAdmin
      .from("payments")
      .select("user_id, metadata")
      .eq("transaction_id", captureId)
      .single();

    if (paymentRecordError) {
      console.error("Error fetching payment record for subscription update:", paymentRecordError);
      // 支付已经成功，记录错误但不阻止响应
    } else if (paymentRecord) {
      const { user_id, metadata } = paymentRecord;
      const days = metadata?.billingCycle === "yearly" ? 365 : 30;

      // 检查用户是否已有活跃订阅
      const { data: existingSubscription, error: fetchError } = await supabaseAdmin
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .gte("subscription_end", new Date().toISOString())
        .single();

      let subscriptionEnd: Date;

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error("Error checking existing subscription:", fetchError);
      }

      if (existingSubscription) {
        // 用户已有活跃订阅，叠加时间
        console.log(`User ${user_id} has existing subscription ending at: ${existingSubscription.subscription_end}`);
        subscriptionEnd = new Date(existingSubscription.subscription_end);
        subscriptionEnd.setDate(subscriptionEnd.getDate() + days);
        console.log(`Extended subscription to: ${subscriptionEnd.toISOString()}`);
      } else {
        // 用户没有活跃订阅，创建新订阅
        subscriptionEnd = new Date();
        subscriptionEnd.setDate(subscriptionEnd.getDate() + days);
        console.log(`Created new subscription for user ${user_id} ending at: ${subscriptionEnd.toISOString()}`);
      }

      const { error: subscriptionError } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert({
          user_id,
          status: "active",
          subscription_end: subscriptionEnd.toISOString(),
          plan_type: metadata?.planType || "pro",
          currency,
          updated_at: new Date().toISOString(),
        });

      if (subscriptionError) {
        console.error("Error updating user subscription:", subscriptionError);
        // 支付已经成功，不返回错误
      }

      // 同时更新用户的元数据，以便前端能立即显示正确的订阅状态
      const planType = metadata?.planType || "pro";
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        {
          user_metadata: {
            subscription_plan: planType,
            subscription_status: "active",
            subscription_end: subscriptionEnd.toISOString(),
          }
        }
      );

      if (updateError) {
        console.error("Error updating user metadata:", updateError);
        // 不抛出错误，因为订阅已经成功更新
      }
    }

    console.log(`PayPal order captured: ${orderId}, capture: ${captureId}`);

    return NextResponse.json({
      success: true,
      captureId,
      amount,
      currency,
    });
  } catch (error: any) {
    console.error("PayPal capture order error:", {
      orderId,
      error: error.message,
      stack: error.stack,
      paypalError: error
    });

    // 检查是否是配置问题
    if (error.message?.includes('INVALID_REQUEST') ||
        error.message?.includes('authentication') ||
        error.statusCode === 401) {
      console.error("PayPal credentials or configuration issue detected");
      return NextResponse.json(
        { success: false, error: "PayPal service configuration error. Please check API credentials." },
        { status: 500 }
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Failed to capture PayPal order";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
