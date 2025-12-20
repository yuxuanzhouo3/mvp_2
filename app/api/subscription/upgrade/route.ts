// app/api/subscription/upgrade/route.ts - 会员升级API
// 支持双环境架构：INTL (Supabase) 和 CN (CloudBase)
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { z } from "zod";
import { checkPlanTransition, getAmountByCurrency } from "@/lib/payment/payment-config";
import { getUserPlan } from "@/lib/subscription/usage-tracker";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { getUserAdapter } from "@/lib/database";
import type { PlanType, BillingCycle } from "@/lib/payment/payment-config";

// 升级请求验证schema - 支持 CN 和 INTL 支付方式
const upgradeSchema = z.object({
  targetPlan: z.enum(["pro", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  paymentMethod: z.enum(["stripe", "paypal", "wechat", "alipay"]),
});

/**
 * 获取用户当前活跃订阅信息
 * 支持双环境架构
 */
async function getActiveSubscription(userId: string) {
  const now = new Date().toISOString();

  if (isChinaDeployment()) {
    // CN 环境：使用 CloudBase
    const adapter = await getUserAdapter();
    const result = await adapter.getActiveSubscription(userId);
    return result.data;
  } else {
    // INTL 环境：使用 Supabase
    const { supabaseAdmin } = await import("@/lib/integrations/supabase-admin");
    const { data } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("subscription_end", now)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data;
  }
}

/**
 * POST /api/subscription/upgrade
 * 检查升级资格并返回支付信息
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const userId = user.id;

    // 验证请求参数
    const body = await request.json();
    const validationResult = upgradeSchema.safeParse(body);

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

    const { targetPlan, billingCycle, paymentMethod } = validationResult.data;

    // 验证支付方式与部署环境匹配
    const isCN = isChinaDeployment();
    const cnPaymentMethods = ["wechat", "alipay"];
    const intlPaymentMethods = ["stripe", "paypal"];

    if (isCN && intlPaymentMethods.includes(paymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payment method for China region. Please use WeChat Pay or Alipay.",
        },
        { status: 400 }
      );
    }

    if (!isCN && cnPaymentMethods.includes(paymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payment method for international region. Please use Stripe or PayPal.",
        },
        { status: 400 }
      );
    }

    // 获取当前计划
    const currentPlan = await getUserPlan(userId);

    // 检查计划转换是否允许
    const transition = checkPlanTransition(currentPlan, targetPlan as PlanType);

    // 确定货币类型
    const currency = isCN ? "CNY" : "USD";

    if (transition.isSamePlan) {
      // 同级续订
      return NextResponse.json({
        success: true,
        action: "renew",
        currentPlan,
        targetPlan,
        amount: getAmountByCurrency(currency, billingCycle, targetPlan as PlanType),
        currency,
        billingCycle,
        paymentMethod,
        message: isCN ? "您可以续订当前计划。" : "You can renew your current plan.",
      });
    }

    if (!transition.canUpgrade) {
      return NextResponse.json(
        {
          success: false,
          error: isCN
            ? "不支持降级。您只能从免费版升级到专业版，或从专业版升级到企业版。"
            : "Downgrade is not allowed. You can only upgrade from Free to Pro, or from Pro to Enterprise.",
          currentPlan,
          targetPlan,
        },
        { status: 400 }
      );
    }

    // 获取当前订阅信息以计算剩余时间
    const currentSubscription = await getActiveSubscription(userId);

    let prorateCreditDays = 0;
    let message = isCN ? "升级到更高级计划。" : "Upgrade to a higher plan.";

    if (currentSubscription) {
      // 计算剩余天数
      const endDate = new Date(currentSubscription.subscription_end);
      const now = new Date();
      const remainingMs = endDate.getTime() - now.getTime();
      prorateCreditDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));

      if (prorateCreditDays > 0) {
        message = isCN
          ? `您当前的订阅还剩 ${prorateCreditDays} 天。升级后，这些天数将转换为新计划的抵扣额度。`
          : `Your current subscription has ${prorateCreditDays} days remaining. After upgrading, these days will be converted to credit towards your new plan.`;
      }
    }

    // 计算升级价格
    const upgradeAmount = getAmountByCurrency(currency, billingCycle, targetPlan as PlanType);

    return NextResponse.json({
      success: true,
      action: "upgrade",
      currentPlan,
      targetPlan,
      amount: upgradeAmount,
      currency,
      billingCycle,
      paymentMethod,
      prorateCreditDays,
      message,
    });
  } catch (error) {
    console.error("Error processing upgrade:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subscription/upgrade
 * 获取可用的升级选项
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user } = authResult;
    const currentPlan = await getUserPlan(user.id);
    const isCN = isChinaDeployment();
    const currency = isCN ? "CNY" : "USD";

    // 根据当前计划确定可用的升级选项
    const upgradeOptions: Array<{
      plan: PlanType;
      monthly: number;
      yearly: number;
      available: boolean;
    }> = [];

    if (currentPlan === "free") {
      upgradeOptions.push({
        plan: "pro",
        monthly: getAmountByCurrency(currency, "monthly", "pro"),
        yearly: getAmountByCurrency(currency, "yearly", "pro"),
        available: true,
      });
      upgradeOptions.push({
        plan: "enterprise",
        monthly: getAmountByCurrency(currency, "monthly", "enterprise"),
        yearly: getAmountByCurrency(currency, "yearly", "enterprise"),
        available: true,
      });
    } else if (currentPlan === "pro") {
      upgradeOptions.push({
        plan: "pro",
        monthly: getAmountByCurrency(currency, "monthly", "pro"),
        yearly: getAmountByCurrency(currency, "yearly", "pro"),
        available: true, // 续订
      });
      upgradeOptions.push({
        plan: "enterprise",
        monthly: getAmountByCurrency(currency, "monthly", "enterprise"),
        yearly: getAmountByCurrency(currency, "yearly", "enterprise"),
        available: true,
      });
    } else {
      // Enterprise 只能续订
      upgradeOptions.push({
        plan: "enterprise",
        monthly: getAmountByCurrency(currency, "monthly", "enterprise"),
        yearly: getAmountByCurrency(currency, "yearly", "enterprise"),
        available: true, // 续订
      });
    }

    // 支付方式
    const paymentMethods = isCN
      ? ["wechat", "alipay"]
      : ["stripe", "paypal"];

    return NextResponse.json({
      success: true,
      currentPlan,
      currency,
      upgradeOptions,
      paymentMethods,
      rules: {
        canUpgrade: currentPlan !== "enterprise",
        canDowngrade: false,
        canRenew: true,
      },
    });
  } catch (error) {
    console.error("Error getting upgrade options:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
