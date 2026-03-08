import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecommendationCard } from "./RecommendationCard";

describe("RecommendationCard zh copy", () => {
  it("renders clean zh labels for AI badge and CTA", () => {
    const html = renderToStaticMarkup(
      React.createElement(RecommendationCard, {
        recommendation: {
          title: "宇宙探索编辑部",
          description: "硬核科幻喜剧，用荒诞视角解构外星文明与人类执念。",
          category: "entertainment",
          link: "https://example.com",
          linkType: "video",
          metadata: {},
          reason: "小众但质量很高，脑洞大开不烧脑。",
          platform: "腾讯视频",
          tags: ["科幻", "喜剧"],
        },
        category: "entertainment",
        locale: "zh",
      })
    );

    expect(html).toContain("AI 推荐");
    expect(html).toContain("查看详情");
    expect(html).toContain("收藏");
    expect(html).toContain("不感兴趣");
  });
});
