import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/runtime-model-config", () => ({
  getCnAiRuntimeModelConfig: vi.fn(async () => ({
    assistantModel: "qwen3.5-plus",
    recommendationModel: "qwen3.5-flash",
    updatedAt: "2026-03-09T00:00:00.000Z",
    source: "storage",
  })),
}));

const ORIGINAL_ENV = { ...process.env };

describe("callAI CN fallback behavior", () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "CN";
    process.env.QWEN_API_KEY = "test-qwen-key";
    delete process.env.ASSISTANT_CN_QWEN_MODELS;

    vi.stubGlobal("fetch", vi.fn());
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

  it("disables thinking for qwen3.5-plus assistant requests", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
      }),
    } satisfies Partial<Response> as Response);

    const { callAI } = await import("./client");

    await callAI({
      messages: [{ role: "user", content: "我想要吃炸鸡" }],
      maxTokens: 200,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));

    expect(requestBody.model).toBe("qwen3.5-plus");
    expect(requestBody.enable_thinking).toBe(false);
  });

  it("falls back to the next CN qwen model when the primary model times out", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockRejectedValueOnce(new Error("The operation was aborted due to timeout"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "fallback ok" } }],
        }),
      } satisfies Partial<Response> as Response);

    const { callAI } = await import("./client");

    const response = await callAI({
      messages: [{ role: "user", content: "我想要吃炸鸡" }],
      maxTokens: 200,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [, firstInit] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const firstRequestBody = JSON.parse(String(firstInit?.body || "{}"));
    expect(firstRequestBody.model).toBe("qwen3.5-plus");
    expect(firstRequestBody.enable_thinking).toBe(false);

    const [, secondInit] = fetchMock.mock.calls[1] as [RequestInfo | URL, RequestInit | undefined];
    const secondRequestBody = JSON.parse(String(secondInit?.body || "{}"));
    expect(secondRequestBody.model).toBe("qwen3.5-flash");
    expect(secondRequestBody.enable_thinking).toBeUndefined();

    expect(response).toMatchObject({
      model: "qwen3.5-flash",
      content: "fallback ok",
    });
  });
});
