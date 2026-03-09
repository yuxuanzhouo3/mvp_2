import OpenAI from "openai";
import { ZhipuAI } from "zhipuai";
import { isChinaDeployment } from "@/lib/config/deployment.config";
import { getCnAiRuntimeModelConfig } from "@/lib/ai/runtime-model-config";
import { type CnRuntimeModel } from "@/lib/ai/runtime-models";
import { generateFallbackCandidates } from "@/lib/recommendation/fallback-generator";
import type { RecommendationCategory } from "@/lib/types/recommendation";

type CNQwenProvider = CnRuntimeModel;
type AIProvider = "openai" | "mistral" | "zhipu" | CNQwenProvider;

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AIRequestErrorKind = "qwen_free_tier_only" | "http_error" | "empty_content";

class AIRequestError extends Error {
  kind: AIRequestErrorKind;
  provider: AIProvider;
  status?: number;
  code?: string;
  constructor(params: {
    message: string;
    kind: AIRequestErrorKind;
    provider: AIProvider;
    status?: number;
    code?: string;
  }) {
    super(params.message);
    this.name = "AIRequestError";
    this.kind = params.kind;
    this.provider = params.provider;
    this.status = params.status;
    this.code = params.code;
  }
}

const DISABLED_PROVIDERS = new Set<AIProvider>();

const DEFAULT_MODELS = {
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
  mistral: process.env.MISTRAL_MODEL || "mistral-small-latest",
  zhipu: process.env.ZHIPU_MODEL || "glm-4.5-flash",
  "qwen3.5-plus": "qwen3.5-plus",
  "qwen3.5-flash": "qwen3.5-flash",
  "qwen3.5-flash-2026-02-23": "qwen3.5-flash-2026-02-23",
  "qwen3.5-35b-a3b": "qwen3.5-35b-a3b",
};

// 通义千问 API 端点
const QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const DEFAULT_RECOMMENDATION_AI_PROVIDER_TIMEOUT_MS = 45_000;

function hasValidKey(value?: string | null): value is string {
  return Boolean(value && value.trim() && !value.includes("your_"));
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

function getRecommendationProviderTimeoutMs(): number {
  return parseBoundedIntEnv(
    process.env.RECOMMENDATION_AI_PROVIDER_TIMEOUT_MS,
    DEFAULT_RECOMMENDATION_AI_PROVIDER_TIMEOUT_MS,
    5_000,
    120_000
  );
}

async function getProviderOrder(): Promise<AIProvider[]> {
  if (isChinaDeployment()) {
    // CN 环境：仅使用白名单模型，其他模型因额度不足禁用
    const providers: AIProvider[] = [];

    if (hasValidKey(process.env.QWEN_API_KEY)) {
      providers.push((await getCnAiRuntimeModelConfig()).recommendationModel);
    }

    return providers;
  }

  // INTL region: prefer Mistral first, then fall back to OpenAI
  const providers: AIProvider[] = [];

  if (hasValidKey(process.env.MISTRAL_API_KEY)) {
    providers.push("mistral");
  }
  if (hasValidKey(process.env.OPENAI_API_KEY)) {
    providers.push("openai");
  }

  return providers;
}

export function isAIProviderConfigured(): boolean {
  if (isChinaDeployment()) {
    return hasValidKey(process.env.QWEN_API_KEY);
  }

  return hasValidKey(process.env.MISTRAL_API_KEY) || hasValidKey(process.env.OPENAI_API_KEY);
}

export function isZhipuConfigured(): boolean {
  return hasValidKey(process.env.ZHIPU_API_KEY);
}

export function isQwenConfigured(): boolean {
  return hasValidKey(process.env.QWEN_API_KEY);
}

async function callAIWithFallback(messages: AIMessage[], temperature = 0.8) {
  const configuredProviders = await getProviderOrder();
  const providers = configuredProviders.filter((p) => !DISABLED_PROVIDERS.has(p));

  if (configuredProviders.length === 0) {
    throw new Error("No AI provider configured for current deployment region");
  }

  if (providers.length === 0) {
    throw new Error("All AI providers are temporarily unavailable for current deployment region");
  }

  let lastError: unknown;

  for (const provider of providers) {
    try {
      switch (provider) {
        case "openai":
          return {
            content: await callOpenAI(messages, temperature),
            provider,
            model: DEFAULT_MODELS.openai,
          };
        case "mistral":
          return {
            content: await callMistral(messages, temperature),
            provider,
            model: DEFAULT_MODELS.mistral,
          };
        case "zhipu":
          return {
            content: await callZhipu(messages, temperature),
            provider,
            model: DEFAULT_MODELS.zhipu,
          };
        case "qwen3.5-plus":
        case "qwen3.5-flash":
        case "qwen3.5-flash-2026-02-23":
        case "qwen3.5-35b-a3b":
          return {
            content: await callQwen(messages, temperature, provider),
            provider,
            model: provider,
          };
      }
    } catch (error) {
      lastError = error;

      if (error instanceof AIRequestError && error.kind === "qwen_free_tier_only") {
        DISABLED_PROVIDERS.add(provider);
        console.warn(
          `[AI][${provider}] disabled due to quota mode (${error.status || "?"} ${error.code || "FreeTierOnly"})`
        );
        continue;
      }

      const message =
        error instanceof Error && typeof error.message === "string" && error.message.trim().length > 0
          ? error.message
          : String(error);
      console.error(`[AI][${provider}] request failed: ${message}`);
    }
  }

  throw lastError || new Error("All AI providers failed");
}

async function callQwen(
  messages: AIMessage[],
  temperature: number,
  model: CNQwenProvider
) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!hasValidKey(apiKey)) {
    throw new Error("QWEN_API_KEY is not configured");
  }

  const timeoutMs = getRecommendationProviderTimeoutMs();
  const requestBody = {
    model,
    messages,
    temperature,
    max_tokens: 600,
    ...(model === "qwen3.5-plus" ? { enable_thinking: false } : {}),
  };

  console.log(`[AI] Calling Qwen API with model: ${model} (timeout=${timeoutMs}ms)...`);

  // 添加30秒超时控制，避免长时间等待
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(QWEN_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      const status = response.status;
      let code = "";
      let message = "";
      try {
        const parsed = JSON.parse(errorText);
        code = String(parsed?.error?.code || parsed?.error?.type || "");
        message = String(parsed?.error?.message || "");
      } catch {
        message = errorText;
      }

      const normalizedMessage = (message || "").trim();
      const normalizedCode = (code || "").trim();
      const looksLikeFreeTierOnly =
        status === 403 &&
        (normalizedCode.includes("FreeTierOnly") ||
          normalizedMessage.includes("FreeTierOnly") ||
          /free tier/i.test(normalizedMessage));

      if (looksLikeFreeTierOnly) {
        throw new AIRequestError({
          message: `Qwen quota mode prevents using ${model}`,
          kind: "qwen_free_tier_only",
          provider: model,
          status,
          code: normalizedCode || "AllocationQuota.FreeTierOnly",
        });
      }

      throw new AIRequestError({
        message: `Qwen API (${model}) error ${status}`,
        kind: "http_error",
        provider: model,
        status,
        code: normalizedCode || undefined,
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new AIRequestError({
        message: `Qwen (${model}) returned empty content`,
        kind: "empty_content",
        provider: model,
      });
    }

    console.log(`[AI] ✅ Successfully called Qwen API (${model})`);
    return content;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as any).name === 'AbortError') {
      throw new AIRequestError({
        message: `Qwen API (${model}) request timeout after ${timeoutMs}ms`,
        kind: "http_error",
        provider: model,
        status: 408,
      });
    }
    throw error;
  }
}

