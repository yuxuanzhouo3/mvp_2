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
import { searchNearbyStores, type NearbySearchResult } from "./nearby-store-search";
import { resolveCandidateLink } from "@/lib/outbound/link-resolver";
import { buildOutboundHref } from "@/lib/outbound/outbound-url";
import type { AIExecutionMetadata } from "@/lib/ai/provider-metadata";
import type { AssistantResponse, ChatRequest, CandidateResult, AssistantAction } from "./types";
import type { DeploymentRegion } from "@/lib/outbound/provider-catalog";

const DEFAULT_ASSISTANT_HISTORY_LIMIT = 12;
const DEFAULT_ASSISTANT_MAX_TOKENS = 800;
const DEFAULT_ASSISTANT_LOCATION_HINT_TIMEOUT_MS = 1200;
const DEFAULT_ASSISTANT_NEARBY_SEED_TIMEOUT_MS = 2200;
const DEFAULT_ASSISTANT_PREFERENCES_WAIT_MS = 180;
const DEFAULT_ASSISTANT_CONTEXT_WAIT_MS = 250;
const DEFAULT_ASSISTANT_NEARBY_PROMPT_WAIT_MS = 500;
const MAP_PROVIDER_AMAP = "高德地图" as const;
const MAP_PROVIDER_GOOGLE = "Google Maps" as const;
type NearbyMapProvider = typeof MAP_PROVIDER_AMAP | typeof MAP_PROVIDER_GOOGLE;
type ChatProgressStage =
  | "intent"
  | "context"
  | "nearby_seed"
  | "calling_ai"
  | "postprocess"
  | "complete";

export type ChatProgressUpdate = {
  stage: ChatProgressStage;
  message: string;
  thinkingStep?: string;
};

export type ProcessChatOptions = {
  onProgress?: (update: ChatProgressUpdate) => void;
  runtimeModelOverride?: string;
  onAiMetadata?: (metadata: AIExecutionMetadata) => void;
};

function reportChatProgress(
  locale: "zh" | "en",
  reporter: ProcessChatOptions["onProgress"] | undefined,
  payload: {
    stage: ChatProgressStage;
    zhMessage: string;
    enMessage: string;
    zhThinkingStep?: string;
    enThinkingStep?: string;
  }
): void {
  if (!reporter) {
    return;
  }

  try {
    reporter({
      stage: payload.stage,
      message: locale === "zh" ? payload.zhMessage : payload.enMessage,
      thinkingStep: locale === "zh" ? payload.zhThinkingStep : payload.enThinkingStep,
    });
  } catch {
    // ignore progress reporter failures to avoid affecting main flow
  }
}

function parseBoundedIntEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function getAssistantHistoryLimit(): number {
  return parseBoundedIntEnv(
    process.env.ASSISTANT_HISTORY_LIMIT ?? process.env.AI_HISTORY_LIMIT,
    DEFAULT_ASSISTANT_HISTORY_LIMIT,
    0,
    20
  );
}

function getAssistantMaxTokens(): number {
  return parseBoundedIntEnv(
    process.env.ASSISTANT_MAX_TOKENS,
    DEFAULT_ASSISTANT_MAX_TOKENS,
    400,
    3000
  );
}

function getAssistantLocationHintTimeoutMs(): number {
  return parseBoundedIntEnv(
    process.env.ASSISTANT_LOCATION_HINT_TIMEOUT_MS,
    DEFAULT_ASSISTANT_LOCATION_HINT_TIMEOUT_MS,
    300,
    8000
  );
}

function getAssistantNearbySeedTimeoutMs(): number {
  return parseBoundedIntEnv(
    process.env.ASSISTANT_NEARBY_SEED_TIMEOUT_MS,
    DEFAULT_ASSISTANT_NEARBY_SEED_TIMEOUT_MS,
    300,
    8000
  );
}

function getAssistantPreferencesWaitMs(): number {
  return parseBoundedIntEnv(
    process.env.ASSISTANT_PREFERENCES_WAIT_MS,
    DEFAULT_ASSISTANT_PREFERENCES_WAIT_MS,
    0,
    3000
  );
}

function getAssistantContextWaitMs(): number {
  return parseBoundedIntEnv(
    process.env.ASSISTANT_CONTEXT_WAIT_MS,
    DEFAULT_ASSISTANT_CONTEXT_WAIT_MS,
    0,
    3000
  );
}

function getAssistantNearbyPromptWaitMs(): number {
  return parseBoundedIntEnv(
    process.env.ASSISTANT_NEARBY_PROMPT_WAIT_MS,
    DEFAULT_ASSISTANT_NEARBY_PROMPT_WAIT_MS,
    0,
    4000
  );
}

