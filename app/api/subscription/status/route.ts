// app/api/subscription/status/route.ts - 获取用户订阅状态和功能权限
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import {
  getUserPlan,
  getUserUsageStats,
  canExportData,
} from "@/lib/subscription/usage-tracker";
import {
  PLAN_FEATURES,
  getAvailableDimensions,
  RECOMMENDATION_REASON_CONFIG,
} from "@/lib/subscription/features";
import { PRICING_TABLE, getYearlyDiscount } from "@/lib/payment/payment-config";

/**
 * GET /api/subscription/status
 * 获取用户订阅状态和功能权限
 */
export async function GET(request: NextRequest) {
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
    const userId = user.id;

    // 获取用户计划
    const planType = await getUserPlan(userId);

    // 获取功能配置
    const features = PLAN_FEATURES[planType];

    // 获取使用统计
    const usageStats = await getUserUsageStats(userId);

    // 获取可用画像维度
    const availableDimensions = getAvailableDimensions(planType);

    // 获取推荐理由配置
    const reasonConfig = RECOMMENDATION_REASON_CONFIG[features.recommendationReasonLevel];

    // 检查导出权限
    const exportPermission = await canExportData(userId);

    // 构建响应
    const response = {
      success: true,
      subscription: {
        planType,
        features: {
          ...features,
          availableDimensions,
          reasonConfig,
        },
        usage: {
          current: usageStats.currentPeriodUsage,
          limit: usageStats.periodLimit,
          remaining: usageStats.remainingUsage,
          isUnlimited: usageStats.isUnlimited,
          periodType: usageStats.periodType,
          periodStart: usageStats.periodStart.toISOString(),
          periodEnd: usageStats.periodEnd.toISOString(),
        },
        export: exportPermission,
      },
      pricing: {
        pro: PRICING_TABLE.USD.pro,
        enterprise: PRICING_TABLE.USD.enterprise,
        discounts: {
          pro: getYearlyDiscount("pro"),
          enterprise: getYearlyDiscount("enterprise"),
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error getting subscription status:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
