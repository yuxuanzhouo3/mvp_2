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
const CN_ZHIPU_MODEL = "glm-4.5-flash";

const INTL_MODELS = {
  mistral: process.env.MISTRAL_MODEL || "mistral-small-latest",
  openai: process.env.OPENAI_MODEL || "gpt-4o-mini",
};

const QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

function hasValidKey(value?: string | null): value is string {
  return Boolean(value && value.trim() && !value.includes("your_"));
}

function shouldRetry(statusCode?: number): boolean {
  return statusCode === 429 || (typeof statusCode === "number" && statusCode >= 500);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  model: (typeof CN_QWEN_MODELS)[number],
  retryCount = 0
): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  const maxRetries = 2;

  if (!hasValidKey(apiKey)) {
    throw new Error("QWEN_API_KEY is not configured");
  }

  const response = await fetch(QWEN_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorText;
    } catch {
      // noop
    }

    if (shouldRetry(response.status) && retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return callQwenAPI(request, model, retryCount + 1);
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

async function callZhipuAPI(request: AIRequest, retryCount = 0): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  const maxRetries = 2;

  if (!hasValidKey(apiKey)) {
    throw new Error("ZHIPU_API_KEY is not configured");
  }

  const response = await fetch(ZHIPU_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CN_ZHIPU_MODEL,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = errorText;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.msg || errorText;
    } catch {
      // noop
    }

    if (shouldRetry(response.status) && retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return callZhipuAPI(request, retryCount + 1);
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

async function callMistralAPI(request: AIRequest, retryCount = 0): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  const maxRetries = 2;

  if (!hasValidKey(apiKey)) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }

  const response = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: INTL_MODELS.mistral,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (shouldRetry(response.status) && retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return callMistralAPI(request, retryCount + 1);
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

async function callOpenAIAPI(request: AIRequest, retryCount = 0): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const maxRetries = 2;

  if (!hasValidKey(apiKey)) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: INTL_MODELS.openai,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2000,
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("OpenAI API returned no valid content");
    }

    return content;
  } catch (error: any) {
    const statusCode = typeof error?.status === "number" ? error.status : undefined;
    if (shouldRetry(statusCode) && retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
      return callOpenAIAPI(request, retryCount + 1);
    }
    throw error;
  }
}

export async function callAI(request: AIRequest): Promise<AIResponse> {
  const errors: string[] = [];

  if (isChinaDeployment()) {
    if (isQwenConfigured()) {
      for (const model of CN_QWEN_MODELS) {
        try {
          const content = await callQwenAPI(request, model);
          return { content, model };
        } catch (error) {
          errors.push(`${model}: ${getErrorMessage(error)}`);
        }
      }
    }

    if (isZhipuConfigured()) {
      try {
        const content = await callZhipuAPI(request);
        return { content, model: CN_ZHIPU_MODEL };
      } catch (error) {
        errors.push(`${CN_ZHIPU_MODEL}: ${getErrorMessage(error)}`);
      }
    }

    throw new Error(`All CN AI models failed:\n${errors.join("\n")}`);
  }

  if (isMistralConfigured()) {
    try {
      const content = await callMistralAPI(request);
      return { content, model: INTL_MODELS.mistral };
    } catch (error) {
      errors.push(`${INTL_MODELS.mistral}: ${getErrorMessage(error)}`);
    }
  }

  if (isOpenAIConfigured()) {
    try {
      const content = await callOpenAIAPI(request);
      return { content, model: INTL_MODELS.openai };
    } catch (error) {
      errors.push(`${INTL_MODELS.openai}: ${getErrorMessage(error)}`);
    }
  }

  throw new Error(`All INTL AI models failed:\n${errors.join("\n")}`);
}

export function getAvailableModels(): string[] {
  const models: string[] = [];

  if (isChinaDeployment()) {
    if (isQwenConfigured()) {
      models.push(...CN_QWEN_MODELS);
    }
    if (isZhipuConfigured()) {
      models.push(CN_ZHIPU_MODEL);
    }
    return models;
  }

  if (isMistralConfigured()) {
    models.push(INTL_MODELS.mistral);
  }
  if (isOpenAIConfigured()) {
    models.push(INTL_MODELS.openai);
  }

  return models;
}

