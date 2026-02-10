import { describe, expect, it } from "vitest";
import {
  normalizeCnMobileCategoryPlatform,
  stripCnFoodGenericTerms,
} from "./cn-mobile-normalizer";

describe("normalizeCnMobileCategoryPlatform", () => {
  it("maps fitness nearby_place to 高德地图健身", () => {
    const platform = normalizeCnMobileCategoryPlatform({
      category: "fitness",
      platform: "美团",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 0,
      fitnessType: "nearby_place",
    });
    expect(platform).toBe("高德地图健身");
  });

  it("maps fitness equipment to 美团", () => {
    const platform = normalizeCnMobileCategoryPlatform({
      category: "fitness",
      platform: "B站健身",
      client: "app",
      isMobile: true,
      locale: "zh",
      index: 0,
      fitnessType: "equipment",
    });
    expect(platform).toBe("美团");
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

