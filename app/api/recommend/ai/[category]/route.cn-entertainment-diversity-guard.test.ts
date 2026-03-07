import { describe, expect, it } from "vitest";

const routePath = "./route";

describe("CN entertainment diversity guard", () => {
  it("enables guard for both web and app in CN zh entertainment context", async () => {
    const mod = (await import(routePath)) as any;
    const guard = mod.shouldEnsureCnEntertainmentTypes as
      | ((params: {
          category: "entertainment" | "shopping" | "food" | "travel" | "fitness";
          locale: "zh" | "en";
          client: "app" | "web";
          isChinaDeploymentEnabled: boolean;
        }) => boolean)
      | undefined;

    expect(guard).toBeTypeOf("function");
    expect(
      guard!({
        category: "entertainment",
        locale: "zh",
        client: "web",
        isChinaDeploymentEnabled: true,
      })
    ).toBe(true);
    expect(
      guard!({
        category: "entertainment",
        locale: "zh",
        client: "app",
        isChinaDeploymentEnabled: true,
      })
    ).toBe(true);
  });

  it("disables guard outside CN zh entertainment context", async () => {
    const mod = (await import(routePath)) as any;
    const guard = mod.shouldEnsureCnEntertainmentTypes as
      | ((params: {
          category: "entertainment" | "shopping" | "food" | "travel" | "fitness";
          locale: "zh" | "en";
          client: "app" | "web";
          isChinaDeploymentEnabled: boolean;
        }) => boolean)
      | undefined;

    expect(guard).toBeTypeOf("function");
    expect(
      guard!({
        category: "entertainment",
        locale: "en",
        client: "app",
        isChinaDeploymentEnabled: true,
      })
    ).toBe(false);
    expect(
      guard!({
        category: "shopping",
        locale: "zh",
        client: "app",
        isChinaDeploymentEnabled: true,
      })
    ).toBe(false);
    expect(
      guard!({
        category: "entertainment",
        locale: "zh",
        client: "app",
        isChinaDeploymentEnabled: false,
      })
    ).toBe(false);
  });
});

