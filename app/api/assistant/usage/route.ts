/**
 * GET /api/assistant/usage
 *
 * 功能描述：获取 AI 助手使用统计
 * 返回用户当前计划类型、已用次数、剩余次数等
 *
 * @returns AssistantUsageStats
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { getAssistantUsageStats } from "@/lib/assistant/usage-limiter";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 验证认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    const stats = await getAssistantUsageStats(userId);

    return NextResponse.json({
      success: true,
      usage: stats,
    });
  } catch (error) {
    console.error("[API /assistant/usage] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
