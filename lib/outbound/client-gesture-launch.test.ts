import { describe, expect, it } from "vitest";
import { buildRecommendationGestureLaunchPlan } from "./client-gesture-launch";
import { decodeCandidateLink } from "./deep-link-helpers";
import { resolveCandidateLink } from "./link-resolver";
import type { AIRecommendation } from "@/lib/types/recommendation";

function extractQueryParam(linkUrl: string, key: string): string | null {
  const match = linkUrl.match(new RegExp(`[?&]${key}=([^&#]+)`, "i"));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function extractKugouKeyword(linkUrl: string): string | null {
  const query = linkUrl.split("?")[1] || "";
  const params = new URLSearchParams(query);
  const jsonStr = params.get("jsonStr");
  if (!jsonStr) return null;

  try {
    const payload = JSON.parse(jsonStr) as {
      keyword?: string;
      searchKeyWord?: string;
      keyWord?: string;
    };
    return payload.keyword || payload.searchKeyWord || payload.keyWord || null;
  } catch {
    return null;
  }
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

function buildEntertainmentRecommendation(
  title: string,
  platform: string,
  candidateLink?: AIRecommendation["candidateLink"]
): AIRecommendation {
  return {
    title,
    description: `${platform} 搜索推荐`,
    category: "entertainment",
    link: candidateLink?.primary.url || "https://example.com/entertainment",
    linkType: "search",
    metadata: {},
    reason: "命中娱乐搜索场景",
    platform,
    candidateLink,
  };
}

function buildShoppingRecommendation(
  title: string,
  platform: string,
  candidateLink?: AIRecommendation["candidateLink"]
): AIRecommendation {
  return {
    title,
    description: `${platform} 搜索推荐`,
    category: "shopping",
    link: candidateLink?.primary.url || "https://example.com/shopping",
    linkType: "search",
    metadata: {},
    reason: "命中购物搜索场景",
    platform,
    candidateLink,
  };
}

describe("buildRecommendationGestureLaunchPlan", () => {
  it.each([
    { provider: "去哪儿", paramKey: "searchWord", expectedScheme: "qunarphone://search?searchWord=" },
    { provider: "马蜂窝", paramKey: "keyword", expectedScheme: "intent://search?keyword=" },
  ])("keeps travel keyword for $provider Android deeplink", ({ provider, paramKey, expectedScheme }) => {
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
    const expectedType = provider === "马蜂窝" ? "intent" : "app";
    expect(plan.firstDeepLink?.type).toBe(expectedType);
    expect(plan.firstDeepLink?.url).toContain(expectedScheme);
    if (provider !== "马蜂窝") {
      expect(extractQueryParam(plan.firstDeepLink?.url || "", paramKey)).toBe(query);
    }

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

  it("uses TapTap Android app scheme as first deep link and keeps keyword", () => {
    const query = "原神";
    const candidateLink = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "TapTap",
      isMobile: true,
      os: "android",
    });

    const plan = buildRecommendationGestureLaunchPlan(
      buildEntertainmentRecommendation(query, "TapTap", candidateLink),
      "/category/entertainment",
      "android"
    );

    expect(plan.firstDeepLink).toBeTruthy();
    expect(plan.firstDeepLink?.type).toBe("app");
    expect(plan.firstDeepLink?.url).toContain("taptap://taptap.cn/search?keyword=");
    expect(extractQueryParam(plan.firstDeepLink?.url || "", "keyword")).toBe(query);
  });

  it("uses NetEase app scheme as first Android deep link and keeps keyword", () => {
    const query = "林俊杰 修炼爱情";
    const candidateLink = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "网易云音乐",
      isMobile: true,
      os: "android",
    });

    const plan = buildRecommendationGestureLaunchPlan(
      buildEntertainmentRecommendation(query, "网易云音乐", candidateLink),
      "/category/entertainment",
      "android"
    );

    expect(plan.firstDeepLink).toBeTruthy();
    expect(plan.firstDeepLink?.type).toBe("app");
    expect(plan.firstDeepLink?.url).toContain("orpheus://search?keyword=");
    expect(extractQueryParam(plan.firstDeepLink?.url || "", "keyword")).toBe(query);
  });

  it("uses Vipshop Android app scheme as first deep link and keeps keyword", () => {
    const query = "春季防晒外套";
    const candidateLink = resolveCandidateLink({
      title: query,
      query: "   ",
      category: "shopping",
      locale: "zh",
      region: "CN",
      provider: "唯品会",
      isMobile: true,
      os: "android",
    });

    const plan = buildRecommendationGestureLaunchPlan(
      buildShoppingRecommendation(query, "唯品会", candidateLink),
      "/category/shopping",
      "android"
    );

    expect(plan.firstDeepLink).toBeTruthy();
    expect(plan.firstDeepLink?.type).toBe("app");
    expect(plan.firstDeepLink?.url).toContain("vipshop://search?keyword=");
    expect(extractQueryParam(plan.firstDeepLink?.url || "", "keyword")).toBe(query);
  });

  it("uses Kugou Android app scheme as first deep link and keeps keyword", () => {
    const query = "林俊杰 修炼爱情";
    const candidateLink = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "酷狗音乐",
      isMobile: true,
      os: "android",
    });

    const plan = buildRecommendationGestureLaunchPlan(
      buildEntertainmentRecommendation(query, "酷狗音乐", candidateLink),
      "/category/entertainment",
      "android"
    );

    expect(plan.firstDeepLink).toBeTruthy();
    expect(plan.firstDeepLink?.type).toBe("app");
    expect(plan.firstDeepLink?.url).toContain("kugouurl://start.music/?cmd=116");
    expect(extractKugouKeyword(plan.firstDeepLink?.url || "")).toBe(query);
  });
});
