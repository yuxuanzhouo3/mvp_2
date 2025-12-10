/**
 * 平台验证机制
 * 确保推荐的平台真实可靠，链接有效
 */

// 可信平台白名单
export const TRUSTED_PLATFORMS = {
  zh: {
    video: ['豆瓣', 'B站', '爱奇艺', '腾讯视频', '优酷', '咪咕视频', '芒果TV'],
    game: ['Steam', 'B站', '淘宝', '京东', '天猫', '拼多多', 'TapTap', 'WeGame'],
    music: ['网易云音乐', 'QQ音乐', '酷狗音乐', '酷我音乐', '虾米音乐', 'B站', '豆瓣'],
    review: ['豆瓣', 'B站', '知乎', '微博', '小红书', '时光网']
  },
  en: {
    video: ['IMDb', 'YouTube', 'Netflix', 'Rotten Tomatoes', 'Hulu', 'Disney+', 'Amazon Prime Video', 'HBO Max'],
    game: ['Steam', 'Epic Games', 'GOG', 'Nintendo eShop', 'PlayStation Store', 'Xbox Games Store', 'Twitch', 'IGN'],
    music: ['Spotify', 'YouTube Music', 'Apple Music', 'Amazon Music', 'SoundCloud', 'Bandcamp', 'Pandora'],
    review: ['IMDb', 'Rotten Tomatoes', 'Metacritic', 'IGN', 'Gamespot', 'Polygon', 'Entertainment Weekly', 'Variety']
  }
};

// 平台域名映射
export const PLATFORM_DOMAINS = {
  '豆瓣': 'douban.com',
  'B站': 'bilibili.com',
  '爱奇艺': 'iqiyi.com',
  '腾讯视频': 'v.qq.com',
  '优酷': 'youku.com',
  '咪咕视频': 'miguvideo.com',
  '芒果TV': 'mgtv.com',
  'Steam': 'steampowered.com',
  '淘宝': 'taobao.com',
  '京东': 'jd.com',
  '天猫': 'tmall.com',
  '拼多多': 'yangkeduo.com',
  'TapTap': 'taptap.com',
  'WeGame': 'wegame.com',
  '网易云音乐': 'music.163.com',
  'QQ音乐': 'y.qq.com',
  '酷狗音乐': 'kugou.com',
  '酷我音乐': 'kuwo.cn',
  '虾米音乐': 'xiami.com',
  '知乎': 'zhihu.com',
  '微博': 'weibo.com',
  '小红书': 'xiaohongshu.com',
  '时光网': 'mtime.com',
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
  'Variety': 'variety.com'
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