async function callOpenAI(messages: AIMessage[], temperature: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!hasValidKey(apiKey)) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const client = new OpenAI({ apiKey: apiKey.trim() });
  const response = await client.chat.completions.create({
    model: DEFAULT_MODELS.openai,
    messages,
    temperature,
    max_tokens: 800,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }
  return content;
}

async function callMistral(messages: AIMessage[], temperature: number) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!hasValidKey(apiKey)) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODELS.mistral,
      messages,
      temperature,
      max_tokens: 800,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Mistral returned empty content");
  }
  return content;
}

async function callZhipu(messages: AIMessage[], temperature: number) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!hasValidKey(apiKey)) {
    throw new Error("ZHIPU_API_KEY is not configured");
  }

  const client = new ZhipuAI({ apiKey: apiKey.trim() });
  const response = await client.chat.completions.create({
    model: DEFAULT_MODELS.zhipu,
    messages,
    temperature,
    top_p: 0.9,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Zhipu returned empty content");
  }
  return content;
}

function cleanAIContent(content: string) {
  return content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
}

function extractJsonCandidate(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return trimmed;
  }

  const firstArray = trimmed.indexOf("[");
  const lastArray = trimmed.lastIndexOf("]");
  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
    return trimmed.slice(firstArray, lastArray + 1);
  }

  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
    return trimmed.slice(firstObject, lastObject + 1);
  }

  return trimmed;
}

function escapeInvalidNewlines(json: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i += 1) {
    const ch = json[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === "\"") {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }
      // Handle other control characters that break JSON
      const code = ch.charCodeAt(0);
      if (code < 32) {
        result += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
    }

    result += ch;
  }

  return result;
}

function normalizeJsonContent(content: string) {
  const withAsciiQuotes = content.replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
  const withoutTrailingCommas = withAsciiQuotes.replace(/,\s*([}\]])/g, "$1");
  return escapeInvalidNewlines(withoutTrailingCommas);
}

/**
 * Attempt to repair truncated JSON arrays by closing open brackets
 */
