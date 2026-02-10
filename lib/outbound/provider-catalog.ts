import type { RecommendationCategory } from "@/lib/types/recommendation";

export type DeploymentRegion = "CN" | "INTL";

export type ProviderId =
  | "美团"
  | "美团外卖"
  | "饿了么"
  | "京东到家"
  | "京东秒送"
  | "淘宝闪购"
  | "淘宝"
  | "京东"
  | "拼多多"
  | "什么值得买"
  | "苏宁易购"
  | "唯品会"
  | "1688"
  | "大众点评"
  | "下厨房"
  | "腾讯视频"
  | "爱奇艺"
  | "优酷"
  | "豆瓣"
  | "QQ音乐"
  | "酷狗音乐"
  | "网易云音乐"
  | "TapTap"
  | "知乎"
  | "慢慢买"
  | "笔趣阁"
  | "小红书"
  | "去哪儿"
  | "携程"
  | "马蜂窝"
  | "穷游"
  | "高德地图"
  | "百度地图"
  | "腾讯地图"
  | "Google Maps"
  | "Google"
  | "百度"
  | "YouTube"
  | "B站"
  | "抖音"
  | "快手"
  | "Steam"
  | "Uber Eats"
  | "DoorDash"
  | "Yelp"
  | "OpenTable"
  | "Amazon"
  | "eBay"
  | "Walmart"
  | "Target"
  | "Netflix"
  | "IMDb"
  | "Rotten Tomatoes"
  | "Metacritic"
  | "TripAdvisor"
  | "Booking.com"
  | "Agoda"
  | "Airbnb"
  | "Keep"
  | "MyFitnessPal"
  | "Peloton"
  | "Muscle & Strength"
  | "YouTube Fitness"
  | "Love and Lemons"
  | "SANParks"
  | "Spotify"
  | "TikTok"
  | "JustWatch"
  | "Medium"
  | "MiniReview"
  | "Etsy"
  | "Slickdeals"
  | "Pinterest"
  | "Fantuan Delivery"
  | "HungryPanda"
  | "Wanderlog"
  | "Visit A City"
  | "GetYourGuide"
  | "Nike Training Club"
  | "Strava"
  | "Nike Run Club"
  | "Hevy"
  | "Strong"
  | "Down Dog";

export type ProviderTier = "mainstream" | "longtail";

export type MobileOs = "ios" | "android" | "other";

export type ProviderLinkKind = "universal_link" | "app" | "web";

export type LinkContext = {
  title: string;
  query: string;
  category: RecommendationCategory;
  locale: "zh" | "en";
  region: DeploymentRegion;
};

export type ProviderLinkBuilder = (ctx: LinkContext) => string;

export type ProviderDefinition = {
  id: ProviderId;
  displayName: {
    zh: string;
    en: string;
  };
  domains: string[];
  hasApp: boolean;
  androidPackageId?: string;
  universalLink?: ProviderLinkBuilder;
  webLink: ProviderLinkBuilder;
  iosScheme?: ProviderLinkBuilder;
  androidScheme?: ProviderLinkBuilder;
};

export type WeightedProvider = {
  provider: ProviderId;
  weight: number;
  tier: ProviderTier;
};

function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function baiduSearchUrl(query: string) {
  return `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
}

function bilibiliSearchUrl(query: string) {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`;
}

function kuaishouSearchUrl(query: string) {
  return `https://www.kuaishou.com/search/video?searchKey=${encodeURIComponent(query)}`;
}

function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function amapUniversalSearchUrl(query: string) {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(query)}`;
}

function amapWebSearchUrl(query: string) {
  return `https://www.amap.com/search?query=${encodeURIComponent(query)}`;
}

function baiduMapSearchUrl(query: string) {
  return `https://map.baidu.com/search/${encodeURIComponent(query)}`;
}

function tencentMapSearchUrl(query: string) {
  return `https://map.qq.com/m/search?keyword=${encodeURIComponent(query)}`;
}

