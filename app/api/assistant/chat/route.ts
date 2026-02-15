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
} from "@/lib/assistant/usage-limiter";
import { saveConversationMessage } from "@/lib/assistant/conversation-store";
import type { AssistantUsageStats, ChatRequest } from "@/lib/assistant/types";

const ASSISTANT_CHAT_DEBUG =
  String(process.env.ASSISTANT_CHAT_DEBUG || "").toLowerCase() === "true";

function logApiChatDebug(message: string, payload: Record<string, unknown>): void {
  if (!ASSISTANT_CHAT_DEBUG || process.env.NODE_ENV === "test") {
    return;
  }

  console.info(message, payload);
}

function applyUsageConsumption(
  usage: AssistantUsageStats,
  shouldConsume: boolean
): AssistantUsageStats {
  if (!shouldConsume || usage.remaining === -1 || usage.limit === -1) {
    return usage;
  }

  const used = Math.min(usage.limit, usage.used + 1);
  return {
    ...usage,
    used,
    remaining: Math.max(0, usage.limit - used),
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const requestId = `${startedAt.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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
    logApiChatDebug("[API /assistant/chat] Request summary", {
      requestId,
      userId,
      region: region || "CN",
      locale: locale || "zh",
      client,
      isMobile,
      isAndroid,
      messageChars: message.trim().length,
      historyCount: Array.isArray(history) ? history.length : 0,
      hasLocation: Boolean(location),
    });

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
    const shouldConsumeUsage = response.type !== "clarify" && response.type !== "error";
    if (shouldConsumeUsage) {
      void recordAssistantUsage(userId, {
        intent: response.intent,
        type: response.type,
        candidateCount: response.candidates?.length || 0,
      }).catch((error) => {
        console.error("[API /assistant/chat] Failed to record usage:", error);
      });
    }
    const usage = applyUsageConsumption(usageCheck.stats, shouldConsumeUsage);

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
    logApiChatDebug("[API /assistant/chat] Response summary", {
      requestId,
      elapsedMs: Date.now() - startedAt,
      responseType: response.type,
      intent: response.intent,
      candidateCount: response.candidates?.length || 0,
      consumedUsage: shouldConsumeUsage,
    });

    return NextResponse.json({
      success: true,
      response,
      usage,
    });
  } catch (error) {
    console.error("[API /assistant/chat] Error:", {
      requestId,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
