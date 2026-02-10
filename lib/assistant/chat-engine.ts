/**
 * AI 助手聊天引擎
 *
 * 功能描述：核心聊天处理逻辑
 * 1. 接收用户消息
 * 2. 构建 system prompt（含工具定义和偏好）
 * 3. 调用 AI 模型获取结构化响应
 * 4. 解析 JSON 响应为 AssistantResponse
 * 5. 通过 provider-catalog 补充真实深链
 * 6. 处理偏好保存/召回
 *
 * @module chat-engine
 */

import { callAI } from "@/lib/ai/client";
import { buildSystemPrompt } from "./tool-definitions";
import { getUserPreferences, savePreference } from "./preference-manager";
import { buildLocationContext } from "./reverse-geocode";
import { resolveCandidateLink } from "@/lib/outbound/link-resolver";
import { buildOutboundHref } from "@/lib/outbound/outbound-url";
import type { AssistantResponse, ChatRequest, CandidateResult, AssistantAction } from "./types";
import type { DeploymentRegion } from "@/lib/outbound/provider-catalog";

/**
 * 处理用户聊天消息，返回结构化 AI 响应
 *
 * @param request - 聊天请求（消息、历史、位置、语言、区域）
 * @param userId - 用户 ID
 * @returns AI 助手的结构化响应
 */
