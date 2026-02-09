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

  it("uses https intent deep link for YouTube", () => {
    const result = resolveCandidateLink({
      title: "YouTube Test",
      query: "travel vlogs",
      category: "entertainment",
      locale: "en",
      region: "INTL",
      provider: "YouTube",
      isMobile: true,
    });

    const androidIntent = result.fallbacks.find(
      (link) => link.type === "intent" && link.url.includes("package=com.google.android.youtube")
    );

    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain("scheme=https");
    expect(androidIntent?.url).toContain("www.youtube.com/results");
  });

  it("uses https intent deep link for JustWatch", () => {
    const result = resolveCandidateLink({
      title: "JustWatch Test",
      query: "inception",
      category: "entertainment",
      locale: "en",
      region: "INTL",
      provider: "JustWatch",
      isMobile: true,
    });

    const androidIntent = result.fallbacks.find(
      (link) => link.type === "intent" && link.url.includes("package=com.justwatch.justwatch")
    );

    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain("scheme=https");
    expect(androidIntent?.url).toContain("www.justwatch.com/us/search");
  });

  it("supports MiniReview android deep link", () => {
    const result = resolveCandidateLink({
      title: "MiniReview Test",
      query: "indie roguelike",
      category: "entertainment",
      locale: "en",
      region: "INTL",
      provider: "MiniReview",
      isMobile: true,
    });

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=minireview.best.android.games.reviews")
    );

    expect(androidIntent).toBeTruthy();
  });

  it("supports Fantuan Delivery android deep link with search query", () => {
    const result = resolveCandidateLink({
      title: "Fantuan Test",
      query: "mapo tofu",
      category: "food",
      locale: "en",
      region: "INTL",
      provider: "Fantuan Delivery",
      isMobile: true,
    });

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=com.AmazingTech.FanTuanDelivery")
    );

    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain("intent://search?keyword=");
    expect(androidIntent?.url).toContain("mapo%20tofu");
  });

  it("supports HungryPanda android deep link with search query", () => {
    const result = resolveCandidateLink({
      title: "HungryPanda Test",
      query: "beef noodle soup",
      category: "food",
      locale: "en",
      region: "INTL",
      provider: "HungryPanda",
      isMobile: true,
    });

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=com.nicetomeetyou.hungrypanda")
    );

    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain("intent://search?keyword=");
    expect(androidIntent?.url).toContain("beef%20noodle%20soup");
  });

  it("supports fitness apps android deep links with search query", () => {
    const fixtures = [
      { provider: "Nike Training Club", packageId: "com.nike.ntc" },
      { provider: "Peloton", packageId: "com.onepeloton.callisto" },
      { provider: "Strava", packageId: "com.strava" },
      { provider: "Nike Run Club", packageId: "com.nike.plusgps" },
      { provider: "Hevy", packageId: "com.hevy.tracker" },
      { provider: "Strong", packageId: "io.strongapp.strong" },
      { provider: "Down Dog", packageId: "com.downdogapp" },
      { provider: "MyFitnessPal", packageId: "com.myfitnesspal.android" },
    ] as const;

    for (const fixture of fixtures) {
      const query = "full body workout";
      const result = resolveCandidateLink({
        title: `${fixture.provider} Test`,
        query,
        category: "fitness",
        locale: "en",
        region: "INTL",
        provider: fixture.provider,
        isMobile: true,
      });

      const androidIntent = result.fallbacks.find(
        (link) =>
          link.type === "intent" && link.url.includes(`package=${fixture.packageId}`)
      );

      expect(androidIntent).toBeTruthy();
      expect(androidIntent?.url).toContain("full%20body%20workout");
    }
  });
});