function repairTruncatedJson(json: string): string {
  const trimmed = json.trim();

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === "\"") { inString = !inString; continue; }
    if (!inString) {
      if (ch === "{") openBraces++;
      else if (ch === "}") openBraces--;
      else if (ch === "[") openBrackets++;
      else if (ch === "]") openBrackets--;
    }
  }

  let result = trimmed;
  if (inString) result = result.replace(/[^"]*$/, "") + "\"";
  result = result.replace(/,\s*$/, "");
  while (openBraces > 0) { result += "}"; openBraces--; }
  while (openBrackets > 0) { result += "]"; openBrackets--; }
  return result;
}

/**
 * Extract valid JSON items from a partial array (handles truncated responses)
 */
function extractValidItemsFromPartialArray(content: string): any[] | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("[")) return null;

  const items: any[] = [];
  let depth = 0;
  let itemStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === "\"") { inString = !inString; continue; }
    if (inString) continue;

    if (ch === "[" || ch === "{") {
      if (depth === 1 && ch === "{") itemStart = i;
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 1 && ch === "}" && itemStart !== -1) {
        try {
          const item = JSON.parse(normalizeJsonContent(trimmed.slice(itemStart, i + 1)));
          if (item && typeof item === "object" && item.title) items.push(item);
        } catch { /* skip */ }
        itemStart = -1;
      }
    }
  }
  return items.length > 0 ? items : null;
}

function parseAIJson(content: string) {
  const cleaned = cleanAIContent(content);
  const candidates = [cleaned, extractJsonCandidate(cleaned)];
  let lastError: unknown;

  for (const candidate of candidates) {
    if (!candidate) continue;

    try { return JSON.parse(candidate); } catch (e) { lastError = e; }

    try {
      const normalized = normalizeJsonContent(candidate);
      return JSON.parse(normalized);
    } catch (e) { lastError = e; }

    try {
      const repaired = repairTruncatedJson(normalizeJsonContent(candidate));
      return JSON.parse(repaired);
    } catch (e) { lastError = e; }

    try {
      const validItems = extractValidItemsFromPartialArray(candidate);
      if (validItems && validItems.length > 0) {
        console.log(`[JSON Repair] Extracted ${validItems.length} valid items from partial array`);
        return validItems;
      }
    } catch { /* continue */ }
  }

  throw lastError || new Error("Failed to parse AI JSON output");
}

export async function callRecommendationAI(messages: AIMessage[], temperature = 0.8) {
  const result = await callAIWithFallback(messages, temperature);
  return cleanAIContent(result.content);
}

interface UserHistory {
  category: string;
  title: string;
  clicked?: boolean;
  saved?: boolean;
  metadata?: any;
}

export interface UserPreferenceData {
  preferences?: Record<string, any>;
  tags?: string[];
  ai_profile_summary?: string;
  personality_tags?: string[];
  onboarding_completed?: boolean;
}

export interface RecommendationItem {
  title: string;
  description: string;
  reason: string;
  tags: string[];
  searchQuery: string;  // 用于搜索引擎的查询词
  platform: string;      // 推荐的平台
  entertainmentType?: 'video' | 'game' | 'music' | 'review';  // 娱乐类型（仅娱乐分类）
  fitnessType?: 'nearby_place' | 'tutorial' | 'equipment' | 'theory_article';
}

export type GenerateRecommendationsOptions = {
  client?: "app" | "web";
  geo?: { lat: number; lng: number } | null;
  avoidTitles?: string[] | null;
  isMobile?: boolean;
  isAndroid?: boolean;
  signals?:
  | {
    topTags?: string[] | null;
    positiveSamples?: Array<{
      title: string;
      tags?: string[] | null;
      searchQuery?: string | null;
    }> | null;
    negativeSamples?: Array<{
      title: string;
      tags?: string[] | null;
      searchQuery?: string | null;
      feedbackType: string;
      rating?: number | null;
    }> | null;
  }
  | null;
};

