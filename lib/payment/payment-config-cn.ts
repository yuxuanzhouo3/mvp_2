/**
 * 统一的支付配置 - 中国版 (CN)
 * 所有关于价格、货币的定义都在这里，只定义一次，避免重复
 *
 * 定价方案：
 * - Free: ¥0
 * - Pro: ¥19.9/月, ¥199/年
 * - Enterprise: ¥49.9/月, ¥499/年
 *
 * 测试模式：设置环境变量 PAYMENT_TEST_MODE=true 可将所有支付金额改为 0.01 元
 */

export type BillingCycle = "monthly" | "yearly";
export type PaymentMethodCN = "wechat" | "alipay";
export type PaymentModeCN = "qrcode" | "page"; // 二维码支付 / 电脑网站支付
export type PlanType = "free" | "pro" | "enterprise";

/**
 * 是否为支付测试模式
 */
export const isPaymentTestMode = process.env.PAYMENT_TEST_MODE === "true";

/**
 * 测试模式金额（0.01 元）
 */
export const TEST_MODE_AMOUNT = 0.01;

/**
 * 定价表（唯一的价格定义来源）- 中国版 CNY
 */
const PRICING_DATA_CN = {
  CNY: {
    pro: {
      monthly: 19.9,
      yearly: 199,
    },
    enterprise: {
      monthly: 49.9,
      yearly: 499,
    },
  },
} as const;

/**
 * 导出定价表供前端显示
 */
export const PRICING_TABLE_CN = PRICING_DATA_CN;

/**
 * 计划优先级（用于升级/降级判断）
 */
export const PLAN_PRIORITY_CN: Record<PlanType, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/**
 * 根据支付方式和计划类型获取定价信息
 * @param method 支付方式
 * @param planType 计划类型
 * @returns 定价配置（货币和金额）
 */
export function getPricingByMethodCN(method: PaymentMethodCN, planType: PlanType = "pro") {
  // 中国版统一使用人民币
  const currency = "CNY";
  const planPricing = planType === "free"
    ? { monthly: 0, yearly: 0 }
    : PRICING_DATA_CN[currency][planType];

  return {
    currency,
    monthly: planPricing.monthly,
    yearly: planPricing.yearly,
  };
}

/**
 * 根据货币类型、账单周期和计划类型获取金额
 * @param currency 货币类型
 * @param billingCycle 账单周期
 * @param planType 计划类型
 * @returns 金额
 */
export function getAmountByCurrencyCN(
  currency: string,
  billingCycle: BillingCycle,
  planType: PlanType = "pro"
): number {
  if (planType === "free") return 0;

  const prices = PRICING_DATA_CN[currency as keyof typeof PRICING_DATA_CN];
  if (!prices) return 0;

  const planPrices = prices[planType as keyof typeof prices];
  return planPrices ? planPrices[billingCycle] : 0;
}

/**
 * 定义会员天数
 */
export function getDaysByBillingCycleCN(billingCycle: BillingCycle): number {
  return billingCycle === "monthly" ? 30 : 365;
}

/**
 * 检查是否可以升级/降级计划
 * @param currentPlan 当前计划
 * @param targetPlan 目标计划
 * @returns { canUpgrade, canDowngrade, isSamePlan }
 */
export function checkPlanTransitionCN(currentPlan: PlanType, targetPlan: PlanType) {
  const currentPriority = PLAN_PRIORITY_CN[currentPlan];
  const targetPriority = PLAN_PRIORITY_CN[targetPlan];

  return {
    canUpgrade: targetPriority > currentPriority,
    canDowngrade: false, // 根据业务规则：不可降级
    isSamePlan: currentPriority === targetPriority,
  };
}

/**
 * 格式化价格显示（中国版）
 */
export function formatPriceCN(amount: number, currency: string = "CNY"): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * 获取年度订阅折扣百分比
 */
export function getYearlyDiscountCN(planType: PlanType): number {
  if (planType === "free") return 0;

  const pricing = PRICING_DATA_CN.CNY[planType];
  const monthlyTotal = pricing.monthly * 12;
  const yearlyPrice = pricing.yearly;

  return Math.round((1 - yearlyPrice / monthlyTotal) * 100);
}

/**
 * 支付方式显示名称
 */
export const PAYMENT_METHOD_NAMES_CN: Record<PaymentMethodCN, string> = {
  wechat: "微信支付",
  alipay: "支付宝",
};

/**
 * 支付方式图标
 */
export const PAYMENT_METHOD_ICONS_CN: Record<PaymentMethodCN, string> = {
  wechat: "wechat",
  alipay: "alipay",
};

