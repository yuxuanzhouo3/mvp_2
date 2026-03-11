import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/runtime-model-config", () => ({
  getCnAiRuntimeModelConfig: vi.fn(async () => ({
    assistantModel: "qwen3.5-plus",
    recommendationModel: "qwen3.5-flash",
    updatedAt: "2026-03-10T00:00:00.000Z",
    source: "storage",
  })),
}));

const ORIGINAL_ENV = { ...process.env };

describe("CN recommendation invalid model override", () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "CN";
    process.env.QWEN_API_KEY = "test-qwen-key";
    delete process.env.OPENAI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.ZHIPU_API_KEY;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  choices: [
                    {
                      delta: {
                        content: JSON.stringify([
                          {
                            title: "Interstellar",
                            description: "Sci-fi movie",
                            reason: "Fits your taste",
                            tags: ["sci-fi", "movie"],
                            searchQuery: "Interstellar",
                            platform: "Tencent Video",
                            entertainmentType: "video",
                          },
                        ]),
                      },
                    },
                  ],
                  usage: {
                    prompt_tokens: 100,
                    completion_tokens: 50,
                    total_tokens: 150,
                  },
                })}\n\n`
              )
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      process.env[key] = value;
    }
  });

  it("passes through glm override on DashScope and uses streaming mode", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const { generateRecommendations } = await import("./zhipu-recommendation");

    await generateRecommendations([], "entertainment", "zh", 1, null, {
      modelOverride: "glm-4.7",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));

    expect(requestBody.model).toBe("glm-4.7");
    expect(requestBody.stream).toBe(true);
    expect(requestBody.enable_thinking).toBe(false);
  });
});