export function getProviderCatalog(): Record<ProviderId, ProviderDefinition> {
  return {
    "Google Maps": {
      id: "Google Maps",
      displayName: { zh: "Google Maps", en: "Google Maps" },
      domains: ["google.com"],
      hasApp: true,
      androidPackageId: "com.google.android.apps.maps",
      universalLink: ({ query }) => googleMapsSearchUrl(query),
      webLink: ({ query }) => googleMapsSearchUrl(query),
      iosScheme: ({ query }) => `comgooglemaps://?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = googleMapsSearchUrl(query);
        return `intent://maps?q=${encodeURIComponent(query)}#Intent;scheme=geo;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Google: {
      id: "Google",
      displayName: { zh: "Google", en: "Google" },
      domains: ["google.com"],
      hasApp: true,
      universalLink: ({ query }) => googleSearchUrl(query),
      webLink: ({ query }) => googleSearchUrl(query),
    },
    YouTube: {
      id: "YouTube",
      displayName: { zh: "YouTube", en: "YouTube" },
      domains: ["youtube.com"],
      hasApp: true,
      androidPackageId: "com.google.android.youtube",
      universalLink: ({ query }) => youtubeSearchUrl(query),
      webLink: ({ query }) => youtubeSearchUrl(query),
      iosScheme: ({ query }) => `youtube://results?search_query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = youtubeSearchUrl(query);
        return `intent://www.youtube.com/results?search_query=${encodeURIComponent(query)}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "腾讯视频": {
      id: "腾讯视频",
      displayName: { zh: "腾讯视频", en: "Tencent Video" },
      domains: ["v.qq.com"],
      hasApp: true,
      androidPackageId: "com.tencent.qqlive",
      universalLink: ({ query }) => `https://v.qq.com/x/search/?q=${encodeURIComponent(query)}`,
      webLink: ({ query }) => `https://v.qq.com/x/search/?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `tenvideo://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://v.qq.com/x/search/?q=${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=tenvideo;package=com.tencent.qqlive;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "爱奇艺": {
      id: "爱奇艺",
      displayName: { zh: "爱奇艺", en: "iQIYI" },
      domains: ["iqiyi.com"],
      hasApp: true,
      androidPackageId: "com.qiyi.video",
      universalLink: ({ query }) => `https://so.iqiyi.com/so/q_${encodeURIComponent(query)}`,
      webLink: ({ query }) => `https://so.iqiyi.com/so/q_${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `iqiyi://mobile/search?keyword=${encodeURIComponent(query)}&from=deeplink`,
      androidScheme: ({ query }) => {
        const web = `https://so.iqiyi.com/so/q_${encodeURIComponent(query)}`;
        return `intent://mobile/search?keyword=${encodeURIComponent(query)}#Intent;scheme=iqiyi;package=com.qiyi.video;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "优酷": {
      id: "优酷",
      displayName: { zh: "优酷", en: "Youku" },
      domains: ["youku.com"],
      hasApp: true,
      androidPackageId: "com.youku.phone",
      universalLink: ({ query }) => `https://so.youku.com/search_video/q_${encodeURIComponent(query)}`,
      webLink: ({ query }) => `https://so.youku.com/search_video/q_${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `youku://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://so.youku.com/search_video/q_${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=youku;package=com.youku.phone;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "豆瓣": {
      id: "豆瓣",
      displayName: { zh: "豆瓣", en: "Douban" },
      domains: ["douban.com"],
      hasApp: false,
      webLink: ({ query }) =>
        `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(query)}`,
    },
    "QQ音乐": {
      id: "QQ音乐",
      displayName: { zh: "QQ音乐", en: "QQ Music" },
      domains: ["y.qq.com"],
      hasApp: true,
      androidPackageId: "com.tencent.qqmusic",
      webLink: ({ query }) => `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `qqmusic://qq.com/ui/search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(query)}`;
        return `intent://qq.com/ui/search?keyword=${encodeURIComponent(query)}#Intent;scheme=qqmusic;package=com.tencent.qqmusic;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "酷狗音乐": {
      id: "酷狗音乐",
      displayName: { zh: "酷狗音乐", en: "Kugou Music" },
      domains: ["kugou.com"],
      hasApp: true,
      androidPackageId: "com.kugou.android",
      webLink: ({ query }) =>
        `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `kugouURL://kg/search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${encodeURIComponent(query)}`;
        return `intent://kg/search?keyword=${encodeURIComponent(query)}#Intent;scheme=kugouURL;package=com.kugou.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "网易云音乐": {
      id: "网易云音乐",
      displayName: { zh: "网易云音乐", en: "NetEase Cloud Music" },
      domains: ["music.163.com"],
      hasApp: true,
      androidPackageId: "com.netease.cloudmusic",
      webLink: ({ query }) => `https://music.163.com/#/search/m/?s=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `orpheus://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://music.163.com/#/search/m/?s=${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=orpheus;package=com.netease.cloudmusic;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    TapTap: {
      id: "TapTap",
      displayName: { zh: "TapTap", en: "TapTap" },
      domains: ["taptap.cn", "taptap.com"],
      hasApp: true,
      androidPackageId: "com.taptap",
      // 使用 universal link 可靠地打开 TapTap 搜索页（已安装则 App 拦截，未安装走浏览器）
      universalLink: ({ query }) => `https://www.taptap.cn/search/${encodeURIComponent(query)}`,
      webLink: ({ query }) => `https://www.taptap.cn/search/${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `taptap://taptap.cn/search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.taptap.cn/search/${encodeURIComponent(query)}`;
        return `intent://taptap.cn/search?keyword=${encodeURIComponent(query)}#Intent;scheme=taptap;package=com.taptap;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "小红书": {
      id: "小红书",
      displayName: { zh: "小红书", en: "Xiaohongshu" },
      domains: ["xiaohongshu.com"],
      hasApp: true,
      androidPackageId: "com.xingin.xhs",
      webLink: ({ query }) =>
        `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&type=note`,
      iosScheme: ({ query }) =>
        `xhsdiscover://search/result?keyword=${encodeURIComponent(query)}&target_search=notes&source=deeplink`,
      androidScheme: ({ query }) =>
        `xhsdiscover://search/result?keyword=${encodeURIComponent(query)}&target_search=notes&source=deeplink`,
    },
    Steam: {
      id: "Steam",
      displayName: { zh: "Steam", en: "Steam" },
      domains: ["steampowered.com"],
      hasApp: true,
      androidPackageId: "com.valvesoftware.android.steam.community",
      webLink: ({ query }) =>
        `https://store.steampowered.com/search/?term=${encodeURIComponent(query)}&supportedlang=schinese&ndl=1`,
    },
    "YouTube Fitness": {
      id: "YouTube Fitness",
      displayName: { zh: "YouTube", en: "YouTube" },
      domains: ["youtube.com"],
      hasApp: true,
      universalLink: ({ query }) => youtubeSearchUrl(`${query} fitness`),
      webLink: ({ query }) => youtubeSearchUrl(`${query} fitness`),
    },
    B站: {
      id: "B站",
      displayName: { zh: "哔哩哔哩", en: "Bilibili" },
      domains: ["bilibili.com"],
      hasApp: true,
      androidPackageId: "tv.danmaku.bili",
      universalLink: ({ query }) => bilibiliSearchUrl(query),
      webLink: ({ query }) => bilibiliSearchUrl(query),
      iosScheme: ({ query }) =>
        `bilibili://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = bilibiliSearchUrl(query);
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=bilibili;package=tv.danmaku.bili;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    抖音: {
      id: "抖音",
      displayName: { zh: "抖音", en: "Douyin" },
      domains: ["douyin.com"],
      hasApp: true,
      androidPackageId: "com.ss.android.ugc.aweme",
      universalLink: ({ query }) => `https://www.douyin.com/search/${encodeURIComponent(query)}`,
      webLink: ({ query }) => `https://www.douyin.com/search/${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `snssdk1128://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.douyin.com/search/${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=snssdk1128;package=com.ss.android.ugc.aweme;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    快手: {
      id: "快手",
      displayName: { zh: "快手", en: "Kuaishou" },
      domains: ["kuaishou.com"],
      hasApp: true,
      androidPackageId: "com.smile.gifmaker",
      universalLink: ({ query }) => kuaishouSearchUrl(query),
      webLink: ({ query }) => kuaishouSearchUrl(query),
      iosScheme: ({ query }) => `kwai://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = kuaishouSearchUrl(query);
        return `intent://#Intent;action=android.intent.action.VIEW;package=com.smile.gifmaker;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "大众点评": {
      id: "大众点评",
      displayName: { zh: "大众点评", en: "Dianping" },
      domains: ["dianping.com"],
      hasApp: true,
      androidPackageId: "com.dianping.v1",
      webLink: ({ query }) =>
        `https://www.dianping.com/search/keyword/1/0_${encodeURIComponent(query)}`,
      // 大众点评 iOS：使用 scheme 直接打开搜索
      iosScheme: ({ query }) => `dianping://search?keyword=${encodeURIComponent(query)}`,
      // 大众点评 Android：使用 intent 打开搜索，带 web fallback
      androidScheme: ({ query }) => {
        const web = `https://m.dianping.com/search/keyword/1/0_${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=dianping;package=com.dianping.v1;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "下厨房": {
      id: "下厨房",
      displayName: { zh: "下厨房", en: "Xiachufang" },
      domains: ["xiachufang.com"],
      hasApp: true,
      webLink: ({ query }) =>
        `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(query)}&cat=1001`,
    },
    百度: {
      id: "百度",
      displayName: { zh: "百度", en: "Baidu" },
      domains: ["baidu.com"],
      hasApp: true,
      universalLink: ({ query }) => baiduSearchUrl(query),
      webLink: ({ query }) => baiduSearchUrl(query),
    },
    知乎: {
      id: "知乎",
      displayName: { zh: "知乎", en: "Zhihu" },
      domains: ["zhihu.com"],
      hasApp: true,
      androidPackageId: "com.zhihu.android",
      universalLink: ({ query }) =>
        `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(query)}`,
      webLink: ({ query }) =>
        `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(query)}`,
    },
    "慢慢买": {
      id: "慢慢买",
      displayName: { zh: "慢慢买", en: "Manmanbuy" },
      domains: ["manmanbuy.com"],
      hasApp: false,
      webLink: ({ query }) =>
        `https://s.manmanbuy.com/pc/search/result?keyword=${encodeURIComponent(query)}&btnSearch=%E6%90%9C%E7%B4%A2`,
    },
    "笔趣阁": {
      id: "笔趣阁",
      displayName: { zh: "笔趣阁", en: "Biquge" },
      domains: ["bqgde.de", "m.bqgde.de"],
      hasApp: false,
      webLink: ({ query }) => `https://m.bqgde.de/s?q=${encodeURIComponent(query)}`,
    },
    "淘宝": {
      id: "淘宝",
      displayName: { zh: "淘宝", en: "Taobao" },
      domains: ["taobao.com"],
      hasApp: true,
      androidPackageId: "com.taobao.taobao",
      webLink: ({ query }) => `https://s.taobao.com/search?q=${encodeURIComponent(query)}`,
      // 淘宝 App 搜索深链：使用 m.taobao.com 的 universal link 更可靠地唤起 App
      iosScheme: ({ query }) => `taobao://s.taobao.com/search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
        return `intent://s.taobao.com/search?q=${encodeURIComponent(query)}#Intent;scheme=taobao;package=com.taobao.taobao;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "京东": {
      id: "京东",
      displayName: { zh: "京东", en: "JD" },
      domains: ["jd.com"],
      hasApp: true,
      androidPackageId: "com.jingdong.app.mall",
      webLink: ({ query }) => `https://search.jd.com/Search?keyword=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => {
        const params = {
          category: "jump",
          des: "productList",
          keyWord: query,
          from: "search",
        };
        return `openapp.jdmobile://virtual?params=${encodeURIComponent(JSON.stringify(params))}`;
      },
      androidScheme: ({ query }) => {
        const params = {
          category: "jump",
          des: "productList",
          keyWord: query,
          from: "search",
        };
        const web = `https://search.jd.com/Search?keyword=${encodeURIComponent(query)}`;
        return `intent://virtual?params=${encodeURIComponent(JSON.stringify(params))}#Intent;scheme=openapp.jdmobile;package=com.jingdong.app.mall;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "拼多多": {
      id: "拼多多",
      displayName: { zh: "拼多多", en: "Pinduoduo" },
      domains: ["yangkeduo.com"],
      hasApp: true,
      androidPackageId: "com.xunmeng.pinduoduo",
      webLink: ({ query }) =>
        `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) =>
        `pinduoduo://com.xunmeng.pinduoduo/search_result.html?search_key=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(query)}`;
        return `intent://com.xunmeng.pinduoduo/search_result.html?search_key=${encodeURIComponent(query)}#Intent;scheme=pinduoduo;package=com.xunmeng.pinduoduo;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "什么值得买": {
      id: "什么值得买",
      displayName: { zh: "什么值得买", en: "SMZDM" },
      domains: ["smzdm.com"],
      hasApp: true,
      webLink: ({ query }) =>
        `https://search.smzdm.com/?c=home&s=${encodeURIComponent(query)}&v=b&mx_v=a`,
    },
    "苏宁易购": {
      id: "苏宁易购",
      displayName: { zh: "苏宁易购", en: "Suning" },
      domains: ["suning.com"],
      hasApp: true,
      webLink: ({ query }) => `https://search.suning.com/${encodeURIComponent(query)}/`,
    },
    "唯品会": {
      id: "唯品会",
      displayName: { zh: "唯品会", en: "VIP.com" },
      domains: ["vip.com"],
      hasApp: true,
      androidPackageId: "com.achievo.vipshop",
      webLink: ({ query }) =>
        `https://category.vip.com/suggest.php?keyword=${encodeURIComponent(query)}`,
      // 唯品会深链：使用 search 路径进行搜索而非 goHome
      iosScheme: ({ query }) => `vipshop://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://category.vip.com/suggest.php?keyword=${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=vipshop;package=com.achievo.vipshop;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "1688": {
      id: "1688",
      displayName: { zh: "1688", en: "1688" },
      domains: ["1688.com"],
      hasApp: true,
      webLink: ({ query }) =>
        `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(query)}`,
    },
    高德地图: {
      id: "高德地图",
      displayName: { zh: "高德地图", en: "Amap" },
      domains: ["amap.com", "uri.amap.com", "ditu.amap.com"],
      hasApp: true,
      universalLink: ({ query }) => amapUniversalSearchUrl(query),
      webLink: ({ query }) => amapWebSearchUrl(query),
      iosScheme: ({ query }) =>
        `iosamap://poi?keywords=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) =>
        `androidamap://poi?keywords=${encodeURIComponent(query)}`,
    },
    百度地图: {
      id: "百度地图",
      displayName: { zh: "百度地图", en: "Baidu Maps" },
      domains: ["baidu.com", "map.baidu.com"],
      hasApp: true,
      universalLink: ({ query }) => baiduMapSearchUrl(query),
      webLink: ({ query }) => baiduMapSearchUrl(query),
      iosScheme: ({ query }) =>
        `baidumap://map/place/search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) =>
        `baidumap://map/place/search?query=${encodeURIComponent(query)}`,
    },
    "腾讯地图": {
      id: "腾讯地图",
      displayName: { zh: "腾讯地图", en: "Tencent Maps" },
      domains: ["map.qq.com"],
      hasApp: true,
      androidPackageId: "com.tencent.map",
      universalLink: ({ query }) => tencentMapSearchUrl(query),
      webLink: ({ query }) => tencentMapSearchUrl(query),
      iosScheme: ({ query }) => `qqmap://map/search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => `qqmap://map/search?keyword=${encodeURIComponent(query)}`,
    },
    美团: {
      id: "美团",
      displayName: { zh: "美团", en: "Meituan" },
      domains: ["meituan.com"],
      hasApp: true,
      androidPackageId: "com.sankuai.meituan",
      webLink: ({ query }) =>
        `https://www.meituan.com/s/${encodeURIComponent(query)}/`,
      iosScheme: ({ query }) =>
        `imeituan://www.meituan.com/search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.meituan.com/s/${encodeURIComponent(query)}/`;
        return `intent://www.meituan.com/search?q=${encodeURIComponent(query)}#Intent;scheme=imeituan;package=com.sankuai.meituan;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "美团外卖": {
      id: "美团外卖",
      displayName: { zh: "美团外卖", en: "Meituan Waimai" },
      domains: ["meituan.com"],
      hasApp: true,
      androidPackageId: "com.sankuai.meituan.takeoutnew",
      webLink: ({ query }) =>
        `https://waimai.meituan.com/search?query=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) =>
        `meituanwaimai://waimai.meituan.com/search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://waimai.meituan.com/search?query=${encodeURIComponent(query)}`;
        return `intent://waimai.meituan.com/search?query=${encodeURIComponent(query)}#Intent;scheme=meituanwaimai;package=com.sankuai.meituan.takeoutnew;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    饿了么: {
      id: "饿了么",
      displayName: { zh: "饿了么", en: "Eleme" },
      domains: ["ele.me"],
      hasApp: true,
      androidPackageId: "me.ele",
      webLink: ({ query }) =>
        `https://www.ele.me/search/${encodeURIComponent(query)}`,
      iosScheme: () => `eleme://`,
      androidScheme: () => `eleme://`,
    },
    京东到家: {
      id: "京东到家",
      displayName: { zh: "京东到家", en: "JD Daojia" },
      domains: ["jd.com", "daojia.jd.com"],
      hasApp: true,
      webLink: ({ query }) =>
        `https://daojia.jd.com/html/index.html?keyword=${encodeURIComponent(query)}`,
    },
    "京东秒送": {
      id: "京东秒送",
      displayName: { zh: "京东秒送", en: "JD Instant Delivery" },
      domains: ["jd.com", "daojia.jd.com"],
      hasApp: true,
      androidPackageId: "com.jingdong.app.mall",
      webLink: ({ query }) =>
        `https://daojia.jd.com/html/index.html?keyword=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => {
        const params = {
          category: "jump",
          des: "productList",
          keyWord: query,
          from: "search",
        };
        return `openapp.jdmobile://virtual?params=${encodeURIComponent(JSON.stringify(params))}`;
      },
      androidScheme: ({ query }) => {
        const params = {
          category: "jump",
          des: "productList",
          keyWord: query,
          from: "search",
        };
        const web = `https://daojia.jd.com/html/index.html?keyword=${encodeURIComponent(query)}`;
        return `intent://virtual?params=${encodeURIComponent(JSON.stringify(params))}#Intent;scheme=openapp.jdmobile;package=com.jingdong.app.mall;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    淘宝闪购: {
      id: "淘宝闪购",
      displayName: { zh: "淘宝闪购", en: "Taobao Now" },
      domains: ["taobao.com"],
      hasApp: true,
      androidPackageId: "com.taobao.taobao",
      webLink: ({ query }) =>
        `https://s.taobao.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `taobao://s.taobao.com/?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
        return `intent://s.taobao.com/search?q=${encodeURIComponent(query)}#Intent;scheme=taobao;package=com.taobao.taobao;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Uber Eats": {
      id: "Uber Eats",
      displayName: { zh: "Uber Eats", en: "Uber Eats" },
      domains: ["ubereats.com", "uber.com"],
      hasApp: true,
      androidPackageId: "com.ubercab.eats",
      webLink: ({ query }) =>
        `https://www.ubereats.com/search?q=${encodeURIComponent(query)}&sc=SEARCH_BAR&searchType=GLOBAL_SEARCH&vertical=ALL`,
      iosScheme: ({ query }) => `ubereats://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.ubereats.com/search?q=${encodeURIComponent(query)}&sc=SEARCH_BAR&searchType=GLOBAL_SEARCH&vertical=ALL`;
        return `intent://search?q=${encodeURIComponent(query)}#Intent;scheme=ubereats;package=com.ubercab.eats;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    DoorDash: {
      id: "DoorDash",
      displayName: { zh: "DoorDash", en: "DoorDash" },
      domains: ["doordash.com"],
      hasApp: true,
      androidPackageId: "com.dd.doordash",
      webLink: ({ query }) =>
        `https://www.doordash.com/search/store/${encodeURIComponent(query)}/`,
      iosScheme: ({ query }) => `doordash://search/store/${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.doordash.com/search/store/${encodeURIComponent(query)}/`;
        return `intent://search/store/${encodeURIComponent(query)}/#Intent;scheme=doordash;package=com.dd.doordash;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Yelp: {
      id: "Yelp",
      displayName: { zh: "Yelp", en: "Yelp" },
      domains: ["yelp.com"],
      hasApp: true,
      androidPackageId: "com.yelp.android",
      webLink: ({ query }) => `https://www.yelp.com/search?find_desc=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `yelp://search?find_desc=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.yelp.com/search?find_desc=${encodeURIComponent(query)}`;
        return `intent://search?find_desc=${encodeURIComponent(query)}#Intent;scheme=yelp;package=com.yelp.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    OpenTable: {
      id: "OpenTable",
      displayName: { zh: "OpenTable", en: "OpenTable" },
      domains: ["opentable.com"],
      hasApp: true,
      androidPackageId: "com.opentable",
      webLink: ({ query }) => `https://www.opentable.com/s?term=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `opentable://search?term=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.opentable.com/s?term=${encodeURIComponent(query)}`;
        return `intent://search?term=${encodeURIComponent(query)}#Intent;scheme=opentable;package=com.opentable;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Amazon: {
      id: "Amazon",
      displayName: { zh: "Amazon", en: "Amazon" },
      domains: ["amazon.com"],
      hasApp: true,
      androidPackageId: "com.amazon.mShop.android.shopping",
      webLink: ({ query }) => `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `com.amazon.mobile.shopping://s?k=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
        return `intent://s?k=${encodeURIComponent(query)}#Intent;scheme=com.amazon.mobile.shopping;package=com.amazon.mShop.android.shopping;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    eBay: {
      id: "eBay",
      displayName: { zh: "eBay", en: "eBay" },
      domains: ["ebay.com"],
      hasApp: true,
      androidPackageId: "com.ebay.mobile",
      webLink: ({ query }) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `ebay://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=ebay;package=com.ebay.mobile;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Walmart: {
      id: "Walmart",
      displayName: { zh: "Walmart", en: "Walmart" },
      domains: ["walmart.com"],
      hasApp: true,
      androidPackageId: "com.walmart.android",
      webLink: ({ query }) => `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `walmart://search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
        return `intent://search?query=${encodeURIComponent(query)}#Intent;scheme=walmart;package=com.walmart.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Target: {
      id: "Target",
      displayName: { zh: "Target", en: "Target" },
      domains: ["target.com"],
      hasApp: true,
      androidPackageId: "com.target.ui",
      webLink: ({ query }) => `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `target://search?searchTerm=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`;
        return `intent://search?searchTerm=${encodeURIComponent(query)}#Intent;scheme=target;package=com.target.ui;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Netflix: {
      id: "Netflix",
      displayName: { zh: "Netflix", en: "Netflix" },
      domains: ["netflix.com"],
      hasApp: true,
      androidPackageId: "com.netflix.mediaclient",
      webLink: ({ query }) => `https://www.netflix.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `nflx://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.netflix.com/search?q=${encodeURIComponent(query)}`;
        return `intent://search?q=${encodeURIComponent(query)}#Intent;scheme=nflx;package=com.netflix.mediaclient;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    IMDb: {
      id: "IMDb",
      displayName: { zh: "IMDb", en: "IMDb" },
      domains: ["imdb.com"],
      hasApp: false,
      webLink: ({ query }) => `https://www.imdb.com/find?q=${encodeURIComponent(query)}`,
    },
    "Rotten Tomatoes": {
      id: "Rotten Tomatoes",
      displayName: { zh: "Rotten Tomatoes", en: "Rotten Tomatoes" },
      domains: ["rottentomatoes.com"],
      hasApp: false,
      webLink: ({ query }) =>
        `https://www.rottentomatoes.com/search?search=${encodeURIComponent(query)}`,
    },
    Metacritic: {
      id: "Metacritic",
      displayName: { zh: "Metacritic", en: "Metacritic" },
      domains: ["metacritic.com"],
      hasApp: false,
      webLink: ({ query }) =>
        `https://www.metacritic.com/search/${encodeURIComponent(query)}`,
    },
    TripAdvisor: {
      id: "TripAdvisor",
      displayName: { zh: "TripAdvisor", en: "TripAdvisor" },
      domains: ["tripadvisor.com"],
      hasApp: true,
      androidPackageId: "com.tripadvisor.tripadvisor",
      webLink: ({ query }) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `tripadvisor://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`;
        return `intent://Search?q=${encodeURIComponent(query)}#Intent;scheme=tripadvisor;package=com.tripadvisor.tripadvisor;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Booking.com": {
      id: "Booking.com",
      displayName: { zh: "Booking.com", en: "Booking.com" },
      domains: ["booking.com"],
      hasApp: true,
      androidPackageId: "com.booking",
      webLink: ({ query }) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `booking://hotel/search?ss=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`;
        return `intent://hotel/search?ss=${encodeURIComponent(query)}#Intent;scheme=booking;package=com.booking;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Agoda: {
      id: "Agoda",
      displayName: { zh: "Agoda", en: "Agoda" },
      domains: ["agoda.com"],
      hasApp: true,
      androidPackageId: "com.agoda.mobile.consumer",
      webLink: ({ query }) => `https://www.agoda.com/search/${encodeURIComponent(query)}.html`,
      iosScheme: ({ query }) => `agoda://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.agoda.com/search/${encodeURIComponent(query)}.html`;
        return `intent://search?q=${encodeURIComponent(query)}#Intent;scheme=agoda;package=com.agoda.mobile.consumer;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Airbnb: {
      id: "Airbnb",
      displayName: { zh: "Airbnb", en: "Airbnb" },
      domains: ["airbnb.com"],
      hasApp: true,
      androidPackageId: "com.airbnb.android",
      webLink: ({ query }) => `https://www.airbnb.com/s/${encodeURIComponent(query)}/homes`,
      iosScheme: ({ query }) => `airbnb://search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.airbnb.com/s/${encodeURIComponent(query)}/homes`;
        return `intent://search?query=${encodeURIComponent(query)}#Intent;scheme=airbnb;package=com.airbnb.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Keep: {
      id: "Keep",
      displayName: { zh: "Keep", en: "Keep" },
      domains: ["gotokeep.com"],
      hasApp: true,
      androidPackageId: "com.gotokeep.keep",
      webLink: ({ query }) => `https://www.gotokeep.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `keep://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.gotokeep.com/search?q=${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=keep;package=com.gotokeep.keep;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    MyFitnessPal: {
      id: "MyFitnessPal",
      displayName: { zh: "MyFitnessPal", en: "MyFitnessPal" },
      domains: ["myfitnesspal.com"],
      hasApp: true,
      androidPackageId: "com.myfitnesspal.android",
      webLink: ({ query }) => `https://www.myfitnesspal.com/food/search?search=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `myfitnesspal://food/search?search=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.myfitnesspal.com/food/search?search=${encodeURIComponent(query)}`;
        return `intent://food/search?search=${encodeURIComponent(query)}#Intent;scheme=myfitnesspal;package=com.myfitnesspal.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    Peloton: {
      id: "Peloton",
      displayName: { zh: "Peloton", en: "Peloton" },
      domains: ["onepeloton.com"],
      hasApp: true,
      androidPackageId: "com.onepeloton.callisto",
      webLink: ({ query }) => `https://www.onepeloton.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `onepeloton://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.onepeloton.com/search?q=${encodeURIComponent(query)}`;
        return `intent://search?q=${encodeURIComponent(query)}#Intent;scheme=onepeloton;package=com.onepeloton.callisto;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Muscle & Strength": {
      id: "Muscle & Strength",
      displayName: { zh: "Muscle & Strength", en: "Muscle & Strength" },
      domains: ["muscleandstrength.com"],
      hasApp: false,
      webLink: ({ query }) =>
        `https://www.muscleandstrength.com/store/search?q=${encodeURIComponent(query)}`,
    },
    "Love and Lemons": {
      id: "Love and Lemons",
      displayName: { zh: "Love and Lemons", en: "Love and Lemons" },
      domains: ["loveandlemons.com"],
      hasApp: false,
      webLink: ({ query }) =>
        `https://www.loveandlemons.com/?s=${encodeURIComponent(query)}`,
    },
    "SANParks": {
      id: "SANParks",
      displayName: { zh: "SANParks", en: "SANParks" },
      domains: ["sanparks.org"],
      hasApp: false,
      webLink: ({ query }) =>
        `https://www.sanparks.org/search?q=${encodeURIComponent(query)}`,
    },
    "Spotify": {
      id: "Spotify",
      displayName: { zh: "Spotify", en: "Spotify" },
      domains: ["spotify.com", "open.spotify.com"],
      hasApp: true,
      androidPackageId: "com.spotify.music",
      webLink: ({ query }) =>
        `https://open.spotify.com/search/${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `spotify://search/${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
        return `intent://search/${encodeURIComponent(query)}#Intent;scheme=spotify;package=com.spotify.music;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    // --- INTL 娱乐类目 ---
    "TikTok": {
      id: "TikTok",
      displayName: { zh: "TikTok", en: "TikTok" },
      domains: ["tiktok.com"],
      hasApp: true,
      androidPackageId: "com.zhiliaoapp.musically",
      universalLink: ({ query }) =>
        `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
      webLink: ({ query }) =>
        `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `snssdk1128://search?keyword=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;
        return `intent://www.tiktok.com/search?q=${encodeURIComponent(query)}#Intent;scheme=https;package=com.zhiliaoapp.musically;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "JustWatch": {
      id: "JustWatch",
      displayName: { zh: "JustWatch", en: "JustWatch" },
      domains: ["justwatch.com"],
      hasApp: true,
      androidPackageId: "com.justwatch.justwatch",
      webLink: ({ query }) =>
        `https://www.justwatch.com/us/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `justwatch://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.justwatch.com/us/search?q=${encodeURIComponent(query)}`;
        return `intent://www.justwatch.com/us/search?q=${encodeURIComponent(query)}#Intent;scheme=https;package=com.justwatch.justwatch;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Medium": {
      id: "Medium",
      displayName: { zh: "Medium", en: "Medium" },
      domains: ["medium.com"],
      hasApp: true,
      androidPackageId: "com.medium.reader",
      universalLink: ({ query }) =>
        `https://medium.com/search?q=${encodeURIComponent(query)}`,
      webLink: ({ query }) =>
        `https://medium.com/search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://medium.com/search?q=${encodeURIComponent(query)}`;
        return `intent://medium.com/search?q=${encodeURIComponent(query)}#Intent;scheme=https;package=com.medium.reader;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "MiniReview": {
      id: "MiniReview",
      displayName: { zh: "MiniReview", en: "MiniReview" },
      domains: ["minireview.io"],
      hasApp: true,
      androidPackageId: "minireview.best.android.games.reviews",
      universalLink: ({ query }) =>
        `https://minireview.io/?s=${encodeURIComponent(query)}`,
      webLink: ({ query }) =>
        `https://minireview.io/?s=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://minireview.io/?s=${encodeURIComponent(query)}`;
        return `intent://minireview.io/?s=${encodeURIComponent(query)}#Intent;scheme=https;package=minireview.best.android.games.reviews;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    // --- INTL 购物类目 ---
    "Etsy": {
      id: "Etsy",
      displayName: { zh: "Etsy", en: "Etsy" },
      domains: ["etsy.com"],
      hasApp: true,
      androidPackageId: "com.etsy.android",
      webLink: ({ query }) =>
        `https://www.etsy.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `etsy://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.etsy.com/search?q=${encodeURIComponent(query)}`;
        return `intent://search?q=${encodeURIComponent(query)}#Intent;scheme=etsy;package=com.etsy.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Slickdeals": {
      id: "Slickdeals",
      displayName: { zh: "Slickdeals", en: "Slickdeals" },
      domains: ["slickdeals.net"],
      hasApp: true,
      androidPackageId: "net.slickdeals.android",
      webLink: ({ query }) =>
        `https://slickdeals.net/newsearch.php?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `slickdeals://newsearch.php?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://slickdeals.net/newsearch.php?q=${encodeURIComponent(query)}`;
        return `intent://newsearch.php?q=${encodeURIComponent(query)}#Intent;scheme=slickdeals;package=net.slickdeals.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Pinterest": {
      id: "Pinterest",
      displayName: { zh: "Pinterest", en: "Pinterest" },
      domains: ["pinterest.com"],
      hasApp: true,
      androidPackageId: "com.pinterest",
      webLink: ({ query }) =>
        `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `pinterest://search/pins/?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
        return `intent://search/pins/?q=${encodeURIComponent(query)}#Intent;scheme=pinterest;package=com.pinterest;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    // --- INTL 美食类目 ---
    "Fantuan Delivery": {
      id: "Fantuan Delivery",
      displayName: { zh: "饭团外卖", en: "Fantuan Delivery" },
      domains: ["fantuanorder.com"],
      hasApp: true,
      androidPackageId: "com.AmazingTech.FanTuanDelivery",
      webLink: ({ query }) => `https://www.fantuanorder.com/search?keyword=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) =>
        `fantuandelivery://search?keyword=${encodeURIComponent(query)}&from=deeplink`,
      androidScheme: ({ query }) => {
        const web = `https://www.fantuanorder.com/search?keyword=${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=fantuandelivery;package=com.AmazingTech.FanTuanDelivery;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "HungryPanda": {
      id: "HungryPanda",
      displayName: { zh: "HungryPanda", en: "HungryPanda" },
      domains: ["hungrypanda.co"],
      hasApp: true,
      androidPackageId: "com.nicetomeetyou.hungrypanda",
      webLink: ({ query }) => `https://www.hungrypanda.co/search?keyword=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) =>
        `hungrypanda://search?keyword=${encodeURIComponent(query)}&from=deeplink`,
      androidScheme: ({ query }) => {
        const web = `https://www.hungrypanda.co/search?keyword=${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=hungrypanda;package=com.nicetomeetyou.hungrypanda;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    // --- INTL 旅行类目 ---
    "Wanderlog": {
      id: "Wanderlog",
      displayName: { zh: "Wanderlog", en: "Wanderlog" },
      domains: ["wanderlog.com"],
      hasApp: true,
      androidPackageId: "com.wanderlog.android",
      webLink: ({ query }) =>
        `https://wanderlog.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `wanderlog://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://wanderlog.com/search?q=${encodeURIComponent(query)}`;
        return `intent://search?q=${encodeURIComponent(query)}#Intent;scheme=wanderlog;package=com.wanderlog.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Visit A City": {
      id: "Visit A City",
      displayName: { zh: "Visit A City", en: "Visit A City" },
      domains: ["visitacity.com"],
      hasApp: true,
      androidPackageId: "com.visitacity.visitacityapp",
      webLink: ({ query }) =>
        `https://www.visitacity.com/en/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `visitacity://search?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.visitacity.com/en/search?q=${encodeURIComponent(query)}`;
        return `intent://www.visitacity.com/en/search?q=${encodeURIComponent(query)}#Intent;scheme=https;package=com.visitacity.visitacityapp;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "GetYourGuide": {
      id: "GetYourGuide",
      displayName: { zh: "GetYourGuide", en: "GetYourGuide" },
      domains: ["getyourguide.com"],
      hasApp: true,
      androidPackageId: "com.getyourguide.android",
      webLink: ({ query }) =>
        `https://www.getyourguide.com/s/?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `getyourguide://s/?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.getyourguide.com/s/?q=${encodeURIComponent(query)}`;
        return `intent://s/?q=${encodeURIComponent(query)}#Intent;scheme=getyourguide;package=com.getyourguide.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    // --- INTL 健身类目 ---
    "Nike Training Club": {
      id: "Nike Training Club",
      displayName: { zh: "Nike Training Club", en: "Nike Training Club" },
      domains: ["nike.com"],
      hasApp: true,
      androidPackageId: "com.nike.ntc",
      webLink: ({ query }) => `https://www.nike.com/ntc-app?query=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `ntc://search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.nike.com/ntc-app?query=${encodeURIComponent(query)}`;
        return `intent://search?query=${encodeURIComponent(query)}#Intent;scheme=ntc;package=com.nike.ntc;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Strava": {
      id: "Strava",
      displayName: { zh: "Strava", en: "Strava" },
      domains: ["strava.com"],
      hasApp: true,
      androidPackageId: "com.strava",
      webLink: ({ query }) => `https://www.strava.com/search?text=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `strava://search?text=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.strava.com/search?text=${encodeURIComponent(query)}`;
        return `intent://search?text=${encodeURIComponent(query)}#Intent;scheme=strava;package=com.strava;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Nike Run Club": {
      id: "Nike Run Club",
      displayName: { zh: "Nike Run Club", en: "Nike Run Club" },
      domains: ["nike.com"],
      hasApp: true,
      androidPackageId: "com.nike.plusgps",
      webLink: ({ query }) => `https://www.nike.com/nrc-app?query=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `nikerunclub://search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.nike.com/nrc-app?query=${encodeURIComponent(query)}`;
        return `intent://search?query=${encodeURIComponent(query)}#Intent;scheme=nikerunclub;package=com.nike.plusgps;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Hevy": {
      id: "Hevy",
      displayName: { zh: "Hevy", en: "Hevy" },
      domains: ["hevyapp.com"],
      hasApp: true,
      androidPackageId: "com.hevy.tracker",
      webLink: ({ query }) => `https://www.hevyapp.com/?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `hevy://search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.hevyapp.com/?q=${encodeURIComponent(query)}`;
        return `intent://search?query=${encodeURIComponent(query)}#Intent;scheme=hevy;package=com.hevy.tracker;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Strong": {
      id: "Strong",
      displayName: { zh: "Strong", en: "Strong" },
      domains: ["strong.app"],
      hasApp: true,
      androidPackageId: "io.strongapp.strong",
      webLink: ({ query }) => `https://www.strong.app/?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `strong://search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.strong.app/?q=${encodeURIComponent(query)}`;
        return `intent://search?query=${encodeURIComponent(query)}#Intent;scheme=strong;package=io.strongapp.strong;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Down Dog": {
      id: "Down Dog",
      displayName: { zh: "Down Dog", en: "Down Dog" },
      domains: ["downdogapp.com"],
      hasApp: true,
      androidPackageId: "com.downdogapp",
      webLink: ({ query }) => `https://www.downdogapp.com/?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `downdog://search?query=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://www.downdogapp.com/?q=${encodeURIComponent(query)}`;
        return `intent://search?query=${encodeURIComponent(query)}#Intent;scheme=downdog;package=com.downdogapp;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "携程": {
      id: "携程",
      displayName: { zh: "携程", en: "Ctrip" },
      domains: ["ctrip.com"],
      hasApp: true,
      androidPackageId: "ctrip.android.view",
      webLink: ({ query }) =>
        `https://you.ctrip.com/globalsearch/?keyword=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) =>
        `ctrip://wireless/h5?type=search&keyword=${encodeURIComponent(query)}&from=deeplink`,
      androidScheme: ({ query }) => {
        const web = `https://you.ctrip.com/globalsearch/?keyword=${encodeURIComponent(query)}`;
        return `intent://wireless/h5?type=search&keyword=${encodeURIComponent(query)}#Intent;scheme=ctrip;package=ctrip.android.view;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "去哪儿": {
      id: "去哪儿",
      displayName: { zh: "去哪儿", en: "Qunar" },
      domains: ["qunar.com"],
      hasApp: true,
      androidPackageId: "com.qunar.atom",
      webLink: ({ query }) => `https://www.qunar.com/search?searchWord=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) =>
        `qunarphone://hotel/hotelList?keyword=${encodeURIComponent(query)}&from=deeplink`,
      androidScheme: ({ query }) => {
        const web = `https://www.qunar.com/search?searchWord=${encodeURIComponent(query)}`;
        return `intent://hotel/hotelList?keyword=${encodeURIComponent(query)}#Intent;scheme=qunarphone;package=com.qunar.atom;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "马蜂窝": {
      id: "马蜂窝",
      displayName: { zh: "马蜂窝", en: "Mafengwo" },
      domains: ["mafengwo.cn"],
      hasApp: true,
      androidPackageId: "com.mfwsc.mafengwo",
      webLink: ({ query }) => `https://www.mafengwo.cn/search/q.php?t=sales&q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) =>
        `mafengwo://search?keyword=${encodeURIComponent(query)}&from=deeplink`,
      androidScheme: ({ query }) => {
        const web = `https://www.mafengwo.cn/search/q.php?t=sales&q=${encodeURIComponent(query)}`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=mafengwo;package=com.mfwsc.mafengwo;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "穷游": {
      id: "穷游",
      displayName: { zh: "穷游", en: "Qyer" },
      domains: ["qyer.com"],
      hasApp: true,
      androidPackageId: "com.qyer.android",
      webLink: ({ query }) => `https://search.qyer.com/qp/?keyword=${encodeURIComponent(query)}&tab=bbs`,
      iosScheme: ({ query }) =>
        `qyertravel://search?keyword=${encodeURIComponent(query)}&from=deeplink`,
      androidScheme: ({ query }) => {
        const web = `https://search.qyer.com/qp/?keyword=${encodeURIComponent(query)}&tab=bbs`;
        return `intent://search?keyword=${encodeURIComponent(query)}#Intent;scheme=qyertravel;package=com.qyer.android;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
  };
}

export function getWeightedProvidersForCategory(
  category: RecommendationCategory,
  region: DeploymentRegion,
  isMobile?: boolean
): WeightedProvider[] {
  if (region === "CN") {
    if (isMobile) {
      switch (category) {
        case "food":
          return [
            { provider: "小红书", weight: 0.18, tier: "mainstream" },
            { provider: "大众点评", weight: 0.18, tier: "mainstream" },
            { provider: "美团", weight: 0.16, tier: "mainstream" },
            { provider: "淘宝闪购", weight: 0.12, tier: "mainstream" },
            { provider: "京东秒送", weight: 0.12, tier: "mainstream" },
            { provider: "高德地图", weight: 0.10, tier: "mainstream" },
            { provider: "百度地图", weight: 0.08, tier: "mainstream" },
            { provider: "腾讯地图", weight: 0.06, tier: "mainstream" },
          ];
        case "shopping":
          return [
            { provider: "京东", weight: 0.30, tier: "mainstream" },
            { provider: "淘宝", weight: 0.28, tier: "mainstream" },
            { provider: "拼多多", weight: 0.22, tier: "mainstream" },
            { provider: "唯品会", weight: 0.20, tier: "mainstream" },
          ];
        case "entertainment":
          return [
            { provider: "腾讯视频", weight: 0.16, tier: "mainstream" },
            { provider: "优酷", weight: 0.14, tier: "mainstream" },
            { provider: "爱奇艺", weight: 0.14, tier: "mainstream" },
            { provider: "TapTap", weight: 0.14, tier: "mainstream" },
            { provider: "网易云音乐", weight: 0.12, tier: "mainstream" },
            { provider: "酷狗音乐", weight: 0.11, tier: "mainstream" },
            { provider: "QQ音乐", weight: 0.11, tier: "mainstream" },
            { provider: "百度", weight: 0.08, tier: "longtail" },
          ];
        case "travel":
          return [
            { provider: "携程", weight: 0.40, tier: "mainstream" },
            { provider: "去哪儿", weight: 0.34, tier: "mainstream" },
            { provider: "马蜂窝", weight: 0.26, tier: "mainstream" },
          ];
        case "fitness":
          return [
            { provider: "B站", weight: 0.40, tier: "mainstream" },
            { provider: "美团", weight: 0.34, tier: "mainstream" },
            { provider: "高德地图", weight: 0.26, tier: "mainstream" },
          ];
        default:
          return [];
      }
    }

    switch (category) {
      case "food":
        return [
          { provider: "下厨房", weight: 0.35, tier: "mainstream" },
          { provider: "高德地图", weight: 0.30, tier: "mainstream" },
          { provider: "大众点评", weight: 0.25, tier: "mainstream" },
          { provider: "小红书", weight: 0.10, tier: "longtail" },
        ];
      case "shopping":
        return [
          { provider: "京东", weight: 0.40, tier: "mainstream" },
          { provider: "什么值得买", weight: 0.35, tier: "mainstream" },
          { provider: "慢慢买", weight: 0.25, tier: "mainstream" },
        ];
      case "entertainment":
        return [
          { provider: "腾讯视频", weight: 0.30, tier: "mainstream" },
          { provider: "TapTap", weight: 0.25, tier: "mainstream" },
          { provider: "Steam", weight: 0.20, tier: "mainstream" },
          { provider: "酷狗音乐", weight: 0.15, tier: "mainstream" },
          { provider: "笔趣阁", weight: 0.10, tier: "longtail" },
        ];
      case "travel":
        return [
          { provider: "携程", weight: 0.40, tier: "mainstream" },
          { provider: "马蜂窝", weight: 0.34, tier: "mainstream" },
          { provider: "穷游", weight: 0.26, tier: "mainstream" },
        ];
      case "fitness":
        return [
          { provider: "B站", weight: 0.40, tier: "mainstream" },
          { provider: "知乎", weight: 0.34, tier: "mainstream" },
          { provider: "什么值得买", weight: 0.26, tier: "mainstream" },
        ];
      default:
        return [];
    }
  }

  // INTL mobile branch — must come before the INTL web branch
  if (region === "INTL" && isMobile) {
    switch (category) {
      case "entertainment":
        return [
          { provider: "YouTube", weight: 0.18, tier: "mainstream" },
          { provider: "TikTok", weight: 0.18, tier: "mainstream" },
          { provider: "JustWatch", weight: 0.16, tier: "mainstream" },
          { provider: "Spotify", weight: 0.16, tier: "mainstream" },
          { provider: "Medium", weight: 0.16, tier: "longtail" },
          { provider: "MiniReview", weight: 0.16, tier: "longtail" },
        ];
      case "shopping":
        return [
          { provider: "Amazon", weight: 0.30, tier: "mainstream" },
          { provider: "Etsy", weight: 0.25, tier: "mainstream" },
          { provider: "Slickdeals", weight: 0.25, tier: "mainstream" },
          { provider: "Pinterest", weight: 0.20, tier: "mainstream" },
        ];
      case "food":
        return [
          { provider: "DoorDash", weight: 0.25, tier: "mainstream" },
          { provider: "Uber Eats", weight: 0.25, tier: "mainstream" },
          { provider: "Fantuan Delivery", weight: 0.15, tier: "mainstream" },
          { provider: "HungryPanda", weight: 0.15, tier: "mainstream" },
          { provider: "Google Maps", weight: 0.10, tier: "longtail" },
          { provider: "Google", weight: 0.10, tier: "longtail" },
        ];
      case "travel":
        return [
          { provider: "TripAdvisor", weight: 0.15, tier: "mainstream" },
          { provider: "Yelp", weight: 0.15, tier: "mainstream" },
          { provider: "Wanderlog", weight: 0.15, tier: "mainstream" },
          { provider: "Visit A City", weight: 0.10, tier: "longtail" },
          { provider: "GetYourGuide", weight: 0.15, tier: "mainstream" },
          { provider: "Google Maps", weight: 0.20, tier: "mainstream" },
          { provider: "Google", weight: 0.10, tier: "longtail" },
        ];
      case "fitness":
        return [
          { provider: "Nike Training Club", weight: 0.12, tier: "mainstream" },
          { provider: "Peloton", weight: 0.12, tier: "mainstream" },
          { provider: "Strava", weight: 0.12, tier: "mainstream" },
          { provider: "Nike Run Club", weight: 0.10, tier: "mainstream" },
          { provider: "Hevy", weight: 0.10, tier: "mainstream" },
          { provider: "Strong", weight: 0.10, tier: "mainstream" },
          { provider: "Down Dog", weight: 0.12, tier: "mainstream" },
          { provider: "MyFitnessPal", weight: 0.12, tier: "mainstream" },
          { provider: "Google", weight: 0.10, tier: "longtail" },
        ];
      default:
        return [];
    }
  }

  // INTL web branch
  switch (category) {
    case "food":
      return [
        { provider: "Uber Eats", weight: 0.25, tier: "mainstream" },
        { provider: "Google Maps", weight: 0.20, tier: "mainstream" },
        { provider: "Yelp", weight: 0.20, tier: "mainstream" },
        { provider: "Love and Lemons", weight: 0.15, tier: "longtail" },
        { provider: "YouTube", weight: 0.10, tier: "longtail" },
        { provider: "Google", weight: 0.10, tier: "longtail" },
      ];
    case "shopping":
      return [
        { provider: "Amazon", weight: 0.25, tier: "mainstream" },
        { provider: "eBay", weight: 0.25, tier: "mainstream" },
        { provider: "Walmart", weight: 0.25, tier: "mainstream" },
        { provider: "Google Maps", weight: 0.15, tier: "longtail" },
        { provider: "Google", weight: 0.10, tier: "longtail" },
      ];
    case "entertainment":
      return [
        { provider: "YouTube", weight: 0.25, tier: "mainstream" },
        { provider: "IMDb", weight: 0.20, tier: "mainstream" },
        { provider: "Spotify", weight: 0.15, tier: "mainstream" },
        { provider: "Steam", weight: 0.15, tier: "mainstream" },
        { provider: "Metacritic", weight: 0.10, tier: "longtail" },
        { provider: "Netflix", weight: 0.10, tier: "longtail" },
        { provider: "Google", weight: 0.05, tier: "longtail" },
      ];
    case "travel":
      return [
        { provider: "Booking.com", weight: 0.25, tier: "mainstream" },
        { provider: "TripAdvisor", weight: 0.25, tier: "mainstream" },
        { provider: "YouTube", weight: 0.15, tier: "mainstream" },
        { provider: "Google Maps", weight: 0.15, tier: "longtail" },
        { provider: "SANParks", weight: 0.10, tier: "longtail" },
        { provider: "Airbnb", weight: 0.10, tier: "longtail" },
      ];
    case "fitness":
      return [
        { provider: "YouTube Fitness", weight: 0.30, tier: "mainstream" },
        { provider: "Muscle & Strength", weight: 0.25, tier: "mainstream" },
        { provider: "Google Maps", weight: 0.15, tier: "longtail" },
        { provider: "MyFitnessPal", weight: 0.10, tier: "longtail" },
        { provider: "Peloton", weight: 0.10, tier: "longtail" },
        { provider: "Google", weight: 0.10, tier: "longtail" },
      ];
    default:
      return [];
  }
}
