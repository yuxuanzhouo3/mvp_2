import { afterEach, describe, expect, it, vi } from "vitest";
import { searchNearbyStores } from "./nearby-store-search";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
const originalAmapKey = process.env.AMAP_WEB_SERVICE_KEY;

describe("nearby-store-search Overpass INTL", () => {
  afterEach(() => {
    vi.clearAllMocks();
    if (originalAmapKey === undefined) {
      delete process.env.AMAP_WEB_SERVICE_KEY;
    } else {
      process.env.AMAP_WEB_SERVICE_KEY = originalAmapKey;
    }
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: "node",
            id: 103,
            lat: 40.7127,
            lon: -74.0062,
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

  it("honors 10km radius in Overpass query for nearby shopping requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: "node",
            id: 301,
            lat: 23.541,
            lon: 110.392,
            tags: {
              name: "Pingnan Apple Tech Store",
              shop: "electronics",
            },
          },
        ],
      }),
    });

    await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "en",
      region: "INTL",
      message: "Find Mac computer stores within 10km",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const primaryRequestOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
    const primaryBody = decodeURIComponent(String(primaryRequestOptions.body || ""));
    expect(primaryBody).toContain("around:10000");
    expect(primaryBody).toContain("\"shop\"~");

    const keywordRequestOptions = mockFetch.mock.calls[1]?.[1] as RequestInit;
    const keywordBody = decodeURIComponent(String(keywordRequestOptions.body || ""));
    expect(keywordBody).toContain("around:10000");
    expect(keywordBody).toContain("[\"name\"~");
  });

  it("falls back to keyword query and returns concrete store names", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: "node",
            id: 201,
            lat: 23.541,
            lon: 110.392,
            tags: {
              name: "Apple Premium Reseller Pingnan",
              shop: "electronics",
              "addr:street": "West Street",
              "addr:city": "Pingnan",
            },
          },
        ],
      }),
    });

    const result = await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "en",
      region: "INTL",
      message: "Find Mac computer stores within 10km",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.name).toBe("Apple Premium Reseller Pingnan");
    expect(result.candidates[0]?.platform).toBe("Google Maps");
  });

  it("uses Amap fallback in INTL China coordinates and returns 5 concrete store names", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: [
          {
            id: "amap_1",
            name: "Apple Digital Plaza",
            type: "购物服务;家电电子卖场;家电电子卖场",
            address: "Jiangbin Rd 599",
            location: "110.390100,23.540100",
            distance: "120",
          },
          {
            id: "amap_2",
            name: "Suning Electronics Pingnan",
            type: "购物服务;家电电子卖场;苏宁",
            address: "Chengxi Rd 27",
            location: "110.389800,23.540200",
            distance: "180",
          },
          {
            id: "amap_3",
            name: "Haidatong Communications",
            type: "购物服务;家电电子卖场;手机销售",
            address: "Chengxi Rd 31",
            location: "110.389700,23.540300",
            distance: "220",
          },
          {
            id: "amap_4",
            name: "Yongxin Computer Shop",
            type: "购物服务;专卖店;专营店",
            address: "Xianlu St 12",
            location: "110.390300,23.540400",
            distance: "260",
          },
          {
            id: "amap_5",
            name: "Jingdong Appliance Service Point",
            type: "购物服务;家电电子卖场;家电电子卖场",
            address: "Chengdong Rd 200",
            location: "110.391000,23.541000",
            distance: "340",
          },
          {
            id: "amap_6",
            name: "Huawei Experience Corner",
            type: "购物服务;家电电子卖场;手机销售",
            address: "Chengdong Rd 210",
            location: "110.391500,23.541400",
            distance: "410",
          },
        ],
      }),
    });

    const result = await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "en",
      region: "INTL",
      message: "Find Mac computer stores within 10km",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0] || "")).toContain("restapi.amap.com/v3/place/around");
    expect(result.candidates).toHaveLength(5);
    expect(result.candidates.map((candidate) => candidate.name)).toContain("Apple Digital Plaza");
    expect(result.candidates.every((candidate) => Boolean(candidate.name))).toBe(true);
  });
});
