import { describe, expect, it } from "vitest";
import { getProviderCatalog } from "./provider-catalog";

describe("provider-catalog intl mobile travel deep links", () => {
  it("TripAdvisor includes query-aware Android intent", () => {
    const catalog = getProviderCatalog();
    const provider = catalog["TripAdvisor"];
    const query = "paris itinerary";

    const android = provider.androidScheme?.({
      title: "test",
      query,
      category: "travel",
      locale: "en",
      region: "INTL",
    });

    expect(android).toContain("package=com.tripadvisor.tripadvisor");
    expect(android).toContain("intent://Search?q=");
    expect(android).toContain("paris%20itinerary");
  });

  it("Yelp includes query-aware Android intent", () => {
    const catalog = getProviderCatalog();
    const provider = catalog["Yelp"];
    const query = "best brunch in boston";

    const android = provider.androidScheme?.({
      title: "test",
      query,
      category: "travel",
      locale: "en",
      region: "INTL",
    });

    expect(android).toContain("package=com.yelp.android");
    expect(android).toContain("intent://search?find_desc=");
    expect(android).toContain("best%20brunch%20in%20boston");
  });

  it("Wanderlog includes query-aware Android intent", () => {
    const catalog = getProviderCatalog();
    const provider = catalog["Wanderlog"];
    const query = "tokyo 3 day plan";

    const android = provider.androidScheme?.({
      title: "test",
      query,
      category: "travel",
      locale: "en",
      region: "INTL",
    });

    expect(android).toContain("package=com.wanderlog.android");
    expect(android).toContain("intent://search?q=");
    expect(android).toContain("tokyo%203%20day%20plan");
  });

  it("Visit A City includes query-aware Android intent", () => {
    const catalog = getProviderCatalog();
    const provider = catalog["Visit A City"];
    const query = "rome one day itinerary";

    const android = provider.androidScheme?.({
      title: "test",
      query,
      category: "travel",
      locale: "en",
      region: "INTL",
    });

    expect(provider.hasApp).toBe(true);
    expect(provider.androidPackageId).toBe("com.visitacity.visitacityapp");
    expect(android).toContain("package=com.visitacity.visitacityapp");
    expect(android).toContain("S.browser_fallback_url=");
    expect(android).toContain("visitacity.com%2Fen%2Fsearch%3Fq%3D");
    expect(android).toContain("rome%20one%20day%20itinerary");
  });

  it("GetYourGuide includes query-aware Android intent", () => {
    const catalog = getProviderCatalog();
    const provider = catalog["GetYourGuide"];
    const query = "london day tours";

    const android = provider.androidScheme?.({
      title: "test",
      query,
      category: "travel",
      locale: "en",
      region: "INTL",
    });

    expect(android).toContain("package=com.getyourguide.android");
    expect(android).toContain("intent://s/?q=");
    expect(android).toContain("london%20day%20tours");
  });

  it("Google Maps includes query-aware Android intent", () => {
    const catalog = getProviderCatalog();
    const provider = catalog["Google Maps"];
    const query = "things to do in seattle";

    const android = provider.androidScheme?.({
      title: "test",
      query,
      category: "travel",
      locale: "en",
      region: "INTL",
    });

    expect(android).toContain("package=com.google.android.apps.maps");
    expect(android).toContain("intent://maps?q=");
    expect(android).toContain("things%20to%20do%20in%20seattle");
  });
});
