import { describe, expect, it } from "vitest";
import { resolveCandidateLink } from "./link-resolver";

describe("resolveCandidateLink CN Douyin mapping", () => {
  it("maps Douyin alias to CN 抖音 provider", () => {
    const link = resolveCandidateLink({
      title: "健身食谱",
      query: "低脂高蛋白晚餐",
      category: "fitness",
      locale: "zh",
      region: "CN",
      provider: "Douyin",
      isMobile: true,
    });

    expect(link.provider).toBe("抖音");
    expect(link.primary.url).toContain("douyin.com/search");
    const androidIntent = link.fallbacks.find(
      (item) => item.type === "intent" && item.url.includes("package=com.ss.android.ugc.aweme")
    );
    expect(androidIntent).toBeTruthy();
  });

  it("keeps explicit 抖音 provider instead of falling back to 百度", () => {
    const link = resolveCandidateLink({
      title: "健身食谱",
      query: "减脂早餐",
      category: "fitness",
      locale: "zh",
      region: "CN",
      provider: "抖音",
      isMobile: true,
    });

    expect(link.provider).toBe("抖音");
  });
});

