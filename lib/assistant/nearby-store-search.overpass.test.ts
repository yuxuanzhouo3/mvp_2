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
    expect(result.candidates[0]?.platform).toBeTruthy();
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
            type: "shopping;electronics;store",
            address: "Jiangbin Rd 599",
            location: "110.390100,23.540100",
            distance: "120",
          },
          {
            id: "amap_2",
            name: "Suning Electronics Pingnan",
            type: "shopping;electronics;store",
            address: "Chengxi Rd 27",
            location: "110.389800,23.540200",
            distance: "180",
          },
          {
            id: "amap_3",
            name: "Haidatong Communications",
            type: "shopping;electronics;mobile_phone",
            address: "Chengxi Rd 31",
            location: "110.389700,23.540300",
            distance: "220",
          },
          {
            id: "amap_4",
            name: "Yongxin Computer Shop",
            type: "shopping;computer_store",
            address: "Xianlu St 12",
            location: "110.390300,23.540400",
            distance: "260",
          },
          {
            id: "amap_5",
            name: "Jingdong Appliance Service Point",
            type: "shopping;electronics;store",
            address: "Chengdong Rd 200",
            location: "110.391000,23.541000",
            distance: "340",
          },
          {
            id: "amap_6",
            name: "Huawei Experience Corner",
            type: "shopping;electronics;mobile_phone",
            address: "Chengdong Rd 210",
            location: "110.391500,23.541400",
            distance: "410",
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
      region: "INTL",
      message: "Find Mac computer stores within 10km",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0] || "")).toContain("restapi.amap.com/v3/place/around");
    expect(result.candidates).toHaveLength(5);
    expect(result.candidates.map((candidate) => candidate.name)).toContain("Apple Digital Plaza");
    expect(result.candidates.every((candidate) => Boolean(candidate.name))).toBe(true);
    expect(result.candidates.every((candidate) => Boolean(candidate.platform))).toBe(true);
    expect(result.candidates.every((candidate) => /mile/.test(candidate.distance || ""))).toBe(true);
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
            name: "\u5e73\u5357\u53bf\u6770\u5174\u52a8\u7269\u8fd0\u8f93\u8f66\u8f86\u6d17\u6d88\u4e2d\u5fc3",
            type: "\u6c7d\u8f66\u670d\u52a1;\u6d17\u8f66\u573a;\u6d88\u6bd2\u6d17\u6d88",
            address: "\u4e0a\u6e21\u8857\u9053",
            location: "110.390200,23.540200",
            distance: "350",
          },
          {
            id: "amap_mix_4",
            name: "\u8f66\u6d77\u6d0b\u81ea\u52a9\u6d17\u8f66\u7ad9",
            type: "\u6c7d\u8f66\u670d\u52a1;\u6d17\u8f66\u573a;\u81ea\u52a9\u6d17\u8f66",
            address: "\u5e73\u5357\u519c\u4fe1\u7efc\u5408\u5927\u697c",
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
    expect(result.candidates[0]?.name).toBe("\u8f66\u6d77\u6d0b\u81ea\u52a9\u6d17\u8f66\u7ad9");
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
            name: "\u4e34\u6c5f\u6d17\u8f66",
            type: "\u6c7d\u8f66\u670d\u52a1;\u6d17\u8f66\u573a;\u6c7d\u8f66\u7f8e\u5bb9",
            address: "\u4e34\u6c5f\u8def",
            location: "110.395000,23.545000",
            distance: "6500",
          },
          {
            id: "amap_drive_2",
            name: "\u5357\u57ce\u81ea\u52a9\u6d17\u8f66\u7ad9",
            type: "\u6c7d\u8f66\u670d\u52a1;\u6d17\u8f66\u573a;\u81ea\u52a9\u6d17\u8f66",
            address: "\u5357\u57ce\u8def",
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
    expect(result.candidates[0]?.name).toBe("\u5357\u57ce\u81ea\u52a9\u6d17\u8f66\u7ad9");
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
