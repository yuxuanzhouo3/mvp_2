import { describe, expect, it } from "vitest";

import {
  getFoodPlatformOverride,
  getRecommendationTargetCount,
  sanitizeIntlAndroidFoodRecommendation,
} from "./route-test-helpers";

const TEST_TIMEOUT = 15000;

describe("INTL Android food platform mix", () => {
  it("enforces 6-item platform sequence for first six indices", () => {
    expect(getFoodPlatformOverride).toBeTypeOf("function");

    const expected = [
      "DoorDash",
      "DoorDash",
      "Uber Eats",
      "Uber Eats",
      "Fantuan Delivery",
      "HungryPanda",
    ];

    const actual = expected.map((_, index) =>
      getFoodPlatformOverride({
        category: "food",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        index,
        count: 6,
      })
    );

    expect(actual).toEqual(expected);
  }, TEST_TIMEOUT);

  it("raises recommendation target count to 6 in INTL Android food context", () => {
    expect(getRecommendationTargetCount).toBeTypeOf("function");

    expect(
      getRecommendationTargetCount({
        category: "food",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        requestedCount: 5,
      })
    ).toBe(6);
  }, TEST_TIMEOUT);

  it("does not force sequence outside INTL Android food context", () => {
    expect(
      getFoodPlatformOverride({
        category: "food",
        locale: "en",
        isMobile: true,
        isAndroid: false,
        index: 0,
        count: 6,
      })
    ).toBeNull();
  }, TEST_TIMEOUT);

  it("sanitizes scenario-style food recommendation to concrete dish", () => {
    expect(sanitizeIntlAndroidFoodRecommendation).toBeTypeOf("function");

    const output = sanitizeIntlAndroidFoodRecommendation({
      title: "????",
      query: "friends hangout dinner",
      tags: ["food"],
      platform: "DoorDash",
      index: 0,
    });

    expect(output.platform).toBe("DoorDash");
    expect(output.title).toBe("Nashville hot chicken sandwich");
    expect(output.searchQuery).toBe("Nashville hot chicken sandwich");
    expect(output.tags.some((tag) => tag.startsWith("cuisine:"))).toBe(true);
    expect(output.tags.some((tag) => tag.startsWith("price_range:"))).toBe(true);
  }, TEST_TIMEOUT);
});
