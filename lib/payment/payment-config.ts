/**
 * 统一的支付配置 - 国际版 (INTL)
 * 所有关于价格、货币的定义都在这里，只定义一次，避免重复
 *
 * 定价方案：
 * - Free: $0
 * - Pro: $2.99/月, $29.99/年
 * - Enterprise: $6.99/月, $69.99/年
 */

export type BillingCycle = "monthly" | "yearly";
export type PaymentMethod = "stripe" | "paypal";
export type PlanType = "free" | "pro" | "enterprise";

/**
 * 定价表（唯一的价格定义来源）- 国际版 USD
 */
const PRICING_DATA = {
  USD: {
    pro: {
      monthly: 2.99,
      yearly: 29.99,
    },
    enterprise: {
      monthly: 6.99,
      yearly: 69.99,
    },
  },
} as const;

/**
 * 导出定价表供前端显示
 */
export const PRICING_TABLE = PRICING_DATA;

/**
 * 计划优先级（用于升级/降级判断）
 */
export const PLAN_PRIORITY: Record<PlanType, number> = {
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
export function getPricingByMethod(method: PaymentMethod, planType: PlanType = "pro") {
  // 国际版统一使用美元
  const currency = "USD";
  const planPricing = planType === "free"
    ? { monthly: 0, yearly: 0 }
    : PRICING_DATA[currency][planType];

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
export function getAmountByCurrency(
  currency: string,
  billingCycle: BillingCycle,
  planType: PlanType = "pro"
): number {
  if (planType === "free") return 0;

  const prices = PRICING_DATA[currency as keyof typeof PRICING_DATA];
  if (!prices) return 0;

  const planPrices = prices[planType as keyof typeof prices];
  return planPrices ? planPrices[billingCycle] : 0;
}

/**
 * 定义会员天数
 */
export function getDaysByBillingCycle(billingCycle: BillingCycle): number {
  return billingCycle === "monthly" ? 30 : 365;
}

/**
 * 检查是否可以升级/降级计划
 * @param currentPlan 当前计划
 * @param targetPlan 目标计划
 * @returns { canUpgrade, canDowngrade, isSamePlan }
 */
export function checkPlanTransition(currentPlan: PlanType, targetPlan: PlanType) {
  const currentPriority = PLAN_PRIORITY[currentPlan];
  const targetPriority = PLAN_PRIORITY[targetPlan];

  return {
    canUpgrade: targetPriority > currentPriority,
    canDowngrade: false, // 根据业务规则：不可降级
    isSamePlan: currentPriority === targetPriority,
  };
}

/**
 * 格式化价格显示
 */
export function formatPrice(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * 获取年度订阅折扣百分比
 */
export function getYearlyDiscount(planType: PlanType): number {
  if (planType === "free") return 0;

  const pricing = PRICING_DATA.USD[planType];
  const monthlyTotal = pricing.monthly * 12;
  const yearlyPrice = pricing.yearly;

  return Math.round((1 - yearlyPrice / monthlyTotal) * 100);
}
