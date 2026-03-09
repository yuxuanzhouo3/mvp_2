import { describe, expect, it } from "vitest";

import {
  alignIntlAndroidTitleWithSearchQuery,
  enforceConcreteIntlAndroidSearchQuery,
} from "./route-test-helpers";

const TEST_TIMEOUT = 15000;

describe("INTL Android concrete query enforcement", () => {
  it("replaces generic entertainment query with concrete single item", () => {
    expect(enforceConcreteIntlAndroidSearchQuery).toBeTypeOf("function");

    const result = enforceConcreteIntlAndroidSearchQuery({
      category: "entertainment",
      platform: "TikTok",
      title: "TikTok Trends",
      query: "top songs playlist",
    });

    expect(result).toBe("BookTok Fourth Wing edits");
  }, TEST_TIMEOUT);

  it("replaces generic query in all five INTL Android categories", () => {
    expect(enforceConcreteIntlAndroidSearchQuery).toBeTypeOf("function");

    const cases = [
      {
        category: "shopping" as const,
        platform: "Amazon Shopping",
        query: "best products deals",
        expected: "Stanley Quencher H2.0 40oz",
      },
      {
        category: "food" as const,
        platform: "DoorDash",
        query: "food delivery near me",
        expected: "Nashville hot chicken sandwich",
      },
      {
        category: "travel" as const,
        platform: "TripAdvisor",
        query: "travel things to do",
        expected: "Banff Lake Louise",
      },
      {
        category: "fitness" as const,
        platform: "Nike Training Club",
        query: "fitness workout plans",
        expected: "20-minute lower body dumbbell workout",
      },
    ];

    for (const testCase of cases) {
      const output = enforceConcreteIntlAndroidSearchQuery({
        category: testCase.category,
        platform: testCase.platform,
        query: testCase.query,
      });
      expect(output).toBe(testCase.expected);
    }
  }, TEST_TIMEOUT);

  it("keeps already concrete queries", () => {
    expect(enforceConcreteIntlAndroidSearchQuery).toBeTypeOf("function");

    const output = enforceConcreteIntlAndroidSearchQuery({
      category: "travel",
      platform: "TripAdvisor",
      query: "Banff Lake Louise",
    });

    expect(output).toBe("Banff Lake Louise");
  }, TEST_TIMEOUT);

  it("aligns generic INTL Android title to concrete search query", () => {
    expect(alignIntlAndroidTitleWithSearchQuery).toBeTypeOf("function");

    const output = alignIntlAndroidTitleWithSearchQuery({
      category: "shopping",
      locale: "en",
      isMobile: true,
      isAndroid: true,
      title: "Best trending shopping picks",
      searchQuery: "Stanley Quencher H2.0 40oz",
    });

    expect(output).toBe("Stanley Quencher H2.0 40oz");
  }, TEST_TIMEOUT);

  it("keeps concrete title in INTL Android context", () => {
    expect(alignIntlAndroidTitleWithSearchQuery).toBeTypeOf("function");

    const output = alignIntlAndroidTitleWithSearchQuery({
      category: "travel",
      locale: "en",
      isMobile: true,
      isAndroid: true,
      title: "Banff Lake Louise",
      searchQuery: "Banff Lake Louise",
    });

    expect(output).toBe("Banff Lake Louise");
  }, TEST_TIMEOUT);
});
