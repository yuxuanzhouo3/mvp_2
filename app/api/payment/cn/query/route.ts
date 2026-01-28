/**
 * CN 支付状态查询 API
 * GET /api/payment/cn/query?orderId=xxx&method=wechat|alipay
 *
 * 使用 CloudBase 存储支付记录（CN 环境）
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { getCloudBaseDatabase, CloudBaseCollections, nowISO } from "@/lib/database/cloudbase-client";
import { CloudBaseUserAdapter } from "@/lib/database/adapters/cloudbase-user";
import { createPaymentAdapterCN } from "@/lib/payment/adapter-cn";
import type { PaymentMethodCN } from "@/lib/payment/payment-config-cn";

const cloudbaseAdapter = new CloudBaseUserAdapter();

export async function GET(request: NextRequest) {
  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "未授权，请先登录" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");
    const method = searchParams.get("method") as PaymentMethodCN;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "缺少订单号参数" },
        { status: 400 }
      );
    }

    if (!method || !["wechat", "alipay"].includes(method)) {
      return NextResponse.json(
        { success: false, error: "无效的支付方式" },
        { status: 400 }
      );
    }

    // 先从 CloudBase 数据库查询
    const db = getCloudBaseDatabase();
    const paymentsCollection = db.collection(CloudBaseCollections.PAYMENTS);

    let payment: any = null;
    try {
      const findResult = await paymentsCollection
        .where({ transaction_id: orderId })
        .limit(1)
        .get();
      payment = findResult.data?.[0];
    } catch {
      console.log("[CN Query] 数据库查询失败，尝试从支付平台查询:", orderId);
    }

    // 如果数据库中已经是完成状态，直接返回
    if (payment?.status === "completed") {
      return NextResponse.json({
        success: true,
        status: "completed",
        orderId,
        amount: payment.amount,
        currency: payment.currency,
        completedAt: payment.completed_at,
      });
    }

    // 从支付平台查询最新状态
    try {
      const adapter = createPaymentAdapterCN(method);
      const orderInfo = await adapter.queryOrder(orderId);

      // 如果支付平台显示已完成，但数据库未更新，进行更新
      if (orderInfo.status === "completed" && payment && payment.status !== "completed") {
        const { days, planType } = payment.metadata || {};
        const subscriptionEndDate = new Date();
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + (days || 30));

        // 更新支付状态 - 使用 CloudBase
        const now = nowISO();
        await paymentsCollection.doc(payment._id).update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        });

        // 更新用户订阅 - 使用 CloudBase
        await cloudbaseAdapter.createSubscription({
          user_id: payment.user_id,
          subscription_end: subscriptionEndDate.toISOString(),
          status: "active",
          plan_type: planType || "pro",
          currency: payment.currency || "CNY",
        });

        console.log("✅ [CN Query] 订单状态已同步更新:", orderId);
      }

      return NextResponse.json({
        success: true,
        status: orderInfo.status,
        orderId: orderInfo.id,
        amount: orderInfo.amount,
        currency: orderInfo.currency,
        metadata: orderInfo.metadata,
      });
    } catch (queryError: any) {
      // 对于 H5 支付模式，交易可能还未在支付平台创建，这是正常的
      const isTradeNotExist = queryError.message?.includes("交易不存在") ||
                              queryError.message?.includes("TRADE_NOT_EXIST") ||
                              queryError.message?.includes("ACQ.TRADE_NOT_EXIST");

      if (isTradeNotExist) {
        // 静默处理，只打印 debug 日志
        // 电脑网站支付/H5支付模式下，用户打开支付页面但尚未完成支付时，交易不会在支付平台创建
        console.log("[CN Query] 等待用户完成支付 (交易尚未在支付平台创建):", orderId);
      } else {
        console.error("[CN Query] 查询支付平台失败:", queryError);
      }

      // 如果支付平台查询失败，返回数据库中的状态
      if (payment) {
        return NextResponse.json({
          success: true,
          status: payment.status,
          orderId,
          amount: payment.amount,
          currency: payment.currency,
        });
      }

      return NextResponse.json(
        { success: false, error: "查询订单失败" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[CN Query] 查询失败:", error);
    return NextResponse.json(
      { success: false, error: error.message || "查询失败" },
      { status: 500 }
    );
  }
}
