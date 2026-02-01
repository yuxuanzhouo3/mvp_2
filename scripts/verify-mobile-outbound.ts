import assert from "node:assert/strict";
import { resolveCandidateLink } from "@/lib/outbound/link-resolver";
import { isAllowedOutboundUrl } from "@/lib/search/platform-validator";
import { generatePreferenceHash } from "@/lib/services/recommendation-service";

function assertCandidateLinkAllowed(label: string, input: Parameters<typeof resolveCandidateLink>[0]) {
  const cl = resolveCandidateLink(input);
  assert.ok(cl.primary?.url, `${label}: missing primary.url`);
  assert.ok(isAllowedOutboundUrl(cl.primary.url), `${label}: primary not allowed: ${cl.primary.url}`);
  for (const fb of cl.fallbacks) {
    assert.ok(isAllowedOutboundUrl(fb.url), `${label}: fallback not allowed: ${fb.type} ${fb.url}`);
  }
}

function main() {
  assertCandidateLinkAllowed("JD search", {
    title: "羽绒服推荐",
    query: "羽绒服",
    category: "shopping",
    locale: "zh",
    region: "CN",
    provider: "京东",
  });

  assertCandidateLinkAllowed("Taobao search", {
    title: "运动鞋推荐",
    query: "运动鞋",
    category: "shopping",
    locale: "zh",
    region: "CN",
    provider: "淘宝",
  });

  assertCandidateLinkAllowed("Meituan Waimai search", {
    title: "麻辣烫外卖",
    query: "麻辣烫",
    category: "food",
    locale: "zh",
    region: "CN",
    provider: "美团外卖",
  });

  assertCandidateLinkAllowed("TapTap search", {
    title: "游戏推荐",
    query: "二次元 RPG",
    category: "entertainment",
    locale: "zh",
    region: "CN",
    provider: "TapTap",
  });

  const hashA = generatePreferenceHash(
    { user_id: "u", category: "shopping", preferences: { a: 2, b: 1 } } as any,
    [{ title: "A", clicked: true }]
  );
  const hashB = generatePreferenceHash(
    { user_id: "u", category: "shopping", preferences: { a: 2, b: 1 } } as any,
    [{ title: "B", clicked: true }]
  );
  assert.notEqual(hashA, hashB, "preference hash should change with recent clicked titles");

  console.log("verify-mobile-outbound: OK");
}

main();

