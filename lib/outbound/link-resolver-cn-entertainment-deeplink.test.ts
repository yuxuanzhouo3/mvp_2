import { describe, expect, it } from "vitest";
import { getAutoTryLinks } from "./deep-link-helpers";
import { resolveCandidateLink } from "./link-resolver";

function decodeKugouSearchPayload(url: string): Record<string, any> {
  const query = url
    .replace(/^intent:\/\/[^?]*\?/, "")
    .replace(/^kugouurl:\/\/[^?]*\?/, "")
    .replace(/#Intent.*$/i, "");
  const params = new URLSearchParams(query);
  return {
    cmd: Number(params.get("cmd")),
    jsonStr: JSON.parse(params.get("jsonStr") || "{}"),
  };
}

describe("resolveCandidateLink CN entertainment mobile deep links", () => {
  it("TapTap Android auto-try uses https intent first and keeps search keyword", () => {
    const query = "genshin impact";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "TapTap",
      isMobile: true,
      os: "android",
    });

    const autoTry = getAutoTryLinks(result, "android");
    expect(autoTry.length).toBeGreaterThan(0);
    expect(result.primary.type).toBe("intent");
    expect(autoTry[0]?.type).toBe("intent");
    expect(autoTry[0]?.url).toContain(`intent://www.taptap.cn/search/${encodeURIComponent(query)}`);
    expect(autoTry[0]?.url).toContain("scheme=https");
    expect(autoTry[0]?.url).toContain("package=com.taptap");

    expect(autoTry.some((link) => link.type === "intent")).toBe(true);

    const webFallback = result.fallbacks.find((link) => link.type === "web");
    expect(webFallback?.url).toBe(`https://www.taptap.cn/search/${encodeURIComponent(query)}`);
  });

  it("Tencent Video Android auto-try uses https intent first and keeps search keyword", () => {
    const query = "流浪地球2";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "腾讯视频",
      isMobile: true,
      os: "android",
    });

    expect(result.primary.type).toBe("intent");
    expect(result.primary.url).toContain("intent://v.qq.com/x/search/?q=");
    expect(result.primary.url).toContain(`q=${encodeURIComponent(query)}`);
    expect(result.primary.url).toContain("scheme=https");
    expect(result.primary.url).toContain("package=com.tencent.qqlive");

    const autoTry = getAutoTryLinks(result, "android");
    expect(autoTry[0]?.type).toBe("intent");
    expect(autoTry[0]?.url).toContain(`q=${encodeURIComponent(query)}`);

    const webFallback = result.fallbacks.find((link) => link.type === "web");
    expect(webFallback?.url).toBe(`https://v.qq.com/x/search/?q=${encodeURIComponent(query)}`);
  });

  it("QQ Music Android auto-try uses https intent first and keeps search keyword", () => {
    const query = "周杰伦 晴天";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "QQ音乐",
      isMobile: true,
      os: "android",
    });

    expect(result.primary.type).toBe("intent");
    expect(result.primary.url).toContain("intent://y.qq.com/n/ryqq/search?w=");
    expect(result.primary.url).toContain(`w=${encodeURIComponent(query)}`);
    expect(result.primary.url).toContain("scheme=https");
    expect(result.primary.url).toContain("package=com.tencent.qqmusic");

    const autoTry = getAutoTryLinks(result, "android");
    expect(autoTry[0]?.type).toBe("intent");
    expect(autoTry[0]?.url).toContain(`w=${encodeURIComponent(query)}`);

    const webFallback = result.fallbacks.find((link) => link.type === "web");
    expect(webFallback?.url).toBe(`https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(query)}`);
  });

  it("Kugou Android intent uses cmd=116 payload and carries keyword", () => {
    const query = "jay chou rice fragrance";

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

    const primaryPayload = decodeKugouSearchPayload(result.primary.url);
    expect(primaryPayload.cmd).toBe(116);
    expect(primaryPayload.jsonStr?.keyword).toBe(query);

    const autoTry = getAutoTryLinks(result, "android");
    expect(autoTry[0]?.type).toBe("app");
    expect(autoTry[0]?.url).toContain("kugouurl://start.music/?");

    const androidIntent = autoTry.find(
      (link) => link.type === "intent" && link.url.includes("package=com.kugou.android")
    );

    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain("intent://start.music/?");
    expect(androidIntent?.url).toContain("scheme=kugouurl");

    const intentPayload = decodeKugouSearchPayload(androidIntent!.url);
    expect(intentPayload.cmd).toBe(116);
    expect(intentPayload.jsonStr?.keyword).toBe(query);
    expect(intentPayload.jsonStr?.searchKeyWord).toBe(query);
  });

  it("NetEase Cloud Music Android prefers app scheme and keeps keyword intent fallback", () => {
    const query = "周杰伦 晴天";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "网易云音乐",
      isMobile: true,
      os: "android",
    });

    expect(result.primary.type).toBe("app");
    expect(result.primary.url).toContain("orpheus://search?keyword=");
    expect(result.primary.url).toContain(`keyword=${encodeURIComponent(query)}`);

    const autoTry = getAutoTryLinks(result, "android");
    expect(autoTry.length).toBeGreaterThan(0);
    expect(autoTry[0]?.type).toBe("app");
    expect(autoTry[0]?.url).toContain(`keyword=${encodeURIComponent(query)}`);

    const androidIntent = autoTry.find(
      (link) => link.type === "intent" && link.url.includes("package=com.netease.cloudmusic")
    );
    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain(`keyword=${encodeURIComponent(query)}`);
  });

  it("TapTap iOS auto-try prioritizes app scheme before universal link", () => {
    const query = "honkai star rail";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "TapTap",
      isMobile: true,
    });

    const autoTry = getAutoTryLinks(result, "ios");
    expect(autoTry.length).toBeGreaterThan(0);
    expect(autoTry[0]?.type).toBe("app");
    expect(autoTry[0]?.url).toContain("taptap://");
    expect(autoTry.some((link) => link.type === "universal_link")).toBe(true);
  });

  it("Youku Android auto-try prioritizes app scheme and keeps keyword intent fallback", () => {
    const query = "庆余年 第二季";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "优酷",
      isMobile: true,
    });

    const autoTry = getAutoTryLinks(result, "android");
    expect(autoTry.length).toBeGreaterThan(0);
    expect(autoTry[0]?.type).toBe("app");
    expect(autoTry[0]?.url).toContain("youku://search?keyword=");

    const androidIntent = autoTry.find(
      (link) => link.type === "intent" && link.url.includes("package=com.youku.phone")
    );
    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain(`keyword=${encodeURIComponent(query)}`);
    expect(androidIntent?.url).toContain("scheme=youku");

    const webFallback = result.fallbacks.find((link) => link.type === "web");
    expect(webFallback?.url).toBe(`https://so.youku.com/search_video/q_${encodeURIComponent(query)}`);
  });

  it("iQIYI Android auto-try prioritizes app scheme with keyword and keeps keyword intent fallback", () => {
    const query = "狂飙";

    const result = resolveCandidateLink({
      title: query,
      query,
      category: "entertainment",
      locale: "zh",
      region: "CN",
      provider: "爱奇艺",
      isMobile: true,
      os: "android",
    });

    expect(result.primary.type).toBe("app");
    expect(result.primary.url).toContain("iqiyi://mobile/search?keyword=");
    expect(result.primary.url).toContain(`keyword=${encodeURIComponent(query)}`);

    const autoTry = getAutoTryLinks(result, "android");
    expect(autoTry.length).toBeGreaterThan(0);
    expect(autoTry[0]?.type).toBe("app");
    expect(autoTry[0]?.url).toContain(`keyword=${encodeURIComponent(query)}`);

    const androidIntent = autoTry.find(
      (link) => link.type === "intent" && link.url.includes("package=com.qiyi.video")
    );
    expect(androidIntent).toBeTruthy();
    expect(androidIntent?.url).toContain(`keyword=${encodeURIComponent(query)}`);
    expect(androidIntent?.url).toContain("scheme=iqiyi");

    const webFallback = result.fallbacks.find((link) => link.type === "web");
    expect(webFallback?.url).toBe(`https://so.iqiyi.com/so/q_${encodeURIComponent(query)}`);
  });
});
