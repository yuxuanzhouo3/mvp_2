/**
 * POST /api/assistant/chat
 *
 * 功能描述：AI 超级助手聊天接口
 * 接收用户自然语言消息，返回结构化 AI 响应
 * 包含意图识别、候选结果、深链跳转、追问建议
 *
 * @param message - 用户消息
 * @param history - 对话历史（可选）
 * @param location - 用户位置（可选）
 * @param locale - 语言 zh|en
 * @param region - 区域 CN|INTL
 * @returns AssistantResponse + 使用统计
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/auth";
import { processChat } from "@/lib/assistant/chat-engine";
import {
  canUseAssistant,
  recordAssistantUsage,
  getAssistantUsageStats,
} from "@/lib/assistant/usage-limiter";
import { saveConversationMessage } from "@/lib/assistant/conversation-store";
import type { ChatRequest } from "@/lib/assistant/types";

export async function POST(request: NextRequest) {
  try {
    // 1. 验证认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;

    // 2. 检查使用限制
    const usageCheck = await canUseAssistant(userId);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: usageCheck.reason,
          usage: usageCheck.stats,
        },
        { status: 403 }
      );
    }

    // 3. 解析请求
    const body = await request.json();
    const { message, history, location, locale, region } = body as ChatRequest;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    // 检测客户端类型、移动端和 Android
    const userAgent = request.headers.get("user-agent") || "";
    const client = (body?.client as "app" | "web" | undefined) || "web";
    const isMobile = /iphone|ipad|ipod|android/i.test(userAgent);
    const isAndroid = /android/i.test(userAgent);

    // 4. 处理聊天
    const response = await processChat(
      {
        message: message.trim(),
        history: history || [],
        location,
        locale: locale || "zh",
        region: region || "CN",
        client,
        isMobile,
        isAndroid,
      },
      userId
    );

    // 5. 记录使用次数（仅在成功生成结果时计数，clarify 不计数）
    if (response.type !== "clarify" && response.type !== "error") {
      await recordAssistantUsage(userId, {
        intent: response.intent,
        type: response.type,
        candidateCount: response.candidates?.length || 0,
      });
    }

    // 6. 持久化对话（异步，不阻断响应）
    const userCreatedAt = new Date().toISOString();
    const assistantCreatedAt = new Date(Date.now() + 1).toISOString();
    saveConversationMessage(userId, "user", message.trim(), undefined, undefined, userCreatedAt)
      .then(() => saveConversationMessage(
        userId,
        "assistant",
        response.message,
        response,
        { intent: response.intent, type: response.type },
        assistantCreatedAt
      ))
      .catch(() => {
        // 瀵硅瘽淇濆瓨澶辫触涓嶅簲闃绘柇涓绘祦绋?
      });

    // 7. 获取最新使用统计
    const usage = await getAssistantUsageStats(userId);

    return NextResponse.json({
      success: true,
      response,
      usage,
    });
  } catch (error) {
    console.error("[API /assistant/chat] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
