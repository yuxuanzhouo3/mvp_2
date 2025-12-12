// app/api/stripe/webhook/route.ts - Stripe Webhook 处理
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { handleStripeWebhook } from "@/lib/payment/webhook-handler";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = headers().get("stripe-signature");

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig || "",
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err: any) {
      console.error(`Webhook signature verification failed.`, err.message);
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    console.log(`Received Stripe webhook: ${event.type}`);

    // 处理 webhook
    await handleStripeWebhook({
      type: event.type,
      data: event.data.object,
      paymentMethod: "stripe",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);

    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
