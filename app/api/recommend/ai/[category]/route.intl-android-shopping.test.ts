import { describe, expect, it } from "vitest";

import { getShoppingPlatformOverride } from "./route-test-helpers";

const TEST_TIMEOUT = 15000;

describe("INTL Android shopping platform mix", () => {
  it("enforces 6-item platform sequence for first six indices", () => {
    expect(getShoppingPlatformOverride).toBeTypeOf("function");

    const expected = [
      "Amazon Shopping",
      "Amazon Shopping",
      "Etsy",
      "Etsy",
      "Slickdeals",
      "Pinterest",
    ];

    const actual = expected.map((_, index) =>
      getShoppingPlatformOverride({
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
  }, TEST_TIMEOUT);

  it("does not force sequence outside INTL Android shopping context", () => {
    expect(
      getShoppingPlatformOverride({
        category: "shopping",
        locale: "en",
        client: "app",
        isMobile: true,
        isAndroid: false,
        index: 0,
        count: 6,
      })
    ).toBeNull();
  }, TEST_TIMEOUT);
});
