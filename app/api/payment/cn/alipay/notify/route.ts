/**
 * 支付宝回调通知 API
 * POST /api/payment/cn/alipay/notify
 *
 * 使用 CloudBase 存储支付记录（CN 环境）
 */
import { NextRequest, NextResponse } from "next/server";
import { getCloudBaseDatabase, CloudBaseCollections, nowISO } from "@/lib/database/cloudbase-client";
import { CloudBaseUserAdapter } from "@/lib/database/adapters/cloudbase-user";
import { createPaymentAdapterCN } from "@/lib/payment/adapter-cn";

const cloudbaseAdapter = new CloudBaseUserAdapter();

export async function POST(request: NextRequest) {
  try {
    // 支付宝以 form 表单格式发送回调
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log("[Alipay Notify] 收到回调:", {
      out_trade_no: params.out_trade_no,
      trade_status: params.trade_status,
    });

    // 验证并处理回调
    const adapter = createPaymentAdapterCN("alipay");
    const result = await adapter.verifyPayment(params);

    if (!result.success) {
      console.error("[Alipay Notify] 验证失败:", result.error);
      // 支付宝要求返回 "fail" 字符串
      return new NextResponse("fail", { status: 200 });
    }

    // 查找支付记录 - 使用 CloudBase
    const db = getCloudBaseDatabase();
    const paymentsCollection = db.collection(CloudBaseCollections.PAYMENTS);

    const findResult = await paymentsCollection
      .where({ transaction_id: result.orderId })
      .limit(1)
      .get();

    const payment = findResult.data?.[0];

    if (!payment) {
      console.error("[Alipay Notify] 未找到支付记录:", result.orderId);
      return new NextResponse("fail", { status: 200 });
    }

    // 检查是否已处理
    if (payment.status === "completed") {
      console.log("[Alipay Notify] 订单已处理:", result.orderId);
      return new NextResponse("success", { status: 200 });
    }

    // 更新支付状态 - 使用 CloudBase
    const now = nowISO();
    await paymentsCollection.doc(payment._id).update({
      status: "completed",
      completed_at: now,
      updated_at: now,
      metadata: {
        ...payment.metadata,
        alipayTradeNo: result.transactionId,
      },
    });

    // 更新用户订阅状态 - 使用 CloudBase
    const { days, planType, billingCycle } = payment.metadata || {};
    const subscriptionEndDate = new Date();
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + (days || 30));

    // 创建或更新用户订阅
    await cloudbaseAdapter.createSubscription({
      user_id: payment.user_id,
      subscription_end: subscriptionEndDate.toISOString(),
      status: "active",
      plan_type: planType || "pro",
      currency: payment.currency || "CNY",
    });

    console.log("✅ [Alipay Notify] 支付处理成功:", {
      orderId: result.orderId,
      userId: payment.user_id,
      planType,
    });

    // 返回支付宝要求的成功响应
    return new NextResponse("success", { status: 200 });
  } catch (error: any) {
    console.error("[Alipay Notify] 处理失败:", error);
    return new NextResponse("fail", { status: 200 });
  }
}
