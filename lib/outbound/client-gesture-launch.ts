import type { AIRecommendation, CandidateLink, OutboundLink } from "@/lib/types/recommendation";
import { buildOutboundHref } from "@/lib/outbound/outbound-url";
import { detectMobileOs, getAutoTryLinks } from "@/lib/outbound/deep-link-helpers";
import type { MobileOs } from "@/lib/outbound/provider-catalog";

export function buildFallbackCandidateLink(recommendation: AIRecommendation): CandidateLink {
  return {
    provider: recommendation.platform || "Web",
    title: recommendation.title,
    primary: { type: "web", url: recommendation.link, label: "Web" },
    fallbacks: [],
    metadata: {
      source: "client_fallback",
      category: recommendation.category,
      platform: recommendation.platform,
    },
  };
}

export function buildRecommendationGestureLaunchPlan(
  recommendation: AIRecommendation,
  returnTo: string,
  currentOs?: MobileOs
): {
  candidateLink: CandidateLink;
  outboundHref: string;
  firstDeepLink: OutboundLink | null;
} {
  const candidateLink = recommendation.candidateLink ?? buildFallbackCandidateLink(recommendation);
  const outboundHref = buildOutboundHref(candidateLink, returnTo);
  const os = currentOs ?? detectMobileOs();
  const firstDeepLink =
    getAutoTryLinks(candidateLink, os).find(
      (item) => item.type === "app" || item.type === "intent"
    ) ?? null;

  return {
    candidateLink,
    outboundHref,
    firstDeepLink,
  };
}

export function openDeepLinkWithGesture(url: string) {
  if (url.startsWith("intent://")) {
    window.location.href = url;
    return;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const os = detectMobileOs();
    if (os === "android") {
      window.location.href = url;
      return;
    }

    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      window.setTimeout(() => {
        try {
          document.body.removeChild(anchor);
        } catch {
          // ignore cleanup errors
        }
      }, 100);
      return;
    } catch {
      // fall through
    }

    window.location.href = url;
    return;
  }

  window.location.href = url;
}

export function launchRecommendationViaGestureOrOutbound(
  recommendation: AIRecommendation,
  returnTo: string
) {
  const { outboundHref, firstDeepLink } = buildRecommendationGestureLaunchPlan(
    recommendation,
    returnTo
  );

  if (!firstDeepLink) {
    window.location.href = outboundHref;
    return;
  }

  const cleanup = (() => {
    let cleaned = false;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        cleanup();
      }
    };

    const onBlur = () => {
      window.setTimeout(() => {
        if (document.visibilityState === "hidden") {
          cleanup();
        }
      }, 120);
    };

    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        window.location.href = outboundHref;
      }
      cleanup();
    }, 1400);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      if (cleaned) return;
      cleaned = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  })();

  try {
    openDeepLinkWithGesture(firstDeepLink.url);
  } catch {
    cleanup();
    window.location.href = outboundHref;
  }
}
