import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("generateRecommendations prompt budget", () => {
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
                  content: JSON.stringify([
                    {
                      title: "Interstellar",
                      description: "Sci-fi movie",
                      reason: "Fits your taste",
                      tags: ["sci-fi", "movie", "space"],
                      searchQuery: "Interstellar",
                      platform: "Tencent Video",
                      entertainmentType: "video",
                    },
                  ]),
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

  it("compacts oversized history, profile, and signal payloads before calling Qwen", async () => {
    const { generateRecommendations } = await import("./zhipu-recommendation");

    const hugeProfileTail = "PROFILE_TAIL_MARKER";
    const hugePreferenceTail = "PREFERENCE_TAIL_MARKER";
    const hugeHtmlTail = "RAW_HTML_TAIL_MARKER";
    const hugeDebugTail = "DEBUG_PAYLOAD_TAIL_MARKER";

    const userHistory = Array.from({ length: 14 }, (_, index) => ({
      category: "entertainment",
      title: `history item ${index} ${"popular-content-".repeat(8)}`,
      clicked: index % 2 === 0,
      saved: index % 3 === 0,
      metadata: {
        tags: ["sci-fi", "mystery", "action", "high-score", "long-tag"],
        searchQuery: `query ${index} ${"extra-keywords-".repeat(12)}`,
        platform: "Tencent Video",
        entertainmentType: "video",
        rawHtml: `${"<div>detail</div>".repeat(300)}${hugeHtmlTail}`,
        debugPayload: `${"debug-payload-".repeat(300)}${hugeDebugTail}`,
      },
    }));

    const userPreference = {
      preferences: {
        favoriteGenres: ["sci-fi", "mystery", "action", "adventure", "comfort", "documentary", "anime"],
        questionnaireNotes: `${"preference-note-".repeat(300)}${hugePreferenceTail}`,
        nested: {
          morning: ["light", "short", "music"],
          weekend: ["movie", "game", "documentary", "outdoor"],
          hiddenBlob: `${"nested-hidden-".repeat(200)}NESTED_TAIL_MARKER`,
        },
      },
      ai_profile_summary: `${"likes concrete titles and dislikes vague suggestions. ".repeat(200)}${hugeProfileTail}`,
      personality_tags: ["explorer", "quality-first", "night-owl", "title-specific", "avoid-repeat"],
      tags: ["sci-fi", "story", "mystery", "movie", "anime", "music", "game"],
      onboarding_completed: true,
    };

    const signals = {
      topTags: Array.from({ length: 20 }, (_, index) => `tag-${index}-${"trend-".repeat(4)}`),
      positiveSamples: Array.from({ length: 8 }, (_, index) => ({
        title: `positive sample ${index} ${"very-long-title-".repeat(10)}`,
        tags: ["sci-fi", "story", "high-score", "fast-pace"],
        searchQuery: `positive query ${index} ${"detail-".repeat(15)}`,
      })),
      negativeSamples: Array.from({ length: 8 }, (_, index) => ({
        title: `negative sample ${index} ${"very-long-title-".repeat(10)}`,
        tags: ["variety", "boring", "draggy", "repeat"],
        searchQuery: `negative query ${index} ${"detail-".repeat(15)}`,
        feedbackType: "skip",
        rating: 1,
      })),
    };

    await generateRecommendations(userHistory, "entertainment", "zh", 10, userPreference, {
      client: "app",
      isMobile: true,
      isAndroid: true,
      avoidTitles: Array.from({ length: 60 }, (_, index) => `avoid title ${index} ${"repeat-".repeat(8)}`),
      signals,
    });

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const requestBody = JSON.parse(String(init?.body || "{}"));
    const prompt = String(requestBody?.messages?.[1]?.content || "");
    const promptBytes = new TextEncoder().encode(prompt).length;

    expect(promptBytes).toBeLessThan(12 * 1024);
    expect(prompt).toContain("title");
    expect(prompt).toContain("searchQuery");
    expect(prompt).not.toContain(hugeProfileTail);
    expect(prompt).not.toContain(hugePreferenceTail);
    expect(prompt).not.toContain(hugeHtmlTail);
    expect(prompt).not.toContain(hugeDebugTail);
  });
});
