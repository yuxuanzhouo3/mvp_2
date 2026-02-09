import { describe, expect, it } from "vitest";
import { getProviderCatalog } from "./provider-catalog";

describe("provider-catalog intl mobile food deep links", () => {
  it("Fantuan Delivery includes query-aware links", () => {
    const catalog = getProviderCatalog();
    const provider = catalog["Fantuan Delivery"];
    const query = "sichuan noodles";

    const web = provider.webLink({
      title: "test",
      query,
      category: "food",
      locale: "en",
      region: "INTL",
    });
    const ios = provider.iosScheme?.({
      title: "test",
      query,
      category: "food",
      locale: "en",
      region: "INTL",
    });
    const android = provider.androidScheme?.({
      title: "test",
      query,
      category: "food",
      locale: "en",
      region: "INTL",
    });

    expect(web).toContain("keyword=");
    expect(web).toContain("sichuan%20noodles");
    expect(ios).toContain("search?keyword=");
    expect(ios).toContain("sichuan%20noodles");
    expect(android).toContain("intent://search?keyword=");
    expect(android).toContain("sichuan%20noodles");
  });

  it("HungryPanda includes query-aware links", () => {
    const catalog = getProviderCatalog();
    const provider = catalog["HungryPanda"];
    const query = "xiao long bao";

    const web = provider.webLink({
      title: "test",
      query,
      category: "food",
      locale: "en",
      region: "INTL",
    });
    const ios = provider.iosScheme?.({
      title: "test",
      query,
      category: "food",
      locale: "en",
      region: "INTL",
    });
    const android = provider.androidScheme?.({
      title: "test",
      query,
      category: "food",
      locale: "en",
      region: "INTL",
    });

    expect(web).toContain("keyword=");
    expect(web).toContain("xiao%20long%20bao");
    expect(ios).toContain("search?keyword=");
    expect(ios).toContain("xiao%20long%20bao");
    expect(android).toContain("intent://search?keyword=");
    expect(android).toContain("xiao%20long%20bao");
  });
});

