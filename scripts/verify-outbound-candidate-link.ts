import assert from "node:assert/strict";
import { resolveCandidateLink } from "@/lib/outbound/link-resolver";
import { mapSearchPlatformToProvider } from "@/lib/outbound/provider-mapping";

type Case = {
  title: string;
  query: string;
  category: "entertainment" | "shopping" | "food" | "travel" | "fitness";
  locale: "zh" | "en";
  region: "CN" | "INTL";
  platform: string;
  expectPrimaryType?: string;
  expectHasAndroidStore?: boolean;
};

const cases: Case[] = [
  {
    title: "随机购物：手机壳",
    query: "手机壳",
    category: "shopping",
    locale: "zh",
    region: "CN",
    platform: "京东",
    expectPrimaryType: "app",
    expectHasAndroidStore: true,
  },
  {
    title: "随机吃：火锅",
    query: "火锅",
    category: "food",
    locale: "zh",
    region: "CN",
    platform: "饿了么",
    expectPrimaryType: "app",
    expectHasAndroidStore: true,
  },
  {
    title: "随机吃：烧烤",
    query: "烧烤",
    category: "food",
    locale: "zh",
    region: "CN",
    platform: "大众点评",
    expectPrimaryType: "universal_link",
    expectHasAndroidStore: true,
  },
];

for (const c of cases) {
  const provider = mapSearchPlatformToProvider(c.platform, c.locale);
  const candidateLink = resolveCandidateLink({
    title: c.title,
    query: c.query,
    category: c.category,
    locale: c.locale,
    region: c.region,
    provider,
  });

  assert.ok(candidateLink.title, "candidateLink.title should exist");
  assert.ok(candidateLink.primary?.url, "candidateLink.primary.url should exist");
  if (c.expectPrimaryType) {
    assert.equal(candidateLink.primary.type, c.expectPrimaryType);
  }

  if (c.expectHasAndroidStore) {
    const hasMarket = candidateLink.fallbacks.some((l) => l.type === "store" && l.url.startsWith("market://details?id="));
    assert.ok(hasMarket, `${c.platform} should provide an Android market:// store link`);
  }
}

console.log("verify-outbound-candidate-link: OK");
