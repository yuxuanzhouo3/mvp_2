import { describe, expect, it } from "vitest";
import { resolveCandidateLink } from "./link-resolver";

describe("resolveCandidateLink INTL assistant alias handling", () => {
  it("maps Amazon Shopping to Amazon provider", () => {
    const link = resolveCandidateLink({
      title: "test",
      query: "wireless earbuds",
      category: "shopping",
      locale: "en",
      region: "INTL",
      provider: "Amazon Shopping",
      isMobile: true,
    });

    expect(link.provider).toBe("Amazon");
  });

  it("maps NTC/NRC shortcuts to Nike providers", () => {
    const ntc = resolveCandidateLink({
      title: "test",
      query: "hiit",
      category: "fitness",
      locale: "en",
      region: "INTL",
      provider: "NTC",
      isMobile: true,
    });

    const nrc = resolveCandidateLink({
      title: "test",
      query: "5k training",
      category: "fitness",
      locale: "en",
      region: "INTL",
      provider: "NRC",
      isMobile: true,
    });

    expect(ntc.provider).toBe("Nike Training Club");
    expect(nrc.provider).toBe("Nike Run Club");
  });
});

