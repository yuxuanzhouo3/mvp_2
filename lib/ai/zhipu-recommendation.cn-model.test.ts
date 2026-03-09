import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("CN recommendation model selection", () => {
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
                    title: "流浪地球2",
                    description: "科幻灾难大片",
                    reason: "适合放松解压",
                    tags: ["科幻", "电影", "国产"],
                    searchQuery: "流浪地球2",
                    platform: "腾讯视频",
                    entertainmentType: "video",
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

  it("uses qwen3.5-plus for CN entertainment recommendations", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const { generateRecommendations } = await import("./zhipu-recommendation");

    const recommendations = await generateRecommendations([], "entertainment", "zh", 1, null, {
      client: "app",
      isMobile: true,
      isAndroid: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));

    expect(requestBody.model).toBe("qwen3.5-plus");
    expect(requestBody.enable_thinking).toBe(false);
    expect(recommendations[0]?.title).toBe("流浪地球2");
  });

  it("returns fallback recommendations when qwen3.5-plus fails", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockReset();

    fetchMock.mockRejectedValueOnce(new Error("API request failed"));

    const { generateRecommendations } = await import("./zhipu-recommendation");

    const recommendations = await generateRecommendations([], "entertainment", "zh", 1, null, {
      client: "app",
      isMobile: true,
      isAndroid: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, firstInit] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const firstRequestBody = JSON.parse(String(firstInit?.body || "{}"));
    expect(firstRequestBody.model).toBe("qwen3.5-plus");
    expect(firstRequestBody.enable_thinking).toBe(false);

    // Should return fallback recommendations
    expect(recommendations.length).toBeGreaterThan(0);
  });
});
