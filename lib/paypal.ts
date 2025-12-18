import paypal from '@paypal/checkout-server-sdk'

// PayPal environment setup
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID || 'demo_client_id'
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'demo_client_secret'

  // Determine environment based on NODE_ENV or explicit PAYPAL_ENVIRONMENT
  const paypalEnv = process.env.PAYPAL_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox')

  // Validate credentials in non-demo mode
  if (clientId === 'demo_client_id' || clientSecret === 'demo_client_secret') {
    console.warn('PayPal is using demo credentials. Please configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.')
  }

  if (paypalEnv === 'production') {
    return new paypal.core.LiveEnvironment(clientId, clientSecret)
  } else {
    return new paypal.core.SandboxEnvironment(clientId, clientSecret)
  }
}

export const paypalClient = new paypal.core.PayPalHttpClient(environment())

/**
 * PayPal 计划配置 - 国际版 (INTL)
 *
 * 定价方案：
 * - Pro: $2.99/月, $29.99/年
 * - Enterprise: $6.99/月, $69.99/年
 */
export const PAYPAL_PLANS = {
  pro: {
    monthly: {
      planId: process.env.PAYPAL_PRO_MONTHLY_PLAN_ID || 'P-demo-pro-monthly-plan',
      amount: '2.99',
      currency: 'USD',
    },
    yearly: {
      planId: process.env.PAYPAL_PRO_YEARLY_PLAN_ID || 'P-demo-pro-yearly-plan',
      amount: '29.99',
      currency: 'USD',
    },
  },
  enterprise: {
    monthly: {
      planId: process.env.PAYPAL_ENTERPRISE_MONTHLY_PLAN_ID || 'P-demo-enterprise-monthly-plan',
      amount: '6.99',
      currency: 'USD',
    },
    yearly: {
      planId: process.env.PAYPAL_ENTERPRISE_YEARLY_PLAN_ID || 'P-demo-enterprise-yearly-plan',
      amount: '69.99',
      currency: 'USD',
    },
  },
}

/**
 * 根据计划类型和账单周期获取 PayPal 计划配置
 */
export function getPayPalPlan(planType: 'pro' | 'enterprise', billingCycle: 'monthly' | 'yearly') {
  return PAYPAL_PLANS[planType][billingCycle]
}
