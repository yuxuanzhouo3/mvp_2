/**
 * 支付 Webhook 处理程序 - 国际版
 */

import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { PaymentMethod } from "./payment-config";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";

export interface WebhookEvent {
  type: string;
  data: any;
  paymentMethod: PaymentMethod;
}

type AppSubscriptionStatus = "active" | "expired" | "cancelled";
type PlanTier = "free" | "pro" | "enterprise";

function resolveBillingCycleFromInterval(
  interval?: Stripe.Price.Recurring.Interval | string
): "monthly" | "yearly" {
  if (interval === "year") return "yearly";
  if (interval === "month") return "monthly";
  return "monthly";
}

function mapStripeStatusToAppStatus(status?: string): AppSubscriptionStatus {
  switch (status) {
    case "canceled":
      return "cancelled";
    case "unpaid":
    case "incomplete_expired":
    case "past_due":
      return "expired";
    default:
      return "active";
  }
}

function normalizePlanType(value?: string | null): PlanTier {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("enterprise")) return "enterprise";
  if (normalized.includes("pro")) return "pro";
  return "free";
}

function resolvePlanType(params: {
  metadata?: Record<string, any>;
  amount?: number;
  billingCycle?: string | null;
  priceNickname?: string | null;
  priceId?: string | null;
}): PlanTier {
  const { metadata, amount = 0, billingCycle, priceNickname, priceId } = params;

  const metaPlan = normalizePlanType(
    metadata?.planType ||
      metadata?.tier ||
      metadata?.plan ||
      metadata?.plan_type ||
      metadata?.subscription_plan ||
      metadata?.product_tier
  );
  if (metaPlan !== "free") return metaPlan;

  const nicknamePlan = normalizePlanType(priceNickname);
  if (nicknamePlan !== "free") return nicknamePlan;

  const priceIdFromMeta =
    (metadata?.priceId as string | undefined) ||
    (metadata?.price_id as string | undefined) ||
    (metadata?.price as string | undefined) ||
    priceId ||
    null;

  if (priceIdFromMeta) {
    if (
      process.env.STRIPE_ENTERPRISE_PRICE_ID &&
      priceIdFromMeta === process.env.STRIPE_ENTERPRISE_PRICE_ID
    ) {
      return "enterprise";
    }
    if (
      process.env.STRIPE_PRO_PRICE_ID &&
      priceIdFromMeta === process.env.STRIPE_PRO_PRICE_ID
    ) {
      return "pro";
    }
  }

  const normalizedAmount = Math.max(0, amount);
  if (billingCycle === "yearly") {
    return normalizedAmount >= 300 ? "enterprise" : "pro";
  }
  if (billingCycle === "monthly") {
    return normalizedAmount >= 30 ? "enterprise" : "pro";
  }

  if (normalizedAmount >= 300) return "enterprise";
  if (normalizedAmount >= 30) return "enterprise";
  return "pro";
}

async function syncProfileTables(
  userId: string,
  planType: PlanTier,
  status: AppSubscriptionStatus
) {
  const now = new Date().toISOString();
  const profileUpdates = {
    subscription_tier: planType,
    subscription_status: status,
    updated_at: now,
  };

  try {
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          ...profileUpdates,
        },
        { onConflict: "id" }
      );
  } catch (error) {
    console.error("[Webhook] Failed to sync profiles table:", error);
  }

  try {
    await supabaseAdmin
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          ...profileUpdates,
          created_at: now,
        },
        { onConflict: "id" }
      );
  } catch (error) {
    console.error("[Webhook] Failed to sync user_profiles table:", error);
  }
}

