// app/api/payment/status/route.ts
// 支付状态查询接口 - 国际版

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { z } from "zod";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// 验证查询参数
const querySchema = z.object({
  paymentId: z.string().min(1, "paymentId is required"),
});

/**
 * GET /api/payment/status?paymentId=xxx
 * 查询支付订单状态
 */
export async function GET(request: NextRequest) {
  try {
    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");

    const validationResult = querySchema.safeParse({ paymentId });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // 从 Supabase 查询支付记录
    const { data: paymentRecord, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .or(`transaction_id.eq.${paymentId},id.eq.${paymentId}`)
      .single();

    if (error || !paymentRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "Payment record not found",
          status: "unknown",
        },
        { status: 404 }
      );
    }

    // 返回支付状态
    return NextResponse.json(
      {
        success: true,
        paymentId,
        status: paymentRecord.status,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        method: paymentRecord.payment_method,
        createdAt: paymentRecord.created_at,
        transactionId: paymentRecord.transaction_id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Payment status query error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        status: "unknown",
      },
      { status: 500 }
    );
  }
}
