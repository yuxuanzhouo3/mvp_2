// app/api/subscription/upgrade/route.ts - 会员升级API
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { z } from "zod";
import { checkPlanTransition, getAmountByCurrency } from "@/lib/payment/payment-config";
import { getUserPlan } from "@/lib/subscription/usage-tracker";
import type { PlanType, BillingCycle } from "@/lib/payment/payment-config";

// 升级请求验证schema
const upgradeSchema = z.object({
  targetPlan: z.enum(["pro", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  paymentMethod: z.enum(["stripe", "paypal"]),
});

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

    // 获取当前计划
    const currentPlan = await getUserPlan(userId);

    // 检查计划转换是否允许
    const transition = checkPlanTransition(currentPlan, targetPlan as PlanType);

    if (transition.isSamePlan) {
      // 同级续订
      return NextResponse.json({
        success: true,
        action: "renew",
        currentPlan,
        targetPlan,
        amount: getAmountByCurrency("USD", billingCycle, targetPlan as PlanType),
        currency: "USD",
        billingCycle,
        paymentMethod,
        message: "You can renew your current plan.",
      });
    }

    if (!transition.canUpgrade) {
      return NextResponse.json(
        {
          success: false,
          error: "Downgrade is not allowed. You can only upgrade from Free to Pro, or from Pro to Enterprise.",
          currentPlan,
          targetPlan,
        },
        { status: 400 }
      );
    }

    // 获取当前订阅信息以计算剩余时间
    const { data: currentSubscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("subscription_end", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let prorateCreditDays = 0;
    let message = "Upgrade to a higher plan.";

    if (currentSubscription) {
      // 计算剩余天数
      const endDate = new Date(currentSubscription.subscription_end);
      const now = new Date();
      const remainingMs = endDate.getTime() - now.getTime();
      prorateCreditDays = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60 * 24)));

      if (prorateCreditDays > 0) {
        message = `Your current subscription has ${prorateCreditDays} days remaining. After upgrading, these days will be converted to credit towards your new plan.`;
      }
    }

    // 计算升级价格
    const upgradeAmount = getAmountByCurrency("USD", billingCycle, targetPlan as PlanType);

    return NextResponse.json({
      success: true,
      action: "upgrade",
      currentPlan,
      targetPlan,
      amount: upgradeAmount,
      currency: "USD",
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
        monthly: getAmountByCurrency("USD", "monthly", "pro"),
        yearly: getAmountByCurrency("USD", "yearly", "pro"),
        available: true,
      });
      upgradeOptions.push({
        plan: "enterprise",
        monthly: getAmountByCurrency("USD", "monthly", "enterprise"),
        yearly: getAmountByCurrency("USD", "yearly", "enterprise"),
        available: true,
      });
    } else if (currentPlan === "pro") {
      upgradeOptions.push({
        plan: "pro",
        monthly: getAmountByCurrency("USD", "monthly", "pro"),
        yearly: getAmountByCurrency("USD", "yearly", "pro"),
        available: true, // 续订
      });
      upgradeOptions.push({
        plan: "enterprise",
        monthly: getAmountByCurrency("USD", "monthly", "enterprise"),
        yearly: getAmountByCurrency("USD", "yearly", "enterprise"),
        available: true,
      });
    } else {
      // Enterprise 只能续订
      upgradeOptions.push({
        plan: "enterprise",
        monthly: getAmountByCurrency("USD", "monthly", "enterprise"),
        yearly: getAmountByCurrency("USD", "yearly", "enterprise"),
        available: true, // 续订
      });
    }

    return NextResponse.json({
      success: true,
      currentPlan,
      upgradeOptions,
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
