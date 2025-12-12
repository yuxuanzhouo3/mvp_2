// app/api/payment/cancel/route.ts - 取消订单API路由
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { requireAuth } from "@/lib/auth/auth";

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

    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "Payment ID is required" },
        { status: 400 }
      );
    }

    // 从数据库获取支付记录
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .eq("user_id", user.id) // 确保用户只能取消自己的支付
      .single();

    if (fetchError || !payment) {
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 }
      );
    }

    // 只有待处理的订单可以取消
    if (payment.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: "Only pending payments can be cancelled",
        },
        { status: 400 }
      );
    }

    // 更新支付状态为 failed
    const { error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (updateError) {
      console.error("Error cancelling payment:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to cancel payment" },
        { status: 500 }
      );
    }

    console.log(`Payment cancelled successfully: ${paymentId}`);

    return NextResponse.json({
      success: true,
      message: "Payment cancelled successfully",
    });
  } catch (error) {
    console.error("Payment cancel error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
