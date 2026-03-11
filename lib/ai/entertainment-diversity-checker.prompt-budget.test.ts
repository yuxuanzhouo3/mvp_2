import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("entertainment supplement prompt budget", () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "CN";
    process.env.QWEN_API_KEY = "test-qwen-key";
    delete process.env.OPENAI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.ZHIPU_API_KEY;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "Interstellar",
                    description: "Sci-fi movie",
                    reason: "Fits your taste",
                    tags: ["sci-fi", "movie"],
                    searchQuery: "Interstellar",
                    platform: "Tencent Video",
                    entertainmentType: "video",
                  }),
                },
              },
            ],
          }),
        }) satisfies Partial<Response> as Response
      )
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

  it("compacts oversized history before entertainment supplement AI call", async () => {
    const { supplementEntertainmentTypes } = await import("./entertainment-diversity-checker");

    const hugeHtmlTail = "RAW_HTML_TAIL_MARKER";
    const hugeDebugTail = "DEBUG_PAYLOAD_TAIL_MARKER";
    const userHistory = Array.from({ length: 12 }, (_, index) => ({
      category: "entertainment",
      title: `history item ${index} ${"popular-content-".repeat(8)}`,
      clicked: index % 2 === 0,
      saved: index % 3 === 0,
      metadata: {
        tags: ["sci-fi", "mystery", "action", "high-score", "long-tag"],
        searchQuery: `query ${index} ${"extra-keywords-".repeat(12)}`,
        platform: "Tencent Video",
        entertainmentType: "video",
        rawHtml: `${"<div>detail</div>".repeat(400)}${hugeHtmlTail}`,
        debugPayload: `${"debug-payload-".repeat(400)}${hugeDebugTail}`,
      },
    }));

    await supplementEntertainmentTypes([], ["video"], userHistory, "zh");

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));
    const prompt = String(requestBody?.messages?.[1]?.content || "");
    const promptBytes = new TextEncoder().encode(prompt).length;

    expect(promptBytes).toBeLessThan(6 * 1024);
    expect(prompt).toContain("entertainmentType");
    expect(prompt).not.toContain(hugeHtmlTail);
    expect(prompt).not.toContain(hugeDebugTail);
  });
});
