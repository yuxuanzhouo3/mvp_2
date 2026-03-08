import { describe, expect, it } from "vitest";
import { buildRecommendationGestureLaunchPlan } from "./client-gesture-launch";
import { decodeCandidateLink } from "./deep-link-helpers";
import { resolveCandidateLink } from "./link-resolver";
import type { AIRecommendation } from "@/lib/types/recommendation";

function extractQueryParam(linkUrl: string, key: string): string | null {
  const match = linkUrl.match(new RegExp(`[?&]${key}=([^&#]+)`, "i"));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function buildTravelRecommendation(candidateLink?: AIRecommendation["candidateLink"]): AIRecommendation {
  return {
    title: "中国·苏州·平江路",
    description: "经典古城街区，适合散步与轻旅行",
    category: "travel",
    link: "https://www.qunar.com/search?searchWord=%E8%8B%8F%E5%B7%9E%E5%B9%B3%E6%B1%9F%E8%B7%AF",
    linkType: "search",
    metadata: {},
    reason: "适合周末轻旅行",
    platform: candidateLink?.provider,
    candidateLink,
  };
}

describe("buildRecommendationGestureLaunchPlan", () => {
  it.each([
    { provider: "去哪儿", paramKey: "searchWord" },
    { provider: "马蜂窝", paramKey: "keyword" },
  ])("keeps travel keyword for $provider Android deeplink", ({ provider, paramKey }) => {
    const query = "江苏苏州平江路游玩攻略";
    const candidateLink = resolveCandidateLink({
      title: "中国·苏州·平江路",
      query,
      category: "travel",
      locale: "zh",
      region: "CN",
      provider,
      isMobile: true,
      os: "android",
    });

    const plan = buildRecommendationGestureLaunchPlan(
      buildTravelRecommendation(candidateLink),
      "/category/travel",
      "android"
    );

    expect(plan.firstDeepLink).toBeTruthy();
    expect(plan.firstDeepLink?.type).toMatch(/app|intent/);
    expect(extractQueryParam(plan.firstDeepLink?.url || "", paramKey)).toBe(query);

    const data = new URL(`https://example.com${plan.outboundHref}`).searchParams.get("data");
    const decoded = decodeCandidateLink(data || "", "zh");
    expect(decoded.candidateLink?.provider).toBe(provider);
    expect(decoded.candidateLink?.metadata?.category).toBe("travel");
  });

  it("falls back to outbound web link when candidateLink is missing", () => {
    const recommendation = buildTravelRecommendation();
    const plan = buildRecommendationGestureLaunchPlan(
      recommendation,
      "/category/travel",
      "android"
    );

    expect(plan.firstDeepLink).toBeNull();
    expect(plan.candidateLink.primary.type).toBe("web");
    expect(plan.candidateLink.primary.url).toBe(recommendation.link);

    const data = new URL(`https://example.com${plan.outboundHref}`).searchParams.get("data");
    const decoded = decodeCandidateLink(data || "", "zh");
    expect(decoded.candidateLink?.primary.type).toBe("web");
    expect(decoded.candidateLink?.primary.url).toBe(recommendation.link);
  });
});
