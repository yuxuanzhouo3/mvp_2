import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocode } from "./reverse-geocode";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

describe("reverseGeocode provider fallback", () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.AMAP_WEB_SERVICE_KEY;
    delete process.env.AMAP_API_KEY;
    delete process.env.GAODE_WEB_SERVICE_KEY;
  });

  it("uses Nominatim first for INTL region", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: {
          city: "Los Angeles",
          state: "California",
          country: "United States",
        },
        display_name: "Los Angeles, California, United States",
      }),
    });

    const result = await reverseGeocode(34.0522, -118.2437, "en", "INTL");

    expect(result).not.toBeNull();
    expect(result?.city).toBe("Los Angeles");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("nominatim.openstreetmap.org");
  });

  it("does not fall back to Amap in INTL when Nominatim fails", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const result = await reverseGeocode(34.0522, -118.2437, "en", "INTL");

    expect(result).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("nominatim.openstreetmap.org");
  });

  it("prefers Amap in CN region when key is configured", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "1",
        regeocode: {
          formatted_address: "中国上海市浦东新区",
          addressComponent: {
            country: "中国",
            province: "上海市",
            city: "上海市",
            district: "浦东新区",
          },
        },
      }),
    });

    const result = await reverseGeocode(31.23, 121.47, "zh", "CN");

    expect(result).not.toBeNull();
    expect(result?.city).toBe("上海市");
    expect(result?.displayName).toContain("上海");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("restapi.amap.com");
  });

  it("falls back to Nominatim when Amap key is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        address: {
          city: "Shanghai",
          state: "Shanghai",
          country: "China",
        },
        display_name: "Shanghai, China",
      }),
    });

    const result = await reverseGeocode(31.23, 121.47, "en", "CN");

    expect(result).not.toBeNull();
    expect(result?.city).toBe("Shanghai");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("nominatim.openstreetmap.org");
  });

  it("falls back to Nominatim after Amap network failure", async () => {
    process.env.AMAP_WEB_SERVICE_KEY = "test-amap-key";

    mockFetch
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: {
            city: "Beijing",
            state: "Beijing",
            country: "China",
          },
          display_name: "Beijing, China",
        }),
      });

    const result = await reverseGeocode(39.9, 116.4, "en", "CN");

    expect(result).not.toBeNull();
    expect(result?.city).toBe("Beijing");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain("restapi.amap.com");
    expect(mockFetch.mock.calls[1][0]).toContain("nominatim.openstreetmap.org");
  });
});
