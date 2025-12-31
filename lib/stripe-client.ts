"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { isMiniProgram } from "@/lib/wechat-mp";

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * 检测是否应该禁用 Stripe
 * 在微信小程序 web-view 中，Stripe SDK 会加载 m.stripe.network 的 iframe，
 * 微信小程序不支持打开非业务域名的页面，因此需要禁用 Stripe
 */
export function shouldDisableStripe(): boolean {
  if (typeof window === "undefined") return false;
  return isMiniProgram();
}

/**
 * Lazily load the Stripe.js instance so we reuse the same promise across renders.
 * Returns null in WeChat MiniProgram environment to prevent iframe loading errors.
 */
export function getStripePromise() {
  // 在微信小程序环境中禁用 Stripe
  if (shouldDisableStripe()) {
    console.warn("[Stripe] Disabled in WeChat MiniProgram environment");
    return Promise.resolve(null);
  }

  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      console.warn("[Stripe] Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(publishableKey);
    }
  }

  return stripePromise;
}
