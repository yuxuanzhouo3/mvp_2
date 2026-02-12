import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { sanitizeAutoTryLinksForIntlAndroid } from "./deep-link-helpers";
import type { OutboundLink, CandidateLinkType } from "@/lib/types/recommendation";

/**
 * Property-based tests for sanitizeAutoTryLinksForIntlAndroid
 *
 * Feature: intl-android-deep-link-flow, Property 1: INTL Android 链接清洗保持不变量
 * **Validates: Requirements 1.1**
 */

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** The link types that sanitizeAutoTryLinksForIntlAndroid operates on */
const autoTryLinkTypes: CandidateLinkType[] = [
  "app",
  "intent",
  "universal_link",
];

/** Arbitrary for auto-try link types */
const arbAutoTryLinkType = fc.constantFrom<CandidateLinkType>(
  ...autoTryLinkTypes
);

/**
 * Generate a realistic URL based on the link type.
 * Intent URLs follow the intent:// scheme with proper structure.
 * App URLs use custom schemes. Universal links use https://.
 */
const arbAlphaNum = fc.string({ minLength: 1, maxLength: 20, unit: fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
)});

const arbUrlForType = (type: CandidateLinkType): fc.Arbitrary<string> => {
  switch (type) {
    case "intent":
      return fc
        .record({
          path: arbAlphaNum,
          scheme: fc.constantFrom("youtube", "testapp", "snssdk1128", "myapp"),
          packageName: fc.constantFrom(
            "com.google.android.youtube",
            "com.zhiliaoapp.musically",
            "com.example.app",
            "com.test.provider"
          ),
          hasFallback: fc.boolean(),
          fallbackUrl: fc.constantFrom(
            "https%3A%2F%2Fm.youtube.com",
            "https%3A%2F%2Fwww.tiktok.com",
            "https%3A%2F%2Fexample.com"
          ),
        })
        .map(({ path, scheme, packageName, hasFallback, fallbackUrl }) => {
          const fallbackPart = hasFallback
            ? `;S.browser_fallback_url=${fallbackUrl};`
            : ";";
          return `intent://${path}#Intent;scheme=${scheme};package=${packageName}${fallbackPart}end`;
        });
    case "app":
      return fc
        .record({
          scheme: fc.constantFrom("youtube", "spotify", "testapp", "myapp"),
          path: arbAlphaNum,
        })
        .map(({ scheme, path }) => `${scheme}://${path}`);
    case "universal_link":
      return fc
        .record({
          domain: fc.constantFrom(
            "www.youtube.com",
            "www.tiktok.com",
            "open.spotify.com",
            "www.example.com"
          ),
          path: arbAlphaNum,
        })
        .map(({ domain, path }) => `https://${domain}/${path}`);
    default:
      return fc.constant("https://example.com/fallback");
  }
};

/** Generate a single OutboundLink with a type relevant to auto-try */
const arbOutboundLink: fc.Arbitrary<OutboundLink> = arbAutoTryLinkType.chain(
  (type) =>
    arbUrlForType(type).map((url) => ({
      type,
      url,
    }))
);

/** Generate a list of OutboundLinks (0 to 10 items) */
const arbOutboundLinkList: fc.Arbitrary<OutboundLink[]> = fc.array(
  arbOutboundLink,
  { minLength: 0, maxLength: 10 }
);

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe("sanitizeAutoTryLinksForIntlAndroid — Property Tests", () => {
  // Feature: intl-android-deep-link-flow, Property 1: INTL Android 链接清洗保持不变量
  it("Property 1: INTL Android 链接清洗保持不变量 — **Validates: Requirements 1.1**", () => {
    fc.assert(
      fc.property(arbOutboundLinkList, (links) => {
        const result = sanitizeAutoTryLinksForIntlAndroid(links);

        // --- Invariant 1 ---
        // When the input list contains app or intent type links,
        // the result should NOT contain universal_link type links
        const inputHasAppOrIntent = links.some(
          (l) => l.type === "app" || l.type === "intent"
        );
        if (inputHasAppOrIntent) {
          const hasUniversalLink = result.some(
            (l) => l.type === "universal_link"
          );
          expect(hasUniversalLink).toBe(false);
        }

        // --- Invariant 2 ---
        // All intent type links in the result should NOT contain
        // `S.browser_fallback_url=` in their URL
        for (const link of result) {
          if (link.type === "intent") {
            expect(link.url).not.toContain("S.browser_fallback_url=");
          }
        }

        // --- Invariant 3 ---
        // No duplicate links (by type:url combination) in the result
        const keys = result.map((l) => `${l.type}:${l.url}`);
        const uniqueKeys = new Set(keys);
        expect(keys.length).toBe(uniqueKeys.size);
      }),
      { numRuns: 200 }
    );
  });
});