async function runWithTimeout<T>(
  runner: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([runner(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function resolveWithin<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  if (timeoutMs <= 0) {
    return fallback;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * 处理用户聊天消息，返回结构化 AI 响应
 *
 * @param request - 聊天请求（消息、历史、位置、语言、区域）
 * @param userId - 用户 ID
 * @returns AI 助手的结构化响应
 */
export async function processChat(
  request: ChatRequest,
  userId: string,
  options?: ProcessChatOptions
): Promise<AssistantResponse> {
  const onProgress = options?.onProgress;
  const { message, history, location, locale, region, isMobile, isAndroid } = request;
  const nearbyIntent = isNearbyIntent(message);
  const historyNearbyIntent =
    !nearbyIntent &&
    isNearbyContinuationMessage(message) &&
    hasNearbyIntentInHistory(history);
  const effectiveNearbyIntent = nearbyIntent || historyNearbyIntent;
  const effectiveLocale: "zh" | "en" =
    region === "INTL" ? "en" : effectiveNearbyIntent ? "zh" : locale;
  const directCarWashNearbyIntent = effectiveNearbyIntent && isCarWashNearbyIntent(message);
  const historyCarWashNearbyIntent =
    effectiveNearbyIntent &&
    !directCarWashNearbyIntent &&
    (historyNearbyIntent || isNearbyRefinementMessage(message)) &&
    hasCarWashNearbyIntentInHistory(history);
  const carWashNearbyIntent = directCarWashNearbyIntent || historyCarWashNearbyIntent;
  const nearbySeedSearchMessage = buildNearbySeedSearchMessage(
    message,
    effectiveLocale,
    carWashNearbyIntent
  );
  const closerRefinementIntent = isCloserRefinementIntent(message);
  const normalizedLocation = normalizeLocation(location);
  const hasLocation = Boolean(normalizedLocation);
  const targetMapProvider = resolveMapPlatformForContext(region, normalizedLocation);
  const useAmapNearbyFlow =
    effectiveNearbyIntent && targetMapProvider === MAP_PROVIDER_AMAP;
  const historyLimit = getAssistantHistoryLimit();
  const aiMaxTokens = getAssistantMaxTokens();
  const locationHintTimeoutMs = getAssistantLocationHintTimeoutMs();
  const nearbySeedTimeoutMs = getAssistantNearbySeedTimeoutMs();
  const preferencesWaitMs = getAssistantPreferencesWaitMs();
  const contextWaitMs = getAssistantContextWaitMs();
  const nearbyPromptWaitMs = getAssistantNearbyPromptWaitMs();

  reportChatProgress(effectiveLocale, onProgress, {
    stage: "intent",
    zhMessage: "正在识别你的需求意图...",
    enMessage: "Understanding your request intent...",
    zhThinkingStep: "解析用户问题并识别核心意图",
    enThinkingStep: "Parsed the request and identified core intent",
  });

  if (!hasLocation && effectiveNearbyIntent) {
    reportChatProgress(effectiveLocale, onProgress, {
      stage: "complete",
      zhMessage: "需要先获取位置信息才能继续附近搜索。",
      enMessage: "Location is required before continuing nearby search.",
      zhThinkingStep: "缺少定位信息，先引导用户补充位置",
      enThinkingStep: "Missing location context, asked user to provide location first",
    });
    return {
      type: "clarify",
      message:
        effectiveLocale === "zh"
          ? "你提到了“附近/周边”需求，我需要先获取你的位置，才能给出准确推荐。"
          : "You asked for nearby options. I need your location first to provide accurate recommendations.",
      thinking:
        effectiveLocale === "zh"
          ? [
            "识别到用户在询问附近/周边结果",
            "发现当前请求缺少可用位置信息",
            "先向用户发起位置补充，再继续检索",
          ]
          : [
            "Detected a nearby-intent request",
            "No usable location context is available",
            "Ask for location first, then continue search",
          ],
      intent: "search_nearby",
      clarifyQuestions:
        effectiveLocale === "zh"
          ? ["请先授权定位，或告诉我你所在的城市/商圈"]
          : ["Please share your location permission or tell me your city/area"],
      followUps:
        effectiveLocale === "zh"
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
  reportChatProgress(effectiveLocale, onProgress, {
    stage: "context",
    zhMessage: "正在准备上下文与历史信息...",
    enMessage: "Preparing context and recent history...",
    zhThinkingStep: "加载历史上下文与偏好设置",
    enThinkingStep: "Loaded recent history and preference context",
  });

  const preferencesPromise = getUserPreferences(userId).catch((error) => {
    console.warn("[ChatEngine] Failed to load user preferences:", error);
    return [];
  });
  const locationHintPromise: Promise<string | null> = normalizedLocation
    ? runWithTimeout(
      () =>
        buildLocationContext(
          normalizedLocation.lat,
          normalizedLocation.lng,
          effectiveLocale,
          region
        ),
      locationHintTimeoutMs,
      "Assistant location hint"
    ).catch((error) => {
      console.warn("[ChatEngine] Failed to build location context:", error);
      return null;
    })
    : Promise.resolve(null);
  const nearbySeedPromise: Promise<NearbySearchResult | null> =
    normalizedLocation && effectiveNearbyIntent
      ? runWithTimeout(
        () =>
          searchNearbyStores({
            lat: normalizedLocation.lat,
            lng: normalizedLocation.lng,
            locale: effectiveLocale,
            region,
            message: nearbySeedSearchMessage,
            limit: 8,
          }),
        nearbySeedTimeoutMs,
        "Assistant nearby seed"
      ).catch((error) => {
        console.error("[ChatEngine] Failed to fetch nearby seed:", error);
        return null;
      })
      : Promise.resolve(null);
  let latestNearbySeed: NearbySearchResult | null = null;
  void nearbySeedPromise.then((seed) => {
    latestNearbySeed = seed;
  });

  const preferences = await resolveWithin(preferencesPromise, preferencesWaitMs, []);
  const preferencesMap: Record<string, unknown> = {};
  for (const pref of preferences) {
    preferencesMap[pref.name] = pref.filters;
  }

  // 2. 构建 system prompt
  const systemPrompt = buildSystemPrompt(
    region,
    effectiveLocale,
    hasLocation,
    !!isMobile,
    !!isAndroid,
    Object.keys(preferencesMap).length > 0 ? preferencesMap : undefined
  );

  // 3. 构建消息列表
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // 添加历史消息（按 historyLimit 截断）
  if (historyLimit > 0 && history && history.length > 0) {
    const recentHistory = history.slice(-historyLimit);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // 添加位置上下文（如果有）- 反向地理编码为可读城市名
  const [locationHint, quickNearbySeed] = await Promise.all([
    resolveWithin(locationHintPromise, contextWaitMs, null),
    resolveWithin(nearbySeedPromise, nearbyPromptWaitMs, null),
  ]);
  if (quickNearbySeed) {
    latestNearbySeed = quickNearbySeed;
  }

  if (effectiveNearbyIntent) {
    reportChatProgress(effectiveLocale, onProgress, {
      stage: "nearby_seed",
      zhMessage: "正在检索附近真实门店数据...",
      enMessage: "Fetching real nearby place data...",
      zhThinkingStep: "基于定位预取附近候选门店",
      enThinkingStep: "Pre-fetched nearby candidates using location context",
    });
  }

  if (locationHint) {
    messages.push({ role: "system", content: locationHint });
  }

  let nearbySeed = latestNearbySeed;
  if (useAmapNearbyFlow) {
    nearbySeed = await nearbySeedPromise;
    latestNearbySeed = nearbySeed;
  }
  if (useAmapNearbyFlow && hasLocation) {
    if (!nearbySeed) {
      reportChatProgress(effectiveLocale, onProgress, {
        stage: "complete",
        zhMessage: "当前附近服务不可用，已返回重试建议。",
        enMessage: "Nearby service is unavailable right now and retry guidance was returned.",
        zhThinkingStep: "高德附近检索不可用，返回重试引导",
        enThinkingStep: "Amap nearby lookup unavailable, returned retry guidance",
      });
      return buildAmapUnavailableNearbyResponse(effectiveLocale);
    }
    if (nearbySeed.candidates.length === 0) {
      reportChatProgress(effectiveLocale, onProgress, {
        stage: "complete",
        zhMessage: "当前半径未找到匹配地点，已返回扩圈建议。",
        enMessage: "No match in current radius, returned a wider-radius suggestion.",
        zhThinkingStep: "当前半径无结果，建议扩大搜索范围",
        enThinkingStep: "No result in current radius, suggested expanding radius",
      });
      return buildAmapNoResultNearbyResponse(
        effectiveLocale,
        nearbySeed.radiusKm,
        carWashNearbyIntent
      );
    }
  }
  if (nearbySeed) {
    if (nearbySeed.candidates.length > 0) {
      messages.push({
        role: "system",
        content: buildIntlNearbySeedPrompt(
          nearbySeed,
          message,
          closerRefinementIntent,
          effectiveLocale
        ),
      });
    } else {
      messages.push({
        role: "system",
        content:
          "[System: Nearby overpass search returned no concrete places in the current radius. If user still wants nearby options, ask to widen the radius or refine the area.]",
      });
    }
  }

  // 添加用户当前消息
  messages.push({ role: "user", content: message });

  // 4. 调用 AI
  reportChatProgress(effectiveLocale, onProgress, {
    stage: "calling_ai",
    zhMessage: "正在生成答案...",
    enMessage: "Generating your answer...",
    zhThinkingStep: "调用模型生成结构化结果",
    enThinkingStep: "Invoked model to generate structured output",
  });

  let aiContent: string;
  try {
    const aiResponse = await callAI({
      messages,
      temperature: 0.7,
      maxTokens: aiMaxTokens,
      modelOverride: options?.runtimeModelOverride,
    });
    options?.onAiMetadata?.({ model: aiResponse.model, usage: aiResponse.usage ?? null });
    aiContent = aiResponse.content;
  } catch (error) {
    console.error("[ChatEngine] AI call failed:", error);
    const implicitLocalNearbyIntent =
      !effectiveNearbyIntent && isImplicitLocalLifeIntent(message);
    const nearbyFallback =
      (effectiveNearbyIntent || implicitLocalNearbyIntent) && normalizedLocation
        ? await buildNearbyFallbackOnAiFailure(
          message,
          effectiveLocale,
          region,
          normalizedLocation,
          closerRefinementIntent,
          isMobile,
          isAndroid,
          nearbySeed,
          nearbySeedSearchMessage,
          targetMapProvider
        )
        : null;

    if (nearbyFallback) {
      reportChatProgress(effectiveLocale, onProgress, {
        stage: "complete",
        zhMessage: "模型异常，已切换到附近搜索降级结果。",
        enMessage: "Model failed, switched to nearby fallback results.",
        zhThinkingStep: "模型失败后启用附近检索降级策略",
        enThinkingStep: "Applied nearby fallback strategy after model failure",
      });
      return nearbyFallback;
    }

    reportChatProgress(effectiveLocale, onProgress, {
      stage: "complete",
      zhMessage: "模型暂时不可用，已返回安全错误提示。",
      enMessage: "Model is temporarily unavailable and a safe error was returned.",
      zhThinkingStep: "调用模型失败，返回稳定错误提示",
      enThinkingStep: "Model invocation failed, returned stable error message",
    });
    return {
      type: "error",
      message:
        effectiveLocale === "zh"
          ? "AI 服务暂时不可用，请稍后再试。"
          : "AI service is temporarily unavailable. Please try again later.",
      thinking:
        effectiveLocale === "zh"
          ? [
            "已完成输入与上下文整理",
            "尝试调用模型服务时发生失败",
            "返回稳定错误提示，避免用户等待",
          ]
          : [
            "Prepared user input and context",
            "Model invocation failed unexpectedly",
            "Returned a safe fallback error message",
          ],
    };
  }

  // 5. 解析 AI 响应
  let parsed: AssistantResponse;
  try {
    parsed = parseAIResponseSafely(aiContent, effectiveLocale);
  } catch (error) {
    console.error("[ChatEngine] Failed to parse AI response:", error);
    console.error("[ChatEngine] Raw content:", aiContent);
    // 如果解析失败，作为纯文本返回
    reportChatProgress(effectiveLocale, onProgress, {
      stage: "complete",
      zhMessage: "响应解析失败，已切换为文本回复。",
      enMessage: "Response parsing failed, switched to text reply.",
      zhThinkingStep: "结构化解析失败，回退到纯文本结果",
      enThinkingStep: "Structured parsing failed, fell back to plain text result",
    });
    return {
      type: "text",
      message: aiContent,
      thinking:
        effectiveLocale === "zh"
          ? [
            "模型已返回内容",
            "结构化 JSON 解析失败，自动切换为纯文本模式",
            "保留原始回答并直接返回给用户",
          ]
          : [
            "Model returned content",
            "Structured JSON parsing failed, switched to text fallback",
            "Preserved raw answer and returned it directly",
          ],
    };
  }

  reportChatProgress(effectiveLocale, onProgress, {
    stage: "postprocess",
    zhMessage: "正在整理结果与可执行动作...",
    enMessage: "Organizing results and actionable steps...",
    zhThinkingStep: "清洗候选结果并补充可执行操作",
    enThinkingStep: "Normalized candidates and enriched actionable links",
  });

  if (nearbySeed && nearbySeed.candidates.length > 0) {
    parsed = enforceConcreteIntlCandidates(
      parsed,
      nearbySeed,
      effectiveLocale,
      closerRefinementIntent
    );
  }
  parsed = preventRedundantLocationClarify(
    parsed,
    effectiveLocale,
    region,
    normalizedLocation,
    message,
    hasLocation,
    effectiveNearbyIntent,
    closerRefinementIntent,
    nearbySeed,
    targetMapProvider
  );
  if (useAmapNearbyFlow && nearbySeed && nearbySeed.candidates.length > 0) {
    parsed = enforceStrictNearbySeedCandidates(
      parsed,
      nearbySeed,
      effectiveLocale,
      targetMapProvider,
      closerRefinementIntent
    );
  }
  parsed = normalizeAssistantResponseForContext(parsed, region, targetMapProvider);

  // 5.1 归一化 thinking 字段，保证前端可稳定展示
  const normalizedThinking = normalizeThinkingSteps(parsed.thinking);
  if (normalizedThinking.length > 0) {
    parsed.thinking = normalizedThinking;
  } else {
    const fallbackThinking = buildFallbackThinking(parsed, effectiveLocale);
    if (fallbackThinking.length > 0) {
      parsed.thinking = fallbackThinking;
    }
  }

  // 6. 为候选结果补充真实深链
  if (parsed.candidates && parsed.candidates.length > 0) {
    const forceMapProviderForNearby =
      effectiveNearbyIntent || parsed.intent === "search_nearby"
        ? targetMapProvider
        : undefined;
    parsed.actions = enrichActionsWithDeepLinks(
      parsed.candidates,
      parsed.actions || [],
      effectiveLocale,
      region,
      isMobile,
      isAndroid,
      forceMapProviderForNearby
        ? { forceProvider: forceMapProviderForNearby }
        : undefined
    );
  }

  // 7. 处理偏好保存
  if (parsed.type === "preference_saved" && parsed.preferenceData) {
    const prefData = parsed.preferenceData as { name?: string; filters?: Record<string, unknown> };
    if (prefData.name && prefData.filters) {
      await savePreference(userId, prefData.name, prefData.filters);
    }
  }

  reportChatProgress(effectiveLocale, onProgress, {
    stage: "complete",
    zhMessage: "结果已准备完成。",
    enMessage: "Your result is ready.",
    zhThinkingStep: "完成结果生成并返回给用户",
    enThinkingStep: "Completed result generation and returned response",
  });

  return parsed;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeLocation(
  location: ChatRequest["location"] | null | undefined
): { lat: number; lng: number } | null {
  if (!location || typeof location !== "object") {
    return null;
  }

  const lat = toFiniteNumber((location as { lat?: unknown }).lat);
  const lng = toFiniteNumber((location as { lng?: unknown }).lng);
  if (lat === null || lng === null) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

function isLikelyInChinaCoordinates(lat: number, lng: number): boolean {
  return lat >= 3.8 && lat <= 53.6 && lng >= 73.5 && lng <= 135.1;
}

function resolveMapPlatformForContext(
  region: "CN" | "INTL",
  location?: { lat: number; lng: number } | null
): NearbyMapProvider {
  if (location) {
    return isLikelyInChinaCoordinates(location.lat, location.lng)
      ? MAP_PROVIDER_AMAP
      : MAP_PROVIDER_GOOGLE;
  }
  return region === "CN" ? MAP_PROVIDER_AMAP : MAP_PROVIDER_GOOGLE;
}

function isMapPlatformValue(platform: string | undefined): boolean {
  if (!platform) return false;
  const normalized = platform.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes("map") ||
    normalized.includes("地图") ||
    normalized === "amap" ||
    normalized === "gaode" ||
    normalized === "baidumap" ||
    normalized === "tencentmap"
  );
}

function normalizeDistanceLabelForIntl(distance: string | undefined): string | undefined {
  if (!distance) return distance;
  const meters = parseDistanceToMeters(distance);
  if (meters === null) return distance;

  const miles = meters / 1609.344;
  if (miles < 0.1) {
    return "0.1 miles";
  }
  if (miles < 10) {
    return `${miles.toFixed(1)} miles`;
  }
  return `${Math.round(miles)} miles`;
}

function normalizeAssistantResponseForContext(
  response: AssistantResponse,
  region: "CN" | "INTL",
  targetMapPlatform: NearbyMapProvider
): AssistantResponse {
  if (!response.candidates || response.candidates.length === 0) {
    return response;
  }

  const normalizedCandidates = response.candidates.map((candidate) => ({
    ...candidate,
    platform: isMapPlatformValue(candidate.platform)
      ? targetMapPlatform
      : candidate.platform,
    distance:
      region === "INTL"
        ? normalizeDistanceLabelForIntl(candidate.distance)
        : candidate.distance,
  }));

  return {
    ...response,
    candidates: normalizedCandidates,
  };
}

function sanitizeNearbySearchQuery(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "nearby stores";
  }

  const stripped = trimmed
    .replace(/\bwithin\s+\d+(?:\.\d+)?\s*(?:km|kilometers?|kilometres?|miles?|meters?|m)\b/gi, " ")
    .replace(/\b(nearby|near me|around me|close by|nearest|closer|closest)\b/gi, " ")
    .replace(/(更近|近一点|最近)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped.length > 0 ? stripped : trimmed;
}

function parseDistanceToMeters(distance: string | undefined): number | null {
  if (!distance) return null;
  const normalized = distance.trim().toLowerCase();
  if (!normalized) return null;

  const valueMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!valueMatch) return null;

  const value = Number(valueMatch[1]);
  if (!Number.isFinite(value)) return null;

  if (/\b(mi|mile|miles)\b/.test(normalized)) {
    return value * 1609.344;
  }
  if (/\b(km|kilometer|kilometers|kilometre|kilometres)\b|公里|千米/.test(normalized)) {
    return value * 1000;
  }
  if (
    /\b(m|meter|meters)\b|米/.test(normalized) ||
    /(?:\d+(?:\.\d+)?)m$/.test(normalized)
  ) {
    return value;
  }

  return null;
}

function sortCandidatesByDistance(candidates: CandidateResult[]): CandidateResult[] {
  return [...candidates].sort((left, right) => {
    const leftMeters = parseDistanceToMeters(left.distance);
    const rightMeters = parseDistanceToMeters(right.distance);

    if (leftMeters === null && rightMeters === null) {
      return 0;
    }
    if (leftMeters === null) {
      return 1;
    }
    if (rightMeters === null) {
      return -1;
    }
    return leftMeters - rightMeters;
  });
}

function pickTopCandidates(
  candidates: CandidateResult[],
  limit: number,
  preferCloser: boolean
): CandidateResult[] {
  if (!preferCloser) {
    return candidates.slice(0, limit);
  }

  return sortCandidatesByDistance(candidates).slice(0, limit);
}

async function buildNearbyFallbackOnAiFailure(
  message: string,
  locale: "zh" | "en",
  region: "CN" | "INTL",
  location: { lat: number; lng: number } | null,
  preferCloser: boolean,
  isMobile?: boolean,
  isAndroid?: boolean,
  preloadedSeed?: NearbySearchResult | null,
  seedSearchMessage?: string,
  mapProvider: NearbyMapProvider = MAP_PROVIDER_GOOGLE
): Promise<AssistantResponse | null> {
  if (!location) {
    return null;
  }

  let nearbySeed: NearbySearchResult | null = preloadedSeed ?? null;
  const fallbackSearchMessage = buildNearbyFallbackQuery(
    seedSearchMessage || message,
    locale
  );
  if (!nearbySeed) {
    try {
      nearbySeed = await searchNearbyStores({
        lat: location.lat,
        lng: location.lng,
        locale,
        region,
        message: fallbackSearchMessage,
        limit: 8,
      });
    } catch (error) {
      console.warn("[ChatEngine] Nearby fallback search failed:", error);
    }
  }

  const candidates =
    nearbySeed && nearbySeed.candidates.length > 0
      ? pickTopCandidates(nearbySeed.candidates, 5, preferCloser)
      : buildFallbackNearbyCandidates(message, locale, mapProvider);

  const fallbackResponse: AssistantResponse = {
    type: "results",
    intent: "search_nearby",
    message:
      nearbySeed && nearbySeed.candidates.length > 0
        ? locale === "zh"
          ? `已使用你的当前位置，找到 ${candidates.length} 个结果`
          : `I used your current location and found ${candidates.length} nearby places.`
        : locale === "zh"
          ? "已使用你的当前位置，为你准备了可直接打开的附近搜索。"
          : "I used your current location and prepared a nearby search you can open directly.",
    plan: buildDefaultNearbyPlan(locale, message),
    candidates,
    followUps: buildDefaultNearbyFollowUps(locale, message),
    thinking: buildNearbyFallbackThinking(locale, message),
  };

  let normalizedFallback = normalizeAssistantResponseForContext(
    fallbackResponse,
    region,
    mapProvider
  );

  if (normalizedFallback.candidates && normalizedFallback.candidates.length > 0) {
    normalizedFallback = {
      ...normalizedFallback,
      actions: enrichActionsWithDeepLinks(
        normalizedFallback.candidates,
        [],
        locale,
        region,
        isMobile,
        isAndroid,
        { forceProvider: mapProvider }
      ),
    };
  }

  return normalizedFallback;
}

function buildFallbackNearbyCandidates(
  message: string,
  locale: "zh" | "en",
  mapProvider: NearbyMapProvider
): CandidateResult[] {
  const query = buildNearbyFallbackQuery(message, locale);
  const platform = mapProvider;
  const foodIntent = isFoodOrDeliveryIntent(message);

  return [
    {
      id: "nearby_fallback_map_search",
      name:
        locale === "zh"
          ? `地图搜索：${query}`
          : `Search on map: ${query}`,
      description:
        locale === "zh"
          ? "已使用你的当前位置，已为你准备可直接打开的附近地图搜索。"
          : "I used your current location and prepared a direct nearby map search.",
      category: foodIntent ? "food" : "local_life",
      platform,
      searchQuery: query,
    },
  ];
}

function preventRedundantLocationClarify(
  response: AssistantResponse,
  locale: "zh" | "en",
  region: "CN" | "INTL",
  location: { lat: number; lng: number } | null,
  message: string,
  hasLocation: boolean,
  nearbyIntent: boolean,
  preferCloser: boolean,
  nearbySeed?: NearbySearchResult | null,
  mapProvider: NearbyMapProvider = MAP_PROVIDER_GOOGLE
): AssistantResponse {
  if (!hasLocation || !nearbyIntent || response.type !== "clarify") {
    return response;
  }

  const followUps = (response.followUps || []).slice(0, 3);

  if (nearbySeed && nearbySeed.candidates.length > 0) {
    const topCandidates = pickTopCandidates(nearbySeed.candidates, 5, preferCloser);
    return {
      ...response,
      type: "results",
      intent: "search_nearby",
      message:
        locale === "zh"
          ? `已使用你的当前位置，找到 ${topCandidates.length} 个结果`
          : `I used your current location and found ${topCandidates.length} nearby places.`,
      plan:
        response.plan && response.plan.length > 0
          ? response.plan
          : buildDefaultNearbyPlan(locale, message),
      candidates: topCandidates,
      clarifyQuestions: undefined,
      followUps: followUps.length > 0 ? followUps : buildDefaultNearbyFollowUps(locale, message),
    };
  }

  return {
    ...response,
    type: "results",
    intent: response.intent || "search_nearby",
    message:
      locale === "zh"
        ? "已使用你的当前位置，已为你准备可直接打开的附近搜索。"
        : "I used your current location and prepared a nearby search you can open directly.",
    plan:
      response.plan && response.plan.length > 0
        ? response.plan
        : buildDefaultNearbyPlan(locale, message),
    candidates: buildFallbackNearbyCandidates(message, locale, mapProvider),
    clarifyQuestions: undefined,
    followUps: followUps.length > 0 ? followUps : buildDefaultNearbyFollowUps(locale, message),
  };
}

function isNearbyIntent(message: string): boolean {
  const text = message.toLowerCase();
  const zhPattern =
    /(附近|周边|就近|离我近|最近|更近|近一点|\d+(?:\.\d+)?\s*(?:公里|千米|米)\s*(?:内|以内)?)/;
  const enPattern = /(nearby|near me|around me|close by|nearest|closer|closest|within \d+\s?(km|miles?|meters?|m))/;
  return zhPattern.test(text) || enPattern.test(text);
}

function isImplicitLocalLifeIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const zhKnowledgeIntentPattern =
    /做法|教程|怎么做|如何做|热量|卡路里|营养|历史|翻译|意思|原理/;
  const enKnowledgeIntentPattern =
    /\b(recipe|recipes|cook|cooking|homemade|calories?|nutrition|history|definition|meaning|translate)\b/;
  if (zhKnowledgeIntentPattern.test(message) || enKnowledgeIntentPattern.test(normalized)) {
    return false;
  }

  const zhLocalLifeIntentPattern =
    /我想吃|想吃|饿了|汉堡|披萨|火锅|奶茶|咖啡|餐厅|饭店|外卖|吃点|买点|去买|商店|门店|超市/;
  const enLocalLifeIntentPattern =
    /\b(i want to eat|want to eat|hungry|burger|hamburger|pizza|hotpot|restaurant|food|takeout|delivery|coffee|cafe|milk tea|boba|shop|store|buy|shopping)\b/;

  return zhLocalLifeIntentPattern.test(message) || enLocalLifeIntentPattern.test(normalized);
}

function isFoodOrDeliveryIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const zhPattern =
    /汉堡|披萨|炸鸡|外卖|美食|餐厅|饭店|奶茶|咖啡|火锅|烧烤|想吃|吃点/;
  const enPattern =
    /\b(burger|hamburger|pizza|fried chicken|takeout|delivery|food|restaurant|eat|coffee|cafe|milk tea|boba|hotpot|bbq)\b/;

  return zhPattern.test(message) || enPattern.test(normalized);
}

function isBurgerIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return /汉堡/.test(message) || /\b(burger|hamburger)\b/.test(normalized);
}

function buildNearbyFallbackQuery(message: string, locale: "zh" | "en"): string {
  if (isBurgerIntent(message)) {
    return locale === "zh"
      ? "汉堡 外卖 附近"
      : "burger delivery nearby";
  }

  if (isFoodOrDeliveryIntent(message)) {
    return locale === "zh"
      ? "餐饮 外卖 附近"
      : "food delivery nearby";
  }

  return sanitizeNearbySearchQuery(message);
}

function buildNearbyFallbackThinking(locale: "zh" | "en", message: string): string[] {
  const foodIntent = isFoodOrDeliveryIntent(message);
  const burgerIntent = isBurgerIntent(message);

  if (locale === "zh") {
    return [
      "识别到你在寻找附近本地生活服务",
      foodIntent
        ? burgerIntent
          ? "优先按“汉堡/外卖”结合定位执行检索"
          : "优先按“餐饮/外卖”结合定位执行检索"
        : "基于当前定位检索附近门店",
      "返回可直接跳转的候选结果",
    ];
  }

  return [
    "Detected a nearby local-life request",
    foodIntent
      ? burgerIntent
        ? "Prioritized nearby burger and delivery options using your location"
        : "Prioritized nearby food and delivery options using your location"
      : "Queried nearby places from your current location",
    "Returned actionable candidates with direct links",
  ];
}

function isCarWashNearbyIntent(message: string): boolean {
  const normalized = message.toLowerCase();
  const enPattern =
    /(car wash|auto wash|vehicle wash|auto detail|detailing|car detailing|car care)/;
  const zhPattern =
    /(洗车|汽车美容|精洗|打蜡|内饰清洗|漆面)/;
  return enPattern.test(normalized) || zhPattern.test(message);
}

function isNearbyRefinementMessage(message: string): boolean {
  const text = message.toLowerCase();
  const zhPattern =
    /(扩大|扩展|放大|更远|更大范围|半径|范围)/;
  const enPattern = /(expand|widen|increase|broaden|radius|range|within \d+\s?(km|miles?|meters?|m))/;
  return zhPattern.test(text) || enPattern.test(text);
}

function isNearbyContinuationMessage(message: string): boolean {
  const text = message.toLowerCase().trim();
  if (!text) {
    return false;
  }

  if (isNearbyIntent(text)) {
    return true;
  }

  const zhContinuationPattern =
    /(继续|再找|再来|换一批|只看|筛选|评分|预算|官方|自营|直营|旗舰|专卖|扩大|缩小|更近|最近|\d+(?:\.\d+)?\s*(?:公里|千米|米|km))/;
  const enContinuationPattern =
    /(continue|refine|filter|rating|budget|official|authorized|flagship|expand|shrink|closer|nearest|within \d+\s?(km|miles?|meters?|m))/;

  const shortFollowUp = text.length <= 28;
  return shortFollowUp && (zhContinuationPattern.test(text) || enContinuationPattern.test(text));
}

function hasNearbyIntentInHistory(
  history: ChatRequest["history"] | undefined
): boolean {
  if (!history || history.length === 0) {
    return false;
  }

  let inspected = 0;
  for (let index = history.length - 1; index >= 0 && inspected < 8; index -= 1) {
    const item = history[index];
    if (!item || item.role !== "user") {
      continue;
    }
    inspected += 1;
    if (isNearbyIntent(item.content)) {
      return true;
    }
  }

  return false;
}

function hasCarWashNearbyIntentInHistory(
  history: ChatRequest["history"] | undefined
): boolean {
  if (!history || history.length === 0) {
    return false;
  }

  let inspected = 0;
  for (let index = history.length - 1; index >= 0 && inspected < 6; index -= 1) {
    const item = history[index];
    if (!item || item.role !== "user") {
      continue;
    }
    inspected += 1;
    if (isNearbyIntent(item.content) && isCarWashNearbyIntent(item.content)) {
      return true;
    }
  }

  return false;
}

function buildNearbySeedSearchMessage(
  message: string,
  locale: "zh" | "en",
  forceCarWash: boolean
): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return message;
  }
  if (!forceCarWash || isCarWashNearbyIntent(trimmed)) {
    return trimmed;
  }

  return locale === "zh" ? `${trimmed} 洗车` : `${trimmed} car wash`;
}

function isCloserRefinementIntent(message: string): boolean {
  const text = message.toLowerCase();
  const zhPattern = /(更近|近一点|最近|离我近一点)/;
  const enPattern = /(closer|closest|nearest|shorter distance|less far)/;
  return zhPattern.test(text) || enPattern.test(text);
}

function buildIntlNearbySeedPrompt(
  seed: NearbySearchResult,
  userMessage: string,
  preferCloser = false,
  locale: "zh" | "en" = "en"
): string {
  const orderedCandidates = preferCloser
    ? sortCandidatesByDistance(seed.candidates)
    : seed.candidates;

  const dataset = orderedCandidates.slice(0, 8).map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    category: candidate.category,
    distance: candidate.distance,
    description: candidate.description,
    address: candidate.address,
    businessHours: candidate.businessHours,
    tags: candidate.tags,
    searchQuery: candidate.searchQuery,
    platform: candidate.platform,
  }));

  if (locale === "zh") {
    return [
      "[System: 已基于用户坐标预取附近真实 POI，数据在 nearbyData。]",
      "请仅使用 nearbyData 里的真实商家进行排序与推荐。",
      "硬约束：",
      "1. 候选名称必须来自 nearbyData，不要杜撰。",
      "2. 不要使用“洗车店/餐厅/商店”这类泛化名称。",
      "3. 用中文输出。",
      "4. 推荐理由需结合距离、标签、营业时间等具体信息。",
      ...(preferCloser
        ? ["5. 用户要求更近，优先按距离从近到远排序。"]
        : []),
      `搜索半径: ${seed.radiusKm}km, 匹配数量: ${seed.matchedCount}`,
      `用户需求: ${JSON.stringify(userMessage)}`,
      `nearbyData=${JSON.stringify(dataset)}`,
    ].join("\n");
  }

  return [
    "[System: Nearby places are pre-fetched around the user's coordinates.]",
    "For this nearby request, rank and recommend using only places from nearbyData.",
    "Hard constraints:",
    "1. Every candidate name must be a concrete place name from nearbyData.",
    "2. Do not output generic names like Restaurant/Food/Shop/Store.",
    "3. Keep the response fully in English.",
    "4. Explain recommendation reasons in each candidate description (distance, tags, opening hours, etc.).",
    ...(preferCloser ? ["5. The user asked for closer options, so prioritize shortest distance first."] : []),
    `Nearby radius: ${seed.radiusKm}km, matched: ${seed.matchedCount}`,
    `User request: ${JSON.stringify(userMessage)}`,
    `nearbyData=${JSON.stringify(dataset)}`,
  ].join("\n");
}

