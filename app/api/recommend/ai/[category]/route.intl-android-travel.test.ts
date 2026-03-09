import { describe, expect, it } from "vitest";

import { getRecommendationTargetCount, getTravelPlatformOverride } from "./route-test-helpers";

const TEST_TIMEOUT = 15000;

describe("INTL Android travel platform mix", () => {
  it("enforces 6-item platform sequence for first six indices", () => {
    expect(getTravelPlatformOverride).toBeTypeOf("function");

    const expected = [
      "TripAdvisor",
      "Yelp",
      "Wanderlog",
      "Visit A City",
      "GetYourGuide",
      "Google Maps",
    ];

    const actual = expected.map((_, index) =>
      getTravelPlatformOverride({
        category: "travel",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        index,
        count: 6,
      })
    );

    expect(actual).toEqual(expected);
  }, TEST_TIMEOUT);

  it("raises recommendation target count to 6 in INTL Android travel context", () => {
    expect(getRecommendationTargetCount).toBeTypeOf("function");

    expect(
      getRecommendationTargetCount({
        category: "travel",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        requestedCount: 5,
      })
    ).toBe(6);
  }, TEST_TIMEOUT);

  it("does not force sequence outside INTL Android travel context", () => {
    expect(
      getTravelPlatformOverride({
        category: "travel",
        locale: "en",
        isMobile: true,
        isAndroid: false,
        index: 0,
        count: 6,
      })
    ).toBeNull();
  }, TEST_TIMEOUT);
});
