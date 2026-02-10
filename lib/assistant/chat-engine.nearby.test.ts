import { describe, expect, it, vi } from "vitest";

vi.mock("./nearby-store-search", () => ({
  searchNearbyStores: vi.fn(),
}));

vi.mock("./preference-manager", () => ({
  getUserPreferences: vi.fn(async () => []),
  savePreference: vi.fn(),
}));

vi.mock("./reverse-geocode", () => ({
  buildLocationContext: vi.fn(async () => "location hint"),
}));

vi.mock("@/lib/outbound/link-resolver", () => ({
  resolveCandidateLink: vi.fn(() => ({
    metadata: { providerDisplayName: "高德地图" },
  })),
}));

vi.mock("@/lib/outbound/outbound-url", () => ({
  buildOutboundHref: vi.fn(() => "/outbound?mock=1"),
}));

vi.mock("@/lib/ai/client", () => ({
  callAI: vi.fn(async () => ({ content: '{"summary":"mock","selectedIds":["store_1"]}', model: "mock" })),
}));

import { processChat } from "./chat-engine";
import { searchNearbyStores } from "./nearby-store-search";

describe("processChat nearby clarify", () => {
  it("asks for location when message contains 中文 nearby keyword", async () => {
    const response = await processChat(
      {
        message: "帮我找附近好吃的",
        locale: "zh",
        region: "INTL",
      },
      "test-user"
    );

    expect(response.type).toBe("clarify");
    expect(response.intent).toBe("search_nearby");
    expect(response.clarifyQuestions?.length).toBeGreaterThan(0);
  });

  it("asks for location when message contains English nearby keyword", async () => {
    const response = await processChat(
      {
        message: "find gyms nearby",
        locale: "en",
        region: "INTL",
      },
      "test-user"
    );

    expect(response.type).toBe("clarify");
    expect(response.intent).toBe("search_nearby");
    expect(response.clarifyQuestions?.[0]).toContain("location");
  });

  it("returns DB-backed nearby results when location is provided", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      radiusKm: 5,
      matchedCount: 2,
      category: "food",
      candidates: [
        {
          id: "store_1",
          name: "浦东小馆",
          description: "本帮菜，口碑好",
          category: "food",
          distance: "800m",
          rating: 4.7,
          address: "浦东新区世纪大道 1 号",
          platform: "高德地图",
          searchQuery: "浦东小馆",
        },
      ],
    });

    const response = await processChat(
      {
        message: "帮我找附近好吃的",
        locale: "zh",
        region: "CN",
        location: { lat: 31.23, lng: 121.47 },
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.intent).toBe("search_nearby");
    expect(response.candidates?.[0]?.id).toBe("store_1");
    expect(response.plan?.length).toBeGreaterThan(0);
  });
});
