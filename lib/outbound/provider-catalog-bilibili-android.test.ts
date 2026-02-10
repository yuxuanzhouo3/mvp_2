import { describe, expect, it } from "vitest";
import { getProviderCatalog } from "./provider-catalog";

describe("provider-catalog Bilibili Android deep link", () => {
  it("uses Android intent link with package and web fallback", () => {
    const provider = getProviderCatalog()["B站"];

    const android = provider.androidScheme?.({
      title: "健身视频",
      query: "居家燃脂训练 15分钟",
      category: "fitness",
      locale: "zh",
      region: "CN",
    });

    expect(android).toBeTruthy();
    expect(android).toContain("intent://search?keyword=");
    expect(android).toContain("scheme=bilibili");
    expect(android).toContain("package=tv.danmaku.bili");
    expect(android).toContain("S.browser_fallback_url=");
    expect(android).toContain("search.bilibili.com%2Fall%3Fkeyword%3D");
  });
});
