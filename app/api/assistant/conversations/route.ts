/**
 * /api/assistant/conversations
 *
 * 功能描述：AI 助手对话历史管理接口
 * GET - 获取最近对话历史
 * DELETE - 清除对话历史
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import {
  getRecentConversations,
  clearConversations,
} from "@/lib/assistant/conversation-store";

/**
 * GET /api/assistant/conversations
 * 获取用户最近的对话历史
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

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const conversations = await getRecentConversations(
      authResult.user.id,
      Math.min(limit, 50) // 最多 50 条
    );

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("[API /assistant/conversations GET] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/assistant/conversations
 * 清除用户对话历史
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await clearConversations(authResult.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API /assistant/conversations DELETE] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
