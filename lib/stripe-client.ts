"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

/**
 * Lazily load the Stripe.js instance so we reuse the same promise across renders.
 */
export function getStripePromise() {
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
