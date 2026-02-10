import { describe, expect, it } from "vitest";
import { resolveCandidateLink } from "./link-resolver";

describe("resolveCandidateLink CN mobile platform consistency", () => {
  const fixtures = [
    { provider: "抖音", expected: "抖音", packageId: "com.ss.android.ugc.aweme" },
    { provider: "Douyin", expected: "抖音", packageId: "com.ss.android.ugc.aweme" },
    { provider: "快手", expected: "快手", packageId: "com.smile.gifmaker" },
    { provider: "Kuaishou", expected: "快手", packageId: "com.smile.gifmaker" },
    { provider: "B站", expected: "B站", packageId: "tv.danmaku.bili" },
    { provider: "哔哩哔哩", expected: "B站", packageId: "tv.danmaku.bili" },
  ] as const;

  for (const fixture of fixtures) {
    it(`maps ${fixture.provider} to ${fixture.expected} without CN fallback`, () => {
      const link = resolveCandidateLink({
        title: "健身食谱",
        query: "低脂高蛋白晚餐",
        category: "fitness",
        locale: "zh",
        region: "CN",
        provider: fixture.provider,
        isMobile: true,
      });

      expect(link.provider).toBe(fixture.expected);
      expect(link.provider).not.toBe("百度");

      const androidIntent = link.fallbacks.find(
        (item) => item.type === "intent" && item.url.includes(`package=${fixture.packageId}`)
      );
      expect(androidIntent).toBeTruthy();
    });
  }
});

