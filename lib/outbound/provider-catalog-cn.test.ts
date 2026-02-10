import { describe, it, expect } from "vitest";
import { getWeightedProvidersForCategory } from "./provider-catalog";
import type { RecommendationCategory } from "@/lib/types/recommendation";

const CATEGORIES: RecommendationCategory[] = [
  "entertainment",
  "shopping",
  "food",
  "travel",
  "fitness",
];

function names(category: RecommendationCategory, isMobile?: boolean) {
  return getWeightedProvidersForCategory(category, "CN", isMobile).map((item) => item.provider);
}

describe("CN platform policy (assistant)", () => {
  it("CN web entertainment should use specified web sources", () => {
    const providers = names("entertainment", false);
    expect(providers).toEqual(["腾讯视频", "TapTap", "Steam", "酷狗音乐", "笔趣阁"]);
  });

  it("CN web shopping should use JD + SMZDM + Manmanbuy", () => {
    const providers = names("shopping", false);
    expect(providers).toEqual(["京东", "什么值得买", "慢慢买"]);
  });

  it("CN web food should include recipe + map + review + xhs", () => {
    const providers = names("food", false);
    expect(providers).toEqual(["下厨房", "高德地图", "大众点评", "小红书"]);
  });

  it("CN web travel should use Ctrip + Mafengwo + Qyer", () => {
    const providers = names("travel", false);
    expect(providers).toEqual(["携程", "马蜂窝", "穷游"]);
  });

  it("CN web fitness should use Bilibili + Zhihu + SMZDM", () => {
    const providers = names("fitness", false);
    expect(providers).toEqual(["B站", "知乎", "什么值得买"]);
  });

  it("CN Android entertainment should include video/game/music/article apps", () => {
    const providers = names("entertainment", true);
    expect(providers).toContain("腾讯视频");
    expect(providers).toContain("优酷");
    expect(providers).toContain("爱奇艺");
    expect(providers).toContain("TapTap");
    expect(providers).toContain("网易云音乐");
    expect(providers).toContain("酷狗音乐");
    expect(providers).toContain("QQ音乐");
    expect(providers).toContain("百度");
  });

  it("CN Android shopping should include JD/Taobao/PDD/VIP", () => {
    const providers = names("shopping", true);
    expect(providers).toEqual(["京东", "淘宝", "拼多多", "唯品会"]);
  });

  it("CN Android food should include review/takeout/map apps", () => {
    const providers = names("food", true);
    expect(providers).toContain("小红书");
    expect(providers).toContain("大众点评");
    expect(providers).toContain("美团");
    expect(providers).toContain("淘宝闪购");
    expect(providers).toContain("京东秒送");
    expect(providers).toContain("腾讯地图");
    expect(providers).toContain("百度地图");
    expect(providers).toContain("高德地图");
  });

  it("CN Android travel should include Ctrip/Qunar/Mafengwo", () => {
    const providers = names("travel", true);
    expect(providers).toEqual(["携程", "去哪儿", "马蜂窝"]);
  });

  it("CN Android fitness should include Meituan/Amap/Bilibili", () => {
    const providers = names("fitness", true);
    expect(providers).toEqual(["B站", "美团", "高德地图"]);
  });

  it("all CN weights should sum to around 1", () => {
    for (const category of CATEGORIES) {
      const webSum = getWeightedProvidersForCategory(category, "CN", false).reduce((sum, item) => sum + item.weight, 0);
      const mobileSum = getWeightedProvidersForCategory(category, "CN", true).reduce((sum, item) => sum + item.weight, 0);
      expect(webSum).toBeCloseTo(1, 2);
      expect(mobileSum).toBeCloseTo(1, 2);
    }
  });
});
