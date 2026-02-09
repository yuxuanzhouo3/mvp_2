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
    小红书美食: "小红书",
    小红书购物: "小红书",
  };

  const intlMap: Record<string, string> = {
    "TripAdvisor Travel": "TripAdvisor",
    "Love and Lemons": "Love and Lemons",
    "SANParks": "SANParks",
    "YouTube Fitness": "YouTube Fitness",
    "TikTok": "TikTok",
    "JustWatch": "JustWatch",
    "Medium": "Medium",
    "MiniReview": "MiniReview",
    "Etsy": "Etsy",
    "Slickdeals": "Slickdeals",
    "Pinterest": "Pinterest",
    "Fantuan Delivery": "Fantuan Delivery",
    "饭团外卖": "Fantuan Delivery",
    "HungryPanda": "HungryPanda",
    "Wanderlog": "Wanderlog",
    "Visit A City": "Visit A City",
    "GetYourGuide": "GetYourGuide",
    "Nike Training Club": "Nike Training Club",
    "NTC": "Nike Training Club",
    "Strava": "Strava",
    "Nike Run Club": "Nike Run Club",
    "NRC": "Nike Run Club",
    "Hevy": "Hevy",
    "Strong": "Strong",
    "Down Dog": "Down Dog",
    "Amazon Shopping": "Amazon",
  };

  if (locale === "zh") return cnMap[platform] || platform;
  return intlMap[platform] || platform;
}
