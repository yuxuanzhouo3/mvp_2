// app/api/paypal/webhook/route.ts - PayPal Webhook 处理
import { NextRequest, NextResponse } from "next/server";
import { handlePayPalWebhook } from "@/lib/payment/webhook-handler";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = request.headers.get("paypal-transmission-signature");

    // 验证 PayPal webhook（简化版本）
    // 在生产环境中，应该验证 webhook 签名

    console.log(`Received PayPal webhook: ${body.event_type || 'unknown'}`);

    // 对于 ORDER 级别的事件，整个 body.resource 就是订单数据
    // 对于 PAYMENT 级别的事件，数据在 body.resource 中
    const webhookData = {
      type: body.event_type,
      data: body.resource,
      paymentMethod: "paypal",
    };

    // 特殊处理：对于 CHECKOUT.ORDER.* 事件，resource 已经是完整的订单数据
    // 对于 PAYMENT.CAPTURE.* 事件，resource 也是完整的支付数据
    console.log(`Processing PayPal webhook ${body.event_type}:`, {
      hasResource: !!body.resource,
      resourceType: body.event_type?.startsWith('CHECKOUT.ORDER') ? 'order' : 'payment'
    });

    // 处理 webhook
    await handlePayPalWebhook(webhookData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PayPal webhook error:", error);

    return NextResponse.json(
      { success: false, error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
