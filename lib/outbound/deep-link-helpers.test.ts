import { describe, it, expect } from "vitest";
import {
  decodeCandidateLink,
  base64UrlEncode,
  validateReturnTo,
  getGooglePlayLink,
} from "./deep-link-helpers";
import type { CandidateLink } from "@/lib/types/recommendation";

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
});
