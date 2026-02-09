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

  it("adds android intent fallback for Medium via package id", () => {
    const result = resolveCandidateLink({
      title: "Medium Test",
      query: "react",
      category: "entertainment",
      locale: "en",
      region: "INTL",
      provider: "Medium",
      isMobile: true,
    });

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=com.medium.reader")
    );

    expect(androidIntent).toBeTruthy();
  });

  it("uses TikTok package-only android intent", () => {
    const result = resolveCandidateLink({
      title: "TikTok Test",
      query: "funny cat",
      category: "entertainment",
      locale: "en",
      region: "INTL",
      provider: "TikTok",
      isMobile: true,
    });

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=com.zhiliaoapp.musically")
    );

    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).not.toContain("scheme=snssdk1128");
  });
});