async function resolveUserIdFromStripe(
  metadata?: Record<string, any>,
  lookup?: { subscriptionId?: string; paymentIntentId?: string }
): Promise<string | null> {
  const metaUser =
    metadata?.userId ||
    metadata?.user_id ||
    metadata?.userid ||
    metadata?.customer_id ||
    null;
  if (metaUser) return metaUser;

  try {
    if (lookup?.subscriptionId) {
      const { data } = await supabaseAdmin
        .from("payments")
        .select("user_id")
        .eq("subscription_id", lookup.subscriptionId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data[0]?.user_id) {
        return data[0].user_id;
      }
    }

    if (lookup?.paymentIntentId) {
      const { data } = await supabaseAdmin
        .from("payments")
        .select("user_id")
        .eq("transaction_id", lookup.paymentIntentId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data[0]?.user_id) {
        return data[0].user_id;
      }
    }
  } catch (error) {
    console.error("Error resolving user id from Stripe metadata:", error);
  }

  return null;
}

async function upsertStripePaymentRecord(params: {
  transactionId: string;
  amount: number;
  currency: string;
  status: "completed" | "failed" | "pending";
  userId?: string | null;
  subscriptionId?: string | null;
  metadata?: Record<string, any>;
  completedAt?: string;
}) {
  const {
    transactionId,
    amount,
    currency,
    status,
    userId,
    subscriptionId,
    metadata = {},
    completedAt,
  } = params;

  console.log(`[Webhook] Upserting payment record for transaction: ${transactionId}, status: ${status}`);

  // 先查询是否已存在该 transaction_id 的记录
  const { data: existingPayment, error: queryError } = await supabaseAdmin
    .from("payments")
    .select("id, status, user_id")
    .eq("transaction_id", transactionId)
    .limit(1)
    .single();

  if (queryError && queryError.code !== "PGRST116") {
    // PGRST116 是 "no rows returned" 错误，可以忽略
    console.error("[Webhook] Error querying existing payment:", queryError);
  }

  const now = new Date().toISOString();
  const resolvedUserId = userId || existingPayment?.user_id || null;

  if (existingPayment) {
    // 记录存在，执行更新
    console.log(`[Webhook] Found existing payment ${existingPayment.id}, updating status from ${existingPayment.status} to ${status}`);
    
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        status,
        user_id: resolvedUserId,
        subscription_id: subscriptionId || null,
        metadata: { ...metadata },
        completed_at: completedAt || (status === "completed" ? now : null),
        updated_at: now,
      })
      .eq("id", existingPayment.id);

    if (updateError) {
      console.error("[Webhook] Error updating payment record:", updateError);
      throw updateError;
    }
    console.log(`[Webhook] Successfully updated payment ${existingPayment.id} to status: ${status}`);
  } else {
    // 记录不存在，执行插入
    console.log(`[Webhook] No existing payment found, inserting new record for transaction: ${transactionId}`);
    
    const { error: insertError } = await supabaseAdmin.from("payments").insert({
      user_id: resolvedUserId,
      amount,
      currency: currency?.toUpperCase?.() || "USD",
      status,
      payment_method: "stripe",
      transaction_id: transactionId,
      subscription_id: subscriptionId || null,
      metadata,
      completed_at: completedAt || (status === "completed" ? now : null),
      updated_at: now,
    });

    if (insertError) {
      console.error("[Webhook] Error inserting payment record:", insertError);
      throw insertError;
    }
    console.log(`[Webhook] Successfully inserted new payment record for transaction: ${transactionId}`);
  }
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
  } catch (error: any) {
    console.error(`Error handling PayPal webhook ${type}:`, {
      error: error?.message,
      stack: error?.stack,
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
      case "checkout.session.completed":
        await handleStripeCheckoutSessionCompleted(data);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleStripeSubscriptionUpdated(data, type);
        break;
      case "customer.subscription.deleted":
        await handleStripeSubscriptionDeleted(data);
        break;
      case "invoice.payment_succeeded":
        await handleStripeInvoicePaymentSucceeded(data);
        break;
      case "invoice.payment_failed":
        await handleStripeInvoicePaymentFailed(data);
        break;
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
  const amount =
    data.amount_received !== undefined
      ? data.amount_received / 100
      : data.amount / 100;
  const currency = (data.currency || "usd").toUpperCase();
  const metadata = data.metadata || {};
  const subscriptionId =
    typeof data.subscription === "string" ? data.subscription : undefined;

  let userId =
    metadata.userId || metadata.user_id || metadata.userid || null;

  if (!userId) {
    userId = await resolveUserIdFromStripe(metadata, {
      subscriptionId,
      paymentIntentId,
    });
  }

  await upsertStripePaymentRecord({
    transactionId: paymentIntentId,
    amount,
    currency,
    status: "completed",
    userId,
    subscriptionId,
    metadata,
    completedAt: new Date().toISOString(),
  });

  if (userId) {
    await updateUserSubscription(userId, amount, currency, metadata);
  }

  console.log(`Stripe payment succeeded: ${paymentIntentId}`);
}

/**
 * 处理 Stripe 支付失败
 */
async function handleStripePaymentFailed(data: any) {
  const paymentIntentId = data.id;
  const metadata = data.metadata || {};
  const subscriptionId =
    typeof data.subscription === "string" ? data.subscription : undefined;
  const amount =
    data.amount_received !== undefined
      ? data.amount_received / 100
      : data.amount
      ? data.amount / 100
      : 0;
  const currency = (data.currency || "usd").toUpperCase();

  let userId =
    metadata.userId || metadata.user_id || metadata.userid || null;

  if (!userId) {
    userId = await resolveUserIdFromStripe(metadata, {
      subscriptionId,
      paymentIntentId,
    });
  }

  await upsertStripePaymentRecord({
    transactionId: paymentIntentId,
    amount,
    currency,
    status: "failed",
    userId,
    subscriptionId,
    metadata,
    completedAt: new Date().toISOString(),
  });

  console.log(`Stripe payment failed: ${paymentIntentId}`);
}

/**
 * 更新用户订阅状态 - 支持叠加订阅时间
 */
async function updateUserSubscription(userId: string, amount: number, currency: string, metadata?: any) {
  try {
    if (!userId) {
      console.warn("updateUserSubscription called without userId", { metadata });
      return;
    }

    // 从元数据或金额判断订阅类型
    const billingCycle =
      metadata?.billingCycle ||
      metadata?.billing_cycle ||
      (amount >= 99 ? "yearly" : "monthly");
    const planType = resolvePlanType({
      metadata,
      amount,
      billingCycle,
    });
    const daysToAdd = billingCycle === "yearly" ? 365 : 30;
    const requestedEnd = metadata?.subscriptionEnd ? new Date(metadata.subscriptionEnd) : null;
    const statusToSet: AppSubscriptionStatus = metadata?.status || "active";
    const isStatusActive = statusToSet === "active";
    const normalizedCurrency = currency?.toUpperCase?.() || "USD";

    // 首先检查用户是否已有活跃订阅
    const { data: existingSubscription, error: fetchError } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("subscription_end", new Date().toISOString())
      .single();

    let subscriptionEnd: Date;
    let isNewSubscription = false;

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error checking existing subscription:", fetchError);
      throw fetchError;
    }

    if (requestedEnd) {
      if (existingSubscription) {
        const currentEnd = new Date(existingSubscription.subscription_end);
        subscriptionEnd = currentEnd > requestedEnd ? currentEnd : requestedEnd;
      } else {
        isNewSubscription = true;
        subscriptionEnd = requestedEnd;
      }
    } else if (existingSubscription && isStatusActive) {
      // 用户已有活跃订阅，叠加时间
      console.log(`User ${userId} has existing subscription ending at: ${existingSubscription.subscription_end}`);

      subscriptionEnd = new Date(existingSubscription.subscription_end);
      subscriptionEnd.setDate(subscriptionEnd.getDate() + daysToAdd);

      console.log(`Extended subscription to: ${subscriptionEnd.toISOString()}`);
    } else if (existingSubscription && !isStatusActive) {
      subscriptionEnd = new Date(existingSubscription.subscription_end);
    } else {
      isNewSubscription = true;
      subscriptionEnd = new Date();
      if (isStatusActive) {
        subscriptionEnd.setDate(subscriptionEnd.getDate() + daysToAdd);
      }
      console.log(`Created new subscription for user ${userId} ending at: ${subscriptionEnd.toISOString()}`);
    }

    // 更新或创建订阅记录
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert({
        user_id: userId,
        status: statusToSet,
        subscription_end: subscriptionEnd.toISOString(),
        // 订阅档位（pro / enterprise）
        plan_type: planType,
        currency: normalizedCurrency,
        updated_at: new Date().toISOString(),
        // 只在创建新订阅时设置 created_at
        ...(isNewSubscription && { created_at: new Date().toISOString() })
      }, {
        // 使用 onConflict 参数来处理重复键
        onConflict: 'user_id',
        ignoreDuplicates: false
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
          subscription_status: statusToSet,
          subscription_end: subscriptionEnd.toISOString(),
          subscription_billing_cycle: billingCycle,
        }
      }
    );

    if (updateError) {
      console.error("Error updating user metadata:", updateError);
      // 不抛出错误，因为订阅已经成功更新
    }

    await syncProfileTables(userId, planType, statusToSet);

    console.log(`${isNewSubscription ? 'Created' : 'Extended'} subscription for user ${userId}: ${planType} plan ${daysToAdd} days, expires at ${subscriptionEnd.toISOString()}`);
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

/**
 * Stripe Checkout Session completed (subscription checkout)
 */
async function handleStripeCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription)?.id;

  const amount = session.amount_total ? session.amount_total / 100 : 0;
  const currency = (session.currency || "usd").toUpperCase();
  const metadata = session.metadata || {};

  let userId =
    metadata.userId ||
    metadata.user_id ||
    metadata.userid ||
    session.client_reference_id ||
    null;

  let billingCycle: "monthly" | "yearly" | undefined =
    (metadata.billingCycle as any) || undefined;
  let subscriptionEnd: string | undefined;
  let priceNickname: string | null = null;
  let priceId: string | null = null;
  let planType = resolvePlanType({
    metadata,
    amount,
    billingCycle,
  });

  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const subscriptionPrice = subscription.items?.data?.[0]?.price;
      billingCycle =
        billingCycle ||
        resolveBillingCycleFromInterval(
          subscriptionPrice?.recurring?.interval
        );
      priceNickname = subscriptionPrice?.nickname || null;
      priceId = subscriptionPrice?.id || null;
      planType = resolvePlanType({
        metadata: { ...metadata, ...(subscription.metadata || {}) },
        amount: amount || (subscriptionPrice?.unit_amount ? subscriptionPrice.unit_amount / 100 : 0),
        billingCycle,
        priceNickname,
        priceId,
      });
      subscriptionEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : undefined;

      if (!userId) {
        userId = await resolveUserIdFromStripe(subscription.metadata, {
          subscriptionId,
          paymentIntentId,
        });
      }
    } catch (error) {
      console.error("Error retrieving Stripe subscription for checkout:", error);
    }
  }

  if (!userId) {
    userId = await resolveUserIdFromStripe(metadata, {
      subscriptionId,
      paymentIntentId,
    });
  }

  planType = resolvePlanType({
    metadata,
    amount,
    billingCycle,
    priceNickname,
    priceId,
  });

  await upsertStripePaymentRecord({
    transactionId: paymentIntentId || session.id,
    amount,
    currency,
    status: "completed",
    userId,
    subscriptionId,
    metadata: {
      ...metadata,
      checkoutSessionId: session.id,
      billingCycle: billingCycle || "monthly",
      planType,
      subscriptionId,
      eventType: "checkout.session.completed",
    },
    completedAt: new Date().toISOString(),
  });

  if (userId) {
    await updateUserSubscription(userId, amount, currency, {
      ...metadata,
      billingCycle: billingCycle || "monthly",
      planType,
      subscriptionEnd,
      status: "active",
      subscriptionId,
    });
  } else {
    console.warn("Stripe checkout completed but user id missing", {
      checkoutSessionId: session.id,
      subscriptionId,
    });
  }
}

