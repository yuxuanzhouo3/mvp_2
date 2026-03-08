import { describe, expect, it } from "vitest";
import type { AIRecommendation } from "@/lib/types/recommendation";
import { normalizeLegacyEntertainmentRecommendation } from "./legacy-entertainment-normalizer";

function buildRecommendation(overrides: Partial<AIRecommendation>): AIRecommendation {
  return {
    title: "sample",
    description: "sample",
    category: "entertainment",
    link: "https://example.com",
    linkType: "search",
    metadata: {},
    reason: "sample",
    ...overrides,
  };
}

describe("normalizeLegacyEntertainmentRecommendation", () => {
  it("repairs legacy zh entertainment fallback records", () => {
    const normalized = normalizeLegacyEntertainmentRecommendation(
      buildRecommendation({
        title: "鐜勫够闀跨瘒 legacy sample",
        description: "legacy zh description",
        reason: "legacy zh reason",
        platform: "legacy-platform",
        tags: ["legacy-tag"],
        metadata: {
          searchQuery: "legacy-query",
          originalPlatform: "legacy-platform",
        },
        candidateLink: {
          provider: "legacy-platform",
          title: "鐜勫够闀跨瘒 legacy sample",
          primary: { type: "web", url: "https://example.com" },
          fallbacks: [],
        },
      })
    );

    expect(normalized.title).toBe("玄幻长篇：诡秘之主");
    expect(normalized.description).toBe("克苏鲁风格的神秘奇幻长篇，世界观宏大");
    expect(normalized.reason).toBe("剧情张力强，适合沉浸式阅读");
    expect(normalized.platform).toBe("笔趣阁");
    expect(normalized.tags).toEqual(['小说', '奇幻', '长篇', '克苏鲁']);
    expect(normalized.metadata.searchQuery).toBe("诡秘之主");
    expect(normalized.metadata.originalPlatform).toBe("笔趣阁");
    expect(normalized.candidateLink?.provider).toBe("笔趣阁");
    expect(normalized.candidateLink?.title).toBe("玄幻长篇：诡秘之主");
    expect(normalized.candidateLink?.metadata).toMatchObject({ platform: "笔趣阁" });
  });

  it("repairs legacy en entertainment fallback records", () => {
    const normalized = normalizeLegacyEntertainmentRecommendation(
      buildRecommendation({
        title: "Underrated Sci鈥慒i Movies legacy sample",
        description: "legacy en description",
        reason: "Hidden gems with cult followings worth discovering",
        platform: "IMDb",
        tags: ["movies"],
        metadata: {
          searchQuery: "underrated sci fi movies mind bending list",
        },
      })
    );

    expect(normalized.title).toBe("Underrated Sci‑Fi Movies (Mind‑Bending Picks)");
    expect(normalized.description).toBe(
      "A curated list of lesser-known sci‑fi films with strong concepts and reviews"
    );
    expect(normalized.tags).toEqual(["movies", "sci-fi", "underrated", "concept"]);
  });

  it("leaves normal entertainment records unchanged", () => {
    const recommendation = buildRecommendation({
      title: "繁花",
      description: "王家卫首部电视剧，重现上海滩往事，画面精致如电影。",
      reason: "王家卫审美在线，台词耐品，值得收藏细看的高质剧集。",
      platform: "腾讯视频",
    });

    expect(normalizeLegacyEntertainmentRecommendation(recommendation)).toEqual(recommendation);
  });
});
