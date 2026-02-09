import { describe, expect, it } from "vitest";
import { buildOutboundHref } from "./outbound-url";
import { decodeCandidateLink } from "./deep-link-helpers";
import { resolveCandidateLink } from "./link-resolver";
import type { CandidateLink, RecommendationCategory } from "@/lib/types/recommendation";

const baseCandidate: CandidateLink = {
  provider: "Google",
  title: "Test",
  primary: { type: "web", url: "https://google.com/search?q=test" },
  fallbacks: [],
  metadata: { region: "INTL", category: "shopping", locale: "en" },
};

describe("buildOutboundHref", () => {
  it("builds outbound URL with encoded data", () => {
    const href = buildOutboundHref(baseCandidate);
    expect(href.startsWith("/outbound?data=")).toBe(true);

    const url = new URL(href, "https://example.com");
    const data = url.searchParams.get("data");
    expect(data).toBeTruthy();

    const decoded = decodeCandidateLink(data!, "en");
    expect(decoded.error).toBeNull();
    expect(decoded.candidateLink?.provider).toBe(baseCandidate.provider);
    expect(decoded.candidateLink?.title).toBe(baseCandidate.title);
    expect(decoded.candidateLink?.primary.url).toBe(baseCandidate.primary.url);
  });

  it("appends returnTo when it is a valid relative path", () => {
    const href = buildOutboundHref(baseCandidate, "/category/shopping?foo=1");
    const url = new URL(href, "https://example.com");

    expect(url.searchParams.get("returnTo")).toBe("/category/shopping?foo=1");
  });

  it("does not append returnTo when it is invalid", () => {
    const href = buildOutboundHref(baseCandidate, "https://evil.com");
    const url = new URL(href, "https://example.com");

    expect(url.searchParams.get("returnTo")).toBeNull();
  });
});

describe("Category deep-link flow consistency", () => {
  const categories: RecommendationCategory[] = [
    "entertainment",
    "shopping",
    "food",
    "travel",
    "fitness",
  ];

  it("uses resolveCandidateLink + buildOutboundHref consistently across five categories", () => {
    for (const category of categories) {
      const candidate = resolveCandidateLink({
        title: `${category} title`,
        query: `${category} query`,
        category,
        locale: "en",
        region: "INTL",
        provider: "Google",
        isMobile: true,
      });

      const returnTo = `/category/${category}`;
      const href = buildOutboundHref(candidate, returnTo);
      const url = new URL(href, "https://example.com");
      const data = url.searchParams.get("data");

      expect(url.pathname).toBe("/outbound");
      expect(data).toBeTruthy();
      expect(url.searchParams.get("returnTo")).toBe(returnTo);

      const decoded = decodeCandidateLink(data!, "en");
      expect(decoded.error).toBeNull();
      expect(decoded.candidateLink?.metadata?.category).toBe(category);
      expect(decoded.candidateLink?.provider).toBe(candidate.provider);
      expect(decoded.candidateLink?.primary.url).toBe(candidate.primary.url);
    }
  });
});
