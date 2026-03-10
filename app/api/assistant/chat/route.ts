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
import type { AIExecutionMetadata } from "@/lib/ai/provider-metadata";

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
  consumedUsage: number
): AssistantUsageStats {
  if (consumedUsage <= 0 || usage.remaining === -1 || usage.limit === -1) {
    return usage;
  }

  const used =
    usage.quotaType === "token"
      ? usage.used + consumedUsage
      : Math.min(usage.limit, usage.used + consumedUsage);

  return {
    ...usage,
    used,
    remaining: Math.max(0, usage.limit - used),
  };
}

type RetryableAssistantError = Error & {
  status?: number;
};

function createRetryableAssistantError(
  message: string,
  status = 503
): RetryableAssistantError {
  const error = new Error(message) as RetryableAssistantError;
  error.status = status;
  return error;
}

function isRetryableAssistantError(error: unknown): error is RetryableAssistantError {
  return error instanceof Error && typeof (error as RetryableAssistantError).status === "number";
}

function getMissingUsageMessage(locale: "zh" | "en"): string {
  return locale === "zh"
    ? "本次请求暂时无法计量 token，请稍后重试"
    : "Token usage is temporarily unavailable for this request. Please retry.";
}

function encodeNdjsonLine(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
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
    const { message, history, location, locale, region } = body as ChatRequest & {
      stream?: boolean;
    };
    const streamFlag = body?.stream === true || request.nextUrl.searchParams.get("stream") === "true";
    const deploymentRegion: "CN" | "INTL" =
      process.env.NEXT_PUBLIC_DEPLOYMENT_REGION === "CN" ? "CN" : "INTL";
    const effectiveRegion: "CN" | "INTL" =
      region === "CN" || region === "INTL" ? region : deploymentRegion;

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
      region: effectiveRegion,
      locale: locale || "zh",
      client,
      isMobile,
      isAndroid,
      messageChars: message.trim().length,
      historyCount: Array.isArray(history) ? history.length : 0,
      hasLocation: Boolean(location),
    });

    const runChat = async (
      onProgress?: (progress: { stage: string; message: string; thinkingStep?: string }) => void
    ) => {
      const requestLocale = locale || "zh";
      const runtimeModelOverride = usageCheck.stats.model ?? undefined;
      const requiresTokenUsage = usageCheck.stats.quotaType === "token";
      const aiMetadataState: { value: AIExecutionMetadata | null } = { value: null };

      const response = await processChat(
        {
          message: message.trim(),
          history: history || [],
          location,
          locale: requestLocale,
          region: effectiveRegion,
          client,
          isMobile,
          isAndroid,
        },
        userId,
        {
          onProgress,
          runtimeModelOverride,
          onAiMetadata: (metadata) => {
            aiMetadataState.value = metadata;
          },
        }
      );

      const shouldConsumeUsage = response.type !== "clarify" && response.type !== "error";
      let consumedUsage = 0;
      const aiMetadata = aiMetadataState.value;
      const aiUsage = aiMetadata?.usage ?? null;
      const aiModel = aiMetadata?.model ?? usageCheck.stats.model;

      if (shouldConsumeUsage) {
        if (requiresTokenUsage && !aiUsage) {
          throw createRetryableAssistantError(getMissingUsageMessage(requestLocale));
        }

        const usageRecord = await recordAssistantUsage(userId, {
          intent: response.intent,
          type: response.type,
          candidateCount: response.candidates?.length || 0,
          promptTokens: aiUsage?.promptTokens,
          completionTokens: aiUsage?.completionTokens,
          totalTokens: aiUsage?.totalTokens,
          model: aiModel,
        });

        if (usageRecord?.success) {
          consumedUsage = requiresTokenUsage ? aiUsage?.totalTokens || 0 : 1;
        } else if (usageRecord) {
          if (usageRecord.error === "token_usage_required") {
            throw createRetryableAssistantError(getMissingUsageMessage(requestLocale));
          }
          console.error("[API /assistant/chat] Failed to record usage:", usageRecord?.error);
        }
      }
      const usage = applyUsageConsumption(
        {
          ...usageCheck.stats,
          model: aiModel,
        },
        consumedUsage
      );

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
          // 对话保存失败不应阻断主流程
        });

      logApiChatDebug("[API /assistant/chat] Response summary", {
        requestId,
        elapsedMs: Date.now() - startedAt,
        responseType: response.type,
        intent: response.intent,
        candidateCount: response.candidates?.length || 0,
        consumedUsage,
        model: aiModel,
        totalTokens: aiUsage?.totalTokens ?? null,
      });

      return { response, usage };
    };

    if (streamFlag) {
      const stream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          const push = (event: string, data: unknown) => {
            controller.enqueue(encodeNdjsonLine({ event, data }));
          };

          try {
            push("progress", {
              stage: "intent",
              message:
                (locale || "zh") === "zh"
                  ? "已接收请求，正在分析问题..."
                  : "Request received. Analyzing your message...",
              thinkingStep:
                (locale || "zh") === "zh"
                  ? "接收请求并开始需求分析"
                  : "Received request and started intent analysis",
            });

            const result = await runChat((progress) => {
              push("progress", progress);
            });

            push("result", {
              success: true,
              response: result.response,
              usage: result.usage,
            });
            push("done", { success: true });
          } catch (error) {
            console.error("[API /assistant/chat stream] Error:", {
              requestId,
              elapsedMs: Date.now() - startedAt,
              error: error instanceof Error ? error.message : String(error),
            });
            push("error", {
              success: false,
              error: isRetryableAssistantError(error)
                ? error.message
                : "Internal server error",
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const result = await runChat();
    return NextResponse.json({
      success: true,
      response: result.response,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[API /assistant/chat] Error:", {
      requestId,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });

    if (isRetryableAssistantError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status || 503 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
