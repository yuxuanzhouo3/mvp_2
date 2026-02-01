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
  | "YouTube Fitness";

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

function youtubeSearchUrl(query: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function amapSearchUrl(query: string) {
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(query)}`;
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
      universalLink: ({ query }) => googleMapsSearchUrl(query),
      webLink: ({ query }) => googleMapsSearchUrl(query),
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
      universalLink: ({ query }) => youtubeSearchUrl(query),
      webLink: ({ query }) => youtubeSearchUrl(query),
    },
    "腾讯视频": {
      id: "腾讯视频",
      displayName: { zh: "腾讯视频", en: "Tencent Video" },
      domains: ["v.qq.com"],
      hasApp: true,
      webLink: ({ query }) => `https://v.qq.com/x/search/?q=${encodeURIComponent(query)}`,
    },
    "爱奇艺": {
      id: "爱奇艺",
      displayName: { zh: "爱奇艺", en: "iQIYI" },
      domains: ["iqiyi.com"],
      hasApp: true,
      webLink: ({ query }) => `https://so.iqiyi.com/so/q_${encodeURIComponent(query)}`,
    },
    "优酷": {
      id: "优酷",
      displayName: { zh: "优酷", en: "Youku" },
      domains: ["youku.com"],
      hasApp: true,
      webLink: ({ query }) => `https://so.youku.com/search_video/q_${encodeURIComponent(query)}`,
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
      webLink: ({ query }) => `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(query)}`,
    },
    "酷狗音乐": {
      id: "酷狗音乐",
      displayName: { zh: "酷狗音乐", en: "Kugou Music" },
      domains: ["kugou.com"],
      hasApp: true,
      webLink: ({ query }) =>
        `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${encodeURIComponent(query)}`,
      iosScheme: () => `kugouURL://`,
      androidScheme: () => `kugouURL://`,
    },
    "网易云音乐": {
      id: "网易云音乐",
      displayName: { zh: "网易云音乐", en: "NetEase Cloud Music" },
      domains: ["music.163.com"],
      hasApp: true,
      webLink: ({ query }) => `https://music.163.com/#/search/m/?s=${encodeURIComponent(query)}`,
      iosScheme: () => `orpheuswidget://`,
      androidScheme: () => `orpheuswidget://`,
    },
    TapTap: {
      id: "TapTap",
      displayName: { zh: "TapTap", en: "TapTap" },
      domains: ["taptap.cn", "taptap.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.taptap.cn/search/${encodeURIComponent(query)}`,
    },
    "小红书": {
      id: "小红书",
      displayName: { zh: "小红书", en: "Xiaohongshu" },
      domains: ["xiaohongshu.com"],
      hasApp: true,
      androidPackageId: "com.xingin.xhs",
      webLink: ({ query }) =>
        `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&type=note`,
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
      androidScheme: ({ query }) =>
        `bilibili://search?keyword=${encodeURIComponent(query)}`,
    },
    "大众点评": {
      id: "大众点评",
      displayName: { zh: "大众点评", en: "Dianping" },
      domains: ["dianping.com"],
      hasApp: true,
      androidPackageId: "com.dianping.v1",
      webLink: ({ query }) =>
        `https://www.dianping.com/search/keyword/2/0_${encodeURIComponent(query)}`,
    },
    "下厨房": {
      id: "下厨房",
      displayName: { zh: "下厨房", en: "Xiachufang" },
      domains: ["xiachufang.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(query)}`,
    },
    百度: {
      id: "百度",
      displayName: { zh: "百度", en: "Baidu" },
      domains: ["baidu.com"],
      hasApp: true,
      universalLink: ({ query }) => baiduSearchUrl(query),
      webLink: ({ query }) => baiduSearchUrl(query),
    },
    "淘宝": {
      id: "淘宝",
      displayName: { zh: "淘宝", en: "Taobao" },
      domains: ["taobao.com"],
      hasApp: true,
      androidPackageId: "com.taobao.taobao",
      webLink: ({ query }) => `https://s.taobao.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: ({ query }) => `taobao://s.taobao.com?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
        return `intent://s.taobao.com?q=${encodeURIComponent(query)}#Intent;scheme=taobao;package=com.taobao.taobao;S.browser_fallback_url=${encodeURIComponent(web)};end`;
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
    },
    "什么值得买": {
      id: "什么值得买",
      displayName: { zh: "什么值得买", en: "SMZDM" },
      domains: ["smzdm.com"],
      hasApp: true,
      webLink: ({ query }) => `https://search.smzdm.com/?c=home&s=${encodeURIComponent(query)}`,
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
      webLink: ({ query }) =>
        `https://category.vip.com/suggest.php?keyword=${encodeURIComponent(query)}`,
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
      universalLink: ({ query }) => amapSearchUrl(query),
      webLink: ({ query }) => amapSearchUrl(query),
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
      webLink: ({ query }) => tencentMapSearchUrl(query),
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
      androidScheme: ({ query }) =>
        `imeituan://www.meituan.com/search?q=${encodeURIComponent(query)}`,
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
      iosScheme: ({ query }) => `taobao://s.taobao.com?q=${encodeURIComponent(query)}`,
      androidScheme: ({ query }) => {
        const web = `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
        return `intent://s.taobao.com?q=${encodeURIComponent(query)}#Intent;scheme=taobao;package=com.taobao.taobao;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      },
    },
    "Uber Eats": {
      id: "Uber Eats",
      displayName: { zh: "Uber Eats", en: "Uber Eats" },
      domains: ["ubereats.com", "uber.com"],
      hasApp: true,
      webLink: ({ query }) =>
        `https://www.ubereats.com/search?diningMode=DELIVERY&q=${encodeURIComponent(query)}`,
    },
    DoorDash: {
      id: "DoorDash",
      displayName: { zh: "DoorDash", en: "DoorDash" },
      domains: ["doordash.com"],
      hasApp: true,
      webLink: ({ query }) =>
        `https://www.doordash.com/search/store/${encodeURIComponent(query)}/`,
    },
    Yelp: {
      id: "Yelp",
      displayName: { zh: "Yelp", en: "Yelp" },
      domains: ["yelp.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.yelp.com/search?find_desc=${encodeURIComponent(query)}`,
    },
    OpenTable: {
      id: "OpenTable",
      displayName: { zh: "OpenTable", en: "OpenTable" },
      domains: ["opentable.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.opentable.com/search?q=${encodeURIComponent(query)}`,
    },
    Amazon: {
      id: "Amazon",
      displayName: { zh: "Amazon", en: "Amazon" },
      domains: ["amazon.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
    },
    eBay: {
      id: "eBay",
      displayName: { zh: "eBay", en: "eBay" },
      domains: ["ebay.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`,
    },
    Walmart: {
      id: "Walmart",
      displayName: { zh: "Walmart", en: "Walmart" },
      domains: ["walmart.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
    },
    Target: {
      id: "Target",
      displayName: { zh: "Target", en: "Target" },
      domains: ["target.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`,
    },
    Netflix: {
      id: "Netflix",
      displayName: { zh: "Netflix", en: "Netflix" },
      domains: ["netflix.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.netflix.com/search?q=${encodeURIComponent(query)}`,
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
        `https://www.metacritic.com/search/all/${encodeURIComponent(query)}/results`,
    },
    TripAdvisor: {
      id: "TripAdvisor",
      displayName: { zh: "TripAdvisor", en: "TripAdvisor" },
      domains: ["tripadvisor.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`,
    },
    "Booking.com": {
      id: "Booking.com",
      displayName: { zh: "Booking.com", en: "Booking.com" },
      domains: ["booking.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`,
    },
    Agoda: {
      id: "Agoda",
      displayName: { zh: "Agoda", en: "Agoda" },
      domains: ["agoda.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.agoda.com/search/${encodeURIComponent(query)}.html`,
    },
    Airbnb: {
      id: "Airbnb",
      displayName: { zh: "Airbnb", en: "Airbnb" },
      domains: ["airbnb.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.airbnb.com/s/${encodeURIComponent(query)}/homes`,
    },
    Keep: {
      id: "Keep",
      displayName: { zh: "Keep", en: "Keep" },
      domains: ["gotokeep.com"],
      hasApp: true,
      androidPackageId: "com.gotokeep.keep",
      webLink: ({ query }) => `https://www.gotokeep.com/search?q=${encodeURIComponent(query)}`,
      iosScheme: () => `keep://`,
      androidScheme: () => `keep://`,
    },
    MyFitnessPal: {
      id: "MyFitnessPal",
      displayName: { zh: "MyFitnessPal", en: "MyFitnessPal" },
      domains: ["myfitnesspal.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.myfitnesspal.com/food/search?q=${encodeURIComponent(query)}`,
    },
    Peloton: {
      id: "Peloton",
      displayName: { zh: "Peloton", en: "Peloton" },
      domains: ["onepeloton.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.onepeloton.com/search?q=${encodeURIComponent(query)}`,
    },
    "Muscle & Strength": {
      id: "Muscle & Strength",
      displayName: { zh: "Muscle & Strength", en: "Muscle & Strength" },
      domains: ["muscleandstrength.com"],
      hasApp: false,
      webLink: ({ query }) => `https://www.muscleandstrength.com/?s=${encodeURIComponent(query)}`,
    },
    "携程": {
      id: "携程",
      displayName: { zh: "携程", en: "Ctrip" },
      domains: ["ctrip.com"],
      hasApp: true,
      webLink: ({ query }) =>
        `https://you.ctrip.com/globalsearch/?keyword=${encodeURIComponent(query)}`,
    },
    "去哪儿": {
      id: "去哪儿",
      displayName: { zh: "去哪儿", en: "Qunar" },
      domains: ["qunar.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.qunar.com/search?searchWord=${encodeURIComponent(query)}`,
    },
    "马蜂窝": {
      id: "马蜂窝",
      displayName: { zh: "马蜂窝", en: "Mafengwo" },
      domains: ["mafengwo.cn"],
      hasApp: true,
      webLink: ({ query }) => `https://www.mafengwo.cn/search/q.php?q=${encodeURIComponent(query)}`,
    },
    "穷游": {
      id: "穷游",
      displayName: { zh: "穷游", en: "Qyer" },
      domains: ["qyer.com"],
      hasApp: true,
      webLink: ({ query }) => `https://www.qyer.com/search?q=${encodeURIComponent(query)}`,
    },
  };
}

export function getWeightedProvidersForCategory(
  category: RecommendationCategory,
  region: DeploymentRegion
): WeightedProvider[] {
  if (region === "CN") {
    switch (category) {
      case "food":
        return [
          { provider: "大众点评", weight: 0.35, tier: "mainstream" },
          { provider: "高德地图", weight: 0.25, tier: "mainstream" },
          { provider: "百度地图", weight: 0.2, tier: "mainstream" },
          { provider: "腾讯地图", weight: 0.2, tier: "mainstream" },
        ];
      case "shopping":
        return [
          { provider: "京东", weight: 0.3, tier: "mainstream" },
          { provider: "淘宝", weight: 0.3, tier: "mainstream" },
          { provider: "拼多多", weight: 0.2, tier: "mainstream" },
          { provider: "唯品会", weight: 0.2, tier: "mainstream" },
        ];
      case "entertainment":
        return [
          { provider: "腾讯视频", weight: 0.25, tier: "mainstream" },
          { provider: "优酷", weight: 0.25, tier: "mainstream" },
          { provider: "QQ音乐", weight: 0.15, tier: "mainstream" },
          { provider: "酷狗音乐", weight: 0.1, tier: "mainstream" },
          { provider: "网易云音乐", weight: 0.1, tier: "mainstream" },
          { provider: "TapTap", weight: 0.15, tier: "mainstream" },
        ];
      case "travel":
        return [
          { provider: "携程", weight: 0.3, tier: "mainstream" },
          { provider: "去哪儿", weight: 0.25, tier: "mainstream" },
          { provider: "小红书", weight: 0.2, tier: "mainstream" },
          { provider: "马蜂窝", weight: 0.25, tier: "mainstream" },
        ];
      case "fitness":
        return [
          { provider: "Keep", weight: 0.23, tier: "mainstream" },
          { provider: "B站", weight: 0.18, tier: "mainstream" },
          { provider: "优酷", weight: 0.15, tier: "mainstream" },
          { provider: "大众点评", weight: 0.14, tier: "mainstream" },
          { provider: "美团", weight: 0.1, tier: "mainstream" },
          { provider: "高德地图", weight: 0.08, tier: "longtail" },
          { provider: "百度地图", weight: 0.07, tier: "longtail" },
          { provider: "腾讯地图", weight: 0.05, tier: "longtail" },
        ];
      default:
        return [];
    }
  }

  switch (category) {
    case "food":
      return [
        { provider: "Uber Eats", weight: 0.2, tier: "mainstream" },
        { provider: "DoorDash", weight: 0.2, tier: "mainstream" },
        { provider: "Yelp", weight: 0.2, tier: "mainstream" },
        { provider: "Google Maps", weight: 0.1, tier: "longtail" },
        { provider: "Google", weight: 0.1, tier: "longtail" },
        { provider: "YouTube", weight: 0.1, tier: "longtail" },
        { provider: "TripAdvisor", weight: 0.1, tier: "longtail" },
      ];
    case "shopping":
      return [
        { provider: "Amazon", weight: 0.2, tier: "mainstream" },
        { provider: "eBay", weight: 0.2, tier: "mainstream" },
        { provider: "Walmart", weight: 0.2, tier: "mainstream" },
        { provider: "Target", weight: 0.1, tier: "longtail" },
        { provider: "Google", weight: 0.1, tier: "longtail" },
        { provider: "YouTube", weight: 0.1, tier: "longtail" },
        { provider: "Google Maps", weight: 0.1, tier: "longtail" },
      ];
    case "entertainment":
      return [
        { provider: "YouTube", weight: 0.2, tier: "mainstream" },
        { provider: "Netflix", weight: 0.2, tier: "mainstream" },
        { provider: "Google", weight: 0.2, tier: "mainstream" },
        { provider: "IMDb", weight: 0.1, tier: "longtail" },
        { provider: "Google Maps", weight: 0.1, tier: "longtail" },
        { provider: "YouTube", weight: 0.1, tier: "longtail" },
        { provider: "TripAdvisor", weight: 0.1, tier: "longtail" },
      ];
    case "travel":
      return [
        { provider: "Google Maps", weight: 0.2, tier: "mainstream" },
        { provider: "Booking.com", weight: 0.2, tier: "mainstream" },
        { provider: "TripAdvisor", weight: 0.2, tier: "mainstream" },
        { provider: "Agoda", weight: 0.1, tier: "longtail" },
        { provider: "Airbnb", weight: 0.1, tier: "longtail" },
        { provider: "Google", weight: 0.1, tier: "longtail" },
        { provider: "YouTube", weight: 0.1, tier: "longtail" },
      ];
    case "fitness":
      return [
        { provider: "YouTube Fitness", weight: 0.2, tier: "mainstream" },
        { provider: "MyFitnessPal", weight: 0.2, tier: "mainstream" },
        { provider: "Peloton", weight: 0.2, tier: "mainstream" },
        { provider: "Google", weight: 0.1, tier: "longtail" },
        { provider: "YouTube", weight: 0.1, tier: "longtail" },
        { provider: "Google Maps", weight: 0.1, tier: "longtail" },
        { provider: "TripAdvisor", weight: 0.1, tier: "longtail" },
      ];
    default:
      return [];
  }
}
