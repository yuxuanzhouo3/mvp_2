/**
 * 支付 Webhook 处理程序 - 国际版
 */

import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { PaymentMethod } from "./payment-config";

export interface WebhookEvent {
  type: string;
  data: any;
  paymentMethod: PaymentMethod;
}

/**
 * 处理 PayPal Webhook
 */
export async function handlePayPalWebhook(event: WebhookEvent) {
  const { type, data } = event;

  console.log(`Processing PayPal webhook: ${type}`, {
    hasData: !!data,
    dataType: typeof data,
    dataKeys: data ? Object.keys(data) : null
  });

  try {
    switch (type) {
      case "CHECKOUT.ORDER.APPROVED":
        await handlePayPalOrderApproved(data);
        break;
      case "CHECKOUT.ORDER.COMPLETED":
        await handlePayPalOrderCompleted(data);
        break;
      case "PAYMENT.CAPTURE.COMPLETED":
        await handlePayPalPaymentCompleted(data);
        break;
      case "PAYMENT.CAPTURE.DENIED":
        await handlePayPalPaymentDenied(data);
        break;
      case "PAYMENT.CAPTURE.DECLINED":
        await handlePayPalPaymentDeclined(data);
        break;
      default:
        console.log(`Unhandled PayPal webhook type: ${type}`);
    }
  } catch (error) {
    console.error(`Error handling PayPal webhook ${type}:`, {
      error: error.message,
      stack: error.stack,
      data
    });
    throw error;
  }
}

/**
 * 处理 Stripe Webhook
 */
export async function handleStripeWebhook(event: WebhookEvent) {
  const { type, data } = event;

  console.log(`Processing Stripe webhook: ${type}`, data);

  try {
    switch (type) {
      case "payment_intent.succeeded":
        await handleStripePaymentSucceeded(data);
        break;
      case "payment_intent.payment_failed":
        await handleStripePaymentFailed(data);
        break;
      default:
        console.log(`Unhandled Stripe webhook type: ${type}`);
    }
  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
    throw error;
  }
}

/**
 * 处理 PayPal 订单已批准
 */
async function handlePayPalOrderApproved(data: any) {
  // CHECKOUT.ORDER.APPROVED 事件的数据直接在 data 中
  const orderId = data.id;
  const purchaseUnit = data.purchase_units?.[0];

  if (!purchaseUnit) {
    console.error("No purchase units found in PayPal ORDER.APPROVED webhook");
    return;
  }

  const amount = parseFloat(purchaseUnit.amount?.value || '0');
  const currency = purchaseUnit.amount?.currency_code || 'USD';
  const referenceId = purchaseUnit.reference_id;

  console.log(`PayPal order approved: ${orderId}, amount: ${amount} ${currency}`);

  // 更新支付记录状态为 "approved"
  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "approved",
      transaction_id: orderId,
    })
    .eq("transaction_id", orderId);

  if (error) {
    console.error("Error updating PayPal payment status to approved:", error);
    // Don't throw error here as the order might be captured later
  }

  console.log(`PayPal order approved status updated: ${orderId}`);
}

/**
 * 处理 PayPal 订单已完成
 */
async function handlePayPalOrderCompleted(data: any) {
  // CHECKOUT.ORDER.COMPLETED 事件的数据直接在 data 中
  const orderId = data.id;
  const purchaseUnit = data.purchase_units?.[0];

  if (!purchaseUnit) {
    console.error("No purchase units found in PayPal ORDER.COMPLETED webhook");
    return;
  }

  const amount = parseFloat(purchaseUnit.amount?.value || '0');
  const currency = purchaseUnit.amount?.currency_code || 'USD';
  const referenceId = purchaseUnit.reference_id;

  console.log(`PayPal order completed: ${orderId}, amount: ${amount} ${currency}`);

  // 更新支付记录状态为 "completed"
  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      transaction_id: orderId,
    })
    .eq("transaction_id", orderId);

  if (error) {
    console.error("Error updating PayPal payment status to completed:", error);
    throw error;
  }

  // 获取用户ID并更新订阅
  const { data: paymentRecord, error: fetchError } = await supabaseAdmin
    .from("payments")
    .select("user_id")
    .eq("transaction_id", orderId)
    .single();

  if (!fetchError && paymentRecord) {
    await updateUserSubscription(paymentRecord.user_id, amount, currency, paymentRecord.metadata);
  }

  console.log(`PayPal order completed status updated: ${orderId}`);
}

/**
 * 处理 PayPal 支付完成
 */
