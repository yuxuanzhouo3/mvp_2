import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveCandidateLink } from "./link-resolver";
import {
  getProviderCatalog,
  getWeightedProvidersForCategory,
  type ProviderId,
} from "./provider-catalog";
import type { RecommendationCategory } from "@/lib/types/recommendation";

/**
 * Property-based tests for resolveCandidateLink — INTL Android CandidateLink completeness
 *
 * Feature: intl-android-deep-link-flow, Property 4: INTL Android Provider 的 CandidateLink 完整性
 * **Validates: Requirements 5.1, 5.2**
 */

// ---------------------------------------------------------------------------
// Helpers: collect all INTL mobile providers with androidPackageId
// ---------------------------------------------------------------------------

const categories: RecommendationCategory[] = [
  "entertainment",
  "shopping",
  "food",
  "travel",
  "fitness",
];

/**
 * Build a deduplicated list of INTL mobile provider IDs that have an
 * androidPackageId, across all 5 categories.
 */
function getIntlAndroidProviders(): ProviderId[] {
  const catalog = getProviderCatalog();
  const seen = new Set<ProviderId>();

  for (const category of categories) {
    const weighted = getWeightedProvidersForCategory(category, "INTL", true);
    for (const wp of weighted) {
      const def = catalog[wp.provider];
      if (def && def.androidPackageId && !seen.has(wp.provider)) {
        seen.add(wp.provider);
      }
    }
  }

  return Array.from(seen);
}

const intlAndroidProviders = getIntlAndroidProviders();

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Arbitrary for random query strings (used as search terms) */
const arbQuery = fc.string({
  minLength: 1,
  maxLength: 30,
  unit: fc.constantFrom(
    ..."abcdefghijklmnopqrstuvwxyz0123456789 ".split("")
  ),
});

/** Arbitrary for random title strings */
const arbTitle = fc.string({
  minLength: 1,
  maxLength: 40,
  unit: fc.constantFrom(
    ..."abcdefghijklmnopqrstuvwxyz0123456789 ".split("")
  ),
});

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe("resolveCandidateLink — Property Tests", () => {
  // Feature: intl-android-deep-link-flow, Property 4: INTL Android Provider 的 CandidateLink 完整性

  it("Property 4: INTL Android Provider 的 CandidateLink 完整性 — **Validates: Requirements 5.1, 5.2**", () => {
    fc.assert(
      fc.property(arbQuery, arbTitle, (query, title) => {
        for (const providerId of intlAndroidProviders) {
          for (const category of categories) {
            const candidate = resolveCandidateLink({
              title,
              query,
              category,
              locale: "en",
              region: "INTL",
              provider: providerId,
              isMobile: true,
            });

            // --- Check 1: primary link is non-empty ---
            expect(candidate.primary).toBeDefined();
            expect(candidate.primary.url).toBeTruthy();
            expect(candidate.primary.url.length).toBeGreaterThan(0);

            // --- Check 2: fallbacks contain at least one Google Play intent store link ---
            // The store link should be type "store" with a URL containing
            // "intent://" and "com.android.vending"
            const hasGooglePlayIntentStore = candidate.fallbacks.some(
              (link) =>
                link.type === "store" &&
                link.url.startsWith("intent://") &&
                link.url.includes("com.android.vending")
            );
            expect(hasGooglePlayIntentStore).toBe(true);

            // --- Check 3: fallbacks contain at least one web type link ---
            const hasWebLink = candidate.fallbacks.some(
              (link) => link.type === "web"
            );
            expect(hasWebLink).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
