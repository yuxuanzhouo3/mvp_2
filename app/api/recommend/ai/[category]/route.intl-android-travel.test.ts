import { describe, it, expect } from "vitest";

const routePath = "./route";

describe("INTL Android travel platform mix", () => {
  it("enforces 6-item platform sequence for first six indices", async () => {
    const mod = (await import(routePath)) as any;
    const getter = mod.getTravelPlatformOverride as
      | ((params: {
          category: string;
          locale: "zh" | "en";
          isMobile?: boolean;
          isAndroid?: boolean;
          index: number;
          count: number;
        }) => string | null)
      | undefined;

    expect(typeof getter).toBe("function");

    const expected = [
      "TripAdvisor",
      "Yelp",
      "Wanderlog",
      "Visit A City",
      "GetYourGuide",
      "Google Maps",
    ];

    const actual = expected.map((_, index) =>
      getter!({
        category: "travel",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        index,
        count: 6,
      })
    );

    expect(actual).toEqual(expected);
  });

  it("raises recommendation target count to 6 in INTL Android travel context", async () => {
    const mod = (await import(routePath)) as any;
    const targetCount = mod.getRecommendationTargetCount as
      | ((params: {
          category: string;
          locale: "zh" | "en";
          isMobile?: boolean;
          isAndroid?: boolean;
          requestedCount: number;
        }) => number)
      | undefined;

    expect(typeof targetCount).toBe("function");

    expect(
      targetCount!({
        category: "travel",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        requestedCount: 5,
      })
    ).toBe(6);
  });

  it("does not force sequence outside INTL Android travel context", async () => {
    const mod = (await import(routePath)) as any;
    const getter = mod.getTravelPlatformOverride as
      | ((params: {
          category: string;
          locale: "zh" | "en";
          isMobile?: boolean;
          isAndroid?: boolean;
          index: number;
          count: number;
        }) => string | null)
      | undefined;

    expect(
      getter!({
        category: "travel",
        locale: "en",
        isMobile: true,
        isAndroid: false,
        index: 0,
        count: 6,
      })
    ).toBeNull();
  });
});