export function buildExpansionSignalPrompt(params: {
  locale: "zh" | "en";
  topTags: string[];
  positiveSamples: Array<{ title: string; tags?: string[]; searchQuery?: string }>;
  negativeSamples: Array<{ title: string; tags?: string[]; searchQuery?: string; feedbackType: string; rating?: number }>;
  avoidTitles: string[];
  requestNonce: string;
}): string {
  const { locale, topTags, positiveSamples, negativeSamples, avoidTitles, requestNonce } = params;

  // 预格式化避开标题列表，强化去重效果
  const avoidTitlesStr = avoidTitles.length > 0 ? avoidTitles.join("、") : "无";

  if (locale === "zh") {
    return `\n\n【拓展信号（三段式）】\n- Top Tags（按重要性排序）：${topTags.length > 0 ? topTags.join("、") : "无"}\n- 最近正反馈样本（点击/收藏）：${positiveSamples.length > 0 ? JSON.stringify(positiveSamples, null, 2) : "无"}\n- 负反馈样本（不感兴趣/跳过/低评分，必须避开同主题）：${negativeSamples.length > 0 ? JSON.stringify(negativeSamples, null, 2) : "无"}\n- 需要避开的标题（强制避重复，这些是用户已经看过的，绝不能再推荐）：${avoidTitlesStr}\n- 本次生成种子（用于提升随机性）：${requestNonce}\n\n【拓展策略（可控）】\n- 50% 围绕 Top Tags + 正反馈样本做长尾细分：同题材不同作品/同菜系不同招牌/同目的地不同玩法，但必须是全新的、未出现过的具体内容。\n- 30% 做相邻探索：基于 Top Tags 的相邻概念做拓展，寻找用户可能感兴趣但尚未接触过的全新领域。\n- 20% 做新鲜补充：在不触发负反馈的前提下，提供小众/冷门/新上线的具体条目，强调新鲜感和惊喜感。\n\n【避坑规则 - 最高优先级】\n- 不得输出与负反馈样本高度相关的条目（同主题/同关键词/同意图都算）。\n- 输出内不得重复；不得与“需要避开的标题”重复或高度相似（同义/换序/续集/系列也算重复）。\n- 每次生成都要追求最大程度的新颖性，不要总是推荐最知名/最热门的内容。\n`;
  }

  return `\n\n[Expansion Signals (3-part)]\n- Top tags (ranked): ${topTags.length > 0 ? topTags.join(", ") : "none"}\n- Recent positive examples (clicked/saved): ${positiveSamples.length > 0 ? JSON.stringify(positiveSamples, null, 2) : "none"}\n- Negative examples (not interested/skip/low rating; must avoid): ${negativeSamples.length > 0 ? JSON.stringify(negativeSamples, null, 2) : "none"}\n- Titles to avoid (must avoid): ${avoidTitles.length > 0 ? avoidTitles.join(", ") : "none"}\n- Generation nonce (for randomness): ${requestNonce}\n\n[Expansion Strategy (controllable)]\n- 60% exploit: expand from top tags + positive examples into long-tail subtopics.\n- 25% explore: adjacent concepts, still specific and searchable.\n- 15% fresh: add novel but still relevant items, without triggering negative examples.\n\n[Anti-Patterns]\n- Do NOT output items strongly related to negative examples.\n- No duplicates; must not repeat or paraphrase avoided titles.\n`;
}

/**
 * Returns the INTL (English) platform list for a given recommendation category.
 * Extracted for testability.
 */
export function getIntlCategoryPlatforms(category: string): string[] {
  const platformMap: Record<string, string[]> = {
    entertainment: ['IMDb', 'YouTube', 'Spotify', 'Metacritic', 'Steam', 'Netflix', 'Rotten Tomatoes'],
    shopping: ['Amazon', 'eBay', 'Walmart', 'Google Maps'],
    food: ['Uber Eats', 'Love and Lemons', 'Google Maps', 'Yelp'],
    travel: ['Booking.com', 'TripAdvisor', 'SANParks', 'YouTube'],
    fitness: ['YouTube Fitness', 'Muscle & Strength', 'Google Maps'],
  };
  return platformMap[category] ?? [];
}

/**
 * Returns the INTL mobile App platform list for a given recommendation category.
 * Used when isMobile=true to prioritize platforms with native apps.
 */
export function getMobilePlatforms(category: string): string[] {
  switch (category) {
    case "entertainment":
      return ["YouTube", "TikTok", "JustWatch", "Spotify", "Medium", "MiniReview"];
    case "shopping":
      return ["Amazon Shopping", "Etsy", "Slickdeals", "Pinterest"];
    case "food":
      return ["DoorDash", "Uber Eats", "Fantuan Delivery", "HungryPanda"];
    case "travel":
      return ["TripAdvisor", "Yelp", "Wanderlog", "Visit A City", "GetYourGuide", "Google Maps"];
    case "fitness":
      return ["Nike Training Club", "Peloton", "Strava", "Nike Run Club", "Hevy", "Strong", "Down Dog", "MyFitnessPal"];
    default:
      return [];
  }
}


/**
 * 使用智谱 AI 分析用户偏好并生成推荐
 * 注意：AI 只生成推荐内容，不生成链接
 */
