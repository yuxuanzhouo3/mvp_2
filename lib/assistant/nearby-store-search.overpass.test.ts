import { afterEach, describe, expect, it, vi } from "vitest";
import { searchNearbyStores } from "./nearby-store-search";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
const originalAmapKey = process.env.AMAP_WEB_SERVICE_KEY;

describe("nearby-store-search Overpass INTL", () => {
  afterEach(() => {
    mockFetch.mockReset();
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
    expect(result.candidates[0]?.distance).toMatch(/mile/);

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
            lat: 40.7131,
            lon: -74.0058,
            tags: {
              name: "Pingnan Apple Tech Store",
              shop: "electronics",
            },
          },
        ],
      }),
    });

    await searchNearbyStores({
      lat: 40.7128,
      lng: -74.006,
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
            lat: 40.7132,
            lon: -74.0062,
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
      lat: 40.7128,
      lng: -74.006,
      locale: "en",
      region: "INTL",
      message: "Find Mac computer stores within 10km",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.name).toBe("Apple Premium Reseller Pingnan");
    expect(result.candidates[0]?.platform).toBeTruthy();
  });

  it("uses Amap in INTL when coordinates are in China", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: [
          {
            id: "amap_intl_cn_1",
            name: "Apple Digital Plaza",
            type: "shopping;electronics",
            address: "Jiangbin Rd",
            location: "110.390200,23.540200",
            distance: "420",
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
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.name).toBe("Apple Digital Plaza");
    expect(result.candidates[0]?.platform).not.toBe("Google Maps");
    expect(result.candidates[0]?.distance).toMatch(/mile/);
  });

  it("uses Amap in CN nearby flow and returns concrete car wash stores", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: [
          {
            id: "amap_cn_1",
            name: "Pingnan Fast Car Wash",
            type: "car_service;car_wash;auto_beauty",
            address: "Jiangbin Rd 88",
            location: "110.390100,23.540100",
            distance: "320",
          },
          {
            id: "amap_cn_2",
            name: "Auto Care Flagship",
            type: "car_service;car_wash;auto_beauty",
            address: "Chengnan Ave 66",
            location: "110.391000,23.541000",
            distance: "560",
          },
          {
            id: "amap_cn_3",
            name: "Clean Car Wash Workshop",
            type: "car_service;car_wash",
            address: "Mingyang Rd 12",
            location: "110.392000,23.542000",
            distance: "980",
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        results: [{ distance: "320" }, { distance: "560" }, { distance: "980" }],
      }),
    });

    const result = await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "en",
      region: "CN",
      message: "find car wash stores within 10km",
      limit: 3,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[0]?.[0] || "")).toContain("restapi.amap.com/v3/place/around");
    expect(String(mockFetch.mock.calls[1]?.[0] || "")).toContain("restapi.amap.com/v3/distance");
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]?.name).toBe("Pingnan Fast Car Wash");
    expect(result.candidates.every((candidate) => Boolean(candidate.name))).toBe(true);
    expect(result.candidates.every((candidate) => Boolean(candidate.platform))).toBe(true);
    expect(result.candidates.every((candidate) => /(m|km)/.test(candidate.distance || ""))).toBe(true);
  });

  it("filters out non-car-wash Amap POIs for car wash intent", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: [
          {
            id: "amap_mix_1",
            name: "Yongping Furniture",
            type: "shopping;furniture",
            address: "County Rd",
            location: "110.390100,23.540100",
            distance: "238",
          },
          {
            id: "amap_mix_2",
            name: "Sparkle Car Wash",
            type: "car_service;car_wash;auto_beauty",
            address: "Main Street 8",
            location: "110.391000,23.541000",
            distance: "420",
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        results: [{ distance: "420" }],
      }),
    });

    const result = await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "en",
      region: "CN",
      message: "find car wash stores within 10km",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[0]?.[0] || "")).toContain("restapi.amap.com/v3/place/around");
    expect(String(mockFetch.mock.calls[0]?.[0] || "")).toContain("keywords=car%20wash");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.name).toBe("Sparkle Car Wash");
  });

  it("filters out wash-disinfection transport facilities for car wash intent", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: [
          {
            id: "amap_mix_3",
            name: "平南县杰兴动物运输车辆洗消中心",
            type: "汽车服务;洗车场;消毒洗消",
            address: "上渡街道",
            location: "110.390200,23.540200",
            distance: "350",
          },
          {
            id: "amap_mix_4",
            name: "车海洋自助洗车站",
            type: "汽车服务;洗车场;自助洗车",
            address: "平南农信综合大楼",
            location: "110.391200,23.541200",
            distance: "420",
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        results: [{ distance: "420" }],
      }),
    });

    const result = await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "en",
      region: "CN",
      message: "find car wash stores within 10km",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.name).toBe("车海洋自助洗车站");
  });

  it("drops car wash POIs whose driving distance exceeds requested radius", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: [
          {
            id: "amap_drive_1",
            name: "临江洗车",
            type: "汽车服务;洗车场;汽车美容",
            address: "临江路",
            location: "110.395000,23.545000",
            distance: "6500",
          },
          {
            id: "amap_drive_2",
            name: "南城自助洗车站",
            type: "汽车服务;洗车场;自助洗车",
            address: "南城路",
            location: "110.392000,23.542000",
            distance: "5200",
          },
        ],
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        results: [{ distance: "7300" }, { distance: "12800" }],
      }),
    });

    const result = await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "en",
      region: "CN",
      message: "find car wash stores within 10km",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[1]?.[0] || "")).toContain("restapi.amap.com/v3/distance");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.name).toBe("南城自助洗车站");
  });

  it("returns empty result in strict CN car wash mode when Amap has no POIs", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: [],
      }),
    });

    const result = await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "zh",
      region: "CN",
      message: "附近10公里洗车店",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0] || "")).toContain("restapi.amap.com/v3/place/around");
    expect(result.candidates).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
  });

  it("returns empty result for generic CN nearby request when Amap has no POIs", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        info: "OK",
        pois: [],
      }),
    });

    const result = await searchNearbyStores({
      lat: 23.54,
      lng: 110.39,
      locale: "zh",
      region: "CN",
      message: "附近咖啡店",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0] || "")).toContain("restapi.amap.com/v3/place/around");
    expect(result.candidates).toHaveLength(0);
    expect(result.matchedCount).toBe(0);
  });
});
