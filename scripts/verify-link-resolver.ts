import assert from "node:assert/strict";
import { resolveCandidateLink } from "../lib/outbound/link-resolver";
import { isAllowedOutboundUrl } from "../lib/search/platform-validator";
import type { RecommendationCategory } from "../lib/types/recommendation";

type Case = {
  name: string;
  input: {
    title: string;
    query: string;
    category: RecommendationCategory;
    locale: "zh" | "en";
    region: "CN" | "INTL";
    provider: string;
  };
};

const cases: Case[] = [
  {
    name: "CN food meituan",
    input: {
      title: "3公里内性价比最高外卖",
      query: "外卖 性价比 3公里",
      category: "food",
      locale: "zh",
      region: "CN",
      provider: "美团",
    },
  },
  {
    name: "CN entertainment bilibili",
    input: {
      title: "入门吉他教程",
      query: "入门 吉他 教程",
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "B站",
    },
  },
  {
    name: "INTL food ubereats",
    input: {
      title: "Best tacos near me",
      query: "tacos near me",
      category: "food",
      locale: "en",
      region: "INTL",
      provider: "Uber Eats",
    },
  },
  {
    name: "INTL travel google maps",
    input: {
      title: "Kyoto sightseeing",
      query: "Kyoto attractions",
      category: "travel",
      locale: "en",
      region: "INTL",
      provider: "Google Maps",
    },
  },
];

function validateCandidateLink(name: string, candidateLink: ReturnType<typeof resolveCandidateLink>) {
  assert.ok(candidateLink.primary?.url, `${name}: primary url missing`);
  assert.ok(isAllowedOutboundUrl(candidateLink.primary.url), `${name}: primary url not allowed`);
  assert.ok(Array.isArray(candidateLink.fallbacks), `${name}: fallbacks not array`);
  for (const fb of candidateLink.fallbacks) {
    assert.ok(fb.url, `${name}: fallback url missing`);
    assert.ok(isAllowedOutboundUrl(fb.url), `${name}: fallback url not allowed`);
  }

  const hasStore = candidateLink.fallbacks.some((l) => l.type === "store");
  assert.ok(hasStore, `${name}: expected store fallback links`);
}

for (const c of cases) {
  const candidateLink = resolveCandidateLink(c.input);
  validateCandidateLink(c.name, candidateLink);
}

console.log(`[verify-link-resolver] OK (${cases.length} cases)`);