/**
 * Stripe subscription created/updated
 */
async function handleStripeSubscriptionUpdated(
  subscription: Stripe.Subscription,
  eventType: string
) {
  const subscriptionId = subscription.id;
  const price = subscription.items?.data?.[0]?.price;
  const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
  const currency = (price?.currency || subscription.currency || "usd").toUpperCase();

  const billingCycle = resolveBillingCycleFromInterval(price?.recurring?.interval);
  const planType = resolvePlanType({
    metadata: subscription.metadata || undefined,
    amount,
    billingCycle,
    priceNickname: price?.nickname || null,
    priceId: price?.id || null,
  });
  const subscriptionEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : undefined;
  const status = mapStripeStatusToAppStatus(subscription.status);

  let userId =
    subscription.metadata?.userId ||
    subscription.metadata?.user_id ||
    subscription.metadata?.userid ||
    null;

  if (!userId) {
    userId = await resolveUserIdFromStripe(subscription.metadata, { subscriptionId });
  }

  if (!userId) {
    console.warn(`Stripe ${eventType} received without user metadata`, {
      subscriptionId,
    });
    return;
  }

  await updateUserSubscription(userId, amount, currency, {
    ...subscription.metadata,
    billingCycle,
    planType,
    subscriptionEnd,
    status,
    subscriptionId,
  });
}