function normalizeCandidateName(value: string | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWeakDescription(description: string | undefined): boolean {
  const text = (description || "").trim().toLowerCase();
  if (!text) return true;
  if (text.length < 12) return true;
  const weakPatterns = [
    /^good\b/,
    /^nice\b/,
    /^recommended\b/,
    /^best\b/,
    /^nearby\b/,
    /^附近/,
  ];
  return weakPatterns.some((pattern) => pattern.test(text));
}

function mergeCandidateWithSeed(
  candidate: CandidateResult,
  seed: CandidateResult
): CandidateResult {
  return {
    ...seed,
    ...candidate,
    id: seed.id,
    name: seed.name,
    description: isWeakDescription(candidate.description) ? seed.description : candidate.description,
    category: candidate.category || seed.category,
    distance: candidate.distance || seed.distance,
    rating: candidate.rating ?? seed.rating,
    priceRange: candidate.priceRange || seed.priceRange,
    estimatedTime: candidate.estimatedTime || seed.estimatedTime,
    businessHours: candidate.businessHours || seed.businessHours,
    phone: candidate.phone || seed.phone,
    address: candidate.address || seed.address,
    tags: candidate.tags && candidate.tags.length > 0 ? candidate.tags : seed.tags,
    platform: seed.platform,
    searchQuery: candidate.searchQuery?.trim() ? candidate.searchQuery : seed.searchQuery,
  };
}

function buildDefaultNearbyPlan(locale: "zh" | "en", message?: string) {
  const foodIntent = message ? isFoodOrDeliveryIntent(message) : false;
  const burgerIntent = message ? isBurgerIntent(message) : false;

  if (locale === "zh") {
    return [
      { step: 1, description: "获取您的定位", status: "done" as const },
      {
        step: 2,
        description: foodIntent
          ? burgerIntent
            ? "搜索附近汉堡店和可外卖商家"
            : "搜索附近餐饮和可外卖商家"
          : "检索周边 POI",
        status: "done" as const,
      },
      { step: 3, description: "按距离和相关性排序", status: "done" as const },
    ];
  }

  return [
    { step: 1, description: "Get your location", status: "done" as const },
    {
      step: 2,
      description: foodIntent
        ? burgerIntent
          ? "Search nearby burger places and delivery options"
          : "Search nearby food places and delivery options"
        : "Search nearby POIs",
      status: "done" as const,
    },
    { step: 3, description: "Rank by distance and relevance", status: "done" as const },
  ];
}

function buildDefaultNearbyFollowUps(locale: "zh" | "en", message?: string) {
  const foodIntent = message ? isFoodOrDeliveryIntent(message) : false;
  const burgerIntent = message ? isBurgerIntent(message) : false;

  if (foodIntent) {
    if (locale === "zh") {
      return [
        {
          text: burgerIntent ? "只看附近汉堡店" : "只看可外卖的店",
          type: "refine" as const,
        },
        { text: "优先 30 分钟内可送达", type: "refine" as const },
      ];
    }

    return [
      {
        text: burgerIntent
          ? "Show nearby burger places only"
          : "Show delivery-friendly places only",
        type: "refine" as const,
      },
      { text: "Prioritize options deliverable within 30 minutes", type: "refine" as const },
    ];
  }

  if (locale === "zh") {
    return [
      { text: "需要我把范围扩大到 3 公里吗？", type: "refine" as const },
      { text: "要不要只看评分更高的？", type: "refine" as const },
    ];
  }

  return [
    { text: "Want me to expand the radius to 3km?", type: "refine" as const },
    { text: "Should I keep only higher-rated options?", type: "refine" as const },
  ];
}

function buildAmapUnavailableNearbyResponse(locale: "zh" | "en"): AssistantResponse {
  return {
    type: "clarify",
    intent: "search_nearby",
    message:
      locale === "zh"
        ? "附近结果仅基于高德地图周边搜索。当前高德服务暂时不可用，请稍后重试。"
        : "Nearby results are based on Amap only. The Amap service is temporarily unavailable.",
    clarifyQuestions:
      locale === "zh"
        ? ["是否稍后重试高德周边搜索？"]
        : ["Do you want to retry Amap nearby search later?"],
    followUps:
      locale === "zh"
        ? [
          { text: "稍后重试", type: "refine" },
          { text: "换个关键词", type: "refine" },
        ]
        : [
          { text: "Retry later", type: "refine" },
          { text: "Use another keyword", type: "refine" },
        ],
    thinking:
      locale === "zh"
        ? [
          "已按 Amap-only 策略执行附近检索",
          "当前无法获取可用的高德周边结果",
          "返回重试引导，避免使用非高德数据源",
        ]
        : [
          "Applied Amap-only nearby strategy",
          "No usable Amap nearby result is available right now",
          "Returned retry guidance without using non-Amap sources",
        ],
  };
}

function buildAmapNoResultNearbyResponse(
  locale: "zh" | "en",
  radiusKm: number,
  isCarWash: boolean
): AssistantResponse {
  const radiusDisplay = Math.max(1, Math.round(radiusKm || 10));
  if (isCarWash) {
    return {
      type: "clarify",
      intent: "search_nearby",
      message:
        locale === "zh"
          ? `我已按你的位置用高德地图查了 ${radiusDisplay}km 内的洗车服务，暂无结果。`
          : `I searched Amap for car wash options within ${radiusDisplay}km of your location and found none. Expand to 20km?`,
      clarifyQuestions:
        locale === "zh"
          ? ["是否扩大搜索半径到 20km？"]
          : ["Should I expand the search radius to 20km?"],
      followUps:
        locale === "zh"
          ? [
            { text: "扩大到 20km", type: "refine" },
            { text: "给我最近的 3 家（可超出 10km）", type: "refine" },
          ]
          : [
            { text: "Expand to 20km", type: "refine" },
            { text: "Show 3 nearest even if beyond 10km", type: "refine" },
          ],
      thinking:
        locale === "zh"
          ? [
            "已使用高德地图周边检索洗车店",
            "在当前半径内未命中可用门店",
            "建议扩大半径继续检索",
          ]
          : [
            "Searched Amap nearby for car wash options",
            "No usable place found within current radius",
            "Suggested expanding radius for next search",
          ],
    };
  }

  return {
    type: "clarify",
    intent: "search_nearby",
    message:
      locale === "zh"
        ? `我已按你的位置用高德地图查了 ${radiusDisplay}km 范围，暂无结果。`
        : `I searched Amap nearby within ${radiusDisplay}km of your location and found no matching places. Expand to 20km or change the keyword?`,
    clarifyQuestions:
      locale === "zh"
        ? ["是否扩大搜索半径到 20km，或更换搜索词？"]
        : ["Should I expand the radius to 20km or use a different keyword?"],
    followUps:
      locale === "zh"
        ? [
          { text: "扩大到 20km", type: "refine" },
          { text: "换个关键词重试", type: "refine" },
        ]
        : [
          { text: "Expand to 20km", type: "refine" },
          { text: "Try another keyword", type: "refine" },
        ],
    thinking:
      locale === "zh"
        ? [
          "已使用高德地图周边检索",
          "当前半径下没有匹配地点",
          "建议扩大范围或调整关键词",
        ]
        : [
          "Searched nearby places via Amap",
          "No matching place in current radius",
          "Suggested wider radius or refined keyword",
        ],
  };
}

function enforceConcreteIntlCandidates(
  response: AssistantResponse,
  seed: NearbySearchResult,
  locale: "zh" | "en",
  preferCloser: boolean
): AssistantResponse {
  if (response.type !== "results") {
    return response;
  }

  const seedCandidates = seed.candidates.slice(0, 8);
  if (seedCandidates.length === 0) {
    return response;
  }

  if (!response.candidates || response.candidates.length === 0) {
    const fallbackCandidates = pickTopCandidates(seedCandidates, 5, preferCloser);
    return {
      ...response,
      intent: "search_nearby",
      message:
        locale === "zh"
          ? `找到 ${fallbackCandidates.length} 个附近结果，已按距离排序。`
          : `Found ${fallbackCandidates.length} nearby places ranked by distance and relevance.`,
      plan: response.plan && response.plan.length > 0 ? response.plan : buildDefaultNearbyPlan(locale),
      candidates: fallbackCandidates,
      followUps:
        response.followUps && response.followUps.length > 0
          ? response.followUps
          : buildDefaultNearbyFollowUps(locale),
    };
  }

  const seedByName = new Map<string, CandidateResult>();
  for (const item of seedCandidates) {
    seedByName.set(normalizeCandidateName(item.name), item);
  }

  const mergedCandidates: CandidateResult[] = [];
  const usedSeedIds = new Set<string>();

  for (const candidate of response.candidates) {
    const normalizedName = normalizeCandidateName(candidate.name);
    const matchedSeed = seedByName.get(normalizedName);
    if (!matchedSeed || usedSeedIds.has(matchedSeed.id)) {
      continue;
    }

    // Keep INTL nearby results strictly grounded in fetched map POIs.
    mergedCandidates.push(mergeCandidateWithSeed(candidate, matchedSeed));
    usedSeedIds.add(matchedSeed.id);
  }

  if (mergedCandidates.length === 0) {
    const fallbackCandidates = pickTopCandidates(seedCandidates, 5, preferCloser);
    return {
      ...response,
      type: "results",
      intent: "search_nearby",
      message:
        locale === "zh"
          ? `找到 ${fallbackCandidates.length} 个附近结果，已按距离排序。`
          : `Found ${fallbackCandidates.length} nearby places ranked by distance and relevance.`,
      plan: response.plan && response.plan.length > 0 ? response.plan : buildDefaultNearbyPlan(locale),
      candidates: fallbackCandidates,
      followUps:
        response.followUps && response.followUps.length > 0
          ? response.followUps
          : buildDefaultNearbyFollowUps(locale),
    };
  }

  const orderedSeedCandidates = preferCloser
    ? sortCandidatesByDistance(seedCandidates)
    : seedCandidates;

  for (const seedCandidate of orderedSeedCandidates) {
    if (mergedCandidates.length >= 5) {
      break;
    }
    if (usedSeedIds.has(seedCandidate.id)) {
      continue;
    }
    mergedCandidates.push(seedCandidate);
  }

  const normalizedCandidates = preferCloser
    ? sortCandidatesByDistance(mergedCandidates)
    : mergedCandidates;

  return {
    ...response,
    type: "results",
    intent: response.intent || "search_nearby",
    candidates: normalizedCandidates.slice(0, 5),
  };
}

function enforceStrictNearbySeedCandidates(
  response: AssistantResponse,
  seed: NearbySearchResult,
  locale: "zh" | "en",
  mapPlatform: NearbyMapProvider,
  preferCloser: boolean
): AssistantResponse {
  const strictSeedCandidates = pickTopCandidates(seed.candidates, 5, preferCloser);
  if (strictSeedCandidates.length === 0) {
    return response;
  }

  const normalizedCandidates = strictSeedCandidates.map((candidate) => ({
    ...candidate,
    platform: mapPlatform,
  }));
  const hasResultsMessage = response.type === "results" && Boolean(response.message?.trim());

  return {
    ...response,
    type: "results",
    intent: "search_nearby",
    message: hasResultsMessage
      ? response.message
      : locale === "zh"
        ? `已基于高德地图周边搜索找到 ${normalizedCandidates.length} 个结果`
        : `Found ${normalizedCandidates.length} nearby places from map POIs.`,
    plan: response.plan && response.plan.length > 0 ? response.plan : buildDefaultNearbyPlan(locale),
    candidates: normalizedCandidates,
    actions: undefined,
    clarifyQuestions: undefined,
    followUps:
      response.followUps && response.followUps.length > 0
        ? response.followUps
        : buildDefaultNearbyFollowUps(locale),
  };
}

/**
 * 解析 AI 返回的 JSON 字符串为 AssistantResponse
 *
 * @param content - AI 原始输出
 * @returns 解析后的结构化响应
 * @throws 如果无法解析为有效 JSON
 */
function parseAIResponse(content: string): AssistantResponse {
  const cleaned = stripMarkdownCodeFence(content);
  const parsed = parseJsonCandidate(cleaned);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI response is not a JSON object");
  }

  const response = parsed as Partial<AssistantResponse>;

  // 验证基本结构
  if (!response.type || !response.message) {
    throw new Error("Missing required fields: type, message");
  }

  // 确保 type 是有效值
  const validTypes = ["plan", "results", "clarify", "text", "preference_saved", "error"];
  if (!validTypes.includes(response.type)) {
    response.type = "text";
  }

  return response as AssistantResponse;
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
  isMobile?: boolean,
  isAndroid?: boolean,
  options?: {
    forceProvider?: string;
  }
): AssistantAction[] {
  const enrichedActions: AssistantAction[] = [];
  const deployRegion = region as DeploymentRegion;

  for (const candidate of candidates) {
    const normalizedCategory = mapCategoryToRecommendation(candidate.category);
    const resolvedQuery =
      candidate.searchQuery?.trim() ||
      candidate.name?.trim() ||
      "nearby";
    const providerCandidates = [candidate.platform, options?.forceProvider]
      .map((provider) => String(provider || "").trim())
      .filter(Boolean)
      .map((provider) => {
        if (
          deployRegion === "CN" &&
          locale === "zh" &&
          isMobile &&
          normalizedCategory === "food" &&
          provider === "大众点评"
        ) {
          return "高德地图";
        }
        return provider;
      })
      .filter((provider, index, list) => list.findIndex((item) => item.toLowerCase() === provider.toLowerCase()) === index);

    try {
      let candidateLink = null as ReturnType<typeof resolveCandidateLink> | null;

      if (providerCandidates.length === 0) {
        candidateLink = resolveCandidateLink({
          title: candidate.name,
          query: resolvedQuery,
          category: normalizedCategory,
          locale,
          region: deployRegion,
          isMobile,
          os: isAndroid ? "android" : isMobile ? "ios" : undefined,
        });
      } else {
        for (const provider of providerCandidates) {
          try {
            candidateLink = resolveCandidateLink({
              title: candidate.name,
              query: resolvedQuery,
              category: normalizedCategory,
              locale,
              region: deployRegion,
              provider,
              isMobile,
              os: isAndroid ? "android" : isMobile ? "ios" : undefined,
            });
            break;
          } catch {
            continue;
          }
        }
      }

      if (!candidateLink) {
        throw new Error("No provider could be resolved for candidate action");
      }

      // 构建跳转 URL（通过 outbound 中间页）
      const outboundUrl = buildOutboundHref(candidateLink, "/assistant");

      // 添加 "打开 App" 动作
      enrichedActions.push({
        type: "open_app",
        label:
          locale === "zh"
            ? `打开${candidateLink.metadata?.providerDisplayName || candidateLink.provider}查看“${candidate.name}”`
            : `Open ${candidateLink.metadata?.providerDisplayName || candidateLink.provider} for "${candidate.name}"`,
        payload: outboundUrl,
        providerId: candidateLink.provider,
        candidateId: candidate.id,
        icon: "external-link",
      });
    } catch (err) {
      console.warn(
        `[ChatEngine] Failed to resolve deep link for ${candidate.platform || options?.forceProvider || "unknown"}:`,
        err
      );
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

  // 保留 AI 生成的不重复动作
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
    lower.includes("food") || lower.includes("restaurant") || lower.includes("delivery") ||
    lower.includes("餐") || lower.includes("吃") || lower.includes("外卖") || lower.includes("美食") ||
    lower.includes("饭") ||
    lower.includes("delivery") || lower.includes("restaurant")
  ) {
    return "food";
  }

  if (
    lower.includes("shop") || lower.includes("store") || lower.includes("mall") || lower.includes("electronics") ||
    lower.includes("购") || lower.includes("买") || lower.includes("商品") ||
    lower.includes("电脑") || lower.includes("数码") || lower.includes("电子") ||
    lower.includes("store") || lower.includes("mall")
  ) {
    return "shopping";
  }

  if (
    lower.includes("travel") || lower.includes("hotel") || lower.includes("flight") ||
    lower.includes("旅") || lower.includes("酒店") || lower.includes("景点")
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
    lower.includes("entertain") || lower.includes("movie") || lower.includes("music") || lower.includes("game") ||
    lower.includes("娱乐") || lower.includes("电影") || lower.includes("音乐") || lower.includes("游戏") ||
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

function looksLikeJsonPayload(content: string): boolean {
  const trimmed = content.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function parseJsonCandidate(candidate: string, depth = 0): unknown {
  const parsed = JSON.parse(candidate);

  if (typeof parsed === "string" && depth < 2) {
    const nested = stripMarkdownCodeFence(parsed.trim());
    if (looksLikeJsonPayload(nested)) {
      return parseJsonCandidate(nested, depth + 1);
    }
  }

  return parsed;
}

function escapeInvalidCharactersInJsonStrings(content: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString) {
      if (char === "\n") {
        result += "\\n";
        continue;
      }
      if (char === "\r") {
        result += "\\r";
        continue;
      }
      if (char === "\t") {
        result += "\\t";
        continue;
      }

      const code = char.charCodeAt(0);
      if (code < 32) {
        result += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
    }

    result += char;
  }

  return result;
}

function extractJsonObjectSegment(content: string): string {
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return content;
  }

  return content.slice(firstBrace, lastBrace + 1);
}

function extractBalancedJsonSegment(content: string): string {
  const trimmed = content.trim();
  const firstObject = trimmed.indexOf("{");
  const firstArray = trimmed.indexOf("[");

  const start =
    firstObject === -1
      ? firstArray
      : firstArray === -1
        ? firstObject
        : Math.min(firstObject, firstArray);

  if (start === -1) {
    return trimmed;
  }

  let inString = false;
  let escaped = false;
  let objectDepth = 0;
  let arrayDepth = 0;
  let started = false;

  for (let i = start; i < trimmed.length; i += 1) {
    const char = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      objectDepth += 1;
      started = true;
      continue;
    }

    if (char === "[") {
      arrayDepth += 1;
      started = true;
      continue;
    }

    if (char === "}") {
      objectDepth = Math.max(0, objectDepth - 1);
    } else if (char === "]") {
      arrayDepth = Math.max(0, arrayDepth - 1);
    }

    if (started && objectDepth === 0 && arrayDepth === 0) {
      return trimmed.slice(start, i + 1);
    }
  }

  return trimmed.slice(start);
}

function repairCommonJsonIssues(content: string): string {
  return content
    .replace(/,\s*"\{/g, ",{")
    .replace(/\}"\s*(?=[,\]])/g, "}")
    .replace(/,\s*([}\]])/g, "$1");
}

