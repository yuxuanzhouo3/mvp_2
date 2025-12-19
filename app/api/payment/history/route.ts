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

    console.log(`[Payment History] Fetching history for user: ${userId}`);

    // 先调试查询：获取该用户的所有支付记录（不管状态）
    const { data: allPayments, error: allError } = await supabaseAdmin
      .from("payments")
      .select("id, created_at, amount, currency, status, payment_method, transaction_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    console.log(`[Payment History DEBUG] All payments for user ${userId}:`, JSON.stringify(allPayments, null, 2));

    // 查询支付记录 - 显示completed状态和PayPal的pending状态（可能需要手动确认）
    const { data: payments, error } = await supabaseAdmin
      .from("payments")
      .select("id, created_at, amount, currency, status, payment_method, transaction_id, user_id")
      .eq("user_id", userId)
      .or("status.eq.completed,and(status.eq.pending,payment_method.eq.paypal)")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[Payment History] Error fetching payment history:", error);
      return NextResponse.json(
        { error: "Failed to fetch billing history" },
        { status: 500 }
      );
    }

    console.log(`[Payment History] Found ${payments?.length || 0} completed records for user: ${userId}`);

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
        transactionId: p.transaction_id,
        invoiceUrl: null as string | null,
      };
    });

    // 获取该用户的已完成支付记录总数
    const { count: totalCount } = await supabaseAdmin
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");

    // 统计各状态的数量
    const statusCounts = (allPayments || []).reduce((acc: Record<string, number>, p: any) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      page,
      pageSize,
      count: records.length,
      totalCount: totalCount || 0,
      records,
      debug: {
        allPaymentsCount: allPayments?.length || 0,
        statusCounts,
        paymentMethods: (allPayments || []).map((p: any) => ({
          id: p.id,
          method: p.payment_method,
          status: p.status,
          amount: p.amount,
          date: p.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("Payment history handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
