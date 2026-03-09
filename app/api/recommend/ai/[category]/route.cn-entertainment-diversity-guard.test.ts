import { describe, expect, it } from "vitest";

import { shouldEnsureCnEntertainmentTypes } from "./route-test-helpers";

const TEST_TIMEOUT = 15000;

describe("CN entertainment diversity guard", () => {
  it("enables guard for both web and app in CN zh entertainment context", () => {
    expect(shouldEnsureCnEntertainmentTypes).toBeTypeOf("function");
    expect(
      shouldEnsureCnEntertainmentTypes({
        category: "entertainment",
        locale: "zh",
        client: "web",
        isChinaDeploymentEnabled: true,
      })
    ).toBe(true);
    expect(
      shouldEnsureCnEntertainmentTypes({
        category: "entertainment",
        locale: "zh",
        client: "app",
        isChinaDeploymentEnabled: true,
      })
    ).toBe(true);
  }, TEST_TIMEOUT);

  it("disables guard outside CN zh entertainment context", () => {
    expect(shouldEnsureCnEntertainmentTypes).toBeTypeOf("function");
    expect(
      shouldEnsureCnEntertainmentTypes({
        category: "entertainment",
        locale: "en",
        client: "app",
        isChinaDeploymentEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldEnsureCnEntertainmentTypes({
        category: "shopping",
        locale: "zh",
        client: "app",
        isChinaDeploymentEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldEnsureCnEntertainmentTypes({
        category: "entertainment",
        locale: "zh",
        client: "app",
        isChinaDeploymentEnabled: false,
      })
    ).toBe(false);
  }, TEST_TIMEOUT);
});
