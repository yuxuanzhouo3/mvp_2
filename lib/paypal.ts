import paypal from '@paypal/checkout-server-sdk'

// PayPal environment setup
function environment() {
  const clientId = process.env.PAYPAL_CLIENT_ID || 'demo_client_id'
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'demo_client_secret'

  // Use sandbox for demo
  return new paypal.core.SandboxEnvironment(clientId, clientSecret)
}

export const paypalClient = new paypal.core.PayPalHttpClient(environment())

export const PAYPAL_PLANS = {
  pro: {
    planId: process.env.PAYPAL_PRO_PLAN_ID || 'P-demo-pro-plan',
    amount: '9.99',
    currency: 'USD',
  },
  enterprise: {
    planId: process.env.PAYPAL_ENTERPRISE_PLAN_ID || 'P-demo-enterprise-plan',
    amount: '49.99',
    currency: 'USD',
  },
}
