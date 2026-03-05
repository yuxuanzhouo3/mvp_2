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
      title: "中国 杭州 西湖",
      description: "经典城市地标与步行路线",
      reason: "适合周末轻旅行",
      tags: ["旅行", "杭州", "西湖"],
      searchQuery: "",
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
    expect(first?.title).toBe("中国 杭州 西湖");

    const candidate = first?.candidateLink;
    expect(candidate).toBeTruthy();
    expect(candidate?.provider).toBe("携程");
    expect(candidate?.metadata?.region).toBe("CN");
    expect(candidate?.metadata?.category).toBe("travel");

    const encodedTitle = encodeURIComponent("中国 杭州 西湖");

    expect(candidate?.primary.url).toContain("ctrip://wireless/h5?url=");
    const primaryEmbeddedUrl = extractCtripEmbeddedUrl(candidate?.primary.url || "");
    expect(primaryEmbeddedUrl).toContain(`keyword=${encodedTitle}`);

    const webLink = candidate?.fallbacks.find(
      (link) =>
        link.type === "web" && link.url.includes("you.ctrip.com/globalsearch")
    );
    expect(webLink?.url).toContain(`keyword=${encodedTitle}`);

    const autoTryLinks = getAutoTryLinks(candidate!, "android");
    expect(autoTryLinks.length).toBeGreaterThan(0);
    expect(autoTryLinks[0]?.type).toBe("intent");
    expect(autoTryLinks[0]?.url).toContain("package=ctrip.android.view");
    const androidEmbeddedUrl = extractCtripEmbeddedUrl(autoTryLinks[0]?.url || "");
    expect(androidEmbeddedUrl).toContain(`keyword=${encodedTitle}`);

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