function normalizeJsonContent(content: string): string {
  const normalizedQuotes = content
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'");

  const commonRepaired = repairCommonJsonIssues(normalizedQuotes);
  const withoutTrailingCommas = commonRepaired.replace(/,\s*([}\]])/g, "$1");

  return escapeInvalidCharactersInJsonStrings(withoutTrailingCommas);
}

function repairTruncatedJson(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return trimmed;
  }

  const stack: Array<"{" | "["> = [];
  let sanitized = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i];

    if (escaped) {
      sanitized += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      sanitized += char;
      escaped = true;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      sanitized += char;
      continue;
    }

    if (inString) {
      sanitized += char;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      sanitized += char;
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack[stack.length - 1] === expected) {
        stack.pop();
        sanitized += char;
      }
      continue;
    }

    sanitized += char;
  }

  let repaired = sanitized.replace(/[,:]\s*$/, "").replace(/,\s*$/, "");

  if (inString) {
    repaired += "\"";
  }

  for (let i = stack.length - 1; i >= 0; i -= 1) {
    repaired += stack[i] === "{" ? "}" : "]";
  }

  return repaired;
}

function parseJsonWithTolerance(content: string): unknown {
  const cleaned = stripMarkdownCodeFence(content);
  const extracted = extractJsonObjectSegment(cleaned);
  const balanced = extractBalancedJsonSegment(cleaned);

  const rawCandidates = [
    cleaned,
    extracted,
    balanced,
    repairCommonJsonIssues(cleaned),
    repairCommonJsonIssues(extracted),
    repairCommonJsonIssues(balanced),
    normalizeJsonContent(cleaned),
    normalizeJsonContent(extracted),
    normalizeJsonContent(balanced),
  ];

  const dedupedCandidates: string[] = [];
  const seen = new Set<string>();
  for (const candidate of rawCandidates) {
    const normalized = candidate.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    dedupedCandidates.push(normalized);
  }

  let lastError: unknown;
  for (const candidate of dedupedCandidates) {
    try {
      return parseJsonCandidate(candidate);
    } catch (error) {
      lastError = error;
    }

    try {
      const repaired = repairTruncatedJson(candidate);
      return parseJsonCandidate(repaired);
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
            ? `找到 ${parsed.candidates.length} 个结果`
            : `Found ${parsed.candidates.length} candidates:`;
      } else {
        parsed.message =
          locale === "zh"
            ? "已为你整理好结果。"
            : "I prepared the result for you.";
      }
    }

    return parsed as AssistantResponse;
  }
}

