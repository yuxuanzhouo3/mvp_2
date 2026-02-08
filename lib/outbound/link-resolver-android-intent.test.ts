import { describe, expect, it } from "vitest";
import { resolveCandidateLink } from "./link-resolver";

describe("resolveCandidateLink android intent fallback", () => {
  it("adds android intent deep link when provider has package but no android scheme", () => {
    const result = resolveCandidateLink({
      title: "Steam Test",
      query: "indie game",
      category: "entertainment",
      locale: "en",
      region: "INTL",
      provider: "Steam",
      isMobile: true,
    });

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=com.valvesoftware.android.steam.community")
    );

    expect(androidIntent).toBeTruthy();
  });
});

