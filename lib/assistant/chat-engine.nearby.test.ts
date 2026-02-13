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
});
