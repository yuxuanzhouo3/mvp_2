import { describe, it, expect } from "vitest";

const routePath = "./route";

describe("INTL Android fitness platform mix", () => {
  it("enforces 8-item platform sequence for first eight indices", async () => {
    const mod = (await import(routePath)) as any;
    const getter = mod.getFitnessPlatformOverride as
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
      getter!({
        category: "fitness",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        index,
        count: 8,
      })
    );

    expect(actual).toEqual(expected);
  });

  it("raises recommendation target count to 8 in INTL Android fitness context", async () => {
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
        category: "fitness",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        requestedCount: 5,
      })
    ).toBe(8);
  });

  it("does not force sequence outside INTL Android fitness context", async () => {
    const mod = (await import(routePath)) as any;
    const getter = mod.getFitnessPlatformOverride as
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
        category: "fitness",
        locale: "en",
        isMobile: true,
        isAndroid: false,
        index: 0,
        count: 8,
      })
    ).toBeNull();
  });
});

