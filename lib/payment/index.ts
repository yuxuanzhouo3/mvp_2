/**
 * 支付服务统一入口
 * 
 * 根据部署区域自动选择正确的支付服务提供商
 * - INTL: Stripe + PayPal
 * - CN: 微信支付 + 支付宝
 */

import { isChinaDeployment } from "@/lib/config/deployment.config";

// 导出通用类型
export type { PaymentOrder, PaymentResult, PaymentAdapter } from "./adapter";
export type { PaymentOrderCN, PaymentResultCN, PaymentAdapterCN } from "./adapter-cn";

// 根据区域导出对应的配置
export * from "./payment-config";
export * from "./payment-config-cn";

// ==========================================
// 统一支付接口
// ==========================================

/**
 * 统一的支付方式类型
 */
export type UnifiedPaymentMethod = "stripe" | "paypal" | "wechat" | "alipay";

/**
 * 获取当前区域支持的支付方式
 */
export function getSupportedPaymentMethods(): UnifiedPaymentMethod[] {
  if (isChinaDeployment()) {
    return ["wechat", "alipay"];
  }
  return ["stripe", "paypal"];
}

/**
 * 检查支付方式是否支持
 */
export function isPaymentMethodSupported(method: UnifiedPaymentMethod): boolean {
  return getSupportedPaymentMethods().includes(method);
}

/**
 * 获取默认支付方式
 */
export function getDefaultPaymentMethod(): UnifiedPaymentMethod {
  return isChinaDeployment() ? "wechat" : "stripe";
}

/**
 * 获取支付货币
 */
export function getPaymentCurrency(): string {
  return isChinaDeployment() ? "CNY" : "USD";
}

/**
 * 格式化金额
 */
export function formatPaymentAmount(amount: number): string {
  if (isChinaDeployment()) {
    return `¥${amount.toFixed(2)}`;
  }
  return `$${amount.toFixed(2)}`;
}

/**
 * 获取定价信息
 */
export function getPricing(planType: "pro" | "enterprise", billingCycle: "monthly" | "yearly"): {
  amount: number;
  currency: string;
  formatted: string;
} {
  if (isChinaDeployment()) {
    const { PRICING_TABLE_CN } = require("./payment-config-cn");
    const amount = PRICING_TABLE_CN.CNY[planType][billingCycle];
    return {
      amount,
      currency: "CNY",
      formatted: `¥${amount}`,
    };
  } else {
    const { PRICING_TABLE } = require("./payment-config");
    const amount = PRICING_TABLE.USD[planType][billingCycle];
    return {
      amount,
      currency: "USD",
      formatted: `$${amount}`,
    };
  }
}

/**
 * 创建支付订单（统一接口）
 */
export async function createPaymentOrder(
  amount: number,
  userId: string,
  method: UnifiedPaymentMethod,
  options?: {
    currency?: string;
    description?: string;
    billingCycle?: string;
    planType?: string;
  }
): Promise<{
  orderId: string;
  paymentUrl?: string;
  qrCodeUrl?: string;
  clientSecret?: string;
}> {
  if (isChinaDeployment()) {
    const { createPaymentAdapterCN } = await import("./adapter-cn");
    const adapter = createPaymentAdapterCN(method as "wechat" | "alipay");
    return adapter.createOrder(amount, userId, method as "wechat" | "alipay", options);
  } else {
    const { createPaymentAdapter } = await import("./adapter");
    const adapter = createPaymentAdapter(method as "stripe" | "paypal");
    return adapter.createOrder(amount, userId, method as "stripe" | "paypal", options);
  }
}

/**
 * 支付方式显示名称映射
 */
export const PAYMENT_METHOD_LABELS: Record<UnifiedPaymentMethod, string> = {
  stripe: "Credit Card",
  paypal: "PayPal",
  wechat: "微信支付",
  alipay: "支付宝",
};

/**
 * 获取支付方式显示名称
 */
export function getPaymentMethodLabel(method: UnifiedPaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] || method;
}

