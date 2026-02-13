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
  const effectiveLocale: "zh" | "en" = region === "INTL" ? "en" : locale;
  const nearbyIntent = isNearbyIntent(message);
  const normalizedLocation = normalizeLocation(location);
  const hasLocation = Boolean(normalizedLocation);

  if (!hasLocation && nearbyIntent) {
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
  const preferences = await getUserPreferences(userId);
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

  // 添加历史消息（最多保留 10 条）
  if (history && history.length > 0) {
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // 添加位置上下文（如果有）— 反向地理编码为可读城市名
  if (normalizedLocation) {
    const locationHint = await buildLocationContext(
      normalizedLocation.lat,
      normalizedLocation.lng,
      effectiveLocale,
      region
    );
    messages.push({ role: "system", content: locationHint });
  }

  let intlNearbySeed: NearbySearchResult | null = null;
  if (region === "INTL" && normalizedLocation && nearbyIntent) {
    try {
      intlNearbySeed = await searchNearbyStores({
        lat: normalizedLocation.lat,
        lng: normalizedLocation.lng,
        locale: "en",
        region: "INTL",
        message,
        limit: 8,
      });

      if (intlNearbySeed.candidates.length > 0) {
        messages.push({
          role: "system",
          content: buildIntlNearbySeedPrompt(intlNearbySeed, message),
        });
      } else {
        messages.push({
          role: "system",
          content:
            "[System: Nearby overpass search returned no concrete places in the current radius. If user still wants nearby options, ask to widen the radius or refine the area.]",
        });
      }
    } catch (error) {
      console.error("[ChatEngine] Failed to fetch INTL nearby seed:", error);
    }
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

  if (intlNearbySeed && intlNearbySeed.candidates.length > 0) {
    parsed = enforceConcreteIntlCandidates(parsed, intlNearbySeed, effectiveLocale);
  }
  parsed = preventRedundantLocationClarify(
    parsed,
    effectiveLocale,
    region,
    message,
    hasLocation,
    nearbyIntent,
    intlNearbySeed
  );

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
    parsed.actions = enrichActionsWithDeepLinks(
      parsed.candidates,
      parsed.actions || [],
      effectiveLocale,
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

function sanitizeNearbySearchQuery(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "nearby stores";
  }

  const stripped = trimmed
    .replace(/\bwithin\s+\d+(?:\.\d+)?\s*(?:km|kilometers?|kilometres?|miles?|meters?|m)\b/gi, " ")
    .replace(/\b(nearby|near me|around me|close by|nearest)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return stripped.length > 0 ? stripped : trimmed;
}

function buildFallbackNearbyCandidates(
  message: string,
  locale: "zh" | "en",
  region: "CN" | "INTL"
): CandidateResult[] {
  const query = sanitizeNearbySearchQuery(message);
  const platform = region === "CN" ? "高德地图" : "Google Maps";

  return [
    {
      id: "nearby_fallback_map_search",
      name: locale === "zh" ? `地图搜索：${query}` : `Search on map: ${query}`,
      description:
        locale === "zh"
          ? "已基于你当前位置准备地图搜索入口，可直接查看附近门店。"
          : "I used your current location and prepared a direct nearby map search.",
      category: locale === "zh" ? "数码/电脑" : "Electronics",
      platform,
      searchQuery: query,
    },
  ];
}

function preventRedundantLocationClarify(
  response: AssistantResponse,
  locale: "zh" | "en",
  region: "CN" | "INTL",
  message: string,
  hasLocation: boolean,
  nearbyIntent: boolean,
  nearbySeed?: NearbySearchResult | null
): AssistantResponse {
  if (!hasLocation || !nearbyIntent || response.type !== "clarify") {
    return response;
  }

  const followUps = (response.followUps || []).slice(0, 3);

  if (nearbySeed && nearbySeed.candidates.length > 0) {
    const topCandidates = nearbySeed.candidates.slice(0, 5);
    return {
      ...response,
      type: "results",
      intent: "search_nearby",
      message:
        locale === "zh"
          ? `已基于你当前位置找到 ${topCandidates.length} 个附近结果。`
          : `I used your current location and found ${topCandidates.length} nearby places.`,
      plan:
        response.plan && response.plan.length > 0
          ? response.plan
          : buildDefaultNearbyPlan(locale),
      candidates: topCandidates,
      clarifyQuestions: undefined,
      followUps: followUps.length > 0 ? followUps : buildDefaultNearbyFollowUps(locale),
    };
  }

  return {
    ...response,
    type: "results",
    intent: response.intent || "search_nearby",
    message:
      locale === "zh"
        ? "已根据你当前位置准备好附近搜索入口，可直接点击查看。"
        : "I used your current location and prepared a nearby search you can open directly.",
    plan:
      response.plan && response.plan.length > 0
        ? response.plan
        : buildDefaultNearbyPlan(locale),
    candidates: buildFallbackNearbyCandidates(message, locale, region),
    clarifyQuestions: undefined,
    followUps: followUps.length > 0 ? followUps : buildDefaultNearbyFollowUps(locale),
  };
}

function isNearbyIntent(message: string): boolean {
  const text = message.toLowerCase();
  const zhPattern = /(附近|周边|就近|离我近|最近|周围)/;
  const enPattern = /(nearby|near me|around me|close by|nearest|within \d+\s?(km|miles?|meters?|m))/;
  return zhPattern.test(text) || enPattern.test(text);
}

function buildIntlNearbySeedPrompt(seed: NearbySearchResult, userMessage: string): string {
  const dataset = seed.candidates.slice(0, 8).map((candidate) => ({
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

  return [
    "[System: Nearby places are pre-fetched from OpenStreetMap Overpass around the user's coordinates.]",
    "For this nearby request, rank and recommend using only places from nearbyData.",
    "Hard constraints:",
    "1. Every candidate name must be a concrete place name from nearbyData.",
    "2. Do not output generic names like Restaurant/Food/Shop/Store.",
    "3. Keep the response fully in English.",
    "4. Explain recommendation reasons in each candidate description (distance, tags, opening hours, etc.).",
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

function isGenericCandidateName(name: string | undefined): boolean {
  const normalized = normalizeCandidateName(name);
  if (!normalized) return true;

  const generic = new Set([
    "restaurant",
    "restaurants",
    "food",
    "food place",
    "shop",
    "store",
    "mall",
    "market",
    "coffee",
    "cafe",
    "bar",
    "gym",
    "fitness",
    "hotel",
    "movie theater",
  ]);

  return generic.has(normalized);
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

function buildDefaultNearbyPlan(locale: "zh" | "en") {
  if (locale === "zh") {
    return [
      { step: 1, description: "获取您的定位", status: "done" as const },
      { step: 2, description: "检索周边 POI", status: "done" as const },
      { step: 3, description: "按距离和相关性排序", status: "done" as const },
    ];
  }

  return [
    { step: 1, description: "Get your location", status: "done" as const },
    { step: 2, description: "Search nearby POIs", status: "done" as const },
    { step: 3, description: "Rank by distance and relevance", status: "done" as const },
  ];
}

function buildDefaultNearbyFollowUps(locale: "zh" | "en") {
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

function enforceConcreteIntlCandidates(
  response: AssistantResponse,
  seed: NearbySearchResult,
  locale: "zh" | "en"
): AssistantResponse {
  if (response.type !== "results") {
    return response;
  }

  const seedCandidates = seed.candidates.slice(0, 8);
  if (seedCandidates.length === 0) {
    return response;
  }

  if (!response.candidates || response.candidates.length === 0) {
    const fallbackCandidates = seedCandidates.slice(0, 5);
    return {
      ...response,
      intent: "search_nearby",
      message:
        locale === "zh"
          ? `找到 ${fallbackCandidates.length} 个附近结果，已按距离和相关性排序。`
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

    if (matchedSeed) {
      mergedCandidates.push(mergeCandidateWithSeed(candidate, matchedSeed));
      usedSeedIds.add(matchedSeed.id);
      continue;
    }

    if (!isGenericCandidateName(candidate.name)) {
      mergedCandidates.push(candidate);
    }
  }

  if (mergedCandidates.length === 0) {
    const fallbackCandidates = seedCandidates.slice(0, 5);
    return {
      ...response,
      type: "results",
      intent: "search_nearby",
      message:
        locale === "zh"
          ? `找到 ${fallbackCandidates.length} 个附近结果，已按距离和相关性排序。`
          : `Found ${fallbackCandidates.length} nearby places ranked by distance and relevance.`,
      plan: response.plan && response.plan.length > 0 ? response.plan : buildDefaultNearbyPlan(locale),
      candidates: fallbackCandidates,
      followUps:
        response.followUps && response.followUps.length > 0
          ? response.followUps
          : buildDefaultNearbyFollowUps(locale),
    };
  }

  for (const seedCandidate of seedCandidates) {
    if (mergedCandidates.length >= 5) {
      break;
    }
    if (usedSeedIds.has(seedCandidate.id)) {
      continue;
    }
    mergedCandidates.push(seedCandidate);
  }

  return {
    ...response,
    type: "results",
    intent: response.intent || "search_nearby",
    candidates: mergedCandidates.slice(0, 5),
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
        candidateId: candidate.id,
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
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");

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
            ? `找到 ${parsed.candidates.length} 个候选结果：`
            : `Found ${parsed.candidates.length} candidates:`;
      } else {
        parsed.message = locale === "zh" ? "已为你整理好结果。" : "I prepared the result for you.";
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
      .split(/\r?\n|[;；]/)
      .map((item) => sanitizeThinkingStep(item))
      .filter((item) => item.length > 0)
      .slice(0, 8);
  }

  return [];
}

function sanitizeThinkingStep(value: string): string {
  return value
    .trim()
    .replace(/^[-*•]+\s*/, "")
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