export async function generateRecommendations(
  userHistory: UserHistory[],
  category: string,
  locale: string = 'zh',
  count: number = 5,
  userPreference?: UserPreferenceData | null,
  options?: GenerateRecommendationsOptions
): Promise<RecommendationItem[]> {
  const client = options?.client ?? "web";
  const geo = options?.geo ?? null;
  const isMobile = options?.isMobile ?? false;
  const isAndroid = options?.isAndroid ?? false;
  const isCnWeb = isChinaDeployment() && locale === "zh" && client === "web";
  const isIntlMobile = !isChinaDeployment() && locale === "en" && isMobile;
  const isIntlAndroidFood = !isChinaDeployment() && locale === "en" && isMobile && isAndroid && category === "food";
  const avoidTitles = Array.isArray(options?.avoidTitles)
    ? options!.avoidTitles!.filter((t) => typeof t === "string" && t.trim().length > 0)
    : [];
  const signals = options?.signals ?? null;

  // 构建用户画像提示
  let userProfilePrompt = '';
  if (userPreference) {
    const profileParts: string[] = [];

    // 问卷偏好数据
    if (userPreference.preferences && Object.keys(userPreference.preferences).length > 0) {
      profileParts.push(locale === 'zh'
        ? `用户问卷偏好：${JSON.stringify(userPreference.preferences)}`
        : `User questionnaire preferences: ${JSON.stringify(userPreference.preferences)}`);
    }

    // AI画像摘要
    if (userPreference.ai_profile_summary) {
      profileParts.push(locale === 'zh'
        ? `用户AI画像：${userPreference.ai_profile_summary}`
        : `User AI profile: ${userPreference.ai_profile_summary}`);
    }

    // 个性标签
    if (userPreference.personality_tags && userPreference.personality_tags.length > 0) {
      profileParts.push(locale === 'zh'
        ? `用户个性标签：${userPreference.personality_tags.join('、')}`
        : `User personality tags: ${userPreference.personality_tags.join(', ')}`);
    }

    // 用户标签
    if (userPreference.tags && userPreference.tags.length > 0) {
      profileParts.push(locale === 'zh'
        ? `用户兴趣标签：${userPreference.tags.join('、')}`
        : `User interest tags: ${userPreference.tags.join(', ')}`);
    }

    if (profileParts.length > 0) {
      userProfilePrompt = locale === 'zh'
        ? `\n\n**用户画像信息（请根据以下信息生成更精准的个性化推荐）**：\n${profileParts.join('\n')}\n`
        : `\n\n**User Profile (please generate more personalized recommendations based on this)**:\n${profileParts.join('\n')}\n`;
    }
  }

  const categoryConfig = {
    entertainment: {
      platforms: locale === 'zh'
        ? (client === 'app'
          ? ['腾讯视频', '优酷', '爱奇艺', 'TapTap', '网易云音乐', '酷狗音乐', 'QQ音乐', '百度']
          : ['腾讯视频', 'TapTap', 'Steam', '酷狗音乐', '笔趣阁', '豆瓣'])
        : isIntlMobile ? getMobilePlatforms('entertainment') : getIntlCategoryPlatforms('entertainment'),
      examples: locale === 'zh'
        ? '电影、电视剧、游戏、音乐、综艺、动漫、小说'
        : 'movies, TV shows, games, music, variety shows, anime',
      types: locale === 'zh'
        ? ['视频', '游戏', '音乐', '小说/文章']
        : ['video', 'game', 'music', 'review/news'],
      // 游戏平台专用列表，供 AI 在推荐游戏时选择
      gamePlatforms: locale === 'zh'
        ? (client === 'app' ? ['TapTap'] : ['TapTap', 'Steam'])
        : ['Steam', 'Epic Games', 'GOG', 'PlayStation Store', 'Xbox Store', 'Nintendo eShop', 'Humble Bundle', 'itch.io', 'Game Pass'],
      // 音乐平台专用列表
      musicPlatforms: locale === 'zh'
        ? (client === 'app' ? ['网易云音乐', '酷狗音乐', 'QQ音乐'] : ['酷狗音乐', 'QQ音乐', '网易云音乐'])
        : ['Spotify', 'YouTube Music', 'Apple Music', 'SoundCloud']
    },
    shopping: {
      platforms: locale === 'zh'
        ? ['京东', '淘宝', '拼多多', '唯品会', '什么值得买', '慢慢买']
        : isIntlMobile ? getMobilePlatforms('shopping') : getIntlCategoryPlatforms('shopping'),
      examples: locale === 'zh'
        ? '数码产品、服装、家居用品'
        : 'electronics, clothing, home goods'
    },
    food: {
      platforms: locale === 'zh'
        ? client === "app"
          ? ['大众点评', '美团外卖', '腾讯地图美食', '百度地图美食', '高德地图美食', '京东秒送', '淘宝闪购', '美团外卖', '小红书']
          : ['下厨房', '高德地图美食', '大众点评']
        : isIntlMobile ? getMobilePlatforms('food') : getIntlCategoryPlatforms('food'),
      examples: locale === 'zh'
        ? '食谱、附近好去处、菜系'
        : 'restaurants, recipes, food'
    },
    travel: {
      platforms: locale === 'zh'
        ? ['携程', '去哪儿', '马蜂窝', '穷游', '小红书']
        : isIntlMobile ? getMobilePlatforms('travel') : getIntlCategoryPlatforms('travel'),
      examples: locale === 'zh'
        ? '景点、酒店、旅游攻略、目的地体验'
        : 'attractions, hotels, travel guides, destination experiences'
    },
    fitness: {
      platforms: locale === 'zh'
        ? (isCnWeb
          ? ['小红书', '知乎', '什么值得买']
          : ['小红书', '优酷健身', 'Keep', '大众点评', '美团', '百度地图健身', '高德地图健身', '腾讯地图健身', '知乎', '什么值得买'])
        : isIntlMobile ? getMobilePlatforms('fitness') : getIntlCategoryPlatforms('fitness'),
      examples: locale === 'zh'
        ? (isCnWeb ? '健身视频、健身原理文章、健身器材推荐' : '健身课程、健身房、哑铃/壶铃/弹力带/瑜伽垫等具体器材')
        : 'fitness classes, gyms, fitness equipment, workout gear'
    }
  };

  const fitnessRequirementsZh =
    category === "fitness"
      ? (isCnWeb
        ? `【强制要求】必须包含3种类型，各至少1个，并且每项必须包含 fitnessType 字段：
- 健身视频(tutorial): 可跟练的视频课程/动作讲解
- 健身原理文章(theory_article): 讲原理/机制/误区/小白科普的文章
- 健身器材(equipment): 器材选购/评测/使用要点（偏推荐与评测，不要纯购物链接）
fitnessType 必须为 tutorial/theory_article/equipment 之一。

【视频硬指标】fitnessType=tutorial 时：searchQuery 必须包含“教程/跟练/训练/视频”至少一项。
【原理文章硬指标】fitnessType=theory_article 时：searchQuery 必须包含“原理/机制/科学/小白/误区”至少一项。
【器材硬指标】fitnessType=equipment 时：searchQuery 必须包含“器材/评测/选购/推荐/使用要点”至少一项。`
        : `【强制要求】必须包含3种类型，各至少1个，并且每项必须包含 fitnessType 字段：
- 附近场所(nearby_place): 真实可去的健身房/运动场地/场馆（不是教程/不是装备评测）
- 教程(tutorial): 健身动作/课程/跟练视频
- 器材(equipment): 必须是具体器材名的内容，如“哑铃动作要点 / 壶铃入门 / 弹力带怎么用 / 瑜伽垫怎么选”；不要输出“必备健身器材 / 家用器材 / 运动装备”这类大类词
fitnessType 必须为 nearby_place/tutorial/equipment 之一。

【附近场所硬指标】当你输出 fitnessType=nearby_place 时，description 必须同时提到：
1) 通风系统（是否闷/异味，建议看评论）
2) 深蹲架数量（照片里大概几个，是否需要排队）
3) 距离（建议优先步行15分钟内，离家/公司近更容易坚持）
并且 searchQuery 必须包含“附近/步行/地铁/商圈/街道”至少一项，方便定位周边。

【教程硬指标】fitnessType=tutorial 时：searchQuery 必须包含“教程/跟练/训练/视频课”至少一项。
【器材硬指标】fitnessType=equipment 时：title 或 searchQuery 至少一个必须包含具体器材名（如“哑铃/壶铃/弹力带/瑜伽垫/泡沫轴/健腹轮”），并且 searchQuery 必须包含“使用教程/怎么用/入门/动作要点”至少一项。`)
      : "";

  const config = categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.entertainment;

  const desiredCount = Math.max(5, Math.min(20, count));

  const positiveSamples =
    Array.isArray(signals?.positiveSamples) && signals!.positiveSamples!.length > 0
      ? signals!.positiveSamples!
        .filter((s) => typeof (s as any)?.title === "string" && String((s as any).title).trim().length > 0)
        .slice(0, 10)
        .map((s) => ({
          title: String((s as any).title),
          tags: Array.isArray((s as any)?.tags)
            ? ((s as any).tags as unknown[]).filter((t) => typeof t === "string" && t.trim().length > 0)
            : undefined,
          searchQuery:
            typeof (s as any)?.searchQuery === "string" && String((s as any).searchQuery).trim().length > 0
              ? String((s as any).searchQuery)
              : undefined,
        }))
      : userHistory
        .filter((h) => !!(h as any)?.clicked || !!(h as any)?.saved)
        .slice(0, 10)
        .map((h) => ({
          title: h.title,
          tags: (h as any)?.metadata?.tags,
        }))
        .filter((h) => typeof h.title === "string" && h.title.trim().length > 0);

  const negativeSamples =
    Array.isArray(signals?.negativeSamples) && signals!.negativeSamples!.length > 0
      ? signals!.negativeSamples!
        .filter((s) => typeof (s as any)?.title === "string" && String((s as any).title).trim().length > 0)
        .slice(0, 10)
        .map((s) => ({
          title: String((s as any).title),
          tags: Array.isArray((s as any)?.tags)
            ? ((s as any).tags as unknown[]).filter(
              (t): t is string => typeof t === "string" && t.trim().length > 0
            )
            : undefined,
          searchQuery:
            typeof (s as any)?.searchQuery === "string" && String((s as any).searchQuery).trim().length > 0
              ? String((s as any).searchQuery)
              : undefined,
          feedbackType: String((s as any)?.feedbackType || ""),
          rating: typeof (s as any)?.rating === "number" ? Number((s as any).rating) : undefined,
        }))
      : [];

  const topTags =
    Array.isArray(signals?.topTags) && signals!.topTags!.length > 0
      ? signals!.topTags!
        .filter((t) => typeof t === "string" && t.trim().length > 0)
        .slice(0, 12)
      : [];

  const recentShownTitles = userHistory
    .slice(0, 30)
    .map((h) => h.title)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0);

  // 使用多源随机种子提升推荐多样性
  const requestNonce = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(36).slice(2, 8)}`;

  const avoidTitlesForPrompt = [
    ...avoidTitles,
    ...recentShownTitles,
    ...negativeSamples.map((s) => s.title),
  ]
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .slice(0, 80);

  const behaviorPrompt = buildExpansionSignalPrompt({
    locale: locale === "en" ? "en" : "zh",
    topTags,
    positiveSamples,
    negativeSamples,
    avoidTitles: avoidTitlesForPrompt,
    requestNonce,
  });

  // 随机选择推荐风格倾向，增加多样性
  const diversityAngles = [
    "偏向近期热门与新上线内容",
    "偏向小众精品与口碑佳作",
    "偏向经典作品与长期热门",
    "偏向新锐创新与潮流趋势",
    "偏向高性价比与实用推荐",
  ];
  const angleIndex = Math.floor(Math.random() * diversityAngles.length);
  const currentAngle = diversityAngles[angleIndex];

  const intlAndroidFoodHardConstraintsPrompt = isIntlAndroidFood
    ? `
