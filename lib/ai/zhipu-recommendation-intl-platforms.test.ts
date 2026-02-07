import { describe, it, expect } from "vitest";
import { getIntlCategoryPlatforms } from "./zhipu-recommendation";

/**
 * Unit tests for INTL categoryConfig platform lists.
 * Validates: Requirements 1.3, 2.1, 3.3, 4.2, 5.2
 */
describe("getIntlCategoryPlatforms — INTL categoryConfig platform lists", () => {
  describe("entertainment (Requirement 1.3)", () => {
    const platforms = getIntlCategoryPlatforms("entertainment");

    it("should include Metacritic, Steam, YouTube, Spotify, and IMDb", () => {
      expect(platforms).toContain("Metacritic");
      expect(platforms).toContain("Steam");
      expect(platforms).toContain("YouTube");
      expect(platforms).toContain("Spotify");
      expect(platforms).toContain("IMDb");
    });

    it("should also include Netflix and Rotten Tomatoes", () => {
      expect(platforms).toContain("Netflix");
      expect(platforms).toContain("Rotten Tomatoes");
    });

    it("should have exactly 7 platforms", () => {
      expect(platforms).toHaveLength(7);
    });
  });

  describe("shopping (Requirement 2.1)", () => {
    const platforms = getIntlCategoryPlatforms("shopping");

    it("should include eBay, Amazon, Walmart, and Google Maps", () => {
      expect(platforms).toContain("eBay");
      expect(platforms).toContain("Amazon");
      expect(platforms).toContain("Walmart");
      expect(platforms).toContain("Google Maps");
    });

    it("should have exactly 4 platforms", () => {
      expect(platforms).toHaveLength(4);
    });
  });

  describe("food (Requirement 3.3)", () => {
    const platforms = getIntlCategoryPlatforms("food");

    it("should include Uber Eats, Love and Lemons, Google Maps, and Yelp", () => {
      expect(platforms).toContain("Uber Eats");
      expect(platforms).toContain("Love and Lemons");
      expect(platforms).toContain("Google Maps");
      expect(platforms).toContain("Yelp");
    });

    it("should have exactly 4 platforms", () => {
      expect(platforms).toHaveLength(4);
    });
  });

  describe("travel (Requirement 4.2)", () => {
    const platforms = getIntlCategoryPlatforms("travel");

    it("should include Booking.com, TripAdvisor, SANParks, and YouTube", () => {
      expect(platforms).toContain("Booking.com");
      expect(platforms).toContain("TripAdvisor");
      expect(platforms).toContain("SANParks");
      expect(platforms).toContain("YouTube");
    });

    it("should have exactly 4 platforms", () => {
      expect(platforms).toHaveLength(4);
    });
  });

  describe("fitness (Requirement 5.2)", () => {
    const platforms = getIntlCategoryPlatforms("fitness");

    it("should include YouTube Fitness, Muscle & Strength, and Google Maps", () => {
      expect(platforms).toContain("YouTube Fitness");
      expect(platforms).toContain("Muscle & Strength");
      expect(platforms).toContain("Google Maps");
    });

    it("should have exactly 3 platforms", () => {
      expect(platforms).toHaveLength(3);
    });
  });

  describe("unknown category", () => {
    it("should return an empty array for unknown categories", () => {
      expect(getIntlCategoryPlatforms("unknown")).toEqual([]);
    });
  });
});
