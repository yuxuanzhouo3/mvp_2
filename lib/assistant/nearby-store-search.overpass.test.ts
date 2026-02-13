import { afterEach, describe, expect, it, vi } from "vitest";
import { searchNearbyStores } from "./nearby-store-search";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("nearby-store-search Overpass INTL", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("queries Overpass and maps concrete places into candidates", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: "node",
            id: 101,
            lat: 40.71281,
            lon: -74.00595,
            tags: {
              name: "Joe's Pizza",
              amenity: "restaurant",
              cuisine: "pizza",
              opening_hours: "Mo-Su 11:00-23:00",
              "addr:housenumber": "123",
              "addr:street": "Broadway",
              "addr:city": "New York",
            },
          },
        ],
      }),
    });

    const result = await searchNearbyStores({
      lat: 40.7128,
      lng: -74.006,
      locale: "en",
      region: "INTL",
      message: "find restaurants nearby within 500m",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("overpass");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.name).toBe("Joe's Pizza");
    expect(result.candidates[0]?.platform).toBe("Google Maps");
    expect(result.candidates[0]?.distance).toMatch(/m|km/);

    const requestOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const body = decodeURIComponent(String(requestOptions.body || ""));
    expect(body).toContain("around:500");
    expect(body).toContain("amenity");
  });

  it("filters generic category-only names from Overpass results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: "node",
            id: 102,
            lat: 40.7129,
            lon: -74.0061,
            tags: {
              name: "Restaurant",
              amenity: "restaurant",
            },
          },
        ],
      }),
    });

    const result = await searchNearbyStores({
      lat: 40.7128,
      lng: -74.006,
      locale: "en",
      region: "INTL",
      message: "restaurants nearby",
      limit: 5,
    });

    expect(result.source).toBe("overpass");
    expect(result.candidates).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
  });
});
