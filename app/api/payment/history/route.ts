// app/api/payment/history/route.ts
// 支付历史查询接口 - 国际版

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { requireAuth } from "@/lib/auth/auth";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/payment/history?page=1&pageSize=20
export async function GET(request: NextRequest) {
  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(searchParams.get("pageSize") || "20", 10), 1),
      100
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 查询支付记录
    const { data: payments, error } = await supabaseAdmin
      .from("payments")
      .select("id, created_at, amount, currency, status, payment_method, transaction_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("Error fetching payment history:", error);
      return NextResponse.json(
        { error: "Failed to fetch billing history" },
        { status: 500 }
      );
    }

    // 格式化支付记录
    const records = (payments || []).map((p: any) => {
      // 标准化状态
      let uiStatus: "paid" | "pending" | "failed" | "refunded" = "pending";
      switch (p.status) {
        case "completed":
          uiStatus = "paid";
          break;
        case "failed":
          uiStatus = "failed";
          break;
        case "refunded":
          uiStatus = "refunded";
          break;
        default:
          uiStatus = "pending";
      }

      const method = (p.payment_method || "").toString();
      const paymentMethod =
        method.toLowerCase() === "stripe"
          ? "Stripe"
          : method.toLowerCase() === "paypal"
            ? "PayPal"
            : method || "";

      return {
        id: p.id,
        date: p.created_at,
        amount: parseFloat(String(p.amount || "0")),
        currency: p.currency || "USD",
        status: uiStatus,
        description: "Subscription payment",
        paymentMethod,
        invoiceUrl: null as string | null,
      };
    });

    return NextResponse.json({
      page,
      pageSize,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("Payment history handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
