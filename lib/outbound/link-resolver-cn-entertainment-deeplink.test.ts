import { describe, expect, it } from "vitest";
import { getAutoTryLinks } from "./deep-link-helpers";
import { resolveCandidateLink } from "./link-resolver";

function decodeOpaqueSearchPayload(url: string): Record<string, any> {
  const parsed = new URL(url);
  const encodedPayload = parsed.search.replace(/^\?/, "");
  const decoded = decodeURIComponent(encodedPayload);
  return JSON.parse(decoded) as Record<string, any>;
}

describe("resolveCandidateLink CN entertainment mobile deep links", () => {
  it("TapTap Android intent keeps keyword in /search/{keyword}", () => {
    const query = "原神";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "TapTap",
      isMobile: true,
    });

    const autoTry = getAutoTryLinks(result, "android");
    expect(autoTry.length).toBeGreaterThan(0);
    expect(autoTry[0]?.type).toBe("intent");
    expect(autoTry[0]?.url).toContain("package=com.taptap");
    expect(autoTry[0]?.url).toContain("scheme=https");
    expect(autoTry[0]?.url).toContain(`intent://www.taptap.cn/search/${encodeURIComponent(query)}`);
    expect(autoTry[0]?.url).not.toContain("keyword=");

    const webFallback = result.fallbacks.find((link) => link.type === "web");
    expect(webFallback?.url).toBe(`https://www.taptap.cn/search/${encodeURIComponent(query)}`);
  });

  it("Kugou Android intent uses cmd=116 payload and carries keyword", () => {
    const query = "周杰伦 稻香";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "kugou",
      isMobile: true,
    });

    expect(result.primary.type).toBe("app");
    expect(result.primary.url).toContain("kugouurl://start.music/?");

    const primaryPayload = decodeOpaqueSearchPayload(result.primary.url);
    expect(primaryPayload.cmd).toBe(116);
    expect(primaryPayload.jsonStr?.keyword).toBe(query);

    const autoTry = getAutoTryLinks(result, "android");
    const androidIntent = autoTry.find(
      (link) => link.type === "intent" && link.url.includes("package=com.kugou.android")
    );

    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain("intent://start.music/?");
    expect(androidIntent?.url).toContain("scheme=kugouurl");

    const intentPayload = decodeOpaqueSearchPayload(androidIntent!.url);
    expect(intentPayload.cmd).toBe(116);
    expect(intentPayload.jsonStr?.keyword).toBe(query);
    expect(intentPayload.jsonStr?.searchKeyWord).toBe(query);
  });
});
