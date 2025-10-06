import Stripe from 'stripe'

// Initialize Stripe (use test key for demo)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo_key', {
  apiVersion: '2024-12-18.acacia',
})

export const STRIPE_PLANS = {
  pro: {
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_demo',
    amount: 999, // $9.99
    currency: 'usd',
    interval: 'month',
  },
  enterprise: {
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise_demo',
    amount: 4999, // $49.99
    currency: 'usd',
    interval: 'month',
  },
}
