// app/api/payment/cn/cancel/route.ts - CN环境取消订单API
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { CloudBaseUserAdapter } from "@/lib/database/adapters/cloudbase-user";

export const dynamic = 'force-dynamic';

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

    console.log(`[CN Cancel] Attempting to cancel payment: ${paymentId} for user: ${user.id}`);

    const cloudbaseAdapter = new CloudBaseUserAdapter();

    // 获取支付记录
    const { data: payment, error: fetchError } = await cloudbaseAdapter.getPaymentById(paymentId);

    if (fetchError || !payment) {
      console.error("[CN Cancel] Payment not found:", fetchError);
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 }
      );
    }

    // 确保用户只能取消自己的支付
    if (payment.user_id !== user.id) {
      console.error("[CN Cancel] User mismatch:", payment.user_id, "!=", user.id);
      return NextResponse.json(
        { success: false, error: "Unauthorized to cancel this payment" },
        { status: 403 }
      );
    }

    // 只有待处理的订单可以取消
    if (payment.status !== "pending") {
      console.error("[CN Cancel] Invalid status:", payment.status);
      return NextResponse.json(
        {
          success: false,
          error: "Only pending payments can be cancelled",
        },
        { status: 400 }
      );
    }

    // 删除支付记录
    const { success, error: deleteError } = await cloudbaseAdapter.deletePayment(paymentId);

    if (!success || deleteError) {
      console.error("[CN Cancel] Error deleting payment:", deleteError);
      return NextResponse.json(
        { success: false, error: "Failed to cancel payment" },
        { status: 500 }
      );
    }

    console.log(`[CN Cancel] Payment cancelled and deleted successfully: ${paymentId}`);

    return NextResponse.json({
      success: true,
      message: "Payment cancelled and deleted successfully",
    });
  } catch (error) {
    console.error("[CN Cancel] Payment cancel error:", error);

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
