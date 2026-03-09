import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  filterStoreLinksByOs,
  getAutoTryLinks,
  getStoreLinks,
} from "@/lib/outbound/deep-link-helpers";
import type { CandidateLink } from "@/lib/types/recommendation";

vi.mock("@/lib/ai/zhipu-recommendation", () => ({
  isAIProviderConfigured: vi.fn(() => false),
  generateRecommendations: vi.fn(),
}));

vi.mock("@/lib/config/deployment.config", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config/deployment.config")>(
    "@/lib/config/deployment.config"
  );
  return {
    ...actual,
    currentRegion: "CN" as const,
    deploymentConfig: {
      ...actual.deploymentConfig,
      region: "CN" as const,
    },
    isChinaDeployment: vi.fn(() => true),
    isInternationalDeployment: vi.fn(() => false),
  };
});

vi.mock("@/lib/ai/travel-enhancer", () => ({
  enhanceTravelRecommendation: vi.fn((rec: any) => rec),
}));

vi.mock("@/lib/recommendation/fallback-generator", () => ({
  generateFallbackCandidates: vi.fn(() => [
    {
      title: "\u4e2d\u56fd\u00b7\u82cf\u5dde\u00b7\u5e73\u6c5f\u8def",
      description: "\u7ecf\u5178\u53e4\u57ce\u8857\u533a\uff0c\u9002\u5408\u6563\u6b65\u4e0e\u8f7b\u65c5\u884c",
      reason: "\u9002\u5408\u5468\u672b\u8f7b\u65c5\u884c",
      tags: ["\u65c5\u884c", "\u82cf\u5dde", "\u5e73\u6c5f\u8def"],
      searchQuery: "\u6c5f\u82cf \u82cf\u5dde \u5e73\u6c5f\u8def \u6e38\u73a9 \u653b\u7565",
      platform: "\u643a\u7a0b",
    },
  ]),
}));

vi.mock("@/lib/recommendation/cn-mobile-normalizer", () => ({
  normalizeCnMobileCategoryPlatform: vi.fn((params: {
    category: string;
    platform: string;
    client?: string;
    locale?: string;
  }) => {
    if (
      params.category === "travel" &&
      params.client === "app" &&
      params.locale === "zh"
    ) {
      return "\u643a\u7a0b";
    }
    return params.platform;
  }),
  normalizeCnMobileFitnessRecommendation: vi.fn((params: any) => ({
    title: params.title,
    description: params.description,
    reason: params.reason,
    searchQuery: params.searchQuery,
    tags: params.tags,
    platform: params.platform,
  })),
  stripCnFoodGenericTerms: vi.fn((value: string) => value),
}));

const routePath = "./route";
const TEST_TIMEOUT = 15000;

describe("recommend travel CN mobile outbound e2e", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns Ctrip candidateLink with structured keyword and app-intent-web fallback chain", async () => {
    const { POST } = (await import(routePath)) as {
      POST: (
        request: NextRequest,
        context: { params: { category: string } }
      ) => Promise<Response>;
    };

    const request = new NextRequest(
      "http://localhost/api/recommend/ai/travel?client=app",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
        },
        body: JSON.stringify({
          userId: "anonymous",
          count: 1,
          locale: "zh",
          skipCache: true,
        }),
      }
    );

    const response = await POST(request, { params: { category: "travel" } });
    const body = (await response.json()) as {
      success: boolean;
      source?: string;
      recommendations?: Array<{ title?: string; candidateLink?: CandidateLink }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.source).toBe("fallback");
    expect(body.recommendations?.length).toBeGreaterThan(0);

    const first = body.recommendations?.[0];
    expect(first?.title).toBe("\u4e2d\u56fd\u00b7\u82cf\u5dde\u00b7\u5e73\u6c5f\u8def");

    const candidate = first?.candidateLink;
    expect(candidate).toBeTruthy();
    expect(candidate?.provider).toBe("\u643a\u7a0b");
    expect(candidate?.metadata?.region).toBe("CN");
    expect(candidate?.metadata?.category).toBe("travel");

    const expectedKeyword = "\u6c5f\u82cf\u00b7\u82cf\u5dde\u00b7\u5e73\u6c5f\u8def";
    const encodedKeyword = encodeURIComponent(expectedKeyword);

    expect(candidate?.primary.type).toBe("app");
    expect(candidate?.primary.url).toContain("ctrip://wireless/search?keyword=");
    expect(candidate?.primary.url).toContain(`keyword=${encodedKeyword}`);

    const webLink = candidate?.fallbacks.find(
      (link) =>
        link.type === "web" && link.url.includes("you.ctrip.com/globalsearch")
    );
    expect(webLink?.url).toContain(`keyword=${encodedKeyword}`);

    const autoTryLinks = getAutoTryLinks(candidate!, "android");
    expect(autoTryLinks.length).toBeGreaterThan(0);
    expect(autoTryLinks[0]?.type).toBe("app");
    expect(autoTryLinks[0]?.url).toContain("ctrip://wireless/search?keyword=");
    expect(autoTryLinks[0]?.url).toContain(`keyword=${encodedKeyword}`);

    const androidIntent = candidate?.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=ctrip.android.view")
    );
    expect(androidIntent?.url).toContain("intent://wireless/search?keyword=");
    expect(androidIntent?.url).toContain(`keyword=${encodedKeyword}`);

    const androidStoreLinks = filterStoreLinksByOs(
      getStoreLinks(candidate!),
      "android"
    );
    expect(androidStoreLinks[0]?.url).toBe(
      "market://details?id=ctrip.android.view"
    );
    expect(
      androidStoreLinks.some((link) =>
        link.url.startsWith("tmast://appdetails?pname=ctrip.android.view")
      )
    ).toBe(true);
    expect(
      candidate?.fallbacks.some((link) => link.type === "web")
    ).toBe(true);
  }, TEST_TIMEOUT);
});
