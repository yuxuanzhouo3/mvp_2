import { describe, it, expect } from "vitest";
import {
  resolveCandidateLink,
  type ResolveCandidateLinkInput,
} from "./link-resolver";
import type { RecommendationCategory } from "@/lib/types/recommendation";

/**
 * Unit tests for INTL fallback provider chains in getFallbackProviders.
 * Validates: Requirements 1.5, 2.3, 3.5, 4.4, 5.4
 *
 * Since getFallbackProviders is not exported, we test it indirectly through
 * resolveCandidateLink by checking that fallback links contain the expected
 * platform labels for each INTL category.
 *
 * Note: When no provider is specified, the default primary provider for INTL
 * is "Google", which gets excluded from fallbacks (since it's the primary).
 * We use a specific non-Google provider to ensure all fallback entries appear.
 * Also, display names may differ from ProviderId (e.g. "YouTube Fitness" displays as "YouTube").
 */

function makeInput(
  category: RecommendationCategory,
  provider: string
): ResolveCandidateLinkInput {
  return {
    title: "Test Item",
    query: "test query",
    category,
    locale: "en",
    region: "INTL",
    provider,
  };
}

function getFallbackLabels(category: RecommendationCategory, provider: string): string[] {
  const result = resolveCandidateLink(makeInput(category, provider));
  return result.fallbacks
    .filter((f) => ["search", "map", "video", "web", "app"].includes(f.type))
    .map((f) => f.label!)
    .filter(Boolean);
}

describe("INTL fallback provider chains", () => {
  describe("food (Requirement 3.5)", () => {
    // Use "Uber Eats" as primary so the rest of the chain is visible
    it("should include Google Maps, Yelp, Love and Lemons, YouTube, and Google as fallback platforms", () => {
      const labels = getFallbackLabels("food", "Uber Eats");
      expect(labels).toContain("Google Maps");
      expect(labels).toContain("Yelp");
      expect(labels).toContain("Love and Lemons");
      expect(labels).toContain("YouTube");
      expect(labels).toContain("Google");
    });

    it("should include Uber Eats when a different provider is primary", () => {
      const labels = getFallbackLabels("food", "Google");
      expect(labels).toContain("Uber Eats");
    });
  });

  describe("shopping (Requirement 2.3)", () => {
    it("should include eBay, Walmart, Google Maps, and Google as fallback platforms", () => {
      const labels = getFallbackLabels("shopping", "Amazon");
      expect(labels).toContain("eBay");
      expect(labels).toContain("Walmart");
      expect(labels).toContain("Google Maps");
      expect(labels).toContain("Google");
    });

    it("should include Amazon when a different provider is primary", () => {
      const labels = getFallbackLabels("shopping", "Google");
      expect(labels).toContain("Amazon");
    });
  });

  describe("entertainment (Requirement 1.5)", () => {
    it("should include IMDb, Spotify, Metacritic, Steam, and Google as fallback platforms", () => {
      const labels = getFallbackLabels("entertainment", "YouTube");
      expect(labels).toContain("IMDb");
      expect(labels).toContain("Spotify");
      expect(labels).toContain("Metacritic");
      expect(labels).toContain("Steam");
      expect(labels).toContain("Google");
    });

    it("should include YouTube when a different provider is primary", () => {
      const labels = getFallbackLabels("entertainment", "Google");
      expect(labels).toContain("YouTube");
    });
  });

  describe("travel (Requirement 4.4)", () => {
    it("should include TripAdvisor, YouTube, Google Maps, SANParks, and Google as fallback platforms", () => {
      const labels = getFallbackLabels("travel", "Booking.com");
      expect(labels).toContain("TripAdvisor");
      expect(labels).toContain("YouTube");
      expect(labels).toContain("Google Maps");
      expect(labels).toContain("SANParks");
      expect(labels).toContain("Google");
    });

    it("should include Booking.com when a different provider is primary", () => {
      const labels = getFallbackLabels("travel", "Google");
      expect(labels).toContain("Booking.com");
    });
  });

  describe("fitness (Requirement 5.4)", () => {
    // "YouTube Fitness" has displayName "YouTube", so we check for "YouTube" label
    it("should include YouTube (from YouTube Fitness), Muscle & Strength, and Google as fallback platforms", () => {
      const labels = getFallbackLabels("fitness", "Google Maps");
      expect(labels).toContain("YouTube");
      expect(labels).toContain("Muscle & Strength");
      expect(labels).toContain("Google");
    });

    it("should include Google Maps when a different provider is primary", () => {
      const labels = getFallbackLabels("fitness", "Google");
      expect(labels).toContain("Google Maps");
    });
  });
});
