import { describe, expect, it } from "vitest";
import { resolveCandidateLink } from "./link-resolver";
import { getAutoTryLinks, sanitizeAutoTryLinksForIntlAndroid } from "./deep-link-helpers";
import { getWeightedProvidersForCategory } from "./provider-catalog";
import type { RecommendationCategory } from "@/lib/types/recommendation";

describe("INTL Android mobile deep-link coverage across five categories", () => {
  const categories: RecommendationCategory[] = [
    "entertainment",
    "shopping",
    "food",
    "travel",
    "fitness",
  ];

  it("ensures every mobile provider deep-link carries query and Play fallback", () => {
    const query = "golden gate bridge";
    const encodedQuery = encodeURIComponent(query);

    for (const category of categories) {
      const providers = [
        ...new Set(getWeightedProvidersForCategory(category, "INTL", true).map((item) => item.provider)),
      ];

      for (const provider of providers) {
        const candidate = resolveCandidateLink({
          title: `Test ${provider}`,
          query,
          category,
          locale: "en",
          region: "INTL",
          provider,
          isMobile: true,
        });

        const autoTryLinks = sanitizeAutoTryLinksForIntlAndroid(
          getAutoTryLinks(candidate, "android")
        );

        const deepLinks = autoTryLinks.filter(
          (link) => link.type === "app" || link.type === "intent" || link.type === "universal_link"
        );
        expect(deepLinks.length).toBeGreaterThan(0);

        const hasQueryInDeepLink = deepLinks.some(
          (link) => link.url.includes(encodedQuery) || link.url.includes(query)
        );
        expect(hasQueryInDeepLink).toBe(true);

        const hasGooglePlayStore = candidate.fallbacks.some(
          (link) =>
            link.type === "store" &&
            ((link.url.startsWith("intent://") && link.url.includes("com.android.vending")) ||
              link.url.includes("play.google.com") ||
              link.url.startsWith("market://details?id="))
        );
        expect(hasGooglePlayStore).toBe(true);

        const hasWebFallback = candidate.fallbacks.some((link) => link.type === "web");
        expect(hasWebFallback).toBe(true);
      }
    }
  });
});

