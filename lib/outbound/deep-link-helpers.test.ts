import { describe, it, expect } from "vitest";
import {
  decodeCandidateLink,
  base64UrlEncode,
  validateReturnTo,
  getGooglePlayLink,
  isIntlAndroidContext,
  getFallbackGooglePlayUrl,
  getAutoTryLinks,
  sanitizeAutoTryLinksForIntlAndroid,
  stripIntentBrowserFallbackUrl,
} from "./deep-link-helpers";
import type { CandidateLink } from "@/lib/types/recommendation";
import { RegionConfig } from "@/lib/config/region";

/**
 * Unit tests for decodeCandidateLink
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5, 7.3
 */

/** Helper: encode a CandidateLink to base64url string */
function encode(obj: unknown): string {
  return base64UrlEncode(JSON.stringify(obj));
}

/** A valid CandidateLink with an allowed primary URL */
const validLink: CandidateLink = {
  provider: "YouTube",
  title: "Test Video",
  primary: { type: "web", url: "https://youtube.com/watch?v=abc" },
  fallbacks: [
    { type: "store", url: "https://apps.apple.com/app/youtube/id544007664" },
  ],
};

describe("decodeCandidateLink", () => {
  // --- Requirement 4.3: empty/missing raw parameter ---
  describe("empty/missing raw parameter (Req 4.3)", () => {
    it("returns Chinese error for empty string with zh language", () => {
      const result = decodeCandidateLink("", "zh");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("缺少跳转参数");
    });

    it("returns English error for empty string with en language", () => {
      const result = decodeCandidateLink("", "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Missing redirect parameters");
    });
  });

  // --- Requirement 4.4: decode/parse failure ---
  describe("decode/parse failure (Req 4.4)", () => {
    it("returns error for invalid base64url string (zh)", () => {
      const result = decodeCandidateLink("!!!not-valid-base64!!!", "zh");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("跳转参数无效");
    });

    it("returns error for invalid base64url string (en)", () => {
      const result = decodeCandidateLink("!!!not-valid-base64!!!", "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });

    it("returns error for valid base64 but invalid JSON", () => {
      const raw = base64UrlEncode("this is not json");
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });

    it("returns error for truncated JSON", () => {
      const raw = base64UrlEncode('{"provider":"YouTube","title":');
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });
  });

  // --- Requirement 4.4: incomplete structure ---
  describe("incomplete structure (Req 4.4)", () => {
    it("returns error when provider is missing", () => {
      const raw = encode({
        title: "Test",
        primary: { type: "web", url: "https://youtube.com" },
        fallbacks: [],
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });

    it("returns error when title is missing", () => {
      const raw = encode({
        provider: "YouTube",
        primary: { type: "web", url: "https://youtube.com" },
        fallbacks: [],
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });

    it("returns error when primary is missing", () => {
      const raw = encode({
        provider: "YouTube",
        title: "Test",
        fallbacks: [],
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });

    it("returns error when primary.url is missing", () => {
      const raw = encode({
        provider: "YouTube",
        title: "Test",
        primary: { type: "web" },
        fallbacks: [],
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });

    it("returns error when primary.type is missing", () => {
      const raw = encode({
        provider: "YouTube",
        title: "Test",
        primary: { url: "https://youtube.com" },
        fallbacks: [],
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });

    it("returns error when provider is empty string", () => {
      const raw = encode({
        provider: "",
        title: "Test",
        primary: { type: "web", url: "https://youtube.com" },
        fallbacks: [],
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Invalid redirect parameters");
    });
  });

  // --- Requirement 4.5: primary URL security check ---
  describe("primary URL security check (Req 4.5)", () => {
    it("returns error when primary URL is not in allowed list (zh)", () => {
      const raw = encode({
        provider: "Evil",
        title: "Malicious",
        primary: { type: "web", url: "https://evil.example.com/hack" },
        fallbacks: [],
      });
      const result = decodeCandidateLink(raw, "zh");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("目标链接不被允许");
    });

    it("returns error when primary URL is not in allowed list (en)", () => {
      const raw = encode({
        provider: "Evil",
        title: "Malicious",
        primary: { type: "web", url: "https://evil.example.com/hack" },
        fallbacks: [],
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.candidateLink).toBeNull();
      expect(result.error).toBe("Target link not allowed");
    });
  });

  // --- Requirement 7.3: fallback filtering ---
  describe("fallback filtering (Req 7.3)", () => {
    it("filters out fallbacks with disallowed URLs", () => {
      const raw = encode({
        ...validLink,
        fallbacks: [
          { type: "web", url: "https://youtube.com/alt" },
          { type: "web", url: "https://evil.example.com/bad" },
          { type: "store", url: "https://apps.apple.com/app/youtube/id544007664" },
        ],
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.error).toBeNull();
      expect(result.candidateLink).not.toBeNull();
      expect(result.candidateLink!.fallbacks).toHaveLength(2);
      expect(result.candidateLink!.fallbacks[0].url).toBe("https://youtube.com/alt");
      expect(result.candidateLink!.fallbacks[1].url).toBe("https://apps.apple.com/app/youtube/id544007664");
    });

    it("handles missing fallbacks array gracefully", () => {
      const raw = encode({
        provider: "YouTube",
        title: "Test",
        primary: { type: "web", url: "https://youtube.com/watch?v=abc" },
      });
      const result = decodeCandidateLink(raw, "en");
      expect(result.error).toBeNull();
      expect(result.candidateLink).not.toBeNull();
      expect(result.candidateLink!.fallbacks).toEqual([]);
    });
  });

  // --- Success case (Req 4.2) ---
  describe("successful decode", () => {
    it("returns valid CandidateLink for a well-formed input", () => {
      const raw = encode(validLink);
      const result = decodeCandidateLink(raw, "en");
      expect(result.error).toBeNull();
      expect(result.candidateLink).not.toBeNull();
      expect(result.candidateLink!.provider).toBe("YouTube");
      expect(result.candidateLink!.title).toBe("Test Video");
      expect(result.candidateLink!.primary.url).toBe("https://youtube.com/watch?v=abc");
      expect(result.candidateLink!.fallbacks).toHaveLength(1);
    });

    it("preserves metadata in the decoded CandidateLink", () => {
      const linkWithMeta = {
        ...validLink,
        metadata: { providerDisplayName: "YouTube" },
      };
      const raw = encode(linkWithMeta);
      const result = decodeCandidateLink(raw, "zh");
      expect(result.error).toBeNull();
      expect(result.candidateLink!.metadata).toEqual({ providerDisplayName: "YouTube" });
    });
  });
});

/**
 * Unit tests for validateReturnTo
 * Validates: Requirements 7.4
 */
describe("validateReturnTo", () => {
  describe("accepts valid relative paths", () => {
    it("returns the path when it starts with /", () => {
      expect(validateReturnTo("/recommendations")).toBe("/recommendations");
    });

    it("returns root path /", () => {
      expect(validateReturnTo("/")).toBe("/");
    });

    it("returns nested relative path", () => {
      expect(validateReturnTo("/search/results?q=test")).toBe("/search/results?q=test");
    });
  });

  describe("returns null for null input", () => {
    it("returns null when input is null", () => {
      expect(validateReturnTo(null)).toBeNull();
    });
  });

  describe("rejects invalid inputs", () => {
    it("rejects empty string", () => {
      expect(validateReturnTo("")).toBeNull();
    });

    it("rejects http:// URL", () => {
      expect(validateReturnTo("http://evil.com")).toBeNull();
    });

    it("rejects https:// URL", () => {
      expect(validateReturnTo("https://evil.com")).toBeNull();
    });

    it("rejects javascript: protocol", () => {
      expect(validateReturnTo("javascript:alert(1)")).toBeNull();
    });

    it("rejects relative path without leading slash", () => {
      expect(validateReturnTo("recommendations")).toBeNull();
    });

    it("rejects protocol-relative URL (//evil.com)", () => {
      expect(validateReturnTo("//evil.com")).toBeNull();
    });

    it("rejects protocol-relative URL with path (//evil.com/path)", () => {
      expect(validateReturnTo("//evil.com/path")).toBeNull();
    });
  });
});

describe("getGooglePlayLink", () => {
  it("prefers intent:// Google Play link when available", () => {
    const result = getGooglePlayLink([
      { type: "store", url: "market://details?id=com.example.app", label: "Market" },
      {
        type: "store",
        url: "intent://details?id=com.example.app#Intent;scheme=market;package=com.android.vending;end",
        label: "Google Play",
      },
      {
        type: "store",
        url: "https://play.google.com/store/apps/details?id=com.example.app",
        label: "Google Play Web",
      },
    ]);

    expect(result?.url).toContain("intent://details?id=com.example.app");
  });

  it("falls back to play.google.com link when no intent link", () => {
    const result = getGooglePlayLink([
      {
        type: "store",
        url: "https://play.google.com/store/apps/details?id=com.example.app",
        label: "Google Play Web",
      },
      { type: "store", url: "market://details?id=com.example.app", label: "Market" },
    ]);

    expect(result?.url).toBe("https://play.google.com/store/apps/details?id=com.example.app");
  });

  it("falls back to market:// when no intent and no play web link", () => {
    const result = getGooglePlayLink([
      { type: "store", url: "market://details?id=com.example.app", label: "Market" },
      { type: "store", url: "https://apps.apple.com/app/id123", label: "App Store" },
    ]);

    expect(result?.url).toBe("market://details?id=com.example.app");
  });

  it("returns null when no Google Play compatible store link exists", () => {
    const result = getGooglePlayLink([
      { type: "store", url: "https://apps.apple.com/app/id123", label: "App Store" },
    ]);

    expect(result).toBeNull();
  });

  it("returns null for an empty store links array", () => {
    const result = getGooglePlayLink([]);
    expect(result).toBeNull();
  });
});

describe("isIntlAndroidContext", () => {
  const baseCandidate: CandidateLink = {
    provider: "Google",
    title: "Test",
    primary: { type: "web", url: "https://google.com/search?q=test" },
    fallbacks: [],
  };

  it("returns false when candidate is null", () => {
    expect(isIntlAndroidContext(null, "android")).toBe(false);
  });

  it("returns false when os is not android", () => {
    expect(
      isIntlAndroidContext(
        {
          ...baseCandidate,
          metadata: { region: "INTL" },
        },
        "ios"
      )
    ).toBe(false);
  });

  it("returns true when metadata.region is INTL on android", () => {
    expect(
      isIntlAndroidContext(
        {
          ...baseCandidate,
          metadata: { region: "INTL" },
        },
        "android"
      )
    ).toBe(true);
  });

  it("treats metadata.region case-insensitively", () => {
    expect(
      isIntlAndroidContext(
        {
          ...baseCandidate,
          metadata: { region: "intl" },
        },
        "android"
      )
    ).toBe(true);
  });

  it("returns false when metadata.region is CN on android", () => {
    expect(
      isIntlAndroidContext(
        {
          ...baseCandidate,
          metadata: { region: "CN" },
        },
        "android"
      )
    ).toBe(false);
  });

  it("falls back to RegionConfig when metadata.region is missing", () => {
    const expected = RegionConfig.database.provider !== "cloudbase";
    expect(
      isIntlAndroidContext(
        {
          ...baseCandidate,
          metadata: {},
        },
        "android"
      )
    ).toBe(expected);
  });

  it("falls back to RegionConfig when metadata.region is unknown", () => {
    const expected = RegionConfig.database.provider !== "cloudbase";
    expect(
      isIntlAndroidContext(
        {
          ...baseCandidate,
          metadata: { region: "EU" },
        },
        "android"
      )
    ).toBe(expected);
  });
});

describe("getFallbackGooglePlayUrl", () => {
  function getKeywordFromUrl(url: string): string | null {
    const parsed = new URL(url);
    return parsed.searchParams.get("q");
  }

  it("prefers metadata.providerDisplayName as fallback keyword", () => {
    const url = getFallbackGooglePlayUrl({
      provider: "YouTube",
      title: "My Video",
      primary: { type: "web", url: "https://youtube.com" },
      fallbacks: [],
      metadata: { providerDisplayName: "YouTube Music" },
    });

    expect(getKeywordFromUrl(url)).toBe("YouTube Music");
    expect(url).toContain("&c=apps");
  });

  it("falls back to provider when providerDisplayName is unavailable", () => {
    const url = getFallbackGooglePlayUrl({
      provider: "Spotify",
      title: "Best Songs",
      primary: { type: "web", url: "https://spotify.com" },
      fallbacks: [],
    });

    expect(getKeywordFromUrl(url)).toBe("Spotify");
  });

  it("falls back to title when provider is empty", () => {
    const url = getFallbackGooglePlayUrl({
      provider: "",
      title: "Running App",
      primary: { type: "web", url: "https://example.com" },
      fallbacks: [],
    });

    expect(getKeywordFromUrl(url)).toBe("Running App");
  });

  it("falls back to app when candidate is null", () => {
    const url = getFallbackGooglePlayUrl(null);
    expect(getKeywordFromUrl(url)).toBe("app");
  });
});

describe("stripIntentBrowserFallbackUrl", () => {
  it("removes browser fallback parameter from intent URL", () => {
    const input =
      "intent://search?q=test#Intent;scheme=youtube;package=com.google.android.youtube;S.browser_fallback_url=https%3A%2F%2Fm.youtube.com%2Fresults%3Fsearch_query%3Dtest;end";

    const output = stripIntentBrowserFallbackUrl(input);

    expect(output).toContain("intent://search?q=test#Intent;");
    expect(output).toContain("scheme=youtube");
    expect(output).toContain("package=com.google.android.youtube");
    expect(output).not.toContain("S.browser_fallback_url=");
  });

  it("returns non-intent URL unchanged", () => {
    const input = "https://play.google.com/store/apps/details?id=com.example.app";
    expect(stripIntentBrowserFallbackUrl(input)).toBe(input);
  });
});

describe("sanitizeAutoTryLinksForIntlAndroid", () => {
  it("removes universal_link and strips intent browser fallback", () => {
    const links = [
      {
        type: "intent" as const,
        url: "intent://search?q=test#Intent;scheme=youtube;package=com.google.android.youtube;S.browser_fallback_url=https%3A%2F%2Fm.youtube.com%2Fresults%3Fsearch_query%3Dtest;end",
      },
      { type: "app" as const, url: "youtube://results?search_query=test" },
      { type: "universal_link" as const, url: "https://www.youtube.com/results?search_query=test" },
    ];

    const result = sanitizeAutoTryLinksForIntlAndroid(links);

    expect(result).toHaveLength(2);
    expect(result.some((item) => item.type === "universal_link")).toBe(false);
    expect(result[0].type).toBe("intent");
    expect(result[0].url).not.toContain("S.browser_fallback_url=");
  });

  it("keeps universal_link when no app/intent deep link exists", () => {
    const links = [
      {
        type: "universal_link" as const,
        url: "https://store.steampowered.com/search/?term=test",
      },
    ];

    const result = sanitizeAutoTryLinksForIntlAndroid(links);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("universal_link");
  });

  it("deduplicates links after sanitization", () => {
    const links = [
      {
        type: "intent" as const,
        url: "intent://search?q=test#Intent;scheme=youtube;package=com.google.android.youtube;S.browser_fallback_url=https%3A%2F%2Fm.youtube.com%2Fresults%3Fsearch_query%3Dtest;end",
      },
      {
        type: "intent" as const,
        url: "intent://search?q=test#Intent;scheme=youtube;package=com.google.android.youtube;end",
      },
    ];

    const result = sanitizeAutoTryLinksForIntlAndroid(links);
    expect(result).toHaveLength(1);
  });

  it("normalizes TikTok snssdk intent to package-only intent on Android", () => {
    const links = [
      {
        type: "intent" as const,
        url: "intent://search?q=test#Intent;scheme=snssdk1128;package=com.zhiliaoapp.musically;S.browser_fallback_url=https%3A%2F%2Fwww.tiktok.com%2Fsearch%3Fq%3Dtest;end",
      },
    ];

    const result = sanitizeAutoTryLinksForIntlAndroid(links);
    expect(result).toHaveLength(1);
    expect(result[0].url).toContain("package=com.zhiliaoapp.musically");
    expect(result[0].url).not.toContain("scheme=snssdk1128");
  });
});

describe("getAutoTryLinks", () => {
  // --- Criterion 1: Sorting logic intent(0) > app(1) > universal_link(2) ---
  describe("Android sorting: intent > app > universal_link (Req 1.2)", () => {
    it("sorts intent before app before universal_link on Android", () => {
      const candidateLink: CandidateLink = {
        provider: "YouTube",
        title: "YouTube Test",
        primary: {
          type: "universal_link",
          url: "https://www.youtube.com/results?search_query=test",
        },
        fallbacks: [
          {
            type: "app",
            url: "youtube://results?search_query=test",
            label: "Android",
          },
          {
            type: "intent",
            url: "intent://results?search_query=test#Intent;scheme=youtube;package=com.google.android.youtube;end",
            label: "Android",
          },
        ],
      };

      const links = getAutoTryLinks(candidateLink, "android");
      expect(links.length).toBe(2);
      expect(links[0].type).toBe("intent");
      expect(links[1].type).toBe("app");
    });

    it("places multiple intents before apps on Android", () => {
      const candidateLink: CandidateLink = {
        provider: "TestProvider",
        title: "Test",
        primary: {
          type: "app",
          url: "testapp://search?q=test",
        },
        fallbacks: [
          {
            type: "universal_link",
            url: "https://www.testprovider.com/search?q=test",
          },
          {
            type: "intent",
            url: "intent://search?q=test#Intent;scheme=testapp;package=com.test.app;end",
          },
          {
            type: "app",
            url: "testapp2://search?q=test",
          },
          {
            type: "intent",
            url: "intent://search?q=test2#Intent;scheme=testapp;package=com.test.app2;end",
          },
        ],
      };

      const links = getAutoTryLinks(candidateLink, "android");
      // All intents should come before all apps, all apps before universal_links
      const intentIndices = links
        .map((l, i) => (l.type === "intent" ? i : -1))
        .filter((i) => i >= 0);
      const appIndices = links
        .map((l, i) => (l.type === "app" ? i : -1))
        .filter((i) => i >= 0);
      const ulIndices = links
        .map((l, i) => (l.type === "universal_link" ? i : -1))
        .filter((i) => i >= 0);

      // Every intent index should be less than every app index
      for (const ii of intentIndices) {
        for (const ai of appIndices) {
          expect(ii).toBeLessThan(ai);
        }
      }
      // Every app index should be less than every universal_link index
      for (const ai of appIndices) {
        for (const ui of ulIndices) {
          expect(ai).toBeLessThan(ui);
        }
      }
    });

    it("does not apply Android sorting on iOS", () => {
      const candidateLink: CandidateLink = {
        provider: "YouTube",
        title: "YouTube Test",
        primary: {
          type: "universal_link",
          url: "https://www.youtube.com/results?search_query=test",
        },
        fallbacks: [
          {
            type: "app",
            url: "youtube://results?search_query=test",
            label: "iOS",
          },
        ],
      };

      const links = getAutoTryLinks(candidateLink, "ios");
      // On iOS, universal_link comes first (from primary), then app — no re-sorting
      expect(links[0].type).toBe("universal_link");
      expect(links[1].type).toBe("app");
    });
  });

  // --- Criterion 2: iOS-labeled links filtered on Android ---
  describe("filters iOS-labeled links on Android (Req 1.2)", () => {
    it("filters iOS-labeled app links on Android", () => {
      const candidateLink: CandidateLink = {
        provider: "YouTube",
        title: "YouTube Test",
        primary: {
          type: "universal_link",
          url: "https://www.youtube.com/results?search_query=test",
        },
        fallbacks: [
          {
            type: "app",
            url: "youtube://results?search_query=test",
            label: "iOS",
          },
          {
            type: "intent",
            url: "intent://results?search_query=test#Intent;scheme=youtube;package=com.google.android.youtube;end",
            label: "Android",
          },
        ],
      };

      const links = getAutoTryLinks(candidateLink, "android");
      expect(links.some((link) => link.label === "iOS")).toBe(false);
      expect(links.some((link) => link.type === "intent")).toBe(true);
    });

    it("filters iOS-labeled universal_link on Android", () => {
      const candidateLink: CandidateLink = {
        provider: "TestProvider",
        title: "Test",
        primary: {
          type: "intent",
          url: "intent://search?q=test#Intent;scheme=testapp;package=com.test.app;end",
        },
        fallbacks: [
          {
            type: "universal_link",
            url: "https://apps.apple.com/app/test",
            label: "iOS",
          },
          {
            type: "app",
            url: "testapp://search?q=test",
            label: "Android",
          },
        ],
      };

      const links = getAutoTryLinks(candidateLink, "android");
      expect(links.some((link) => link.label === "iOS")).toBe(false);
      expect(links.length).toBe(2);
      expect(links[0].type).toBe("intent");
      expect(links[1].type).toBe("app");
    });

    it("filters case-insensitive iOS labels on Android", () => {
      const candidateLink: CandidateLink = {
        provider: "TestProvider",
        title: "Test",
        primary: {
          type: "app",
          url: "testapp://search?q=test",
          label: "IOS App",
        },
        fallbacks: [
          {
            type: "intent",
            url: "intent://search?q=test#Intent;scheme=testapp;package=com.test.app;end",
            label: "Android",
          },
        ],
      };

      const links = getAutoTryLinks(candidateLink, "android");
      expect(links.length).toBe(1);
      expect(links[0].type).toBe("intent");
    });

    it("keeps links without labels on Android", () => {
      const candidateLink: CandidateLink = {
        provider: "TestProvider",
        title: "Test",
        primary: {
          type: "app",
          url: "testapp://search?q=test",
        },
        fallbacks: [
          {
            type: "intent",
            url: "intent://search?q=test#Intent;scheme=testapp;package=com.test.app;end",
          },
        ],
      };

      const links = getAutoTryLinks(candidateLink, "android");
      expect(links.length).toBe(2);
    });

    it("does not include cross-provider app deep links in auto-try list", () => {
      const candidateLink: CandidateLink = {
        provider: "小红书",
        title: "小红书探店",
        primary: {
          type: "app",
          url: "xhsdiscover://search/result?keyword=%E7%81%AB%E9%94%85",
        },
        fallbacks: [
          {
            type: "app",
            url: "imeituan://www.meituan.com/search?q=%E7%81%AB%E9%94%85",
            label: "美团",
          },
          {
            type: "intent",
            url: "intent://www.meituan.com/search?q=%E7%81%AB%E9%94%85#Intent;scheme=imeituan;package=com.sankuai.meituan;end",
            label: "美团",
          },
          {
            type: "store",
            url: "market://details?id=com.xingin.xhs",
            label: "系统应用商店",
          },
        ],
      };

      const links = getAutoTryLinks(candidateLink, "android");
      expect(links).toHaveLength(1);
      expect(links[0].url).toContain("xhsdiscover://");
      expect(links.some((link) => link.url.includes("imeituan://"))).toBe(false);
      expect(links.some((link) => link.url.includes("com.sankuai.meituan"))).toBe(false);
    });

    it("strips browser fallback from android intent in auto-try list", () => {
      const candidateLink: CandidateLink = {
        provider: "腾讯视频",
        title: "测试视频",
        primary: {
          type: "intent",
          url:
            "intent://search?keyword=test#Intent;scheme=tenvideo;package=com.tencent.qqlive;S.browser_fallback_url=https%3A%2F%2Fv.qq.com%2Fx%2Fsearch%2F%3Fq%3Dtest;end",
        },
        fallbacks: [],
      };

      const links = getAutoTryLinks(candidateLink, "android");
      expect(links).toHaveLength(1);
      expect(links[0].type).toBe("intent");
      expect(links[0].url).not.toContain("S.browser_fallback_url=");
    });
  });
});
