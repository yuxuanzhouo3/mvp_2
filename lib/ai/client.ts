/**
 * AI 客户端 - 使用智谱 (Zhipu) GLM-4-Flash
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

/**
 * 检查智谱 API 是否配置
 */
export function isZhipuConfigured(): boolean {
  const apiKey = process.env.ZHIPU_API_KEY;
  return !!(apiKey && !apiKey.includes("your_"));
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
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-4.5-flash",
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;

      // 解析错误响应
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.msg || errorText;
      } catch {
        // 继续使用原始错误文本
      }

      // 详细的错误日志
      console.error(`Zhipu API Error (Status ${statusCode}):`, {
        status: statusCode,
        message: errorMessage,
        timestamp: new Date().toISOString(),
        apiKeyExists: !!apiKey,
      });

      // 403 Forbidden - API Key 或权限问题
      if (statusCode === 403) {
        throw new Error(
          `Zhipu API access denied (403 Forbidden): ${errorMessage}. Please check your API key and account permissions.`
        );
      }

      // 429 Too Many Requests - 速率限制，可以重试
      if (statusCode === 429 && retryCount < MAX_RETRIES) {
        console.warn(`Rate limited, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callZhipuAPI(request, retryCount + 1);
      }

      // 500+ 服务器错误，可以重试
      if (statusCode >= 500 && retryCount < MAX_RETRIES) {
        console.warn(`Server error (${statusCode}), retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
        return callZhipuAPI(request, retryCount + 1);
      }

      throw new Error(`Zhipu API error: ${statusCode} - ${errorMessage}`);
    }

    interface ZhipuResponse {
      code: number;
      msg: string;
      data?: {
        choices: Array<{
          message: {
            content: string;
          };
        }>;
      };
    }

    const data: ZhipuResponse = await response.json();

    // 检查 API 返回的状态码
    if (data.code !== 0) {
      throw new Error(`Zhipu API returned error code ${data.code}: ${data.msg}`);
    }

    if (!data.data?.choices || data.data.choices.length === 0) {
      throw new Error("Zhipu API returned no choices");
    }

    return data.data.choices[0].message.content;
  } catch (error) {
    // 重新抛出已知的错误
    if (error instanceof Error) {
      throw error;
    }
    // 捕获未知错误
    throw new Error(`Unexpected error calling Zhipu API: ${error}`);
  }
}

/**
 * 通用 AI 调用函数
 */
export async function callAI(request: AIRequest): Promise<AIResponse> {
  if (!isZhipuConfigured()) {
    throw new Error(
      "Zhipu API not configured. Please set ZHIPU_API_KEY environment variable."
    );
  }

  try {
    console.log("Calling Zhipu API...");
    const content = await callZhipuAPI(request);
    console.log("✅ Successfully called Zhipu API");
    return { content, model: "glm-4-flash" };
  } catch (error) {
    console.error("❌ Zhipu API failed:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
