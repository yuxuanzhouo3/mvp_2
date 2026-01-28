// app/api/paypal/create/route.ts - 创建 PayPal 订单
import { NextRequest, NextResponse } from "next/server";
import { paypalClient } from "@/lib/paypal";
import { requireAuth } from "@/lib/auth/auth";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { getBaseUrl } from "@/lib/utils/get-base-url";

export async function POST(request: NextRequest) {
  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const userId = user.id;

    const body = await request.json();
    const {
      amount,
      currency = "USD",
      description,
      billingCycle = "monthly",
      planType = "pro"
    } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount" },
        { status: 400 }
      );
    }

    // 创建 PayPal 订单
    const requestBody = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
          description: description || `${billingCycle === "monthly" ? "1 Month" : "1 Year"} Premium Membership`,
        },
      ],
      application_context: {
        return_url: `${getBaseUrl()}/payment-success?provider=paypal`,
        cancel_url: `${getBaseUrl()}/payment-cancel?provider=paypal`,
      },
    };

    const order = await paypalClient.execute(
      new paypal.orders.OrdersCreateRequest().requestBody(requestBody)
    );

    const orderId = order.result.id;
    const approvalUrl = order.result.links.find(
      (link: any) => link.rel === "approve"
    )?.href;

    if (!approvalUrl) {
      throw new Error("Failed to get PayPal approval URL");
    }

    // 记录支付到数据库
    const { error: recordError } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      amount,
      currency,
      status: "pending",
      payment_method: "paypal",
      transaction_id: orderId,
      metadata: {
        billingCycle,
        planType,
        description: requestBody.purchase_units[0].description,
      },
    });

    if (recordError) {
      console.error("Error recording PayPal payment:", recordError);
      return NextResponse.json(
        { success: false, error: "Failed to record payment" },
        { status: 500 }
      );
    }

    console.log(`PayPal order created: ${orderId}`);

    return NextResponse.json({
      success: true,
      orderId,
      approvalUrl,
    });
  } catch (error) {
    console.error("PayPal create order error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to create PayPal order";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
