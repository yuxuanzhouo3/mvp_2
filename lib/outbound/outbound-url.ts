import type { CandidateLink } from "@/lib/types/recommendation";

export function encodeCandidateLinkToQueryParam(candidateLink: CandidateLink): string {
  const json = JSON.stringify(candidateLink);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function buildOutboundHref(candidateLink: CandidateLink): string {
  const data = encodeCandidateLinkToQueryParam(candidateLink);
  return `/outbound?data=${encodeURIComponent(data)}`;
}