[INTL Android Food Hard Constraints / INTL 安卓 Food 硬约束]
- Return specific orderable dish names only (title = dish_name). No scenario labels.
- 仅输出可直接下单的具体菜品（title = dish_name），禁止场景词：家庭聚餐、朋友小聚、宵夜场景、约会、办公室午餐。
- platform = app_name and MUST be one of: DoorDash, Uber Eats, Fantuan Delivery, HungryPanda.
- 每条需满足结构映射：title=dish_name, platform=app_name, tags must include cuisine:<type> and price_range:<$|$$|$$$>.
- At least 70% must be concrete single dishes; avoid broad labels such as Chinese food, Western food, fast food.
- searchQuery must be a concrete dish keyword and should match title semantics.
`
    : "";

  const prompt = locale === 'zh' ? `
生成 ${desiredCount} 个推荐。

用户历史：${JSON.stringify(userHistory.slice(0, 10), null, 2)}
${userProfilePrompt}
${behaviorPrompt}
分类：${category}

【去重】严禁与以下标题重复：${avoidTitlesForPrompt.slice(0, 30).join('、')}

【推荐风格】${currentAngle}

输出JSON数组，每项包含：title, description(30字内), reason(30字内), tags(3个), searchQuery, platform${category === 'entertainment' ? ', entertainmentType' : ''}

