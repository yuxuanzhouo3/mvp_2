import { describe, expect, it } from "vitest";
import { resolveCandidateLink } from "./link-resolver";

function extractQueryParam(linkUrl: string, key: string): string | null {
  const match = linkUrl.match(new RegExp(`[?&]${key}=([^&#]+)`, "i"));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

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
    const query = "indie roguelike";
    const result = resolveCandidateLink({
      title: "MiniReview Test",
      query,
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
    expect(androidIntent?.url).toContain("intent://minireview.io/");
    expect(androidIntent?.url).toContain("s=");
    expect(androidIntent?.url).toContain(encodeURIComponent(query));
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

  it("uses recommendation title as Ctrip keyword fallback when query is empty", () => {
    const title = "中国 杭州 西湖";
    const result = resolveCandidateLink({
      title,
      query: "   ",
      category: "travel",
      locale: "zh",
      region: "CN",
      provider: "携程",
      isMobile: true,
    });

    const encodedTitle = encodeURIComponent(title);
    expect(result.primary.url).toContain("ctrip://wireless/search?keyword=");
    expect(result.primary.url).toContain(`keyword=${encodedTitle}`);

    const webLink = result.fallbacks.find(
      (link) =>
        link.type === "web" &&
        link.url.includes("you.ctrip.com/globalsearch")
    );
    expect(webLink?.url).toContain(`keyword=${encodedTitle}`);

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=ctrip.android.view")
    );
    expect(androidIntent?.url).toContain("intent://wireless/search?keyword=");
    expect(androidIntent?.url).toContain(`keyword=${encodedTitle}`);
  });

  it("uses Ctrip Android app deeplink first and keeps keyword intent fallback", () => {
    const query = "江苏苏州平江路";
    const result = resolveCandidateLink({
      title: "中国·苏州·平江路",
      query,
      category: "travel",
      locale: "zh",
      region: "CN",
      provider: "携程",
      isMobile: true,
      os: "android",
    });

    expect(result.primary.type).toBe("app");
    expect(result.primary.url).toContain("ctrip://wireless/search?keyword=");
    expect(result.primary.url).toContain(`keyword=${encodeURIComponent(query)}`);

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=ctrip.android.view")
    );
    expect(androidIntent?.url).toContain("intent://wireless/search?keyword=");
    expect(androidIntent?.url).toContain(`keyword=${encodeURIComponent(query)}`);
  });

  it.each([
    {
      provider: "去哪儿",
      expectedScheme: "qunarphone://search?searchWord=",
      fallbackScheme: "scheme=qunarphone",
      fallbackPrefix: "intent://search?searchWord=",
      paramKey: "searchWord",
      packageId: "com.qunar.atom",
    },
    {
      provider: "马蜂窝",
      expectedScheme: "intent://search?keyword=",
      fallbackScheme: "scheme=mafengwo",
      fallbackPrefix: "intent://search?keyword=",
      paramKey: "keyword",
      packageId: "com.mfw.roadbook",
    },
  ])(
    "uses $provider Android app deeplink first and keeps keyword intent fallback",
    ({ provider, expectedScheme, fallbackScheme, fallbackPrefix, paramKey, packageId }) => {
      const query = "江苏苏州平江路游玩攻略";
      const result = resolveCandidateLink({
        title: "中国·苏州·平江路",
        query,
        category: "travel",
        locale: "zh",
        region: "CN",
        provider,
        isMobile: true,
        os: "android",
      });

      const expectedType = provider === "马蜂窝" ? "intent" : "app";
      expect(result.primary.type).toBe(expectedType);
      expect(result.primary.url).toContain(expectedScheme);
      if (provider !== "马蜂窝") {
        expect(extractQueryParam(result.primary.url, paramKey)).toBe(query);
      }

      if (provider === "马蜂窝") {
        expect(result.primary.url).toContain(`package=${packageId}`);
        expect(result.primary.url).toContain(fallbackScheme);
      } else {
        const androidIntent = result.fallbacks.find(
          (link) => link.type === "intent" && link.url.includes(`package=${packageId}`)
        );
        expect(androidIntent?.url).toContain(fallbackPrefix);
        expect(androidIntent?.url).toContain(fallbackScheme);
        expect(extractQueryParam(androidIntent?.url || "", paramKey)).toBe(query);
      }
    }
  );

  it.each([
    { provider: "去哪儿", paramKey: "searchWord" },
    { provider: "马蜂窝", paramKey: "keyword" },
  ])("uses recommendation title as $provider keyword fallback when query is empty", ({ provider, paramKey }) => {
    const title = "中国 杭州 西湖";
    const result = resolveCandidateLink({
      title,
      query: "   ",
      category: "travel",
      locale: "zh",
      region: "CN",
      provider,
      isMobile: true,
      os: "android",
    });

    const expectedType = provider === "马蜂窝" ? "intent" : "app";
    expect(result.primary.type).toBe(expectedType);
    if (provider !== "马蜂窝") {
      expect(extractQueryParam(result.primary.url, paramKey)).toBe(title);
    }
  });

  it("uses recommendation title as Vipshop keyword fallback when query is empty", () => {
    const title = "春季防晒外套";
    const encodedTitle = encodeURIComponent(title);
    const result = resolveCandidateLink({
      title,
      query: "   ",
      category: "shopping",
      locale: "zh",
      region: "CN",
      provider: "唯品会",
      isMobile: true,
      os: "android",
    });

    expect(result.primary.type).toBe("app");
    expect(result.primary.url).toContain("vipshop://search?keyword=");
    expect(result.primary.url).toContain(`keyword=${encodedTitle}`);

    const webLink = result.fallbacks.find(
      (link) =>
        link.type === "web" &&
        link.url.includes("category.vip.com/suggest.php")
    );
    expect(webLink?.url).toContain(`keyword=${encodedTitle}`);

    const androidIntent = result.fallbacks.find(
      (link) =>
        link.type === "intent" &&
        link.url.includes("package=com.achievo.vipshop")
    );
    expect(androidIntent?.url).toContain("intent://search?keyword=");
    expect(androidIntent?.url).toContain("scheme=vipshop");
    expect(extractQueryParam(androidIntent?.url || "", "keyword")).toBe(title);
  });

  it("uses Dianping Android app deeplink first and keeps keyword intent fallback", () => {
    const query = "海底捞火锅";
    const result = resolveCandidateLink({
      title: query,
      query,
      category: "food",
      locale: "zh",
      region: "CN",
      provider: "大众点评",
      isMobile: true,
      os: "android",
    });

    expect(result.primary.type).toBe("app");
    expect(result.primary.url).toContain("dianping://search?keyword=");
    expect(extractQueryParam(result.primary.url, "keyword")).toBe(query);

    const androidIntent = result.fallbacks.find(
      (link) => link.type === "intent" && link.url.includes("package=com.dianping.v1")
    );
    expect(androidIntent?.url).toContain("intent://search?keyword=");
    expect(androidIntent?.url).toContain("scheme=dianping");
    expect(extractQueryParam(androidIntent?.url || "", "keyword")).toBe(query);
  });

  it("uses Amap Android app deeplink first and keeps keyword intent fallback", () => {
    const query = "海底捞火锅";
    const result = resolveCandidateLink({
      title: query,
      query,
      category: "food",
      locale: "zh",
      region: "CN",
      provider: "高德地图",
      isMobile: true,
      os: "android",
    });

    expect(result.primary.type).toBe("app");
    expect(result.primary.url).toContain("androidamap://poi?");
    expect(extractQueryParam(result.primary.url, "keywords")).toBe(query);
    expect(extractQueryParam(result.primary.url, "sourceApplication")).toBe("mvp_2_demo");

    const androidIntent = result.fallbacks.find(
      (link) => link.type === "intent" && link.url.includes("package=com.autonavi.minimap")
    );
    expect(androidIntent?.url).toContain("intent://poi?");
    expect(androidIntent?.url).toContain("scheme=androidamap");
    expect(extractQueryParam(androidIntent?.url || "", "keywords")).toBe(query);
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
