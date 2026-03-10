import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/runtime-model-config", () => ({
  getCnAiRuntimeModelConfig: vi.fn(async () => ({
    assistantModel: "qwen3.5-plus",
    recommendationModel: "qwen-max-latest",
    updatedAt: "2026-03-09T00:00:00.000Z",
    source: "storage",
  })),
}));

const ORIGINAL_ENV = { ...process.env };

describe("CN recommendation custom runtime model", () => {
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
                    title: "Hotpot Place",
                    description: "Good for dinner",
                    reason: "Matches your recent dining preference",
                    tags: ["hotpot", "dining"],
                    searchQuery: "hotpot place",
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

  it("passes through a custom recommendation runtime model from storage in CN", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const { generateRecommendations } = await import("./zhipu-recommendation");

    await generateRecommendations([], "food", "zh", 1, null, {
      client: "app",
      isMobile: true,
      isAndroid: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));

    expect(requestBody.model).toBe("qwen-max-latest");
  });
});
