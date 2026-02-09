import { describe, it, expect } from "vitest";

const routePath = "./route";

describe("INTL Android shopping platform mix", () => {
  it("enforces 6-item platform sequence for first six indices", async () => {
    const mod = (await import(routePath)) as any;
    const getter = mod.getShoppingPlatformOverride as
      | ((params: {
          category: string;
          locale: "zh" | "en";
          client: "app" | "web";
          isMobile?: boolean;
          isAndroid?: boolean;
          index: number;
          count: number;
        }) => string | null)
      | undefined;

    expect(typeof getter).toBe("function");

    const expected = [
      "Amazon Shopping",
      "Amazon Shopping",
      "Etsy",
      "Etsy",
      "Slickdeals",
      "Pinterest",
    ];

    const actual = expected.map((_, index) =>
      getter!({
        category: "shopping",
        locale: "en",
        client: "app",
        isMobile: true,
        isAndroid: true,
        index,
        count: 6,
      })
    );

    expect(actual).toEqual(expected);
  });

  it("does not force sequence outside INTL Android shopping context", async () => {
    const mod = (await import(routePath)) as any;
    const getter = mod.getShoppingPlatformOverride as
      | ((params: {
          category: string;
          locale: "zh" | "en";
          client: "app" | "web";
          isMobile?: boolean;
          isAndroid?: boolean;
          index: number;
          count: number;
        }) => string | null)
      | undefined;

    expect(
      getter!({
        category: "shopping",
        locale: "en",
        client: "app",
        isMobile: true,
        isAndroid: false,
        index: 0,
        count: 6,
      })
    ).toBeNull();
  });
});

