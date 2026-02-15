import OpenAI from "openai";
import { isChinaDeployment } from "@/lib/config/deployment.config";

interface AIRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
}

interface AIResponse {
  content: string;
  model: string;
}

const CN_QWEN_MODELS = ["qwen-flash", "qwen-turbo", "qwen-plus", "qwen-max"] as const;
type CNQwenModel = (typeof CN_QWEN_MODELS)[number];
type IntlProvider = "openai" | "mistral";
const CN_ZHIPU_MODEL = process.env.ZHIPU_MODEL || "glm-4.5-flash";

const INTL_MODELS = {
  mistral: process.env.MISTRAL_MODEL || "mistral-small-latest",
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
};

const FAST_CN_QWEN_ORDER: readonly CNQwenModel[] = ["qwen-flash", "qwen-turbo"];
const DEFAULT_INTL_PROVIDER_ORDER: readonly IntlProvider[] = ["mistral", "openai"];
const FAST_INTL_PROVIDER_ORDER: readonly IntlProvider[] = ["openai", "mistral"];
const DEFAULT_MAX_TOKENS = 1200;
const DEFAULT_FAST_MODE = true;
const DEFAULT_PROVIDER_TIMEOUT_FAST_MS = 3800;
const DEFAULT_PROVIDER_TIMEOUT_SAFE_MS = 9000;
const DEFAULT_TOTAL_TIMEOUT_FAST_MS = 5000;
const DEFAULT_TOTAL_TIMEOUT_SAFE_MS = 20000;
const DEFAULT_INTL_PARALLEL_RACE = true;
const DEFAULT_INTL_SECONDARY_DELAY_MS = 300;
const ASSISTANT_AI_DEBUG =
  String(process.env.ASSISTANT_AI_DEBUG || "").toLowerCase() === "true";

const QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

interface AIExecutionConfig {
  fastMode: boolean;
  providerTimeoutMs: number;
  totalTimeoutMs: number;
  maxRetries: number;
  cnQwenOrder: CNQwenModel[];
  intlProviderOrder: IntlProvider[];
  intlParallelRace: boolean;
  intlSecondaryDelayMs: number;
}

interface ProviderRuntimeOptions {
  timeoutMs: number;
  maxRetries: number;
}

function logAIDebug(message: string, payload: Record<string, unknown>): void {
  if (!ASSISTANT_AI_DEBUG || process.env.NODE_ENV === "test") {
    return;
  }

  console.info(message, payload);
}

function hasValidKey(value?: string | null): value is string {
  return Boolean(value && value.trim() && !value.includes("your_"));
}

