/**
 * 平台验证机制
 * 确保推荐的平台真实可靠，链接有效
 */

// 可信平台白名单 - CN 环境优化版（去掉需登录的平台）
export const TRUSTED_PLATFORMS = {
  zh: {
    video: ['豆瓣', '豆瓣电影', 'B站', '爱奇艺', '腾讯视频', '优酷', '咪咕视频', '芒果TV'],
    game: ['Steam', 'B站', 'TapTap', 'WeGame', '小黑盒', '3DM', '游民星空', 'B站游戏', '4399小游戏', 'Epic Games'],
    music: ['QQ音乐', '酷狗音乐', '汽水音乐', '酷我音乐', 'B站'],  // 去掉需登录的网易云音乐
    review: ['豆瓣', 'B站', '知乎', '微博', '时光网', '百度'],  // 去掉需登录的小红书
    shopping: ['什么值得买', '苏宁易购', '拼多多', '唯品会', '当当网', '1688', '淘宝', '京东', '天猫'],  // 去掉需登录的小红书购物
    food: ['百度地图美食', '高德地图美食', '饿了么', '下厨房', '豆果美食'],  // 去掉需登录的美团、小红书美食、大众点评
    travel: ['携程', '马蜂窝', '穷游', '去哪儿', '飞猪', '途牛', '同程旅行', '驴妈妈', '高德地图旅游', '百度地图旅游', 'Booking.com', 'Agoda', 'Airbnb'],  // 去掉需登录的小红书旅游
    fitness: ['B站健身', '腾讯视频健身', '优酷健身', '百度地图健身', '高德地图健身', '百度健身', 'FitnessVolt', 'GarageGymReviews']  // 去掉需登录的抖音健身、小红书健身
  },
  en: {
    video: ['IMDb', 'YouTube', 'Netflix', 'Rotten Tomatoes', 'Hulu', 'Disney+', 'Amazon Prime Video', 'HBO Max'],
    game: ['Steam', 'Epic Games', 'GOG', 'Nintendo eShop', 'PlayStation Store', 'Xbox Games Store', 'Twitch', 'IGN', 'Humble Bundle', 'itch.io', 'Game Pass', 'Green Man Gaming'],
    music: ['Spotify', 'YouTube Music', 'Apple Music', 'Amazon Music', 'SoundCloud', 'Bandcamp', 'Pandora'],
    review: ['IMDb', 'Rotten Tomatoes', 'Metacritic', 'IGN', 'Gamespot', 'Polygon', 'Entertainment Weekly', 'Variety']
  }
};

// 平台域名映射
export const PLATFORM_DOMAINS = {
  '豆瓣': 'douban.com',
  '豆瓣电影': 'douban.com',
  'B站': 'bilibili.com',
  '爱奇艺': 'iqiyi.com',
  '腾讯视频': 'v.qq.com',
  '优酷': 'youku.com',
  '咪咕视频': 'miguvideo.com',
  '芒果TV': 'mgtv.com',
  '抖音': 'douyin.com',
  '抖音健身': 'douyin.com',
  'Steam': 'steampowered.com',
  '淘宝': 'taobao.com',
  '京东': 'jd.com',
  '天猫': 'tmall.com',
  '拼多多': 'yangkeduo.com',
  '什么值得买': 'smzdm.com',
  '苏宁易购': 'suning.com',
  '唯品会': 'vip.com',
  '当当网': 'dangdang.com',
  '小红书购物': 'xiaohongshu.com',
  '1688': '1688.com',
  'TapTap': 'taptap.com',
  'WeGame': 'wegame.com',
  '小黑盒': 'xiaoheihe.cn',
  '3DM': '3dmgame.com',
  '游民星空': 'gamersky.com',
  'B站游戏': 'bilibili.com',
  '4399小游戏': '4399.com',
  'QQ音乐': 'y.qq.com',
  '酷狗音乐': 'kugou.com',
  '汽水音乐': 'qishui.com',
  '酷我音乐': 'kuwo.cn',
  '网易云音乐': 'music.163.com',
  '虾米音乐': 'xiami.com',
  '知乎': 'zhihu.com',
  '微博': 'weibo.com',
  '小红书': 'xiaohongshu.com',
  '时光网': 'mtime.com',
  '百度': 'baidu.com',
  // 美食平台
  '小红书美食': 'xiaohongshu.com',
  '百度地图美食': 'map.baidu.com',
  '高德地图美食': 'ditu.amap.com',
  '美团': 'meituan.com',
  '饿了么': 'ele.me',
  '下厨房': 'xiachufang.com',
  '豆果美食': 'douguo.com',
  '大众点评': 'dianping.com',
  // 旅游平台
  '携程': 'ctrip.com',
  '马蜂窝': 'mafengwo.cn',
  '穷游': 'qyer.com',
  '去哪儿': 'qunar.com',
  '飞猪': 'fliggy.com',
  '途牛': 'tuniu.com',
  '同程旅行': 'ly.com',
  '驴妈妈': 'lvmama.com',
  '高德地图旅游': 'ditu.amap.com',
  '百度地图旅游': 'map.baidu.com',
  '小红书旅游': 'xiaohongshu.com',
  // 健身平台
  'B站健身': 'bilibili.com',
  '腾讯视频健身': 'v.qq.com',
  '优酷健身': 'youku.com',
  '小红书健身': 'xiaohongshu.com',
  '百度地图健身': 'map.baidu.com',
  '高德地图健身': 'ditu.amap.com',
  // 国际平台
  'IMDb': 'imdb.com',
  'YouTube': 'youtube.com',
  'Netflix': 'netflix.com',
  'Rotten Tomatoes': 'rottentomatoes.com',
  'Hulu': 'hulu.com',
  'Disney+': 'disneyplus.com',
  'Amazon Prime Video': 'primevideo.com',
  'HBO Max': 'hbomax.com',
  'Epic Games': 'epicgames.com',
  'GOG': 'gog.com',
  'Nintendo eShop': 'nintendo.com',
  'PlayStation Store': 'playstation.com',
  'Xbox Games Store': 'xbox.com',
  'Twitch': 'twitch.tv',
  'IGN': 'ign.com',
  'Humble Bundle': 'humblebundle.com',
  'itch.io': 'itch.io',
  'Game Pass': 'xbox.com',
  'Green Man Gaming': 'greenmangaming.com',
  'Spotify': 'spotify.com',
  'YouTube Music': 'music.youtube.com',
  'Apple Music': 'music.apple.com',
  'Amazon Music': 'music.amazon.com',
  'SoundCloud': 'soundcloud.com',
  'Bandcamp': 'bandcamp.com',
  'Pandora': 'pandora.com',
  'Metacritic': 'metacritic.com',
  'Gamespot': 'gamespot.com',
  'Polygon': 'polygon.com',
  'Entertainment Weekly': 'ew.com',
  'Variety': 'variety.com',
  'Booking.com': 'booking.com',
  'Agoda': 'agoda.com',
  'Airbnb': 'airbnb.com',
  'FitnessVolt': 'fitnessvolt.com',
  'GarageGymReviews': 'garagegymreviews.com'
};