import { getAutoTryLinks } from "./deep-link-helpers";
import type { CandidateLink } from "@/lib/types/recommendation";

/**
 * Property-based tests for getAutoTryLinks
 *
 * Feature: intl-android-deep-link-flow, Property 2: Android Auto_Try 链接优先级排序
 * **Validates: Requirements 1.2**
 */

// ---------------------------------------------------------------------------
// Generators for Property 2
// ---------------------------------------------------------------------------

/** All possible link types for generating realistic CandidateLinks */
const allLinkTypes = [
  "app",
  "intent",
  "universal_link",
  "web",
  "store",
] as const;

/** Optional labels — includes iOS/Android labels to test OS filtering */
const arbLabel: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.constant(""),
  fc.constant("iOS"),
  fc.constant("Android"),
  fc.constant("ios app"),
  fc.constant("android app"),
  fc.constant("general"),
);

/** Generate a URL appropriate for the given link type */
const arbUrlForLinkType = (
  type: (typeof allLinkTypes)[number]
): fc.Arbitrary<string> => {
  switch (type) {
    case "intent":
      return fc
        .record({
          path: fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(
            ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
          )}),
          scheme: fc.constantFrom("youtube", "testapp", "myapp"),
          packageName: fc.constantFrom(
            "com.google.android.youtube",
            "com.example.app",
            "com.test.provider"
          ),
        })
        .map(
          ({ path, scheme, packageName }) =>
            `intent://${path}#Intent;scheme=${scheme};package=${packageName};end`
        );
    case "app":
      return fc
        .record({
          scheme: fc.constantFrom("youtube", "spotify", "testapp"),
          path: fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(
            ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
          )}),
        })
        .map(({ scheme, path }) => `${scheme}://${path}`);
    case "universal_link":
      return fc
        .record({
          domain: fc.constantFrom(
            "www.youtube.com",
            "www.tiktok.com",
            "open.spotify.com"
          ),
          path: fc.string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(
            ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
          )}),
        })
        .map(({ domain, path }) => `https://${domain}/${path}`);
    case "web":
      return fc.constant("https://www.example.com/web");
    case "store":
      return fc.constant(
        "intent://details?id=com.example#Intent;scheme=market;package=com.android.vending;end"
      );
    default:
      return fc.constant("https://example.com/fallback");
  }
};

/** Generate a single OutboundLink with any type (for realistic CandidateLinks) */
const arbOutboundLinkWithLabel: fc.Arbitrary<OutboundLink> = fc
  .constantFrom(...allLinkTypes)
  .chain((type) =>
    fc
      .record({
        url: arbUrlForLinkType(type),
        label: arbLabel,
      })
      .map(({ url, label }) => ({
        type: type as OutboundLink["type"],
        url,
        ...(label !== undefined ? { label } : {}),
      }))
  );

/** Generate a primary OutboundLink (can be any type) */
const arbPrimaryLink: fc.Arbitrary<OutboundLink> = fc
  .constantFrom(...allLinkTypes)
  .chain((type) =>
    fc
      .record({
        url: arbUrlForLinkType(type),
        label: arbLabel,
      })
      .map(({ url, label }) => ({
        type: type as OutboundLink["type"],
        url,
        ...(label !== undefined ? { label } : {}),
      }))
  );

