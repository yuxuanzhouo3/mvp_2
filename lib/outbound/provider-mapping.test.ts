import { describe, it, expect } from "vitest";
import { mapSearchPlatformToProvider } from "./provider-mapping";

/**
 * Unit tests for INTL provider mapping in mapSearchPlatformToProvider.
 * Validates: Requirements 10.2, 10.3
 */
describe("mapSearchPlatformToProvider — INTL mappings", () => {
  it('should map "Love and Lemons" to "Love and Lemons" (Requirement 10.2)', () => {
    expect(mapSearchPlatformToProvider("Love and Lemons", "en")).toBe(
      "Love and Lemons"
    );
  });

  it('should map "SANParks" to "SANParks" (Requirement 10.3)', () => {
    expect(mapSearchPlatformToProvider("SANParks", "en")).toBe("SANParks");
  });

  it('should map "YouTube Fitness" to "YouTube Fitness"', () => {
    expect(mapSearchPlatformToProvider("YouTube Fitness", "en")).toBe(
      "YouTube Fitness"
    );
  });

  it('should map "TripAdvisor Travel" to "TripAdvisor"', () => {
    expect(mapSearchPlatformToProvider("TripAdvisor Travel", "en")).toBe(
      "TripAdvisor"
    );
  });

  it("should return the platform name unchanged when no mapping exists", () => {
    expect(mapSearchPlatformToProvider("YouTube", "en")).toBe("YouTube");
    expect(mapSearchPlatformToProvider("Google", "en")).toBe("Google");
  });

  it("should not apply INTL mappings when locale is zh", () => {
    // "Love and Lemons" is not in cnMap, so it should pass through unchanged
    expect(mapSearchPlatformToProvider("Love and Lemons", "zh")).toBe(
      "Love and Lemons"
    );
  });
});
