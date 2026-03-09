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

describe("CN recommendation runtime model config", () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "CN";
    process.env.QWEN_API_KEY = "test-qwen-key";
    delete process.env.OPENAI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.ZHIPU_API_KEY;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    title: "海底捞",
                    description: "适合聚餐的火锅店",
                    reason: "符合你最近偏好的中式聚餐场景",
                    tags: ["火锅", "聚餐"],
                    searchQuery: "海底捞",
                    platform: "大众点评",
                    entertainmentType: "local_service",
                  },
                ]),
              },
            },
          ],
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

  it("uses recommendation runtime model from storage in CN", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const { generateRecommendations } = await import("./zhipu-recommendation");

    const recommendations = await generateRecommendations([], "food", "zh", 1, null, {
      client: "app",
      isMobile: true,
      isAndroid: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));

    expect(requestBody.model).toBe("qwen3.5-flash");
    expect(requestBody.enable_thinking).toBeUndefined();
    expect(recommendations[0]?.title).toBe("海底捞");
  });
});