export async function processChat(
  request: ChatRequest,
  userId: string
): Promise<AssistantResponse> {
  const { message, history, location, locale, region, isMobile, isAndroid } = request;

  if (!location && isNearbyIntent(message, locale)) {
    return {
      type: "clarify",
      message:
        locale === "zh"
          ? "你提到了“附近/周边”需求，我需要先获取你的位置，才能给出准确推荐。"
          : "You asked for nearby options. I need your location first to provide accurate recommendations.",
      intent: "search_nearby",
      clarifyQuestions:
        locale === "zh"
          ? ["请先授权定位，或告诉我你所在的城市/商圈"]
          : ["Please share your location permission or tell me your city/area"],
      followUps:
        locale === "zh"
          ? [
              { text: "我在上海浦东", type: "refine" },
              { text: "已开启定位，继续", type: "refine" },
            ]
          : [
              { text: "I'm in Manhattan, NYC", type: "refine" },
              { text: "Location enabled, continue", type: "refine" },
            ],
    };
  }

  // 1. 加载用户偏好
  const preferences = await getUserPreferences(userId);
  const preferencesMap: Record<string, unknown> = {};
  for (const pref of preferences) {
    preferencesMap[pref.name] = pref.filters;
  }

  // 2. 构建 system prompt
  const systemPrompt = buildSystemPrompt(
    region,
    locale,
    !!location,
    !!isMobile,
    !!isAndroid,
    Object.keys(preferencesMap).length > 0 ? preferencesMap : undefined
  );

  // 3. 构建消息列表
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // 添加历史消息（最多保留 10 条）
  if (history && history.length > 0) {
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // 添加位置上下文（如果有）— 反向地理编码为可读城市名
  if (location) {
    const locationHint = await buildLocationContext(location.lat, location.lng, locale);
    messages.push({ role: "system", content: locationHint });
  }

  // 添加用户当前消息
  messages.push({ role: "user", content: message });

  // 4. 调用 AI
  let aiContent: string;
  try {
    const aiResponse = await callAI({
      messages,
      temperature: 0.7,
      maxTokens: 3000,
    });
    aiContent = aiResponse.content;
    console.log(`[ChatEngine] AI model used: ${aiResponse.model}`);
  } catch (error) {
    console.error("[ChatEngine] AI call failed:", error);
    return {
      type: "error",
      message:
        locale === "zh"
          ? "AI 服务暂时不可用，请稍后再试。"
          : "AI service is temporarily unavailable. Please try again later.",
    };
  }

  // 5. 解析 AI 响应
  let parsed: AssistantResponse;
  try {
    parsed = parseAIResponseSafely(aiContent, locale);
  } catch (error) {
    console.error("[ChatEngine] Failed to parse AI response:", error);
    console.error("[ChatEngine] Raw content:", aiContent);
    // 如果解析失败，作为纯文本返回
    return {
      type: "text",
      message: aiContent,
    };
  }

  // 6. 为候选结果补充真实深链
  if (parsed.candidates && parsed.candidates.length > 0) {
    parsed.actions = enrichActionsWithDeepLinks(
      parsed.candidates,
      parsed.actions || [],
      locale,
      region,
      isMobile
    );
  }

  // 7. 处理偏好保存
  if (parsed.type === "preference_saved" && parsed.preferenceData) {
    const prefData = parsed.preferenceData as { name?: string; filters?: Record<string, unknown> };
    if (prefData.name && prefData.filters) {
      await savePreference(userId, prefData.name, prefData.filters);
    }
  }

  return parsed;
}

function isNearbyIntent(message: string, locale: "zh" | "en"): boolean {
  const text = message.toLowerCase();
  const zhPattern = /(附近|周边|就近|离我近|最近|周围)/;
  const enPattern = /(nearby|near me|around me|close by|nearest|within \d+\s?(km|miles?))/;
  return locale === "zh" ? zhPattern.test(text) : enPattern.test(text);
}

/**
 * 解析 AI 返回的 JSON 字符串为 AssistantResponse
 *
 * @param content - AI 原始输出
 * @returns 解析后的结构化响应
 * @throws 如果无法解析为有效 JSON
 */
function parseAIResponse(content: string): AssistantResponse {
  // 清理可能的 markdown 代码块
  let cleaned = content.trim();

  // 移除 ```json ... ``` 包裹
  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    if (firstNewline !== -1) {
      cleaned = cleaned.substring(firstNewline + 1);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();
  }

  // 尝试解析 JSON
  const parsed = JSON.parse(cleaned);

  // 验证基本结构
  if (!parsed.type || !parsed.message) {
    throw new Error("Missing required fields: type, message");
  }

  // 确保 type 是有效值
  const validTypes = ["plan", "results", "clarify", "text", "preference_saved", "error"];
  if (!validTypes.includes(parsed.type)) {
    parsed.type = "text";
  }

  return parsed as AssistantResponse;
}

/**
 * 为候选结果和动作列表补充真实深链 URL
 *
 * @param candidates - 候选结果列表
 * @param existingActions - AI 生成的动作列表
 * @param locale - 语言
 * @param region - 区域
 * @returns 增强后的动作列表（含真实跳转链接）
 */
function enrichActionsWithDeepLinks(
  candidates: CandidateResult[],
  existingActions: AssistantAction[],
  locale: "zh" | "en",
  region: "CN" | "INTL",
  isMobile?: boolean
): AssistantAction[] {
  const enrichedActions: AssistantAction[] = [];
  const deployRegion = region as DeploymentRegion;

  for (const candidate of candidates) {
    // 使用 provider-catalog 解析深链
    try {
      const candidateLink = resolveCandidateLink({
        title: candidate.name,
        query: candidate.searchQuery || candidate.name,
        category: mapCategoryToRecommendation(candidate.category),
        locale,
        region: deployRegion,
        provider: candidate.platform,
        isMobile,
      });

      // 构建跳转 URL（通过 outbound 中间页）
      const outboundUrl = buildOutboundHref(candidateLink, "/assistant");

      // 添加 "打开 App" 动作
      enrichedActions.push({
        type: "open_app",
        label:
          locale === "zh"
            ? `打开${candidateLink.metadata?.providerDisplayName || candidate.platform}查看「${candidate.name}」`
            : `Open ${candidateLink.metadata?.providerDisplayName || candidate.platform} for "${candidate.name}"`,
        payload: outboundUrl,
        providerId: candidate.platform,
        icon: "external-link",
      });
    } catch (err) {
      console.warn(`[ChatEngine] Failed to resolve deep link for ${candidate.platform}:`, err);
    }

    // 添加电话拨打动作
    if (candidate.phone) {
      enrichedActions.push({
        type: "call_phone",
        label: locale === "zh" ? `拨打 ${candidate.name}` : `Call ${candidate.name}`,
        payload: candidate.phone,
        icon: "phone",
      });
    }
  }

  // 保留 AI 生成的不重复的动作
  for (const action of existingActions) {
    const isDuplicate = enrichedActions.some(
      (a) => a.type === action.type && a.payload === action.payload
    );
    if (!isDuplicate && action.type !== "open_app" && action.type !== "open_map") {
      enrichedActions.push(action);
    }
  }

  return enrichedActions;
}

/**
 * 将 AI 返回的自由分类映射到推荐系统的标准分类
 *
 * @param category - AI 返回的分类字符串
 * @returns 标准分类 ID
 */
function mapCategoryToRecommendation(
  category: string
): "entertainment" | "shopping" | "food" | "travel" | "fitness" {
  const lower = category.toLowerCase();

  if (
    lower.includes("food") || lower.includes("餐") || lower.includes("吃") ||
    lower.includes("外卖") || lower.includes("美食") || lower.includes("饮") ||
    lower.includes("delivery") || lower.includes("restaurant")
  ) {
    return "food";
  }

  if (
    lower.includes("shop") || lower.includes("购") || lower.includes("商") ||
    lower.includes("电脑") || lower.includes("数码") || lower.includes("电子") ||
    lower.includes("商品") || lower.includes("买") || lower.includes("electronics") ||
    lower.includes("store") || lower.includes("mall")
  ) {
    return "shopping";
  }

  if (
    lower.includes("travel") || lower.includes("旅") || lower.includes("酒店") ||
    lower.includes("景") || lower.includes("hotel") || lower.includes("flight")
  ) {
    return "travel";
  }

  if (
    lower.includes("fitness") || lower.includes("健身") || lower.includes("运动") ||
    lower.includes("gym") || lower.includes("workout") || lower.includes("exercise")
  ) {
    return "fitness";
  }

  if (
    lower.includes("entertain") || lower.includes("娱乐") || lower.includes("电影") ||
    lower.includes("音乐") || lower.includes("游戏") || lower.includes("movie") ||
    lower.includes("music") || lower.includes("game")
  ) {
    return "entertainment";
  }

  // 默认使用 shopping 作为兜底（最通用）
  return "shopping";
}

function stripMarkdownCodeFence(content: string): string {
  let cleaned = content.trim();
  if (!cleaned.startsWith("```")) return cleaned;

  const firstNewline = cleaned.indexOf("\n");
  if (firstNewline !== -1) {
    cleaned = cleaned.substring(firstNewline + 1);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }

  return cleaned.trim();
}

function extractJsonObjectSegment(content: string): string {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return content;
  }

  return content.slice(firstBrace, lastBrace + 1);
}