function shouldRetryStatus(statusCode?: number): boolean {
  return statusCode === 429 || (typeof statusCode === "number" && statusCode >= 500);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarizeRequest(
  request: AIRequest,
  includePreview = false
): Record<string, unknown> {
  const userMessages = request.messages.filter((msg) => msg.role === "user");
  const latestUserContent = userMessages[userMessages.length - 1]?.content || "";

  return {
    messageCount: request.messages.length,
    userMessageCount: userMessages.length,
    latestUserChars: latestUserContent.length,
    ...(includePreview ? { latestUserPreview: latestUserContent.slice(0, 80) } : {}),
    temperature: request.temperature ?? 0.7,
    maxTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
}

function summarizeConfig(config: AIExecutionConfig): Record<string, unknown> {
  return {
    deployment: isChinaDeployment() ? "CN" : "INTL",
    fastMode: config.fastMode,
    providerTimeoutMs: config.providerTimeoutMs,
    totalTimeoutMs: config.totalTimeoutMs,
    maxRetries: config.maxRetries,
    cnQwenOrder: config.cnQwenOrder,
    intlProviderOrder: config.intlProviderOrder,
    intlParallelRace: config.intlParallelRace,
    intlSecondaryDelayMs: config.intlSecondaryDelayMs,
    providerAvailability: {
      qwen: isQwenConfigured(),
      zhipu: isZhipuConfigured(),
      openai: isOpenAIConfigured(),
      mistral: isMistralConfigured(),
    },
  };
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
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

function parseQwenOrder(raw: string | undefined, fallback: readonly CNQwenModel[]): CNQwenModel[] {
  if (!raw || raw.trim().length === 0) {
    return [...fallback];
  }

  const allowed = new Set<string>(CN_QWEN_MODELS);
  const parsed: CNQwenModel[] = [];
  for (const token of raw.split(/[,\s]+/)) {
    const normalized = token.trim().toLowerCase();
    if (!normalized || !allowed.has(normalized)) {
      continue;
    }

    const model = normalized as CNQwenModel;
    if (!parsed.includes(model)) {
      parsed.push(model);
    }
  }

  return parsed.length > 0 ? parsed : [...fallback];
}

function parseIntlProviderOrder(
  raw: string | undefined,
  fallback: readonly IntlProvider[]
): IntlProvider[] {
  if (!raw || raw.trim().length === 0) {
    return [...fallback];
  }

  const allowed = new Set<IntlProvider>(["openai", "mistral"]);
  const parsed: IntlProvider[] = [];
  for (const token of raw.split(/[,\s]+/)) {
    const normalized = token.trim().toLowerCase() as IntlProvider;
    if (!allowed.has(normalized)) {
      continue;
    }

    if (!parsed.includes(normalized)) {
      parsed.push(normalized);
    }
  }

  return parsed.length > 0 ? parsed : [...fallback];
}

function getExecutionConfig(): AIExecutionConfig {
  const fastModeDefault = isChinaDeployment() ? false : DEFAULT_FAST_MODE;
  const fastMode = parseBooleanEnv(
    process.env.ASSISTANT_AI_FAST_MODE ?? process.env.AI_FAST_MODE,
    fastModeDefault
  );
  const providerTimeoutDefault = fastMode
    ? DEFAULT_PROVIDER_TIMEOUT_FAST_MS
    : DEFAULT_PROVIDER_TIMEOUT_SAFE_MS;
  const providerTimeoutMs = parseBoundedIntEnv(
    process.env.ASSISTANT_AI_PROVIDER_TIMEOUT_MS ?? process.env.AI_PROVIDER_TIMEOUT_MS,
    providerTimeoutDefault,
    1000,
    30000
  );
  const totalTimeoutDefault = fastMode ? DEFAULT_TOTAL_TIMEOUT_FAST_MS : DEFAULT_TOTAL_TIMEOUT_SAFE_MS;
  const totalTimeoutMs = parseBoundedIntEnv(
    process.env.ASSISTANT_AI_TOTAL_TIMEOUT_MS ?? process.env.AI_TOTAL_TIMEOUT_MS,
    totalTimeoutDefault,
    providerTimeoutMs,
    60000
  );

  const maxRetries = parseBoundedIntEnv(
    process.env.ASSISTANT_AI_MAX_RETRIES,
    fastMode ? 0 : 1,
    0,
    3
  );

  const defaultCnOrder = fastMode ? FAST_CN_QWEN_ORDER : CN_QWEN_MODELS;
  const defaultIntlOrder = fastMode ? FAST_INTL_PROVIDER_ORDER : DEFAULT_INTL_PROVIDER_ORDER;
  const intlParallelRace = parseBooleanEnv(
    process.env.ASSISTANT_INTL_PARALLEL_RACE,
    fastMode ? DEFAULT_INTL_PARALLEL_RACE : false
  );
  const intlSecondaryDelayMs = parseBoundedIntEnv(
    process.env.ASSISTANT_INTL_SECONDARY_DELAY_MS,
    DEFAULT_INTL_SECONDARY_DELAY_MS,
    0,
    2000
  );

  return {
    fastMode,
    providerTimeoutMs,
    totalTimeoutMs,
    maxRetries,
    cnQwenOrder: parseQwenOrder(process.env.ASSISTANT_CN_QWEN_MODELS, defaultCnOrder),
    intlProviderOrder: parseIntlProviderOrder(
      process.env.ASSISTANT_INTL_PROVIDER_ORDER,
      defaultIntlOrder
    ),
    intlParallelRace,
    intlSecondaryDelayMs,
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("socket hang up")
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

function resolveProviderTimeout(startedAt: number, config: AIExecutionConfig): number {
  const elapsed = Date.now() - startedAt;
  const remaining = config.totalTimeoutMs - elapsed;
  if (remaining <= 0) {
    throw new Error(`AI request timed out after ${config.totalTimeoutMs}ms`);
  }

  return Math.max(1000, Math.min(config.providerTimeoutMs, remaining));
}

function estimateRemainingTimeout(startedAt: number, config: AIExecutionConfig): number {
  const elapsed = Date.now() - startedAt;
  const remaining = config.totalTimeoutMs - elapsed;
  if (remaining <= 0) {
    return 0;
  }

  return Math.max(1000, Math.min(config.providerTimeoutMs, remaining));
}

export function isQwenConfigured(): boolean {
  return hasValidKey(process.env.QWEN_API_KEY);
}

export function isZhipuConfigured(): boolean {
  return hasValidKey(process.env.ZHIPU_API_KEY);
}

export function isMistralConfigured(): boolean {
  return hasValidKey(process.env.MISTRAL_API_KEY);
}

export function isOpenAIConfigured(): boolean {
  return hasValidKey(process.env.OPENAI_API_KEY);
}

async function callQwenAPI(
  request: AIRequest,
  model: CNQwenModel,
  options: ProviderRuntimeOptions,
  retryCount = 0
): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;

  if (!hasValidKey(apiKey)) {
    throw new Error("QWEN_API_KEY is not configured");
  }

  let response: Response;
  try {
    response = await fetch(QWEN_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    if (isRetryableNetworkError(error) && retryCount < options.maxRetries) {
      await delay(350 * (retryCount + 1));
      return callQwenAPI(request, model, options, retryCount + 1);
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // noop
    }

    if (shouldRetryStatus(response.status) && retryCount < options.maxRetries) {
      await delay(350 * (retryCount + 1));
      return callQwenAPI(request, model, options, retryCount + 1);
    }

    throw new Error(`Qwen API (${model}) error: ${response.status} - ${errorMessage}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error(`Qwen API (${model}) returned no valid content`);
  }

  return content;
}

async function callZhipuAPI(
  request: AIRequest,
  options: ProviderRuntimeOptions,
  retryCount = 0
): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;

  if (!hasValidKey(apiKey)) {
    throw new Error("ZHIPU_API_KEY is not configured");
  }

  let response: Response;
  try {
    response = await fetch(ZHIPU_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CN_ZHIPU_MODEL,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    if (isRetryableNetworkError(error) && retryCount < options.maxRetries) {
      await delay(350 * (retryCount + 1));
      return callZhipuAPI(request, options, retryCount + 1);
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.msg || errorText;
    } catch {
      // noop
    }

    if (shouldRetryStatus(response.status) && retryCount < options.maxRetries) {
      await delay(350 * (retryCount + 1));
      return callZhipuAPI(request, options, retryCount + 1);
    }

    throw new Error(`Zhipu API error: ${response.status} - ${errorMessage}`);
  }

  const data = await response.json();

  if (data?.code !== undefined && data.code !== 0) {
    throw new Error(`Zhipu API returned error code ${data.code}: ${data.msg}`);
  }

  const content =
    data?.choices?.[0]?.message?.content || data?.data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Zhipu API returned no valid content");
  }

  return content;
}

async function callMistralAPI(
  request: AIRequest,
  options: ProviderRuntimeOptions,
  retryCount = 0
): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!hasValidKey(apiKey)) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }

  let response: Response;
  try {
    response = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: INTL_MODELS.mistral,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      }),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    if (isRetryableNetworkError(error) && retryCount < options.maxRetries) {
      await delay(350 * (retryCount + 1));
      return callMistralAPI(request, options, retryCount + 1);
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (shouldRetryStatus(response.status) && retryCount < options.maxRetries) {
      await delay(350 * (retryCount + 1));
      return callMistralAPI(request, options, retryCount + 1);
    }
    throw new Error(`Mistral API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Mistral API returned no valid content");
  }

  return content;
}

async function callOpenAIAPI(
  request: AIRequest,
  options: ProviderRuntimeOptions,
  retryCount = 0
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!hasValidKey(apiKey)) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await runWithTimeout(
      () =>
        client.chat.completions.create({
          model: INTL_MODELS.openai,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        }),
      options.timeoutMs,
      `OpenAI API (${INTL_MODELS.openai})`
    );

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI API returned no valid content");
    }

    return content;
  } catch (error) {
    const statusCode =
      typeof (error as { status?: unknown })?.status === "number"
        ? Number((error as { status?: unknown }).status)
        : undefined;
    if (
      (shouldRetryStatus(statusCode) || isRetryableNetworkError(error)) &&
      retryCount < options.maxRetries
    ) {
      await delay(350 * (retryCount + 1));
      return callOpenAIAPI(request, options, retryCount + 1);
    }
    throw error;
  }
}

function getConfiguredIntlProviders(order: IntlProvider[]): IntlProvider[] {
  return order.filter((provider) => {
    if (provider === "openai") {
      return isOpenAIConfigured();
    }
    return isMistralConfigured();
  });
}

function getIntlProviderModel(provider: IntlProvider): string {
  return provider === "openai" ? INTL_MODELS.openai : INTL_MODELS.mistral;
}

async function callIntlProvider(
  provider: IntlProvider,
  request: AIRequest,
  startedAt: number,
  config: AIExecutionConfig
): Promise<AIResponse> {
  if (provider === "openai") {
    const content = await callOpenAIAPI(request, {
      timeoutMs: resolveProviderTimeout(startedAt, config),
      maxRetries: config.maxRetries,
    });
    return { content, model: INTL_MODELS.openai };
  }

  const content = await callMistralAPI(request, {
    timeoutMs: resolveProviderTimeout(startedAt, config),
    maxRetries: config.maxRetries,
  });
  return { content, model: INTL_MODELS.mistral };
}

async function callAIInternal(request: AIRequest, config: AIExecutionConfig): Promise<AIResponse> {
  const errors: string[] = [];
  const startedAt = Date.now();

  if (isChinaDeployment()) {
    if (isQwenConfigured()) {
      for (const model of config.cnQwenOrder) {
        logAIDebug("[AIClient] Trying CN provider", {
          provider: "qwen",
          model,
          timeoutMs: estimateRemainingTimeout(startedAt, config),
        });
        try {
          const content = await callQwenAPI(request, model, {
            timeoutMs: resolveProviderTimeout(startedAt, config),
            maxRetries: config.maxRetries,
          });
          logAIDebug("[AIClient] CN provider succeeded", {
            provider: "qwen",
            model,
            elapsedMs: Date.now() - startedAt,
          });
          return { content, model };
        } catch (error) {
          errors.push(`${model}: ${getErrorMessage(error)}`);
          logAIDebug("[AIClient] CN provider failed", {
            provider: "qwen",
            model,
            error: getErrorMessage(error),
            elapsedMs: Date.now() - startedAt,
          });
        }
      }
    }

    if (isZhipuConfigured()) {
      logAIDebug("[AIClient] Trying CN provider", {
        provider: "zhipu",
        model: CN_ZHIPU_MODEL,
        timeoutMs: estimateRemainingTimeout(startedAt, config),
      });
      try {
        const content = await callZhipuAPI(request, {
          timeoutMs: resolveProviderTimeout(startedAt, config),
          maxRetries: config.maxRetries,
        });
        logAIDebug("[AIClient] CN provider succeeded", {
          provider: "zhipu",
          model: CN_ZHIPU_MODEL,
          elapsedMs: Date.now() - startedAt,
        });
        return { content, model: CN_ZHIPU_MODEL };
      } catch (error) {
        errors.push(`${CN_ZHIPU_MODEL}: ${getErrorMessage(error)}`);
        logAIDebug("[AIClient] CN provider failed", {
          provider: "zhipu",
          model: CN_ZHIPU_MODEL,
          error: getErrorMessage(error),
          elapsedMs: Date.now() - startedAt,
        });
      }
    }

    throw new Error(`All CN AI models failed:\n${errors.join("\n")}`);
  }

  const configuredIntlProviders = getConfiguredIntlProviders(config.intlProviderOrder);
  if (configuredIntlProviders.length === 0) {
    throw new Error("No INTL AI providers configured");
  }

  if (config.intlParallelRace && configuredIntlProviders.length > 1) {
    const RACE_SKIPPED_ERROR = "__intl_race_skipped__";
    let hasWinner = false;
    const raceTasks = configuredIntlProviders.map((provider, index) =>
      (async () => {
        if (index > 0 && config.intlSecondaryDelayMs > 0) {
          await delay(config.intlSecondaryDelayMs);
          if (hasWinner) {
            throw new Error(RACE_SKIPPED_ERROR);
          }
        }
        logAIDebug("[AIClient] Trying INTL provider", {
          provider,
          model: getIntlProviderModel(provider),
          mode: "parallel_race",
          timeoutMs: estimateRemainingTimeout(startedAt, config),
        });
        const response = await callIntlProvider(provider, request, startedAt, config);
        logAIDebug("[AIClient] INTL provider succeeded", {
          provider,
          model: response.model,
          mode: "parallel_race",
          elapsedMs: Date.now() - startedAt,
        });
        hasWinner = true;
        return response;
      })().catch((error) => {
        if (error instanceof Error && error.message === RACE_SKIPPED_ERROR) {
          throw error;
        }
        errors.push(`${getIntlProviderModel(provider)}: ${getErrorMessage(error)}`);
        logAIDebug("[AIClient] INTL provider failed", {
          provider,
          model: getIntlProviderModel(provider),
          mode: "parallel_race",
          error: getErrorMessage(error),
          elapsedMs: Date.now() - startedAt,
        });
        throw error;
      })
    );

    try {
      const winner = await Promise.any(raceTasks);
      hasWinner = true;
      return winner;
    } catch {
      throw new Error(`All INTL AI models failed:\n${errors.join("\n")}`);
    }
  }

  for (const provider of configuredIntlProviders) {
    logAIDebug("[AIClient] Trying INTL provider", {
      provider,
      model: getIntlProviderModel(provider),
      mode: "serial",
      timeoutMs: estimateRemainingTimeout(startedAt, config),
    });
    try {
      const response = await callIntlProvider(provider, request, startedAt, config);
      logAIDebug("[AIClient] INTL provider succeeded", {
        provider,
        model: response.model,
        mode: "serial",
        elapsedMs: Date.now() - startedAt,
      });
      return response;
    } catch (error) {
      errors.push(`${getIntlProviderModel(provider)}: ${getErrorMessage(error)}`);
      logAIDebug("[AIClient] INTL provider failed", {
        provider,
        model: getIntlProviderModel(provider),
        mode: "serial",
        error: getErrorMessage(error),
        elapsedMs: Date.now() - startedAt,
      });
    }
  }

  throw new Error(`All INTL AI models failed:\n${errors.join("\n")}`);
}

export async function callAI(request: AIRequest): Promise<AIResponse> {
  const config = getExecutionConfig();
  const startedAt = Date.now();

  logAIDebug("[AIClient] callAI start", {
    ...summarizeConfig(config),
    ...summarizeRequest(request, true),
  });

  try {
    const response = await runWithTimeout(
      () => callAIInternal(request, config),
      config.totalTimeoutMs,
      "AI request"
    );

    logAIDebug("[AIClient] callAI success", {
      model: response.model,
      elapsedMs: Date.now() - startedAt,
      ...summarizeRequest(request, true),
    });

    return response;
  } catch (error) {
    console.error("[AIClient] callAI failed", {
      elapsedMs: Date.now() - startedAt,
      error: getErrorMessage(error),
      ...summarizeConfig(config),
      ...summarizeRequest(request),
    });
    throw error;
  }
}

export function getAvailableModels(): string[] {
  const models: string[] = [];
  const config = getExecutionConfig();

  if (isChinaDeployment()) {
    if (isQwenConfigured()) {
      models.push(...config.cnQwenOrder);
    }
    if (isZhipuConfigured()) {
      models.push(CN_ZHIPU_MODEL);
    }
    return models;
  }

  for (const provider of config.intlProviderOrder) {
    if (provider === "openai" && isOpenAIConfigured()) {
      models.push(INTL_MODELS.openai);
    }
    if (provider === "mistral" && isMistralConfigured()) {
      models.push(INTL_MODELS.mistral);
    }
  }

  return models;
}
