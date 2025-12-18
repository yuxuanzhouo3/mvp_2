// app/api/subscription/check-usage/route.ts - 检查用户是否可以使用推荐功能
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { canUseRecommendation, recordRecommendationUsage } from "@/lib/subscription/usage-tracker";

/**
 * GET /api/subscription/check-usage
 * 检查用户是否可以使用推荐功能
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
    const result = await canUseRecommendation(user.id);

    return NextResponse.json({
      success: true,
      allowed: result.allowed,
      reason: result.reason,
      usage: {
        current: result.stats.currentPeriodUsage,
        limit: result.stats.periodLimit,
        remaining: result.stats.remainingUsage,
        isUnlimited: result.stats.isUnlimited,
        periodType: result.stats.periodType,
      },
    });
  } catch (error) {
    console.error("Error checking usage:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscription/check-usage
 * 记录一次推荐使用
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
    const body = await request.json().catch(() => ({}));

    const result = await recordRecommendationUsage(user.id, body.metadata);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording usage:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