/**
 * Stripe subscription cancelled/deleted
 */
async function handleStripeSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id;
  const price = subscription.items?.data?.[0]?.price;
  const amount = price?.unit_amount ? price.unit_amount / 100 : 0;
  const currency = (price?.currency || subscription.currency || "usd").toUpperCase();
  const billingCycle = resolveBillingCycleFromInterval(price?.recurring?.interval);
  const planType = resolvePlanType({
    metadata: subscription.metadata || undefined,
    amount,
    billingCycle,
    priceNickname: price?.nickname || null,
    priceId: price?.id || null,
  });

  const subscriptionEnd =
    subscription.cancel_at_period_end && subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : new Date().toISOString();

  let userId =
    subscription.metadata?.userId ||
    subscription.metadata?.user_id ||
    subscription.metadata?.userid ||
    null;

  if (!userId) {
    userId = await resolveUserIdFromStripe(subscription.metadata, { subscriptionId });
  }

  if (!userId) {
    console.warn("Stripe subscription deleted but user id missing", { subscriptionId });
    return;
  }

  await updateUserSubscription(userId, amount, currency, {
    ...subscription.metadata,
    billingCycle,
    planType,
    subscriptionEnd,
    status: "cancelled",
    subscriptionId,
  });
}

/**
 * Stripe invoice payment succeeded (recurring)
 */