/** Generate a random CandidateLink with realistic structure */
const arbCandidateLink: fc.Arbitrary<CandidateLink> = fc.record({
  provider: fc.constantFrom("YouTube", "TikTok", "Spotify", "Amazon", "TestApp"),
  title: fc.string({ minLength: 1, maxLength: 30, unit: fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyz '.split('')
  )}),
  primary: arbPrimaryLink,
  fallbacks: fc.array(arbOutboundLinkWithLabel, { minLength: 0, maxLength: 8 }),
});

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe("getAutoTryLinks — Property Tests", () => {
  // Feature: intl-android-deep-link-flow, Property 2: Android Auto_Try 链接优先级排序
  it("Property 2: Android Auto_Try 链接优先级排序 — **Validates: Requirements 1.2**", () => {
    fc.assert(
      fc.property(arbCandidateLink, (candidateLink) => {
        const result = getAutoTryLinks(candidateLink, "android");

        // --- Priority ordering: intent(0) > app(1) > universal_link(2) ---
        // For every pair of adjacent links, the earlier one should have
        // equal or higher priority (lower numeric value) than the later one.
        const priorityMap: Record<string, number> = {
          intent: 0,
          app: 1,
          universal_link: 2,
        };

        for (let i = 1; i < result.length; i++) {
          const prevPriority = priorityMap[result[i - 1].type] ?? 3;
          const currPriority = priorityMap[result[i].type] ?? 3;
          expect(prevPriority).toBeLessThanOrEqual(currPriority);
        }

        // --- iOS-labeled links should be filtered out on Android ---
        for (const link of result) {
          const label = (link.label || "").toLowerCase();
          expect(label.includes("ios")).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });
});

import { getGooglePlayLink } from "./deep-link-helpers";

/**
 * Property-based tests for getGooglePlayLink
 *
 * Feature: intl-android-deep-link-flow, Property 3: Google Play 链接优先级选择
 * **Validates: Requirements 2.2**
 */

// ---------------------------------------------------------------------------
// Generators for Property 3
// ---------------------------------------------------------------------------

/**
 * Generate an intent:// link with com.android.vending (Google Play intent).
 * This is the highest priority link type for getGooglePlayLink.
 */
const arbGooglePlayIntentUrl: fc.Arbitrary<string> = fc
  .constantFrom(
    "com.example.app",
    "com.google.android.youtube",
    "com.zhiliaoapp.musically",
    "com.amazon.mShop.android.shopping"
  )
  .map(
    (packageId) =>
      `intent://details?id=${packageId}#Intent;scheme=market;package=com.android.vending;end`
  );

/**
 * Generate a play.google.com web link.
 * This is the second priority link type.
 */
const arbPlayWebUrl: fc.Arbitrary<string> = fc
  .constantFrom(
    "com.example.app",
    "com.google.android.youtube",
    "com.zhiliaoapp.musically"
  )
  .map((packageId) => `https://play.google.com/store/apps/details?id=${packageId}`);

/**
 * Generate a market:// link.
 * This is the third priority link type.
 */
const arbMarketUrl: fc.Arbitrary<string> = fc
  .constantFrom(
    "com.example.app",
    "com.google.android.youtube",
    "com.zhiliaoapp.musically"
  )
  .map((packageId) => `market://details?id=${packageId}`);

/**
 * Generate a non-Google-Play link (none of the three priority types).
 * These should never be returned by getGooglePlayLink.
 */
const arbNonGooglePlayUrl: fc.Arbitrary<string> = fc.constantFrom(
  "https://apps.apple.com/app/id12345",
  "itms-apps://apps.apple.com/app/id12345",
  "https://www.amazon.com/gp/mas/dl/android",
  "https://appgallery.huawei.com/app/C12345",
  "intent://scan#Intent;scheme=zxing;package=com.example.scanner;end",
  "https://sj.qq.com/appdetail/com.example.app"
);

/** Generate a store OutboundLink with a Google Play intent URL */
const arbGooglePlayIntentLink: fc.Arbitrary<OutboundLink> = arbGooglePlayIntentUrl.map(
  (url) => ({ type: "store" as CandidateLinkType, url, label: "Google Play" })
);

/** Generate a store OutboundLink with a play.google.com URL */
const arbPlayWebLink: fc.Arbitrary<OutboundLink> = arbPlayWebUrl.map(
  (url) => ({ type: "store" as CandidateLinkType, url, label: "Google Play" })
);

/** Generate a store OutboundLink with a market:// URL */
const arbMarketLink: fc.Arbitrary<OutboundLink> = arbMarketUrl.map(
  (url) => ({ type: "store" as CandidateLinkType, url, label: "Google Play" })
);

/** Generate a store OutboundLink with a non-Google-Play URL */
const arbNonGooglePlayLink: fc.Arbitrary<OutboundLink> = arbNonGooglePlayUrl.map(
  (url) => ({ type: "store" as CandidateLinkType, url, label: "Other Store" })
);

/**
 * Generate a mixed list of store links with controlled composition.
 * The flags control which priority tiers are present.
 */
const arbStoreLinkList = (options: {
  hasIntent: boolean;
  hasPlayWeb: boolean;
  hasMarket: boolean;
  extraNonGP?: number;
}): fc.Arbitrary<OutboundLink[]> => {
  const parts: fc.Arbitrary<OutboundLink[]>[] = [];

  if (options.hasIntent) {
    parts.push(fc.array(arbGooglePlayIntentLink, { minLength: 1, maxLength: 3 }));
  }
  if (options.hasPlayWeb) {
    parts.push(fc.array(arbPlayWebLink, { minLength: 1, maxLength: 3 }));
  }
  if (options.hasMarket) {
    parts.push(fc.array(arbMarketLink, { minLength: 1, maxLength: 3 }));
  }
  const extraCount = options.extraNonGP ?? 2;
  if (extraCount > 0) {
    parts.push(fc.array(arbNonGooglePlayLink, { minLength: 0, maxLength: extraCount }));
  }

  if (parts.length === 0) {
    return fc.constant([]);
  }

  return fc
    .tuple(...(parts as [fc.Arbitrary<OutboundLink[]>, ...fc.Arbitrary<OutboundLink[]>[]]))
    .chain((arrays) => {
      const combined = arrays.flat();
      // Shuffle to ensure order doesn't matter
      return fc.shuffledSubarray(combined, { minLength: combined.length, maxLength: combined.length });
    });
};

// ---------------------------------------------------------------------------
// Helper: classify a link into priority tiers
// ---------------------------------------------------------------------------

function isGooglePlayIntent(link: OutboundLink): boolean {
  return (
    link.url.toLowerCase().startsWith("intent://") &&
    link.url.toLowerCase().includes("com.android.vending")
  );
}

function isPlayWebLink(link: OutboundLink): boolean {
  return link.url.toLowerCase().includes("play.google.com");
}

function isMarketLink(link: OutboundLink): boolean {
  return link.url.toLowerCase().startsWith("market://");
}

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe("getGooglePlayLink — Property Tests", () => {
  // Feature: intl-android-deep-link-flow, Property 3: Google Play 链接优先级选择

  it("Property 3: Google Play 链接优先级选择 — **Validates: Requirements 2.2**", () => {
    /**
     * Strategy: generate store link lists with random composition of the
     * three priority tiers (intent, play.google.com, market://) plus
     * non-Google-Play links, then verify the returned link matches the
     * highest-priority tier present.
     */
    const arbHasIntent = fc.boolean();
    const arbHasPlayWeb = fc.boolean();
    const arbHasMarket = fc.boolean();

    fc.assert(
      fc.property(
        arbHasIntent,
        arbHasPlayWeb,
        arbHasMarket,
        (hasIntent, hasPlayWeb, hasMarket) => {
          // Build a store link list with the specified composition
          const listArb = arbStoreLinkList({
            hasIntent,
            hasPlayWeb,
            hasMarket,
            extraNonGP: 3,
          });

          // Run an inner assertion for each generated list
          fc.assert(
            fc.property(listArb, (storeLinks) => {
              const result = getGooglePlayLink(storeLinks);

              // Determine which priority tiers are present in the input
              const inputHasIntent = storeLinks.some(isGooglePlayIntent);
              const inputHasPlayWeb = storeLinks.some(isPlayWebLink);
              const inputHasMarket = storeLinks.some(isMarketLink);

              if (inputHasIntent) {
                // Priority 1: intent:// with com.android.vending should be returned
                expect(result).not.toBeNull();
                expect(isGooglePlayIntent(result!)).toBe(true);
              } else if (inputHasPlayWeb) {
                // Priority 2: play.google.com link should be returned
                expect(result).not.toBeNull();
                expect(isPlayWebLink(result!)).toBe(true);
              } else if (inputHasMarket) {
                // Priority 3: market:// link should be returned
                expect(result).not.toBeNull();
                expect(isMarketLink(result!)).toBe(true);
              } else {
                // No Google Play link available → null
                expect(result).toBeNull();
              }
            }),
            { numRuns: 20 } // Inner runs per outer combination
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

import { validateReturnTo } from "./deep-link-helpers";

/**
 * Property-based tests for validateReturnTo
 *
 * Feature: intl-android-deep-link-flow, Property 6: returnTo 参数验证
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

// ---------------------------------------------------------------------------
// Generators for Property 6
// ---------------------------------------------------------------------------

/** Characters safe for use in URL path segments */
const arbPathChar = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~'.split('')
);

/**
 * Generate a valid relative path starting with "/" but NOT "//".
 * These should be accepted by validateReturnTo.
 * Examples: "/", "/category/food", "/search?q=test"
 */
const arbValidReturnTo: fc.Arbitrary<string> = fc
  .record({
    segments: fc.array(
      fc.string({ minLength: 1, maxLength: 15, unit: arbPathChar }),
      { minLength: 0, maxLength: 5 }
    ),
  })
  .map(({ segments }) => {
    return "/" + segments.join("/");
  });

/**
 * Generate a string starting with "//" (protocol-relative URL).
 * These should be rejected by validateReturnTo (returns null).
 * Examples: "//evil.com", "//example.com/path"
 */
const arbProtocolRelativeUrl: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30, unit: arbPathChar })
  .map((rest) => `//${rest}`);

/**
 * Generate strings that do NOT start with "/".
 * These should be rejected by validateReturnTo (returns null).
 * Includes: empty string, http://, https://, javascript:, random strings, etc.
 */
const arbInvalidReturnTo: fc.Arbitrary<string> = fc.oneof(
  fc.constant(""),
  fc.constant("http://evil.com"),
  fc.constant("https://evil.com"),
  fc.constant("javascript:alert(1)"),
  fc.constant("data:text/html,<h1>hi</h1>"),
  // Random strings that don't start with "/"
  fc
    .string({ minLength: 1, maxLength: 30, unit: fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyz0123456789:@#?&='.split('')
    )})
    .filter((s) => !s.startsWith("/"))
);

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe("validateReturnTo — Property Tests", () => {
  // Feature: intl-android-deep-link-flow, Property 6: returnTo 参数验证

  it("Property 6.1: strings starting with '/' (but not '//') return the input string — **Validates: Requirements 6.1, 6.2, 6.3**", () => {
    fc.assert(
      fc.property(arbValidReturnTo, (input) => {
        // Valid relative paths starting with "/" (not "//") should be returned as-is
        const result = validateReturnTo(input);
        expect(result).toBe(input);
      }),
      { numRuns: 200 }
    );
  });

  it("Property 6.2: strings not starting with '/' return null — **Validates: Requirements 6.1, 6.2, 6.3**", () => {
    fc.assert(
      fc.property(arbInvalidReturnTo, (input) => {
        // Strings that don't start with "/" should return null
        const result = validateReturnTo(input);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it("Property 6.3: protocol-relative URLs ('//...') return null — **Validates: Requirements 6.1, 6.2, 6.3**", () => {
    fc.assert(
      fc.property(arbProtocolRelativeUrl, (input) => {
        // Protocol-relative URLs starting with "//" should return null
        const result = validateReturnTo(input);
        expect(result).toBeNull();
      }),
      { numRuns: 200 }
    );
  });

  it("Property 6.4: null input returns null — **Validates: Requirements 6.1, 6.2, 6.3**", () => {
    // Deterministic check: null → null
    const result = validateReturnTo(null);
    expect(result).toBeNull();
  });
});

import { decodeCandidateLink } from "./deep-link-helpers";
import { encodeCandidateLinkToQueryParam } from "./outbound-url";

/**
 * Property-based tests for CandidateLink encode/decode round-trip
 *
 * Feature: intl-android-deep-link-flow, Property 5: CandidateLink 编解码 Round-Trip
 * **Validates: Requirements 5.3**
 */

// ---------------------------------------------------------------------------
// Generators for Property 5
// ---------------------------------------------------------------------------

/**
 * Allowed domains from platform-validator.ts that will pass isAllowedOutboundUrl.
 * We use a subset of well-known domains from PLATFORM_DOMAINS.
 */
const allowedDomains = [
  "youtube.com",
  "amazon.com",
  "google.com",
  "spotify.com",
  "netflix.com",
  "imdb.com",
  "ebay.com",
  "walmart.com",
  "target.com",
  "yelp.com",
  "tiktok.com",
  "booking.com",
  "airbnb.com",
  "agoda.com",
  "ubereats.com",
  "doordash.com",
  "pinterest.com",
] as const;

/** Characters safe for URL path segments */
const arbSafePathChar = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')
);

/** Generate a safe path segment */
const arbPathSegment = fc.string({ minLength: 1, maxLength: 12, unit: arbSafePathChar });

/**
 * Generate a valid HTTPS URL using an allowed domain.
 * These URLs will pass isAllowedOutboundUrl validation.
 */
const arbAllowedUrl: fc.Arbitrary<string> = fc
  .record({
    domain: fc.constantFrom(...allowedDomains),
    subdomain: fc.constantFrom("www.", "m.", ""),
    path: fc.array(arbPathSegment, { minLength: 0, maxLength: 3 }),
  })
  .map(({ domain, subdomain, path }) => {
    const pathStr = path.length > 0 ? "/" + path.join("/") : "";
    return `https://${subdomain}${domain}${pathStr}`;
  });

/**
 * Primary link types that are valid for CandidateLink primary field.
 * We use "web" and "universal_link" since they use https:// URLs
 * that can pass isAllowedOutboundUrl.
 */
const arbPrimaryType = fc.constantFrom<CandidateLinkType>("web", "universal_link");

/** Generate a primary OutboundLink with an allowed URL */
const arbAllowedPrimaryLink: fc.Arbitrary<OutboundLink> = fc
  .record({
    type: arbPrimaryType,
    url: arbAllowedUrl,
    label: fc.oneof(fc.constant(undefined), fc.constantFrom("", "general", "Android", "iOS")),
  })
  .map(({ type, url, label }) => ({
    type,
    url,
    ...(label !== undefined ? { label } : {}),
  }));

/** Fallback link types that use allowed URLs */
const arbFallbackType = fc.constantFrom<CandidateLinkType>("web", "universal_link", "store");

/** Generate a fallback OutboundLink with an allowed URL */
const arbAllowedFallbackLink: fc.Arbitrary<OutboundLink> = fc
  .record({
    type: arbFallbackType,
    url: arbAllowedUrl,
    label: fc.oneof(fc.constant(undefined), fc.constantFrom("", "general", "Android")),
  })
  .map(({ type, url, label }) => ({
    type,
    url,
    ...(label !== undefined ? { label } : {}),
  }));

/** Characters safe for provider names and titles (ASCII + some unicode) */
const arbSafeTextChar = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'.split('')
);

/** Generate a non-empty provider name */
const arbProvider = fc.string({ minLength: 1, maxLength: 20, unit: arbSafeTextChar }).filter(s => s.trim().length > 0);

/** Generate a non-empty title */
const arbTitle = fc.string({ minLength: 1, maxLength: 30, unit: arbSafeTextChar }).filter(s => s.trim().length > 0);

/**
 * Generate a valid CandidateLink that will pass decodeCandidateLink validation:
 * - provider and title are non-empty strings
 * - primary has a valid type and an allowed URL
 * - fallbacks use allowed URLs (so they survive the security filter)
 */
const arbValidCandidateLink: fc.Arbitrary<CandidateLink> = fc.record({
  provider: arbProvider,
  title: arbTitle,
  primary: arbAllowedPrimaryLink,
  fallbacks: fc.array(arbAllowedFallbackLink, { minLength: 0, maxLength: 5 }),
});

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe("CandidateLink encode/decode round-trip — Property Tests", () => {
  // Feature: intl-android-deep-link-flow, Property 5: CandidateLink 编解码 Round-Trip
  it("Property 5: CandidateLink 编解码 Round-Trip — **Validates: Requirements 5.3**", () => {
    fc.assert(
      fc.property(arbValidCandidateLink, (candidateLink) => {
        // Encode the CandidateLink to a base64url query parameter
        const encoded = encodeCandidateLinkToQueryParam(candidateLink);

        // Decode it back
        const { candidateLink: decoded, error } = decodeCandidateLink(encoded, "en");

        // Should decode without error
        expect(error).toBeNull();
        expect(decoded).not.toBeNull();

        // provider should match
        expect(decoded!.provider).toBe(candidateLink.provider);

        // title should match
        expect(decoded!.title).toBe(candidateLink.title);

        // primary.type should match
        expect(decoded!.primary.type).toBe(candidateLink.primary.type);

        // primary.url should match
        expect(decoded!.primary.url).toBe(candidateLink.primary.url);
      }),
      { numRuns: 200 }
    );
  });
});