async function handlePayPalPaymentCompleted(data: any) {
  // PAYMENT.CAPTURE.COMPLETED 事件的数据直接在 data 中
  const orderId = data.id;
  const amount = data.amount?.value || '0';
  const currency = data.amount?.currency_code || 'USD';
  const customId = data.custom_id;

  console.log(`Processing PAYMENT.CAPTURE.COMPLETED for order: ${orderId}`, {
    amount,
    currency,
    customId
  });

  // 先查找支付记录以获取用户ID和元数据
  const { data: paymentRecord, error: fetchError } = await supabaseAdmin
    .from("payments")
    .select("user_id, metadata, status")
    .eq("transaction_id", orderId)
    .single();

  if (fetchError) {
    console.error("Error fetching payment record:", fetchError);
    throw fetchError;
  }

  if (!paymentRecord) {
    console.error("Payment record not found for order:", orderId);
    throw new Error("Payment record not found");
  }

  // 如果支付已经完成，跳过处理
  if (paymentRecord.status === "completed") {
    console.log(`Payment ${orderId} already completed, skipping...`);
    return;
  }

  // 更新支付记录状态
  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("transaction_id", orderId);

  if (error) {
    console.error("Error updating PayPal payment status:", error);
    throw error;
  }

  // 使用支付记录中的用户ID和元数据更新订阅状态
  await updateUserSubscription(paymentRecord.user_id, parseFloat(amount), currency, paymentRecord.metadata);

  console.log(`PayPal payment completed: ${orderId} for user: ${paymentRecord.user_id}`);
}

/**
 * 处理 PayPal 支付失败
 */
async function handlePayPalPaymentDenied(data: any) {
  // PAYMENT.CAPTURE.DENIED 事件的数据直接在 data 中
  const orderId = data.id;

  console.log(`Processing PAYMENT.CAPTURE.DENIED for order: ${orderId}`);

  // 更新支付记录状态
  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
    })
    .eq("transaction_id", orderId);

  if (error) {
    console.error("Error updating PayPal payment status:", error);
    throw error;
  }

  console.log(`PayPal payment denied: ${orderId}`);
}

/**
 * 处理 PayPal 支付被拒绝（DECLINED）
 */
async function handlePayPalPaymentDeclined(data: any) {
  // PAYMENT.CAPTURE.DECLINED 事件的数据直接在 data 中
  const orderId = data.id;

  console.log(`Processing PAYMENT.CAPTURE.DECLINED for order: ${orderId}`);

  // 更新支付记录状态
  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
    })
    .eq("transaction_id", orderId);

  if (error) {
    console.error("Error updating PayPal payment status to declined:", error);
    throw error;
  }

  console.log(`PayPal payment declined: ${orderId}`);
}

/**
 * 处理 Stripe 支付成功
 */
async function handleStripePaymentSucceeded(data: any) {
  const paymentIntentId = data.id;
  const amount = data.amount / 100; // Stripe 使用分作为单位
  const currency = data.currency;

  // 更新支付记录状态
  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      transaction_id: paymentIntentId,
    })
    .eq("transaction_id", paymentIntentId);

  if (error) {
    console.error("Error updating Stripe payment status:", error);
    throw error;
  }

  // 更新用户订阅状态
  await updateUserSubscription(data.metadata?.userId, amount, currency.toUpperCase());

  console.log(`Stripe payment succeeded: ${paymentIntentId}`);
}

/**
 * 处理 Stripe 支付失败
 */
async function handleStripePaymentFailed(data: any) {
  const paymentIntentId = data.id;

  // 更新支付记录状态
  const { error } = await supabaseAdmin
    .from("payments")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
    })
    .eq("transaction_id", paymentIntentId);

  if (error) {
    console.error("Error updating Stripe payment status:", error);
    throw error;
  }

  console.log(`Stripe payment failed: ${paymentIntentId}`);
}

/**
 * 更新用户订阅状态
 */
async function updateUserSubscription(userId: string, amount: number, currency: string, metadata?: any) {
  try {
    // 从元数据或金额判断订阅类型
    const billingCycle = metadata?.billingCycle || (amount >= 99 ? "yearly" : "monthly");
    const planType = metadata?.planType || (amount >= 199 ? "enterprise" : "pro");
    const days = billingCycle === "yearly" ? 365 : 30;

    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + days);

    // 更新用户订阅状态
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert({
        user_id: userId,
        status: "active",
        subscription_end: subscriptionEnd.toISOString(),
        plan_type: billingCycle === "yearly" ? "yearly" : "monthly",
        currency,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Error updating user subscription:", error);
      throw error;
    }

    // 同时更新用户的元数据，以便前端能立即显示正确的订阅状态
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
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

    // 注意：在服务端（webhook处理）中，window 对象不存在
    // 前端的刷新将由 payment-success 页面处理

    console.log(`Updated subscription for user ${userId}: ${planType} plan for ${days} days`);
  } catch (error) {
    console.error("Error in updateUserSubscription:", error);
    throw error;
  }
}

/**
 * 通用 Webhook 处理入口
 */
export async function handleWebhook(event: WebhookEvent) {
  const { paymentMethod } = event;

  if (paymentMethod === "paypal") {
    return await handlePayPalWebhook(event);
  } else if (paymentMethod === "stripe") {
    return await handleStripeWebhook(event);
  } else {
    throw new Error(`Unsupported payment method for webhook: ${paymentMethod}`);
  }
}