async function handleStripeInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const paymentIntentId =
    typeof invoice.payment_intent === "string"
      ? invoice.payment_intent
      : invoice.payment_intent?.id;
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription as Stripe.Subscription)?.id;

  const amount =
    invoice.amount_paid !== undefined
      ? invoice.amount_paid / 100
      : invoice.amount_due !== undefined
      ? invoice.amount_due / 100
      : 0;
  const currency = (invoice.currency || "usd").toUpperCase();

  const line = invoice.lines?.data?.[0];
  const billingCycle = resolveBillingCycleFromInterval(line?.price?.recurring?.interval);
  const planType = resolvePlanType({
    metadata: invoice.metadata || undefined,
    amount: amount || (line?.price?.unit_amount ? line.price.unit_amount / 100 : 0),
    billingCycle,
    priceNickname: line?.price?.nickname || null,
    priceId: line?.price?.id || null,
  });
  const subscriptionEnd = line?.period?.end
    ? new Date(line.period.end * 1000).toISOString()
    : undefined;

  let userId =
    invoice.metadata?.userId ||
    invoice.metadata?.user_id ||
    invoice.metadata?.userid ||
    null;

  if (!userId) {
    userId = await resolveUserIdFromStripe(invoice.metadata || undefined, {
      subscriptionId,
      paymentIntentId,
    });
  }

  if (!userId && paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      userId =
        (paymentIntent.metadata as any)?.userId ||
        (paymentIntent.metadata as any)?.user_id ||
        null;
    } catch (error) {
      console.error("Error retrieving payment intent for invoice:", error);
    }
  }

  await upsertStripePaymentRecord({
    transactionId: paymentIntentId || invoice.id,
    amount,
    currency,
    status: "completed",
    userId,
    subscriptionId,
    metadata: {
      ...(invoice.metadata || {}),
      billingCycle: billingCycle || "monthly",
      planType,
      subscriptionId,
      invoiceId: invoice.id,
      eventType: "invoice.payment_succeeded",
    },
    completedAt: new Date().toISOString(),
  });

  if (userId) {
    await updateUserSubscription(userId, amount, currency, {
      ...invoice.metadata,
      billingCycle: billingCycle || "monthly",
      planType,
      subscriptionEnd,
      status: "active",
      subscriptionId,
    });
  } else {
    console.warn("Stripe invoice payment succeeded but user id missing", {
      invoiceId: invoice.id,
      subscriptionId,
    });
  }
}