【reason要求】从5种类型轮换：偏好匹配/时机场景/社交热点/个性发现/实用价值，每条不同。

${category === 'entertainment' ? `【娱乐类型】必须包含具体作品名，每种类型至少1个：
- 视频(腾讯视频/优酷/爱奇艺): 具体影视名(如《流浪地球2》)
- 游戏(${(config as any).gamePlatforms?.slice(0, 2).join('/')}): 具体游戏名(如《原神》)
- 音乐(${(config as any).musicPlatforms?.slice(0, 2).join('/')}): 具体歌曲/专辑(如《晴天》)
- 小说/文章(笔趣阁/百度): 具体小说名
entertainmentType必填(video/game/music/review)` : ''}${category === 'food' ? `【美食类型】包含3种：
- 食谱: 纯菜名(如”宫保鸡丁”)，platform: 下厨房
- 菜系: 纯菜系(如”川菜”)，platform: 高德地图美食
- 场合: 纯场合(如”商务午餐”)，platform: 高德地图美食
searchQuery只写核心词，不含”美食/餐厅/推荐”。` : ''}${category === 'travel' ? `【旅行类型】覆盖3类：
1) 附近景点：2个真实名称${geo ? `(位置${geo.lat},${geo.lng})` : ''}
2) 国内目的地：2个具体景点/区域
3) 国外目的地：1个具体景点/区域
标题格式：”国家·城市·景点”(如”中国·西安·大雁塔”)` : ''}${fitnessRequirementsZh}
${category === 'entertainment' ? `
【搜索词】
- 视频：仅片名/人物，不含”豆瓣/评分/在线观看”
- 游戏：仅游戏名，不含”Steam/攻略/下载”
- 音乐：仅歌名/歌手，不含平台名
- 小说：仅小说名，不含”TXT/下载”
` : ''}
平台：${config.platforms.slice(0, 4).join('、')}
勿生成URL` : `
Generate ${desiredCount} recommendations.

User history: ${JSON.stringify(userHistory.slice(0, 10), null, 2)}
${userProfilePrompt}
${behaviorPrompt}
Category: ${category}

De-dup: avoid ${avoidTitlesForPrompt.slice(0, 30).join(', ')}

Style: ${currentAngle}

Output JSON array with: title, description(30 chars), reason(30 chars), tags(3), searchQuery, platform${category === 'entertainment' ? ', entertainmentType' : ''}

Reason types (rotate): preference match/timing/social buzz/discovery/practical value

${category === 'entertainment' ? `Entertainment types (at least 1 each):
- Video(YouTube/IMDb): specific movie/show title
- Game(${(config as any).gamePlatforms?.slice(0, 2).join('/')}): specific game name
- Music(Spotify): specific song/album
- Review: specific article/review
entertainmentType required(video/game/music/review)` : ''}${category === 'food' ? `Food types (3):
- Recipe: dish name, platform: Love and Lemons
- Cuisine: cuisine type, platform: Google Maps
- Occasion: occasion type, platform: Yelp
searchQuery: core keyword only` : ''}${category === 'travel' ? `Travel types (3):
1) Nearby: 2 real places${geo ? ` (${geo.lat},${geo.lng})` : ''}
2) Domestic: 2 specific destinations
3) International: 1 specific destination
Format: "Country·City·Attraction"` : ''}${category === 'fitness' ? `Fitness types (3, at least 1 each):
- nearby_place: real gym/sports venue
- tutorial: workout video
- equipment: equipment guide
fitnessType required(nearby_place/tutorial/equipment)` : ''}