function repairCommonJsonIssues(content: string): string {
  return content
    .replace(/,\s*"\{/g, ",{")
    .replace(/\}"\s*(?=[,\]])/g, "}")
    .replace(/,\s*([}\]])/g, "$1");
}

function parseJsonWithTolerance(content: string): unknown {
  const cleaned = stripMarkdownCodeFence(content);
  const extracted = extractJsonObjectSegment(cleaned);

  const candidates = [
    cleaned,
    extracted,
    repairCommonJsonIssues(cleaned),
    repairCommonJsonIssues(extracted),
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Invalid JSON response");
}

function parseAIResponseSafely(content: string, locale: "zh" | "en"): AssistantResponse {
  try {
    return parseAIResponse(content);
  } catch {
    const parsed = parseJsonWithTolerance(content) as Partial<AssistantResponse>;

    if (!parsed || typeof parsed !== "object") {
      throw new Error("AI response is not a JSON object");
    }

    if (!parsed.type) {
      parsed.type = parsed.candidates && parsed.candidates.length > 0 ? "results" : "text";
    }

    const validTypes = ["plan", "results", "clarify", "text", "preference_saved", "error"];
    if (!validTypes.includes(parsed.type)) {
      parsed.type = "text";
    }

    if (!parsed.message || !parsed.message.trim()) {
      if (parsed.type === "results" && parsed.candidates && parsed.candidates.length > 0) {
        parsed.message =
          locale === "zh"
            ? `找到 ${parsed.candidates.length} 个候选结果：`
            : `Found ${parsed.candidates.length} candidates:`;
      } else {
        parsed.message = locale === "zh" ? "已为你整理好结果。" : "I prepared the result for you.";
      }
    }

    return parsed as AssistantResponse;
  }
}
