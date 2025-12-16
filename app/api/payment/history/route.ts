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

    console.log(`[Payment History] Fetching history for user: ${userId} (type: ${typeof userId}, email: ${user.email})`);

    // 调试：先查询所有该用户的记录（不分页）
    const { data: allUserPayments } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, created_at, status, amount, transaction_id")
      .eq("user_id", userId);

    console.log(`[Payment History] Debug - Total payments for user ${userId}:`, allUserPayments?.length || 0);
    console.log(`[Payment History] Debug - Payment records:`, allUserPayments);

    // 调试：查询该用户在auth.users表中的信息
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    console.log(`[Payment History] Debug - Auth user for ${userId}:`, authUser?.user?.email, authUser?.user?.id);

    // 查询支付记录 - 只显示已完成(completed)的支付记录
    const { data: payments, error } = await supabaseAdmin
      .from("payments")
      .select("id, created_at, amount, currency, status, payment_method, transaction_id, user_id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[Payment History] Error fetching payment history:", error);
      return NextResponse.json(
        { error: "Failed to fetch billing history" },
        { status: 500 }
      );
    }

    console.log(`[Payment History] Found ${payments?.length || 0} records for user: ${userId} (page ${page}, range ${from}-${to})`);
    console.log(`[Payment History] Paginated records:`, payments);

    // 调试：查询最近的所有支付记录看看 user_id 格式
    const { data: allPayments } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, transaction_id, created_at, status, amount, metadata")
      .order("created_at", { ascending: false })
      .limit(10);
    console.log("[Payment History] Debug - Recent payments in DB:", allPayments);

    // 检查metadata中的userId是否匹配
    allPayments?.forEach((p: any) => {
      if (p.metadata) {
        try {
          const metadata = JSON.parse(p.metadata);
          console.log(`[Payment History] Payment ${p.id}: user_id=${p.user_id}, metadata.userId=${metadata.userId}`);
        } catch (e) {
          console.log(`[Payment History] Could not parse metadata for payment ${p.id}`);
        }
      }
    });

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

    // 调试：获取该用户的已完成支付记录总数
    const { count: totalCount } = await supabaseAdmin
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");

    console.log(`[Payment History] Total payment count for user ${userId}: ${totalCount}`);

    return NextResponse.json({
      page,
      pageSize,
      count: records.length,
      totalCount: totalCount || 0,
      records,
      debug: {
        userId,
        queriedFrom: from,
        queriedTo: to,
        returnedCount: records.length,
        totalInDb: totalCount || 0,
      }
    });
  } catch (error) {
    console.error("Payment history handler error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