[Platform-Content Alignment Rules]
- Game recommendations: use Metacritic or Steam as platform, searchQuery = game title only
- Video recommendations: use YouTube as platform
- Music recommendations: use Spotify as platform, searchQuery = "Artist - Song" format
- Movie/TV recommendations: use IMDb as platform, searchQuery = title only

[Shopping Platform Rules]
- Online shopping: use Amazon, eBay, or Walmart
- Offline/nearby shopping: use Google Maps, searchQuery includes product + "near me"

[Food Platform Rules]
- Food delivery: use Uber Eats, searchQuery = cuisine or dish name
- Recipes: use Love and Lemons, searchQuery = dish name or ingredient
- Nearby restaurants: use Google Maps, searchQuery = cuisine + "restaurants near me"
- Picnic/outdoor dining: use Yelp, searchQuery = activity + location

[Travel Platform Rules]
- Accommodation: use Booking.com, searchQuery = destination + "hotel" or "beach"
- Attractions: use TripAdvisor or SANParks, searchQuery = destination + "attractions things to do"
- Attraction videos: use YouTube, searchQuery = destination + "park attraction"

[Fitness Platform Rules]
- Fitness videos/tutorials: use YouTube Fitness, searchQuery includes workout type + "guide tutorial"
- Fitness food & equipment: use Muscle & Strength, searchQuery = product/topic
${isIntlMobile ? `
[Mobile App Platform Rules - INTL]
You are generating recommendations for a MOBILE user. Prioritize platforms with native apps.
North America local-life preference (important):
- Prefer US/Canada local contexts, neighborhoods, city landmarks, and realistic daily-life scenarios.
- searchQuery must be concrete single items (specific place/store/dish/route/workout), not broad categories.
- Avoid generic phrasing such as "top", "best", "trending", "guide", "ideas", "things to do", "near me".

Entertainment:
- Short videos: use YouTube or TikTok, searchQuery = topic or trend keyword
- Movies/TV: use JustWatch, searchQuery = movie/show title
- Music: use Spotify, searchQuery = "Artist - Song" format
- Articles/News: use Medium, searchQuery = topic keyword
- Games: use MiniReview, searchQuery = game name or genre

Shopping:
- General shopping: use Amazon Shopping, searchQuery = product name
- Handmade/unique items: use Etsy, searchQuery = product description
- Deals/discounts: use Slickdeals, searchQuery = product or deal keyword
- Inspiration/ideas: use Pinterest, searchQuery = style or product idea

Food:
- US mainstream delivery: use DoorDash or Uber Eats, searchQuery = cuisine or dish
- Chinese food delivery: use Fantuan Delivery or HungryPanda, searchQuery = dish name in Chinese or English
${intlAndroidFoodHardConstraintsPrompt}

Travel:
- Reviews/guides: use TripAdvisor or Yelp, searchQuery = destination + "things to do"
- Trip planning: use Wanderlog or Visit A City, searchQuery = destination
- Local experiences/tours: use GetYourGuide, searchQuery = destination + activity
- Navigation: use Google Maps, searchQuery = place name

Fitness:
- Home/general training: use Nike Training Club or Peloton, searchQuery = workout type
- Running/cycling: use Strava or Nike Run Club, searchQuery = activity type
- Strength training: use Hevy or Strong, searchQuery = exercise name
- Yoga: use Down Dog, searchQuery = yoga style
- Diet tracking: use MyFitnessPal, searchQuery = food or meal name
` : ''}

De-dup: avoid ${avoidTitlesForPrompt.slice(0, 30).join(', ')}

Platform choices: ${config.platforms.slice(0, 6).join(', ')}
No URLs`;

  try {
    const aiContent = await callRecommendationAI(
      [
        {
          role: 'system',
          content: locale === 'zh'
            ? '你是推荐分析师。返回JSON数组，无链接，无markdown。每条推荐必须全新，理由独特简洁(30字内)。'
            : 'You are a recommendation analyst. Return JSON array, no links, no markdown. Each recommendation must be fresh, reason unique and concise (30 chars).'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      0.92
    );

    if (!aiContent) {
      console.error('AI 返回空内容');
      return getFallbackRecommendations(category, locale);
    }

    const result = parseAIJson(aiContent);
    return Array.isArray(result) ? result : [result];

  } catch (error) {
    console.error('AI 推荐生成失败:', error);
    return getFallbackRecommendations(category, locale);
  }
}

/**
 * 降级方案
 */
function getFallbackRecommendations(category: string, locale: string): RecommendationItem[] {
  const typedLocale = locale === "en" ? "en" : "zh";
  const typedCategory = (
    ["entertainment", "shopping", "food", "travel", "fitness"].includes(category)
      ? category
      : "entertainment"
  ) as RecommendationCategory;

  return generateFallbackCandidates({
    category: typedCategory,
    locale: typedLocale,
    count: 8,
    client: "web",
  }) as RecommendationItem[];
}

