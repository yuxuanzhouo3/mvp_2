import { describe, expect, it } from "vitest";

import { getFitnessPlatformOverride, getRecommendationTargetCount } from "./route-test-helpers";

const TEST_TIMEOUT = 15000;

describe("INTL Android fitness platform mix", () => {
  it("enforces 8-item platform sequence for first eight indices", () => {
    expect(getFitnessPlatformOverride).toBeTypeOf("function");

    const expected = [
      "Nike Training Club",
      "Peloton",
      "Strava",
      "Nike Run Club",
      "Hevy",
      "Strong",
      "Down Dog",
      "MyFitnessPal",
    ];

    const actual = expected.map((_, index) =>
      getFitnessPlatformOverride({
        category: "fitness",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        index,
        count: 8,
      })
    );

    expect(actual).toEqual(expected);
  }, TEST_TIMEOUT);

  it("raises recommendation target count to 8 in INTL Android fitness context", () => {
    expect(getRecommendationTargetCount).toBeTypeOf("function");

    expect(
      getRecommendationTargetCount({
        category: "fitness",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        requestedCount: 5,
      })
    ).toBe(8);
  }, TEST_TIMEOUT);

  it("does not force sequence outside INTL Android fitness context", () => {
    expect(
      getFitnessPlatformOverride({
        category: "fitness",
        locale: "en",
        isMobile: true,
        isAndroid: false,
        index: 0,
        count: 8,
      })
    ).toBeNull();
  }, TEST_TIMEOUT);
});
