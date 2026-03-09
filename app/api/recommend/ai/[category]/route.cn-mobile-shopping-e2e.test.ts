import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
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

vi.mock("@/lib/recommendation/fallback-generator", () => ({
  generateFallbackCandidates: vi.fn(() => [
    {
      title: "Switch 2 Pro 手柄",
      description: "适合掌机和客厅双场景使用的手柄",
      reason: "适合追求手感和续航的玩家",
      tags: ["游戏外设", "手柄", "便携"],
      searchQuery: "Switch 2 Pro 手柄",
      platform: "淘宝",
    },
    {
      title: "便携咖啡机",
      description: "适合出差和露营场景的便携咖啡机",
      reason: "适合需要随时做咖啡的人",
      tags: ["咖啡", "便携", "露营"],
      searchQuery: "便携咖啡机",
      platform: "唯品会",
    },
  ]),
}));

const routePath = "./route";
const TEST_TIMEOUT = 15000;

describe("recommend shopping CN mobile outbound e2e", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns JD and Pinduoduo candidateLinks with keyword-carrying Android intents", async () => {
    const { POST } = (await import(routePath)) as {
      POST: (
        request: NextRequest,
        context: { params: { category: string } }
      ) => Promise<Response>;
    };

    const request = new NextRequest(
      "http://localhost/api/recommend/ai/shopping?client=app",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
        },
        body: JSON.stringify({
          userId: "anonymous",
          count: 2,
          locale: "zh",
          skipCache: true,
        }),
      }
    );

    const response = await POST(request, { params: { category: "shopping" } });
    const body = (await response.json()) as {
      success: boolean;
      source?: string;
      recommendations?: Array<{
        title?: string;
        metadata?: { searchQuery?: string };
        candidateLink?: CandidateLink;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.source).toBe("fallback");
    expect(body.recommendations?.length).toBeGreaterThanOrEqual(2);

    const first = body.recommendations?.[0];
    const second = body.recommendations?.[1];

    expect(first?.candidateLink?.provider).toBe("京东");
    expect(second?.candidateLink?.provider).toBe("拼多多");

    expect(first?.candidateLink?.primary.type).toBe("intent");
    expect(second?.candidateLink?.primary.type).toBe("intent");

    const firstKeyword = encodeURIComponent(String(first?.metadata?.searchQuery || first?.title || ""));
    const secondKeyword = encodeURIComponent(String(second?.metadata?.searchQuery || second?.title || ""));

    expect(first?.candidateLink?.primary.url).toContain(firstKeyword);
    expect(second?.candidateLink?.primary.url).toContain(secondKeyword);
    expect(first?.candidateLink?.primary.url).toContain("package=com.jingdong.app.mall");
    expect(second?.candidateLink?.primary.url).toContain("package=com.xunmeng.pinduoduo");
  }, TEST_TIMEOUT);
});
