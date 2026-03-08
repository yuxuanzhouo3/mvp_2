import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  filterStoreLinksByOs,
  getAutoTryLinks,
  getStoreLinks,
} from "@/lib/outbound/deep-link-helpers";
import type { CandidateLink } from "@/lib/types/recommendation";

function decodeBase64Utf8(value: string): string {
  return Buffer.from(value, "base64").toString("utf8");
}

function extractCtripEmbeddedUrl(linkUrl: string): string | null {
  const match = linkUrl.match(/[?&]url=([^&#]+)/i);
  if (!match?.[1]) return null;

  const base64Payload = decodeURIComponent(match[1]);
  return decodeBase64Utf8(base64Payload);
}

function extractQueryParam(linkUrl: string, key: string): string | null {
  const match = linkUrl.match(new RegExp(`[?&]${key}=([^&#]+)`, "i"));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

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
      title: "中国·苏州·平江路",
      description: "经典古城街区，适合散步与轻旅行",
      reason: "适合周末轻旅行",
      tags: ["旅行", "苏州", "平江路"],
      searchQuery: "江苏 苏州 平江路 游玩 攻略",
      platform: "携程",
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
      return "携程";
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

describe("recommend travel CN mobile outbound e2e", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns Ctrip candidateLink with keyword and app-install-web fallback chain", async () => {
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
    expect(first?.title).toBe("中国·苏州·平江路");

    const candidate = first?.candidateLink;
    expect(candidate).toBeTruthy();
    expect(candidate?.provider).toBe("携程");
    expect(candidate?.metadata?.region).toBe("CN");
    expect(candidate?.metadata?.category).toBe("travel");

    const expectedKeyword = "江苏苏州平江路";
    const encodedKeyword = encodeURIComponent(expectedKeyword);

    expect(candidate?.primary.type).toBe("app");
    expect(candidate?.primary.url).toContain("ctrip://wireless/h5?url=");
    const primaryEmbeddedUrl = extractCtripEmbeddedUrl(candidate?.primary.url || "");
    expect(primaryEmbeddedUrl).toContain(`keyword=${encodedKeyword}`);

    const webLink = candidate?.fallbacks.find(
      (link) =>
        link.type === "web" && link.url.includes("you.ctrip.com/globalsearch")
    );
    expect(webLink?.url).toContain(`keyword=${encodedKeyword}`);

    const autoTryLinks = getAutoTryLinks(candidate!, "android");
    expect(autoTryLinks.length).toBeGreaterThan(0);
    expect(autoTryLinks[0]?.type).toBe("app");
    expect(autoTryLinks[0]?.url).toContain("ctrip://wireless/h5?url=");
    const autoTryEmbeddedUrl = extractCtripEmbeddedUrl(autoTryLinks[0]?.url || "");
    expect(autoTryEmbeddedUrl).toContain(`keyword=${encodedKeyword}`);

    const androidIntent = candidate?.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=ctrip.android.view")
    );
    expect(androidIntent?.url).toContain("intent://wireless/h5?url=");
    const intentEmbeddedUrl = extractCtripEmbeddedUrl(androidIntent?.url || "");
    expect(intentEmbeddedUrl).toContain(`keyword=${encodedKeyword}`);

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
  });
});
