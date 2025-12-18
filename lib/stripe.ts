import Stripe from 'stripe'

// Initialize Stripe (use test key for demo)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo_key', {
  apiVersion: '2024-12-18.acacia',
})

/**
 * Stripe 计划配置 - 国际版 (INTL)
 *
 * 定价方案：
 * - Pro: $2.99/月, $29.99/年
 * - Enterprise: $6.99/月, $69.99/年
 */
export const STRIPE_PLANS = {
  pro: {
    monthly: {
      priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly_demo',
      amount: 299, // $2.99 (in cents)
      currency: 'usd',
      interval: 'month' as const,
    },
    yearly: {
      priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly_demo',
      amount: 2999, // $29.99 (in cents)
      currency: 'usd',
      interval: 'year' as const,
    },
  },
  enterprise: {
    monthly: {
      priceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_enterprise_monthly_demo',
      amount: 699, // $6.99 (in cents)
      currency: 'usd',
      interval: 'month' as const,
    },
    yearly: {
      priceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_enterprise_yearly_demo',
      amount: 6999, // $69.99 (in cents)
      currency: 'usd',
      interval: 'year' as const,
    },
  },
}

/**
 * 根据计划类型和账单周期获取 Stripe 计划配置
 */
export function getStripePlan(planType: 'pro' | 'enterprise', billingCycle: 'monthly' | 'yearly') {
  return STRIPE_PLANS[planType][billingCycle]
}
