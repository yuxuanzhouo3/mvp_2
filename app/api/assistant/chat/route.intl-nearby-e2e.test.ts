import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/auth", () => ({
  requireAuth: vi.fn(async () => ({ user: { id: "e2e-user-1" } })),
}));

vi.mock("@/lib/assistant/usage-limiter", () => ({
  canUseAssistant: vi.fn(async () => ({
    allowed: true,
    reason: null,
    stats: {
      userId: "e2e-user-1",
      planType: "pro",
      used: 0,
      limit: 10,
      remaining: 10,
      periodType: "daily",
    },
  })),
  recordAssistantUsage: vi.fn(async () => undefined),
  getAssistantUsageStats: vi.fn(async () => ({
    userId: "e2e-user-1",
    planType: "pro",
    used: 1,
    limit: 10,
    remaining: 9,
    periodType: "daily",
  })),
}));

vi.mock("@/lib/assistant/conversation-store", () => ({
  saveConversationMessage: vi.fn(async () => undefined),
}));

vi.mock("@/lib/assistant/preference-manager", () => ({
  getUserPreferences: vi.fn(async () => []),
  savePreference: vi.fn(async () => undefined),
}));

vi.mock("@/lib/assistant/reverse-geocode", () => ({
  buildLocationContext: vi.fn(async () => "location hint"),
}));

vi.mock("@/lib/assistant/nearby-store-search", () => ({
  searchNearbyStores: vi.fn(),
}));

vi.mock("@/lib/outbound/link-resolver", () => ({
  resolveCandidateLink: vi.fn(() => ({
    metadata: { providerDisplayName: "Google Maps" },
  })),
}));

vi.mock("@/lib/outbound/outbound-url", () => ({
  buildOutboundHref: vi.fn(() => "/outbound?mock=1"),
}));

vi.mock("@/lib/ai/client", () => ({
  callAI: vi.fn(async () => ({
    model: "mock-model",
    content: JSON.stringify({
      type: "results",
      message: "Found nearby options",
      intent: "search_nearby",
      candidates: [
        {
          id: "tmp_1",
          name: "Restaurant",
          description: "good",
          category: "food",
          platform: "Google Maps",
          searchQuery: "restaurant near me",
        },
      ],
    }),
  })),
}));

import { callAI } from "@/lib/ai/client";
import { searchNearbyStores } from "@/lib/assistant/nearby-store-search";
import { recordAssistantUsage } from "@/lib/assistant/usage-limiter";

const routePath = "./route";

describe("assistant chat INTL nearby e2e scenario", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns concrete English place cards for nearby restaurant request", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "overpass",
      radiusKm: 0.5,
      matchedCount: 1,
      category: "food",
      candidates: [
        {
          id: "osm_node_101",
          name: "Joe's Pizza",
          description: "120m away, cuisine: pizza, opening hours available",
          category: "food",
          distance: "120m",
          rating: 4.6,
          address: "123 Broadway, New York",
          platform: "Google Maps",
          searchQuery: "Joe's Pizza, 123 Broadway, New York",
        },
      ],
    });

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "mock-model",
      content: JSON.stringify({
        type: "results",
        message: "Found nearby options",
        intent: "search_nearby",
        candidates: [
          {
            id: "tmp_1",
            name: "Restaurant",
            description: "good",
            category: "food",
            platform: "Google Maps",
            searchQuery: "restaurant near me",
          },
        ],
      }),
    });

    const { POST } = (await import(routePath)) as { POST: (request: NextRequest) => Promise<Response> };

    const request = new NextRequest("http://localhost/api/assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      body: JSON.stringify({
        message: "帮我找附近餐厅",
        history: [],
        location: { lat: 40.7128, lng: -74.006 },
        locale: "zh",
        region: "INTL",
        client: "web",
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      success: boolean;
      response?: {
        type?: string;
        intent?: string;
        message?: string;
        candidates?: Array<{ name?: string; platform?: string; searchQuery?: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    expect(searchNearbyStores).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchNearbyStores).mock.calls[0]?.[0]).toMatchObject({
      region: "INTL",
      locale: "en",
      limit: 8,
    });

    expect(body.response?.type).toBe("results");
    expect(body.response?.intent).toBe("search_nearby");
    expect(body.response?.message).toContain("nearby places");

    const firstCandidate = body.response?.candidates?.[0];
    expect(firstCandidate?.name).toBe("Joe's Pizza");
    expect(firstCandidate?.platform).toBe("Google Maps");
    expect(firstCandidate?.searchQuery).toContain("Joe's Pizza");

    const hasChineseInMessage = /[\u3400-\u9fff]/.test(body.response?.message || "");
    expect(hasChineseInMessage).toBe(false);

    const genericNames = new Set(["restaurant", "restaurants", "store", "shop", "food"]);
    for (const candidate of body.response?.candidates || []) {
      const normalized = (candidate.name || "").trim().toLowerCase();
      expect(genericNames.has(normalized)).toBe(false);
    }

    expect(recordAssistantUsage).toHaveBeenCalledTimes(1);
  });
});