function normalizeThinkingSteps(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => sanitizeThinkingStep(item))
      .filter((item) => item.length > 0)
      .slice(0, 8);
  }

  if (typeof raw === "string") {
    return raw
      .split(/\r?\n|[;；、]/)
      .map((item) => sanitizeThinkingStep(item))
      .filter((item) => item.length > 0)
      .slice(0, 8);
  }

  return [];
}

function sanitizeThinkingStep(value: string): string {
  return value
    .trim()
    .replace(/^[-*•+\s]+/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^第\s*\d+\s*步[:：]?\s*/, "")
    .replace(/^Step\s*\d+[:：]?\s*/i, "")
    .trim();
}

function buildFallbackThinking(
  response: AssistantResponse,
  locale: "zh" | "en"
): string[] {
  const thinking: string[] = [];

  if (response.intent) {
    thinking.push(
      locale === "zh"
        ? `识别用户意图：${response.intent}`
        : `Identified user intent: ${response.intent}`
    );
  }

  if (response.type === "clarify") {
    thinking.push(
      locale === "zh"
        ? "当前信息不足，先向用户补充关键条件"
        : "Missing critical context, asking for key details first"
    );
    return thinking.slice(0, 6);
  }

  if (response.plan && response.plan.length > 0) {
    const planSteps = response.plan
      .map((step) => sanitizeThinkingStep(step.description))
      .filter((step) => step.length > 0)
      .slice(0, 3);

    if (planSteps.length > 0) {
      thinking.push(...planSteps);
    }
  }

  if (response.candidates && response.candidates.length > 0) {
    thinking.push(
      locale === "zh"
        ? `筛选并整理 ${response.candidates.length} 个候选结果`
        : `Filtered and organized ${response.candidates.length} candidates`
    );
  }

  if (response.actions && response.actions.length > 0) {
    thinking.push(
      locale === "zh"
        ? "补充可直接执行的下一步动作"
        : "Prepared actionable next-step options"
    );
  }

  if (thinking.length === 0 && response.message?.trim()) {
    thinking.push(
      locale === "zh"
        ? "基于当前上下文生成回答并提供建议"
        : "Generated a response based on current context"
    );
  }

  return thinking.slice(0, 6);
}
