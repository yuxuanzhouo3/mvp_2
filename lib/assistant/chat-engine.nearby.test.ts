import { afterEach, describe, expect, it, vi } from "vitest";

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
    metadata: { providerDisplayName: "Google Maps" },
  })),
}));

vi.mock("@/lib/outbound/outbound-url", () => ({
  buildOutboundHref: vi.fn(() => "/outbound?mock=1"),
}));

vi.mock("@/lib/ai/client", () => ({
  callAI: vi.fn(async () => ({
    content: '{"type":"text","message":"ok"}',
    model: "mock",
  })),
}));

import { callAI } from "@/lib/ai/client";
import { processChat } from "./chat-engine";
import { searchNearbyStores } from "./nearby-store-search";

describe("processChat INTL nearby flow", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("asks for location when nearby intent is detected in English", async () => {
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

  it("asks for location when nearby intent is detected in Chinese text under INTL", async () => {
    const response = await processChat(
      {
        message: "帮我找附近好吃的",
        locale: "en",
        region: "INTL",
      },
      "test-user"
    );

    expect(response.type).toBe("clarify");
    expect(response.intent).toBe("search_nearby");
  });

  it("uses Overpass seed results and replaces generic candidate names", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "overpass",
      radiusKm: 0.5,
      matchedCount: 2,
      category: "food",
      candidates: [
        {
          id: "osm_node_1",
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
      model: "mock",
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

    const response = await processChat(
      {
        message: "find restaurants nearby within 500m",
        locale: "zh",
        region: "INTL",
        location: { lat: 40.7128, lng: -74.006 },
      },
      "test-user"
    );

    expect(searchNearbyStores).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchNearbyStores).mock.calls[0]?.[0]?.region).toBe("INTL");
    expect(vi.mocked(searchNearbyStores).mock.calls[0]?.[0]?.locale).toBe("en");

    expect(response.type).toBe("results");
    expect(response.candidates?.[0]?.name).toBe("Joe's Pizza");
    expect(response.candidates?.[0]?.platform).toBe("Google Maps");
    expect(response.candidates?.[0]?.distance).toMatch(/mile/);
    expect(response.candidates?.[0]?.searchQuery).toContain("Joe's Pizza");
  });

  it("does not ask for location again when location is already available", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "overpass",
      radiusKm: 10,
      matchedCount: 1,
      category: "shopping",
      candidates: [
        {
          id: "osm_node_2",
          name: "Apple Store Fifth Avenue",
          description: "450m away, opening hours available",
          category: "shopping",
          distance: "450m",
          rating: 4.8,
          address: "767 5th Ave, New York",
          platform: "Google Maps",
          searchQuery: "Apple Store Fifth Avenue, 767 5th Ave, New York",
        },
      ],
    });

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "mock",
      content: JSON.stringify({
        type: "clarify",
        message:
          "I can help with that. Could you confirm your current location and preferences?",
        intent: "search_nearby",
        clarifyQuestions: [
          "What is your current location?",
          "Any specific preferences like opening hours or price range?",
        ],
      }),
    });

    const response = await processChat(
      {
        message: "Find Mac computer stores within 10km",
        locale: "en",
        region: "INTL",
        location: { lat: 40.7616, lng: -73.9748 },
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.message.toLowerCase()).toContain("used your current location");
    expect(response.clarifyQuestions).toBeUndefined();
    expect(response.candidates?.[0]?.name).toBe("Apple Store Fifth Avenue");
  });

  it("returns 5 concrete store names when nearby seed has enough places", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "overpass",
      radiusKm: 10,
      matchedCount: 8,
      category: "shopping",
      candidates: [
        {
          id: "osm_node_11",
          name: "Apple Digital Plaza",
          description: "120m away, electronics and repair service",
          category: "shopping",
          distance: "120m",
          rating: 4.7,
          address: "Jiangbin Rd 599, Pingnan",
          platform: "Google Maps",
          searchQuery: "Apple Digital Plaza, Jiangbin Rd 599, Pingnan",
        },
        {
          id: "osm_node_12",
          name: "Suning Electronics Pingnan",
          description: "180m away, appliance and laptop section",
          category: "shopping",
          distance: "180m",
          rating: 4.5,
          address: "Chengxi Rd 27, Pingnan",
          platform: "Google Maps",
          searchQuery: "Suning Electronics Pingnan, Chengxi Rd 27, Pingnan",
        },
        {
          id: "osm_node_13",
          name: "Haidatong Communications",
          description: "220m away, phones and accessories",
          category: "shopping",
          distance: "220m",
          rating: 4.4,
          address: "Chengxi Rd 31, Pingnan",
          platform: "Google Maps",
          searchQuery: "Haidatong Communications, Chengxi Rd 31, Pingnan",
        },
        {
          id: "osm_node_14",
          name: "Yongxin Computer Shop",
          description: "260m away, desktop and laptop accessories",
          category: "shopping",
          distance: "260m",
          rating: 4.3,
          address: "Xianlu St 12, Pingnan",
          platform: "Google Maps",
          searchQuery: "Yongxin Computer Shop, Xianlu St 12, Pingnan",
        },
        {
          id: "osm_node_15",
          name: "Jingdong Appliance Service Point",
          description: "340m away, delivery and pickup",
          category: "shopping",
          distance: "340m",
          rating: 4.2,
          address: "Chengdong Rd 200, Pingnan",
          platform: "Google Maps",
          searchQuery: "Jingdong Appliance Service Point, Chengdong Rd 200, Pingnan",
        },
        {
          id: "osm_node_16",
          name: "Huawei Experience Corner",
          description: "410m away, mobile and wearables",
          category: "shopping",
          distance: "410m",
          rating: 4.6,
          address: "Chengdong Rd 210, Pingnan",
          platform: "Google Maps",
          searchQuery: "Huawei Experience Corner, Chengdong Rd 210, Pingnan",
        },
      ],
    });

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "mock",
      content: JSON.stringify({
        type: "clarify",
        message: "Could you confirm your location?",
        intent: "search_nearby",
        clarifyQuestions: ["What is your location?"],
      }),
    });

    const response = await processChat(
      {
        message: "Find Mac computer stores within 10km",
        locale: "en",
        region: "INTL",
        location: { lat: 23.54, lng: 110.39 },
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.clarifyQuestions).toBeUndefined();
    expect(response.candidates).toHaveLength(5);
    expect(response.candidates?.every((candidate) => candidate.name && candidate.name !== "Store")).toBe(
      true
    );
  });

  it("returns fallback results instead of clarify when seed is empty", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "overpass",
      radiusKm: 10,
      matchedCount: 0,
      category: "shopping",
      candidates: [],
    });

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "mock",
      content: JSON.stringify({
        type: "clarify",
        message: "Please share your location and preferred price range.",
        intent: "search_nearby",
        clarifyQuestions: [
          "What is your current location?",
          "Do you have a preferred price range?",
        ],
      }),
    });

    const response = await processChat(
      {
        message: "Find Mac computer stores within 10km",
        locale: "en",
        region: "INTL",
        location: { lat: 40.7616, lng: -73.9748 },
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.message.toLowerCase()).toContain("prepared a nearby search");
    expect(response.clarifyQuestions).toBeUndefined();
    expect(response.candidates?.[0]?.name).toContain("Search on map");
    expect(response.candidates?.[0]?.platform).toBe("Google Maps");
  });

  it("asks to widen radius when car wash nearby seed is empty", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "overpass",
      radiusKm: 10,
      matchedCount: 0,
      category: "local_life",
      candidates: [],
    });

    const response = await processChat(
      {
        message: "find car wash stores within 10km",
        locale: "zh",
        region: "CN",
        location: { lat: 23.54, lng: 110.39 },
      },
      "test-user"
    );

    expect(response.type).toBe("clarify");
    expect(response.intent).toBe("search_nearby");
    expect(response.message).toContain("20km");
    expect(response.clarifyQuestions?.[0]).toContain("20km");
    expect(callAI).not.toHaveBeenCalled();
  });

  it("forces car wash nearby candidates to come from seed and strips non-map actions", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "database",
      radiusKm: 10,
      matchedCount: 3,
      category: "local_life",
      candidates: [
        {
          id: "amap_1",
          name: "Car Wash A",
          description: "1.2km away, manual wash available",
          category: "local_life",
          distance: "1.2km",
          rating: 4.6,
          address: "Pingnan Road 1",
          platform: "Amap",
          searchQuery: "Car Wash A, Pingnan Road 1",
        },
        {
          id: "amap_2",
          name: "Car Wash B",
          description: "2.5km away, detailing supported",
          category: "local_life",
          distance: "2.5km",
          rating: 4.5,
          address: "Pingnan Road 2",
          platform: "Amap",
          searchQuery: "Car Wash B, Pingnan Road 2",
        },
        {
          id: "amap_3",
          name: "Car Wash C",
          description: "3.4km away, open until 21:00",
          category: "local_life",
          distance: "3.4km",
          rating: 4.3,
          address: "Pingnan Road 3",
          platform: "Amap",
          searchQuery: "Car Wash C, Pingnan Road 3",
        },
      ],
    });

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "mock",
      content: JSON.stringify({
        type: "results",
        message: "Here are nearby car wash options.",
        intent: "search_nearby",
        candidates: [
          {
            id: "dp_1",
            name: "Top Car Wash Shop",
            description: "2.1km away, highly rated",
            category: "local_life",
            distance: "2.1km",
            platform: "Dianping",
            searchQuery: "Top Car Wash Shop",
          },
          {
            id: "mt_1",
            name: "Fast Car Wash",
            description: "3.1km away, cheap",
            category: "local_life",
            distance: "3.1km",
            platform: "Meituan",
            searchQuery: "Fast Car Wash",
          },
        ],
        actions: [
          {
            type: "open_web",
            label: "Open Dianping",
            payload: "https://example.com/dianping",
          },
        ],
      }),
    });

    const response = await processChat(
      {
        message: "find nearby car wash stores within 10km",
        locale: "zh",
        region: "CN",
        location: { lat: 23.476458472108877, lng: 110.45730570700682 },
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.intent).toBe("search_nearby");
    expect(response.candidates?.map((candidate) => candidate.id)).toEqual([
      "amap_1",
      "amap_2",
      "amap_3",
    ]);
    expect(
      response.candidates?.every(
        (candidate) => !["Dianping", "Xiaohongshu", "Meituan"].includes(candidate.platform)
      )
    ).toBe(true);
    expect(response.actions?.some((action) => action.type === "open_web")).toBe(false);
  });

  it("forces generic CN nearby candidates to come from Amap seed only", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "database",
      radiusKm: 5,
      matchedCount: 2,
      category: "food",
      candidates: [
        {
          id: "amap_cafe_1",
          name: "Nearby Cafe A",
          description: "0.8km away, opens at 08:00",
          category: "food",
          distance: "0.8km",
          rating: 4.6,
          platform: "Amap",
          searchQuery: "Nearby Cafe A",
        },
        {
          id: "amap_cafe_2",
          name: "Nearby Cafe B",
          description: "1.3km away, open now",
          category: "food",
          distance: "1.3km",
          rating: 4.4,
          platform: "Amap",
          searchQuery: "Nearby Cafe B",
        },
      ],
    });

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "mock",
      content: JSON.stringify({
        type: "results",
        message: "Found coffee shops",
        intent: "search_nearby",
        candidates: [
          {
            id: "dp_cafe_1",
            name: "Platform Cafe",
            description: "popular",
            category: "food",
            distance: "0.9km",
            platform: "Dianping",
            searchQuery: "Platform Cafe",
          },
        ],
      }),
    });

    const response = await processChat(
      {
        message: "附近咖啡店",
        locale: "zh",
        region: "CN",
        location: { lat: 23.476458472108877, lng: 110.45730570700682 },
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.candidates?.map((candidate) => candidate.id)).toEqual([
      "amap_cafe_1",
      "amap_cafe_2",
    ]);
    expect(response.candidates?.every((candidate) => candidate.platform !== "Dianping")).toBe(true);
  });

  it("keeps strict car wash mode for radius expansion follow-up using history context", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "database",
      radiusKm: 20,
      matchedCount: 2,
      category: "local_life",
      candidates: [
        {
          id: "amap_expand_1",
          name: "Car Wash Expand A",
          description: "11.2km away, manual wash",
          category: "local_life",
          distance: "11.2km",
          rating: 4.5,
          platform: "Amap",
          searchQuery: "Car Wash Expand A",
        },
        {
          id: "amap_expand_2",
          name: "Car Wash Expand B",
          description: "13.6km away, detailing",
          category: "local_life",
          distance: "13.6km",
          rating: 4.4,
          platform: "Amap",
          searchQuery: "Car Wash Expand B",
        },
      ],
    });

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "mock",
      content: JSON.stringify({
        type: "results",
        message: "expanded results",
        intent: "search_nearby",
        candidates: [
          {
            id: "dp_expand_1",
            name: "Dianping Car Wash",
            description: "12.0km",
            category: "local_life",
            distance: "12.0km",
            platform: "Dianping",
            searchQuery: "Dianping Car Wash",
          },
        ],
      }),
    });

    const response = await processChat(
      {
        message: "附近扩大到20km",
        locale: "zh",
        region: "CN",
        location: { lat: 23.476458472108877, lng: 110.45730570700682 },
        history: [
          { role: "user", content: "附近10公里洗车店" },
          { role: "assistant", content: "先帮你找10公里内" },
        ],
      },
      "test-user"
    );

    expect(vi.mocked(searchNearbyStores).mock.calls[0]?.[0]?.message).toContain("洗车");
    expect(response.type).toBe("results");
    expect(response.candidates?.map((candidate) => candidate.id)).toEqual([
      "amap_expand_1",
      "amap_expand_2",
    ]);
    expect(
      response.candidates?.every((candidate) => !["Dianping", "Meituan"].includes(candidate.platform))
    ).toBe(true);
  });

  it("prioritizes nearest places when user asks for closer options", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "overpass",
      radiusKm: 5,
      matchedCount: 2,
      category: "food",
      candidates: [
        {
          id: "osm_far",
          name: "Far Cafe",
          description: "1.8 miles away",
          category: "food",
          distance: "1.8 miles",
          platform: "Google Maps",
          searchQuery: "Far Cafe",
        },
        {
          id: "osm_near",
          name: "Near Cafe",
          description: "0.3 miles away",
          category: "food",
          distance: "0.3 miles",
          platform: "Google Maps",
          searchQuery: "Near Cafe",
        },
      ],
    });

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "mock",
      content: JSON.stringify({
        type: "clarify",
        message: "Want to refine?",
        intent: "search_nearby",
        clarifyQuestions: ["Any budget preference?"],
      }),
    });

    const response = await processChat(
      {
        message: "Want closer options",
        locale: "en",
        region: "INTL",
        location: { lat: 40.7128, lng: -74.006 },
      },
      "test-user"
    );

    expect(searchNearbyStores).toHaveBeenCalledTimes(1);
    expect(response.type).toBe("results");
    expect(response.candidates?.[0]?.name).toBe("Near Cafe");
    expect(response.candidates?.[1]?.name).toBe("Far Cafe");
  });

  it("falls back to CN nearby data when AI provider fails", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "database",
      radiusKm: 10,
      matchedCount: 1,
      category: "local_life",
      candidates: [
        {
          id: "cn_car_wash_1",
          name: "Sparkle Car Wash",
          description: "0.4 miles away, car detailing supported",
          category: "local_life",
          distance: "0.4 miles",
          rating: 4.7,
          platform: "Google Maps",
          searchQuery: "Sparkle Car Wash, Downtown",
        },
      ],
    });

    vi.mocked(callAI).mockRejectedValueOnce(new Error("provider timeout"));

    const response = await processChat(
      {
        message: "find car wash nearby within 10km",
        locale: "zh",
        region: "CN",
        location: { lat: 37.7749, lng: -122.4194 },
      },
      "test-user"
    );

    expect(searchNearbyStores).toHaveBeenCalledTimes(1);
    expect(vi.mocked(searchNearbyStores).mock.calls[0]?.[0]).toMatchObject({
      region: "CN",
      locale: "zh",
      limit: 8,
    });

    expect(response.type).toBe("results");
    expect(response.intent).toBe("search_nearby");
    expect(response.candidates?.[0]?.name).toBe("Sparkle Car Wash");
    expect(response.actions?.some((action) => action.type === "open_app")).toBe(true);
  });

  it("treats Chinese distance phrasing as nearby intent and avoids AI error fallback", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "database",
      radiusKm: 10,
      matchedCount: 1,
      category: "local_life",
      candidates: [
        {
          id: "cn_car_wash_2",
          name: "Ocean Car Wash",
          description: "1.2km away, open late",
          category: "local_life",
          distance: "1.2km",
          rating: 4.5,
          platform: "楂樺痉鍦板浘",
          searchQuery: "Ocean Car Wash",
        },
      ],
    });

    vi.mocked(callAI).mockRejectedValueOnce(new Error("provider timeout"));

    const response = await processChat(
      {
        message: "10 公里内洗车店",
        locale: "zh",
        region: "CN",
        location: { lat: 31.2304, lng: 121.4737 },
      },
      "test-user"
    );

    expect(searchNearbyStores).toHaveBeenCalledTimes(1);
    expect(response.type).toBe("results");
    expect(response.intent).toBe("search_nearby");
    expect(response.candidates?.[0]?.name).toBe("Ocean Car Wash");
  });

  it("returns clarify when CN nearby request has no Amap result", async () => {
    vi.mocked(searchNearbyStores).mockResolvedValueOnce({
      source: "database",
      radiusKm: 10,
      matchedCount: 0,
      category: "local_life",
      candidates: [],
    });

    const response = await processChat(
      {
        message: "附近咖啡店",
        locale: "zh",
        region: "CN",
        location: { lat: 37.7749, lng: -122.4194 },
      },
      "test-user"
    );

    expect(response.type).toBe("clarify");
    expect(response.intent).toBe("search_nearby");
    expect(response.message).toContain("高德");
    expect(callAI).not.toHaveBeenCalled();
  });
});