/**
 * Stripe invoice payment failed
 */
async function handleStripeInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const paymentIntentId =
    typeof invoice.payment_intent === "string"
      ? invoice.payment_intent
      : invoice.payment_intent?.id;
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : (invoice.subscription as Stripe.Subscription)?.id;

  const amount =
    invoice.amount_due !== undefined
      ? invoice.amount_due / 100
      : (invoice.amount_paid ?? 0) / 100;
  const currency = (invoice.currency || "usd").toUpperCase();
  const line = invoice.lines?.data?.[0];
  const billingCycle = resolveBillingCycleFromInterval(line?.price?.recurring?.interval);
  const planType = resolvePlanType({
    metadata: invoice.metadata || undefined,
    amount: amount || (line?.price?.unit_amount ? line.price.unit_amount / 100 : 0),
    billingCycle,
    priceNickname: line?.price?.nickname || null,
    priceId: line?.price?.id || null,
  });
  const subscriptionEnd = line?.period?.end
    ? new Date(line.period.end * 1000).toISOString()
    : new Date().toISOString();

  let userId =
    invoice.metadata?.userId ||
    invoice.metadata?.user_id ||
    invoice.metadata?.userid ||
    null;

  if (!userId) {
    userId = await resolveUserIdFromStripe(invoice.metadata || undefined, {
      subscriptionId,
      paymentIntentId,
    });
  }

  await upsertStripePaymentRecord({
    transactionId: paymentIntentId || invoice.id,
    amount,
    currency,
    status: "failed",
    userId,
    subscriptionId,
    metadata: {
      ...(invoice.metadata || {}),
      billingCycle: billingCycle || "monthly",
      planType,
      subscriptionId,
      invoiceId: invoice.id,
      eventType: "invoice.payment_failed",
    },
    completedAt: new Date().toISOString(),
  });

  if (userId) {
    await updateUserSubscription(userId, amount, currency, {
      ...invoice.metadata,
      billingCycle: billingCycle || "monthly",
      planType,
      subscriptionEnd,
      status: "expired",
      subscriptionId,
    });
  } else {
    console.warn("Stripe invoice payment failed but user id missing", {
      invoiceId: invoice.id,
      subscriptionId,
    });
  }
}
