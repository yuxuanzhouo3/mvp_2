import { describe, it, expect } from "vitest";

const routePath = "./route";

describe("INTL Android food platform mix", () => {
  it("enforces 6-item platform sequence for first six indices", async () => {
    const mod = (await import(routePath)) as any;
    const getter = mod.getFoodPlatformOverride as
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
      "DoorDash",
      "DoorDash",
      "Uber Eats",
      "Uber Eats",
      "Fantuan Delivery",
      "HungryPanda",
    ];

    const actual = expected.map((_, index) =>
      getter!({
        category: "food",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        index,
        count: 6,
      })
    );

    expect(actual).toEqual(expected);
  });

  it("raises recommendation target count to 6 in INTL Android food context", async () => {
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
        category: "food",
        locale: "en",
        isMobile: true,
        isAndroid: true,
        requestedCount: 5,
      })
    ).toBe(6);
  });

  it("does not force sequence outside INTL Android food context", async () => {
    const mod = (await import(routePath)) as any;
    const getter = mod.getFoodPlatformOverride as
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
        category: "food",
        locale: "en",
        isMobile: true,
        isAndroid: false,
        index: 0,
        count: 6,
      })
    ).toBeNull();
  });

  it("sanitizes scenario-style food recommendation to concrete dish", async () => {
    const mod = (await import(routePath)) as any;
    const sanitize = mod.sanitizeIntlAndroidFoodRecommendation as
      | ((params: {
          title?: string | null;
          query?: string | null;
          tags?: string[] | null;
          platform?: string | null;
          index: number;
        }) => {
          title: string;
          searchQuery: string;
          tags: string[];
          platform: string;
          cuisine: string;
          priceRange: "$" | "$$" | "$$$";
        })
      | undefined;

    expect(typeof sanitize).toBe("function");

    const output = sanitize!({
      title: "家庭聚餐",
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
  });
});
