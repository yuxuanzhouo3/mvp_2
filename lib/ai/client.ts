/**
 * AI 客户端 - 多模型支持
 * 优先级: 通义千问 (qwen-max → qwen-plus → qwen-turbo) → 智谱 (glm-4.5-flash)
 */

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

// 模型配置
const QWEN_MODELS = ["qwen-max", "qwen-plus", "qwen-turbo"] as const;
const ZHIPU_MODEL = "glm-4.5-flash";

// API 端点
const QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

/**
 * 检查通义千问 API 是否配置
 */
export function isQwenConfigured(): boolean {
  const apiKey = process.env.QWEN_API_KEY;
  return !!(apiKey && !apiKey.includes("your_"));
}

/**
 * 检查智谱 API 是否配置
 */
export function isZhipuConfigured(): boolean {
  const apiKey = process.env.ZHIPU_API_KEY;
  return !!(apiKey && !apiKey.includes("your_"));
}

/**
 * 调用通义千问 API
 */
async function callQwenAPI(
  request: AIRequest,
  model: (typeof QWEN_MODELS)[number],
  retryCount: number = 0
): Promise<string> {
  const apiKey = process.env.QWEN_API_KEY;
  const MAX_RETRIES = 2;

  if (!apiKey) {
    throw new Error("QWEN_API_KEY is not configured");
  }

  try {
    console.log(`Calling Qwen API with model: ${model}...`);

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
      const statusCode = response.status;

      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorText;
      } catch {
        // 使用原始错误文本
      }

      console.error(`Qwen API Error (${model}, Status ${statusCode}):`, errorMessage);

      // 429 限流或 5xx 服务器错误，可以重试
      if ((statusCode === 429 || statusCode >= 500) && retryCount < MAX_RETRIES) {
        console.warn(`${model} error (${statusCode}), retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callQwenAPI(request, model, retryCount + 1);
      }

      throw new Error(`Qwen API (${model}) error: ${statusCode} - ${errorMessage}`);
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message?.content;
      if (content) {
        console.log(`✅ Successfully called Qwen API (${model})`);
        return content;
      }
    }

    throw new Error(`Qwen API (${model}) returned no valid content`);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected error calling Qwen API (${model}): ${error}`);
  }
}

/**
 * 调用智谱 API
 */
async function callZhipuAPI(request: AIRequest, retryCount: number = 0): Promise<string> {
  const apiKey = process.env.ZHIPU_API_KEY;
  const MAX_RETRIES = 2;

  if (!apiKey) {
    throw new Error("ZHIPU_API_KEY is not configured");
  }

  if (apiKey.includes("your_")) {
    throw new Error("ZHIPU_API_KEY is not properly configured (contains placeholder)");
  }

  try {
    console.log("Calling Zhipu API...");

    const response = await fetch(ZHIPU_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;

      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.msg || errorText;
      } catch {
        // 使用原始错误文本
      }

      console.error(`Zhipu API Error (Status ${statusCode}):`, errorMessage);

      if (statusCode === 403) {
        throw new Error(`Zhipu API access denied (403): ${errorMessage}`);
      }

      if ((statusCode === 429 || statusCode >= 500) && retryCount < MAX_RETRIES) {
        console.warn(`Zhipu error (${statusCode}), retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callZhipuAPI(request, retryCount + 1);
      }

      throw new Error(`Zhipu API error: ${statusCode} - ${errorMessage}`);
    }

    interface ZhipuResponse {
      choices?: Array<{
        message: {
          content: string;
        };
      }>;
      code?: number;
      msg?: string;
      data?: {
        choices: Array<{
          message: {
            content: string;
          };
        }>;
      };
    }

    const data: ZhipuResponse = await response.json();

    if (data.code !== undefined && data.code !== 0) {
      throw new Error(`Zhipu API returned error code ${data.code}: ${data.msg}`);
    }

    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message?.content;
      if (content) {
        console.log("✅ Successfully called Zhipu API");
        return content;
      }
    }

    if (data.data?.choices && data.data.choices.length > 0) {
      return data.data.choices[0].message.content;
    }

    throw new Error("Zhipu API returned no valid content");
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected error calling Zhipu API: ${error}`);
  }
}

/**
 * 通用 AI 调用函数 - 多模型容错策略
 * 优先级: qwen-max → qwen-plus → qwen-turbo → glm-4.5-flash
 */
export async function callAI(request: AIRequest): Promise<AIResponse> {
  const errors: string[] = [];

  // 1. 尝试通义千问模型 (按优先级)
  if (isQwenConfigured()) {
    for (const model of QWEN_MODELS) {
      try {
        const content = await callQwenAPI(request, model);
        return { content, model };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`❌ ${model} failed: ${msg}`);
        errors.push(`${model}: ${msg}`);
        // 继续尝试下一个模型
      }
    }
  } else {
    console.warn("⚠️ Qwen API not configured, skipping Qwen models");
  }

  // 2. 尝试智谱模型作为最终备用
  if (isZhipuConfigured()) {
    try {
      const content = await callZhipuAPI(request);
      return { content, model: ZHIPU_MODEL };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${ZHIPU_MODEL} failed: ${msg}`);
      errors.push(`${ZHIPU_MODEL}: ${msg}`);
    }
  } else {
    console.warn("⚠️ Zhipu API not configured");
  }

  // 所有模型都失败
  throw new Error(
    `All AI models failed:\n${errors.join("\n")}`
  );
}

/**
 * 获取可用的模型列表
 */
export function getAvailableModels(): string[] {
  const models: string[] = [];

  if (isQwenConfigured()) {
    models.push(...QWEN_MODELS);
  }

  if (isZhipuConfigured()) {
    models.push(ZHIPU_MODEL);
  }

  return models;
}
