export function mapSearchPlatformToProvider(platform: string, locale: "zh" | "en"): string {
  const cnMap: Record<string, string> = {
    高德地图美食: "高德地图",
    百度地图美食: "百度地图",
    腾讯地图美食: "腾讯地图",
    京东秒送: "京东秒送",
    淘宝闪购: "淘宝闪购",
    美团外卖: "美团外卖",
    高德地图旅游: "高德地图",
    百度地图旅游: "百度地图",
    高德地图健身: "高德地图",
    百度地图健身: "百度地图",
    腾讯地图健身: "腾讯地图",
    百度美食: "百度",
    百度健身: "百度",
    B站健身: "B站",
    腾讯视频健身: "腾讯视频",
    优酷健身: "优酷",
  };

  const intlMap: Record<string, string> = {
    "TripAdvisor Travel": "TripAdvisor",
  };

  if (locale === "zh") return cnMap[platform] || platform;
  return intlMap[platform] || platform;
}
