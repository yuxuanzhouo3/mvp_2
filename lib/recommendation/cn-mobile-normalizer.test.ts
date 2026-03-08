import { describe, expect, it } from "vitest";
import {
  normalizeCnMobileCategoryPlatform,
  normalizeCnMobileFitnessRecommendation,
  stripCnFoodGenericTerms,
} from "./cn-mobile-normalizer";

describe("normalizeCnMobileCategoryPlatform", () => {
  it("maps fitness nearby_place to 美团 on first slot", () => {
    const platform = normalizeCnMobileCategoryPlatform({
      category: "fitness",
      platform: "美团",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 0,
      fitnessType: "nearby_place",
    });
    expect(platform).toBe("美团");
  });

  it("maps fitness nearby_place to 高德地图 on second slot", () => {
    const platform = normalizeCnMobileCategoryPlatform({
      category: "fitness",
      platform: "美团",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 1,
      fitnessType: "nearby_place",
    });
    expect(platform).toBe("高德地图");
  });

  it("maps fitness equipment to 京东", () => {
    const platform = normalizeCnMobileCategoryPlatform({
      category: "fitness",
      platform: "B站健身",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 0,
      fitnessType: "equipment",
    });
    expect(platform).toBe("京东");
  });

  it("maps fitness tutorial to B站", () => {
    const platform = normalizeCnMobileCategoryPlatform({
      category: "fitness",
      platform: "哔哩哔哩",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 0,
      fitnessType: "tutorial",
    });
    expect(platform).toBe("B站");
  });

  it("maps food 腾讯/百度地图美食 to 小红书 in CN app", () => {
    const tencentMapFood = normalizeCnMobileCategoryPlatform({
      category: "food",
      platform: "腾讯地图美食",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 0,
    });
    const baiduMapFood = normalizeCnMobileCategoryPlatform({
      category: "food",
      platform: "百度地图美食",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 1,
    });

    expect(tencentMapFood).toBe("小红书");
    expect(baiduMapFood).toBe("小红书");
  });

  it("does not change platform for CN web", () => {
    const platform = normalizeCnMobileCategoryPlatform({
      category: "food",
      platform: "腾讯地图美食",
      client: "web",
      isMobile: false,
      locale: "zh",
      index: 0,
    });
    expect(platform).toBe("腾讯地图美食");
  });
});

describe("stripCnFoodGenericTerms", () => {
  it("removes generic words like 推荐/附近/美食/餐厅", () => {
    expect(stripCnFoodGenericTerms("附近 美食 推荐 宫保鸡丁 餐厅")).toBe(
      "宫保鸡丁"
    );
  });
});

describe("normalizeCnMobileFitnessRecommendation", () => {
  it("rewrites equipment content to JD shopping intent", () => {
    const result = normalizeCnMobileFitnessRecommendation({
      title: "哑铃使用教程：动作要点与常见错误",
      description: "哑铃训练动作要点与发力细节，避免肩肘受伤，适合家庭训练入门",
      reason: "根据“器材”需求生成的使用教程推荐",
      searchQuery: "哑铃 使用教程 怎么用 动作要点 入门",
      tags: ["哑铃", "使用教程", "动作要点", "入门"],
      platform: "B站健身",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 0,
      fitnessType: "equipment",
    });

    expect(result.platform).toBe("京东");
    expect(result.title).toBe("哑铃健身器材推荐");
    expect(result.searchQuery).toBe("哑铃 健身器材 推荐 京东");
    expect(result.reason).toContain("京东");
    expect(result.description).toContain("承重");
    expect(result.tags).toEqual(["哑铃", "健身器材", "推荐", "京东"]);
  });

  it("keeps tutorial query aligned with video intent", () => {
    const result = normalizeCnMobileFitnessRecommendation({
      title: "20分钟腹肌燃脂训练",
      searchQuery: "20分钟 腹肌 燃脂",
      tags: ["腹肌", "燃脂"],
      platform: "B站健身",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 0,
      fitnessType: "tutorial",
    });

    expect(result.platform).toBe("B站");
    expect(result.searchQuery).toContain("健身视频");
    expect(result.searchQuery).toContain("跟练");
  });
});
