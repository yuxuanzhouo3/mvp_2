import { describe, it, expect } from "vitest";
import { getWeightedProvidersForCategory } from "./provider-catalog";
import type { WeightedProvider } from "./provider-catalog";
import type { RecommendationCategory } from "@/lib/types/recommendation";

/**
 * Unit tests for INTL WeightedProvider configuration.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

const INTL_CATEGORIES: RecommendationCategory[] = [
  "entertainment",
  "shopping",
  "food",
  "travel",
  "fitness",
];

function getProviderNames(providers: WeightedProvider[]): string[] {
  return providers.map((p) => p.provider);
}

function sumWeights(providers: WeightedProvider[]): number {
  return providers.reduce((sum, p) => sum + p.weight, 0);
}

describe("getWeightedProvidersForCategory — INTL WeightedProvider configuration", () => {
  describe("entertainment (Requirement 9.1)", () => {
    const providers = getWeightedProvidersForCategory("entertainment", "INTL");

    it("should include YouTube, IMDb, Spotify, Metacritic, and Steam", () => {
      const names = getProviderNames(providers);
      expect(names).toContain("YouTube");
      expect(names).toContain("IMDb");
      expect(names).toContain("Spotify");
      expect(names).toContain("Metacritic");
      expect(names).toContain("Steam");
    });

    it("should not include TripAdvisor or Google Maps", () => {
      const names = getProviderNames(providers);
      expect(names).not.toContain("TripAdvisor");
      expect(names).not.toContain("Google Maps");
    });

    it("should have weights summing to approximately 1.0", () => {
      expect(sumWeights(providers)).toBeCloseTo(1.0, 2);
    });

    it("should include INTL mobile entertainment app set", () => {
      const mobileProviders = getWeightedProvidersForCategory("entertainment", "INTL", true);
      const names = getProviderNames(mobileProviders);
      expect(names).toContain("YouTube");
      expect(names).toContain("TikTok");
      expect(names).toContain("JustWatch");
      expect(names).toContain("Spotify");
      expect(names).toContain("Medium");
      expect(names).toContain("MiniReview");
    });
  });

  describe("shopping (Requirement 9.2)", () => {
    const providers = getWeightedProvidersForCategory("shopping", "INTL");

    it("should include Amazon, eBay, Walmart, and Google Maps", () => {
      const names = getProviderNames(providers);
      expect(names).toContain("Amazon");
      expect(names).toContain("eBay");
      expect(names).toContain("Walmart");
      expect(names).toContain("Google Maps");
    });

    it("should have weights summing to approximately 1.0", () => {
      expect(sumWeights(providers)).toBeCloseTo(1.0, 2);
    });

    it("should use INTL mobile shopping app set only", () => {
      const mobileProviders = getWeightedProvidersForCategory("shopping", "INTL", true);
      const names = getProviderNames(mobileProviders);
      expect(names).toContain("Amazon");
      expect(names).toContain("Etsy");
      expect(names).toContain("Slickdeals");
      expect(names).toContain("Pinterest");
      expect(names).not.toContain("Google");
      expect(names).not.toContain("Google Maps");
    });
  });

  describe("food (Requirement 9.3)", () => {
    const providers = getWeightedProvidersForCategory("food", "INTL");

    it("should include Uber Eats, Yelp, Google Maps, and Love and Lemons", () => {
      const names = getProviderNames(providers);
      expect(names).toContain("Uber Eats");
      expect(names).toContain("Yelp");
      expect(names).toContain("Google Maps");
      expect(names).toContain("Love and Lemons");
    });

    it("should have weights summing to approximately 1.0", () => {
      expect(sumWeights(providers)).toBeCloseTo(1.0, 2);
    });
  });

  describe("travel (Requirement 9.4)", () => {
    const providers = getWeightedProvidersForCategory("travel", "INTL");

    it("should include Booking.com, TripAdvisor, YouTube, and Google Maps", () => {
      const names = getProviderNames(providers);
      expect(names).toContain("Booking.com");
      expect(names).toContain("TripAdvisor");
      expect(names).toContain("YouTube");
      expect(names).toContain("Google Maps");
    });

    it("should have weights summing to approximately 1.0", () => {
      expect(sumWeights(providers)).toBeCloseTo(1.0, 2);
    });
  });

  describe("fitness (Requirement 9.5)", () => {
    const providers = getWeightedProvidersForCategory("fitness", "INTL");

    it("should include YouTube Fitness, Muscle & Strength, and Google Maps", () => {
      const names = getProviderNames(providers);
      expect(names).toContain("YouTube Fitness");
      expect(names).toContain("Muscle & Strength");
      expect(names).toContain("Google Maps");
    });

    it("should not include TripAdvisor", () => {
      const names = getProviderNames(providers);
      expect(names).not.toContain("TripAdvisor");
    });

    it("should have weights summing to approximately 1.0", () => {
      expect(sumWeights(providers)).toBeCloseTo(1.0, 2);
    });
  });

  describe("all INTL categories", () => {
    it("should return non-empty arrays for all categories", () => {
      for (const category of INTL_CATEGORIES) {
        const providers = getWeightedProvidersForCategory(category, "INTL");
        expect(providers.length).toBeGreaterThan(0);
      }
    });

    it("should have all weights between 0 and 1 (exclusive)", () => {
      for (const category of INTL_CATEGORIES) {
        const providers = getWeightedProvidersForCategory(category, "INTL");
        for (const p of providers) {
          expect(p.weight).toBeGreaterThan(0);
          expect(p.weight).toBeLessThanOrEqual(1);
        }
      }
    });

    it("should have valid tier values for all providers", () => {
      for (const category of INTL_CATEGORIES) {
        const providers = getWeightedProvidersForCategory(category, "INTL");
        for (const p of providers) {
          expect(["mainstream", "longtail"]).toContain(p.tier);
        }
      }
    });
  });
});
