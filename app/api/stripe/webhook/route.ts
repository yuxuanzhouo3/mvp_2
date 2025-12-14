// app/api/stripe/webhook/route.ts - Stripe Webhook 处理
import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { handleStripeWebhook } from "@/lib/payment/webhook-handler";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  console.log("[Stripe Webhook] ===== Received webhook request =====");
  
  try {
    const body = await request.text();
    const sig = headers().get("stripe-signature");

    console.log("[Stripe Webhook] Signature present:", !!sig);
    console.log("[Stripe Webhook] Body length:", body.length);
    console.log("[Stripe Webhook] STRIPE_WEBHOOK_SECRET configured:", !!process.env.STRIPE_WEBHOOK_SECRET);

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig || "",
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
      console.log("[Stripe Webhook] ✅ Signature verified successfully");
    } catch (err: any) {
      console.error(`[Stripe Webhook] ❌ Signature verification failed:`, err.message);
      console.error(`[Stripe Webhook] Signature received:`, sig?.substring(0, 50) + "...");
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    console.log(`[Stripe Webhook] Event type: ${event.type}`);
    console.log(`[Stripe Webhook] Event ID: ${event.id}`);
    console.log(`[Stripe Webhook] Event data:`, JSON.stringify(event.data.object, null, 2).substring(0, 500));

    // 处理 webhook
    await handleStripeWebhook({
      type: event.type,
      data: event.data.object,
      paymentMethod: "stripe",
    });

    console.log(`[Stripe Webhook] ✅ Successfully processed event: ${event.type}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Stripe Webhook] ❌ Error processing webhook:", error);

    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
