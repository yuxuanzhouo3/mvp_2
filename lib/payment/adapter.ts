/**
 * 支付服务适配器 - 国际版
 * 支持 PayPal 和 Stripe 支付
 */

import { PaymentMethod } from "./payment-config";

/**
 * 订单接口（统一数据结构）
 */
export interface PaymentOrder {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  userId: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * 支付结果接口
 */
export interface PaymentResult {
  success: boolean;
  orderId: string;
  transactionId?: string;
  error?: string;
}

/**
 * 支付适配器接口
 */
export interface PaymentAdapter {
  /**
   * 创建支付订单
   * @param amount 支付金额（单位：元）
   * @param userId 用户 ID
   * @param method 支付方式
   * @param options 额外选项
   * @returns 支付订单信息（包含支付链接或表单）
   */
  createOrder(
    amount: number,
    userId: string,
    method: PaymentMethod,
    options?: {
      currency?: string;
      description?: string;
      billingCycle?: string;
      planType?: string;
    }
  ): Promise<{
    orderId: string;
    paymentUrl?: string;
    clientSecret?: string;
  }>;

  /**
   * 验证支付回调
   * @param params 支付回调参数
   * @returns 支付结果
   */
  verifyPayment(params: any): Promise<PaymentResult>;

  /**
   * 查询订单状态
   * @param orderId 订单 ID
   * @returns 订单信息
   */
  queryOrder(orderId: string): Promise<PaymentOrder>;

  /**
   * 取消订单
   * @param orderId 订单 ID
   */
  cancelOrder(orderId: string): Promise<void>;
}

/**
 * PayPal 支付适配器（国际版）
 */
class PayPalAdapter implements PaymentAdapter {
  private clientId: string;
  private clientSecret: string;
  private environment: string;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || "";
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    this.environment = process.env.PAYPAL_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox');
  }

  async createOrder(
    amount: number,
    userId: string,
    method: PaymentMethod,
    options: {
      currency?: string;
      description?: string;
      billingCycle?: string;
      planType?: string;
    } = {}
  ): Promise<{
    orderId: string;
    paymentUrl?: string;
  }> {
    // 直接调用 PayPal API 创建订单
    const { paypalClient } = await import("@/lib/paypal");
    const paypal = await import("@paypal/checkout-server-sdk");

    const requestBody = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: options.currency || "USD",
            value: amount.toFixed(2),
          },
          description: options.description || `${options.billingCycle === "monthly" ? "1 Month" : "1 Year"} Premium Membership`,
        },
      ],
      application_context: {
        return_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment-success?provider=paypal`,
        cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment-cancel?provider=paypal`,
      },
    };

    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody(requestBody);

    const order = await paypalClient.execute(request);
    const orderId = order.result.id;

    const approvalUrl = order.result.links.find(
      (link: any) => link.rel === "approve"
    )?.href;

    if (!approvalUrl) {
      throw new Error("Failed to get PayPal approval URL");
    }

    return {
      orderId,
      paymentUrl: approvalUrl,
    };
  }

  async verifyPayment(params: any): Promise<PaymentResult> {
    // 验证 PayPal 回调
    const response = await fetch("/api/payment/paypal/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return {
        success: false,
        orderId: params.orderId || "",
        error: "Verification failed",
      };
    }

    const data = await response.json();

    return {
      success: data.verified,
      orderId: data.orderId,
      transactionId: data.transactionId,
    };
  }

  async queryOrder(orderId: string): Promise<PaymentOrder> {
    const response = await fetch(
      `/api/payment/paypal/query?orderId=${orderId}`
    );

    if (!response.ok) {
      throw new Error("Failed to query order");
    }

    return await response.json();
  }

  async cancelOrder(orderId: string): Promise<void> {
    await fetch(`/api/payment/paypal/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });
  }
}

/**
 * Stripe 支付适配器（国际版）
 */
class StripeAdapter implements PaymentAdapter {
  private secretKey: string;
  private publishableKey: string;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY || "";
    this.publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  }

  async createOrder(
    amount: number,
    userId: string,
    method: PaymentMethod,
    options: {
      currency?: string;
      description?: string;
      billingCycle?: string;
      planType?: string;
    } = {}
  ): Promise<{
    orderId: string;
    clientSecret: string;
  }> {
    // 直接调用 Stripe API 创建支付意向
    const { stripe } = await import("@/lib/stripe");

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // 转换为分
      currency: options.currency || "usd",
      description: options.description || `${options.billingCycle === "monthly" ? "1 Month" : "1 Year"} Premium Membership`,
      metadata: {
        userId,
        billingCycle: options.billingCycle,
        planType: options.planType,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      orderId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
    };
  }

  async verifyPayment(params: any): Promise<PaymentResult> {
    // 验证 Stripe 回调
    const response = await fetch("/api/payment/stripe/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return {
        success: false,
        orderId: params.paymentIntentId || "",
        error: "Verification failed",
      };
    }

    const data = await response.json();

    return {
      success: data.verified,
      orderId: data.orderId,
      transactionId: data.transactionId,
    };
  }

  async queryOrder(orderId: string): Promise<PaymentOrder> {
    const response = await fetch(
      `/api/payment/stripe/query?orderId=${orderId}`
    );

    if (!response.ok) {
      throw new Error("Failed to query order");
    }

    return await response.json();
  }

  async cancelOrder(orderId: string): Promise<void> {
    await fetch(`/api/payment/stripe/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orderId }),
    });
  }
}

/**
 * 创建支付适配器实例
 * 国际版支持 PayPal 和 Stripe
 */
export function createPaymentAdapter(method: PaymentMethod): PaymentAdapter {
  if (method === "paypal") {
    console.log("💰 Using PayPal payment (International)");
    return new PayPalAdapter();
  } else if (method === "stripe") {
    console.log("💳 Using Stripe payment (International)");
    return new StripeAdapter();
  } else {
    throw new Error(`Unsupported payment method: ${method}`);
  }
}

/**
 * 获取支付实例
 */
export function getPayment(method: PaymentMethod): PaymentAdapter {
  return createPaymentAdapter(method);
}

/**
 * 获取支付货币
 */
export function getPaymentCurrency(): string {
  return "USD";
}

/**
 * 格式化金额显示
 */
export function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
