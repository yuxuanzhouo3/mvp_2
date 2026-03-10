import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/runtime-model-config", () => ({
  getCnAiRuntimeModelConfig: vi.fn(async () => ({
    assistantModel: "qwen3.5-flash",
    recommendationModel: "qwen3.5-plus",
    updatedAt: "2026-03-09T00:00:00.000Z",
    source: "storage",
  })),
}));

const ORIGINAL_ENV = { ...process.env };

describe("callAI CN runtime model config", () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "CN";
    process.env.QWEN_API_KEY = "test-qwen-key";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "ok" } }],
        }),
      }) satisfies Partial<Response> as Response)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      process.env[key] = value;
    }
  });

  it("uses assistant runtime model from storage in CN", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const { callAI } = await import("./client");

    const response = await callAI({
      messages: [{ role: "user", content: "帮我推荐一家火锅店" }],
      maxTokens: 200,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));

    expect(requestBody.model).toBe("qwen3.5-flash");
    expect(requestBody.enable_thinking).toBeUndefined();
    expect(response).toMatchObject({
      model: "qwen3.5-flash",
      content: "ok",
    });
  });

  it("passes through a custom assistant runtime model from storage in CN", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const { getCnAiRuntimeModelConfig } = await import("@/lib/ai/runtime-model-config");
    vi.mocked(getCnAiRuntimeModelConfig).mockResolvedValueOnce({
      assistantModel: "qwen-plus-latest",
      recommendationModel: "qwen3.5-plus",
      updatedAt: "2026-03-09T00:00:00.000Z",
      source: "storage",
    });

    const { callAI } = await import("./client");

    const response = await callAI({
      messages: [{ role: "user", content: "测试自定义模型" }],
      maxTokens: 200,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));

    expect(requestBody.model).toBe("qwen-plus-latest");
    expect(response).toMatchObject({
      model: "qwen-plus-latest",
      content: "ok",
    });
  });
});
