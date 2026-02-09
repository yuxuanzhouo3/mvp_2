import { describe, it, expect } from "vitest";

const routePath = "./route";

describe("INTL Android concrete query enforcement", () => {
  it("replaces generic entertainment query with concrete single item", async () => {
    const mod = (await import(routePath)) as any;
    const enforce = mod.enforceConcreteIntlAndroidSearchQuery as
      | ((params: {
          category: "entertainment" | "shopping" | "food" | "travel" | "fitness";
          platform: string;
          title?: string | null;
          query?: string | null;
        }) => string)
      | undefined;

    expect(typeof enforce).toBe("function");

    const result = enforce!({
      category: "entertainment",
      platform: "TikTok",
      title: "TikTok Trends",
      query: "top songs playlist",
    });

    expect(result).toBe("BookTok Fourth Wing edits");
  });

  it("replaces generic query in all five INTL Android categories", async () => {
    const mod = (await import(routePath)) as any;
    const enforce = mod.enforceConcreteIntlAndroidSearchQuery as
      | ((params: {
          category: "entertainment" | "shopping" | "food" | "travel" | "fitness";
          platform: string;
          title?: string | null;
          query?: string | null;
        }) => string)
      | undefined;

    expect(enforce).toBeTypeOf("function");

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

    for (const c of cases) {
      const output = enforce!({
        category: c.category,
        platform: c.platform,
        query: c.query,
      });
      expect(output).toBe(c.expected);
    }
  });

  it("keeps already concrete queries", async () => {
    const mod = (await import(routePath)) as any;
    const enforce = mod.enforceConcreteIntlAndroidSearchQuery as
      | ((params: {
          category: "entertainment" | "shopping" | "food" | "travel" | "fitness";
          platform: string;
          title?: string | null;
          query?: string | null;
        }) => string)
      | undefined;

    expect(enforce).toBeTypeOf("function");

    const output = enforce!({
      category: "travel",
      platform: "TripAdvisor",
      query: "Banff Lake Louise",
    });

    expect(output).toBe("Banff Lake Louise");
  });
});
