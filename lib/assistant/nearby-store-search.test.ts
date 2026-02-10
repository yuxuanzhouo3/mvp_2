import { describe, expect, it } from "vitest";
import { haversineDistanceKm, parseRadiusKmFromMessage } from "./nearby-store-search";

describe("nearby-store-search utils", () => {
  it("parses kilometer radius from Chinese message", () => {
    expect(parseRadiusKmFromMessage("帮我找3公里内的火锅")).toBeCloseTo(3);
  });

  it("parses meter radius from Chinese message", () => {
    expect(parseRadiusKmFromMessage("附近500米的便利店")).toBeCloseTo(0.5);
  });

  it("parses miles radius from English message", () => {
    expect(parseRadiusKmFromMessage("find gyms within 2 miles")).toBeCloseTo(3.21868, 4);
  });

  it("returns default radius when message has no explicit range", () => {
    expect(parseRadiusKmFromMessage("找附近好吃的")).toBeCloseTo(5);
  });

  it("calculates haversine distance for nearby points", () => {
    const distance = haversineDistanceKm(31.2304, 121.4737, 31.2334, 121.4805);
    expect(distance).toBeGreaterThan(0.5);
    expect(distance).toBeLessThan(1.0);
  });
});

