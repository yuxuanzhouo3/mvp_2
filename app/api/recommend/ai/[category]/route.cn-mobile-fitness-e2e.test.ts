import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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
      title: "附近健身房推荐（先看评论）",
      description: "优先看通风和器械配置",
      reason: "根据附近场所需求生成的场馆推荐",
      tags: ["附近", "健身房", "通风"],
      searchQuery: "附近 健身房 通风",
      platform: "大众点评",
      fitnessType: "nearby_place",
    },
    {
      title: "45分钟全身力量跟练教程",
      description: "适合新手的全身力量跟练",
      reason: "根据教程需求生成的可直接跟练内容",
      tags: ["力量训练", "跟练", "教程"],
      searchQuery: "全身力量 跟练 教程",
      platform: "B站健身",
      fitnessType: "tutorial",
    },
    {
      title: "哑铃使用教程：动作要点与常见错误",
      description: "哑铃训练动作要点与发力细节",
      reason: "根据器材需求生成的使用教程推荐",
      tags: ["哑铃", "使用教程", "动作要点"],
      searchQuery: "哑铃 使用教程 动作要点",
      platform: "B站健身",
      fitnessType: "equipment",
    },
  ]),
}));

const routePath = "./route";

describe("recommend fitness CN mobile outbound e2e", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("aligns CN Android fitness content with Bilibili, local apps, and JD", async () => {
    const { POST } = (await import(routePath)) as {
      POST: (
        request: NextRequest,
        context: { params: { category: string } }
      ) => Promise<Response>;
    };

    const request = new NextRequest(
      "http://localhost/api/recommend/ai/fitness?client=app",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
        },
        body: JSON.stringify({
          userId: "anonymous",
          count: 3,
          locale: "zh",
          skipCache: true,
        }),
      }
    );

    const response = await POST(request, { params: { category: "fitness" } });
    const body = (await response.json()) as {
      success: boolean;
      source?: string;
      recommendations?: Array<{
        title?: string;
        platform?: string;
        linkType?: string;
        metadata?: { fitnessType?: string; searchQuery?: string };
        candidateLink?: { provider?: string };
        reason?: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.source).toBe("fallback");

    const nearby = body.recommendations?.find((item) => item.metadata?.fitnessType === "nearby_place");
    const tutorial = body.recommendations?.find((item) => item.metadata?.fitnessType === "tutorial");
    const equipment = body.recommendations?.find((item) => item.metadata?.fitnessType === "equipment");

    expect(nearby?.platform === "美团" || nearby?.platform === "高德地图").toBe(true);
    expect(nearby?.linkType).toBe("location");
    expect(nearby?.candidateLink?.provider === "美团" || nearby?.candidateLink?.provider === "高德地图").toBe(true);

    expect(tutorial?.platform).toBe("B站");
    expect(tutorial?.linkType).toBe("video");
    expect(tutorial?.candidateLink?.provider).toBe("B站");

    expect(equipment?.platform).toBe("京东");
    expect(equipment?.linkType).toBe("product");
    expect(equipment?.candidateLink?.provider).toBe("京东");
    expect(equipment?.title).toContain("健身器材推荐");
    expect(equipment?.metadata?.searchQuery).toContain("京东");
    expect(equipment?.reason).toContain("京东");
  });
});