/**
 * 验证平台是否可信
 */
export function isTrustedPlatform(
  platform: string,
  entertainmentType?: 'video' | 'game' | 'music' | 'review',
  locale: string = 'zh'
): boolean {
  const platforms = TRUSTED_PLATFORMS[locale as keyof typeof TRUSTED_PLATFORMS];
  if (!platforms) return false;

  // 如果指定了娱乐类型，检查对应的平台列表
  if (entertainmentType && platforms[entertainmentType]) {
    return platforms[entertainmentType].includes(platform);
  }

  // 否则检查所有类型的平台列表
  return Object.values(platforms).some(typePlatforms => typePlatforms.includes(platform));
}

/**
 * 获取平台的官方域名
 */
export function getPlatformDomain(platform: string): string | null {
  return PLATFORM_DOMAINS[platform as keyof typeof PLATFORM_DOMAINS] || null;
}

/**
 * 验证链接是否属于可信平台
 */
export function isValidPlatformLink(url: string, platform: string): boolean {
  const domain = getPlatformDomain(platform);
  if (!domain) return false;

  try {
    const urlDomain = new URL(url).hostname;
    return urlDomain.includes(domain) || domain.includes(urlDomain);
  } catch {
    return false;
  }
}

/**
 * 为娱乐推荐选择最合适的平台
 * 确保选择的是可信平台
 */
export function selectValidPlatform(
  suggestedPlatform: string,
  entertainmentType: 'video' | 'game' | 'music' | 'review',
  locale: string = 'zh'
): string {
  // 首先检查建议的平台是否可信
  if (isTrustedPlatform(suggestedPlatform, entertainmentType, locale)) {
    return suggestedPlatform;
  }

  // 如果不可信，根据类型选择默认的可靠平台
  const defaultPlatforms = {
    zh: {
      video: '豆瓣',
      game: 'Steam',
      music: '网易云音乐',
      review: '豆瓣'
    },
    en: {
      video: 'IMDb',
      game: 'Steam',
      music: 'Spotify',
      review: 'IMDb'
    }
  };

  return defaultPlatforms[locale as keyof typeof defaultPlatforms][entertainmentType];
}

/**
 * 验证并修正推荐列表中的平台
 */
export function validateAndFixPlatforms(
  recommendations: any[],
  locale: string = 'zh'
): any[] {
  return recommendations.map(rec => {
    if (rec.category !== 'entertainment' || !rec.entertainmentType) {
      return rec;
    }

    const validPlatform = selectValidPlatform(
      rec.platform,
      rec.entertainmentType,
      locale
    );

    return {
      ...rec,
      platform: validPlatform,
      metadata: {
        ...rec.metadata,
        platformValidated: true,
        originalPlatform: rec.platform
      }
    };
  });
}