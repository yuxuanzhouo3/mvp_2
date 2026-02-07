/**
 * 搜索引擎链接生成器
 * 根据平台和搜索词生成真实可用的搜索链接
 */

interface SearchLink {
  url: string;
  displayName: string;
}

/**
 * 游戏平台类型定义
 */
export interface GamePlatform {
  id: string;
  name: string;
  url: string;
  region: 'cn' | 'intl';
  gameTypes: ('pc' | 'console' | 'mobile' | 'indie')[];
  searchUrl: (query: string) => string;
}

/**
 * 游戏类型枚举
 */
export enum GameType {
  PC = 'pc',
  CONSOLE = 'console',
  MOBILE = 'mobile',
  INDIE = 'indie'
}

/**
 * 游戏平台配置
 */
export const GAME_PLATFORMS: GamePlatform[] = [
  // 中国版游戏平台
  {
    id: 'steam-cn',
    name: 'Steam',
    url: 'https://store.steampowered.com',
    region: 'cn',
    gameTypes: ['pc', 'indie'],
    searchUrl: (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`
  },
  {
    id: 'taptap',
    name: 'TapTap',
    url: 'https://www.taptap.cn',
    region: 'cn',
    gameTypes: ['mobile', 'indie'],
    searchUrl: (q) => `https://www.taptap.cn/search?kw=${encodeURIComponent(q)}`
  },
  {
    id: 'wegame',
    name: 'WeGame',
    url: 'https://www.wegame.com.cn',
    region: 'cn',
    gameTypes: ['pc'],
    searchUrl: (q) => `https://www.wegame.com.cn/search.html?q=${encodeURIComponent(q)}`
  },
  {
    id: 'shanguo',
    name: '杉果',
    url: 'https://www.sonkwo.cn',
    region: 'cn',
    gameTypes: ['pc'],
    searchUrl: (q) => `https://www.sonkwo.cn/search/?keyword=${encodeURIComponent(q)}`
  },
  {
    id: 'xiaoheihe',
    name: '小黑盒',
    url: 'https://www.xiaoheihe.cn',
    region: 'cn',
    gameTypes: ['pc', 'mobile'],
    searchUrl: (q) => `https://www.xiaoheihe.cn/search?q=${encodeURIComponent(q)}`
  },
  {
    id: '3dm',
    name: '3DM',
    url: 'https://www.3dmgame.com',
    region: 'cn',
    gameTypes: ['pc'],
    searchUrl: (q) => `https://so.3dmgame.com/?keyword=${encodeURIComponent(q)}`
  },
  {
    id: 'gamersky',
    name: '游民星空',
    url: 'https://www.gamersky.com',
    region: 'cn',
    gameTypes: ['pc', 'console'],
    searchUrl: (q) => `https://www.gamersky.com/search/?keyword=${encodeURIComponent(q)}`
  },
  {
    id: 'bilibili-game',
    name: 'B站游戏',
    url: 'https://game.bilibili.com',
    region: 'cn',
    gameTypes: ['mobile', 'indie'],
    searchUrl: (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)} 游戏`
  },
  {
    id: '4399',
    name: '4399小游戏',
    url: 'https://www.4399.com',
    region: 'cn',
    gameTypes: ['mobile'],
    searchUrl: (q) => `https://s.4399.com/search_default.php?keyword=${encodeURIComponent(q)}`
  },

  // 国际版游戏平台
  {
    id: 'steam-intl',
    name: 'Steam',
    url: 'https://store.steampowered.com',
    region: 'intl',
    gameTypes: ['pc', 'indie'],
    searchUrl: (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`
  },
  {
    id: 'epic-intl',
    name: 'Epic Games',
    url: 'https://www.epicgames.com/store',
    region: 'intl',
    gameTypes: ['pc'],
    searchUrl: (q) => `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(q)}`
  },
  {
    id: 'playstation',
    name: 'PlayStation Store',
    url: 'https://store.playstation.com',
    region: 'intl',
    gameTypes: ['console'],
    searchUrl: (q) => `https://store.playstation.com/en-us/search/${encodeURIComponent(q)}`
  },
  {
    id: 'xbox',
    name: 'Xbox Store',
    url: 'https://www.xbox.com',
    region: 'intl',
    gameTypes: ['console'],
    searchUrl: (q) => `https://www.xbox.com/en-US/search?q=${encodeURIComponent(q)}`
  },
  {
    id: 'nintendo',
    name: 'Nintendo eShop',
    url: 'https://www.nintendo.com',
    region: 'intl',
    gameTypes: ['console'],
    searchUrl: (q) => `https://www.nintendo.com/search?q=${encodeURIComponent(q)}&filter=cqf3hd31gd84sb462g4s007su9`
  },
  {
    id: 'gog',
    name: 'GOG',
    url: 'https://www.gog.com',
    region: 'intl',
    gameTypes: ['pc', 'indie'],
    searchUrl: (q) => `https://www.gog.com/search?query=${encodeURIComponent(q)}`
  },
  {
    id: 'humble',
    name: 'Humble Bundle',
    url: 'https://www.humblebundle.com',
    region: 'intl',
    gameTypes: ['pc', 'indie'],
    searchUrl: (q) => `https://www.humblebundle.com/store/search?q=${encodeURIComponent(q)}`
  },
  {
    id: 'itchio',
    name: 'itch.io',
    url: 'https://itch.io',
    region: 'intl',
    gameTypes: ['indie'],
    searchUrl: (q) => `https://itch.io/search?q=${encodeURIComponent(q)}`
  },
  {
    id: 'gamepass',
    name: 'Game Pass',
    url: 'https://www.xbox.com',
    region: 'intl',
    gameTypes: ['pc', 'console'],
    searchUrl: (q) => `https://www.xbox.com/en-US/games/search?q=${encodeURIComponent(q)}&store=xbox-one`
  },
  {
    id: 'gmg',
    name: 'Green Man Gaming',
    url: 'https://www.greenmangaming.com',
    region: 'intl',
    gameTypes: ['pc'],
    searchUrl: (q) => `https://www.greenmangaming.com/search?q=${encodeURIComponent(q)}`
  }
];

/**
 * 根据地区获取游戏平台
 */
export function getGamePlatformsByRegion(region: 'cn' | 'intl' = 'cn'): GamePlatform[] {
  return GAME_PLATFORMS.filter(platform => platform.region === region);
}

/**
 * 根据游戏类型获取平台
 */
export function getGamePlatformsByType(gameType: GameType, region: 'cn' | 'intl' = 'cn'): GamePlatform[] {
  return GAME_PLATFORMS.filter(platform =>
    platform.region === region &&
    platform.gameTypes.includes(gameType)
  );
}

/**
 * 智能识别游戏类型
 * 根据游戏名称和关键词自动识别游戏类型
 */
export function identifyGameType(gameName: string, keywords?: string[]): GameType[] {
  const name = gameName.toLowerCase();
  const allKeywords = [name, ...(keywords || []).map(k => k.toLowerCase())];
  const keywordString = allKeywords.join(' ');

  const identifiedTypes: GameType[] = [];

  // 主机游戏关键词
  const consoleKeywords = [
    'ps5', 'playstation 5', 'ps4', 'playstation 4', 'ps3', 'playstation 3',
    'xbox one', 'xbox series x', 'xbox series s', 'xbox 360',
    'switch', 'nintendo switch', 'wii', 'wii u', '3ds',
    'playstation', 'xbox', 'nintendo',
    'sony', 'microsoft', '任天堂',
    '独占', 'exclusive'
  ];

  // PC游戏关键词
  const pcKeywords = [
    'pc', 'steam', 'epic', 'origin', 'uplay',
    'windows', 'mac', 'linux',
    '鼠标', '键盘', '键鼠',
    'mod', 'mods', 'rtx', 'dlss',
    '4k', '144hz', 'fps'
  ];

  // 手机游戏关键词
  const mobileKeywords = [
    '手机', '手游', 'android', 'ios', 'iphone', 'ipad',
    'taptap', '移动', '触屏', '触摸',
    'app', 'apk', 'ipa'
  ];

  // 独立游戏关键词
  const indieKeywords = [
    '独立游戏', 'indie', '像素', 'pixel', 'retro',
    '迷宫', 'roguelike', 'rogue-lite', '解谜', 'puzzle',
    '横版', '2d', '文字', '模拟', '策略',
    '小众', '精品', '创意'
  ];

  // 检查关键词匹配
  if (consoleKeywords.some(keyword => keywordString.includes(keyword))) {
    identifiedTypes.push(GameType.CONSOLE);
  }

  if (pcKeywords.some(keyword => keywordString.includes(keyword))) {
    identifiedTypes.push(GameType.PC);
  }

  if (mobileKeywords.some(keyword => keywordString.includes(keyword))) {
    identifiedTypes.push(GameType.MOBILE);
  }

  if (indieKeywords.some(keyword => keywordString.includes(keyword))) {
    identifiedTypes.push(GameType.INDIE);
  }

  // 特定游戏名称的特殊识别
  const specialGameMappings: Record<string, GameType[]> = {
    '原神': [GameType.MOBILE, GameType.PC],
    'genshin impact': [GameType.MOBILE, GameType.PC],
    '塞尔达传说': [GameType.CONSOLE],
    'zelda': [GameType.CONSOLE],
    '马里奥': [GameType.CONSOLE],
    'mario': [GameType.CONSOLE],
    '宝可梦': [GameType.MOBILE, GameType.CONSOLE],
    'pokemon': [GameType.MOBILE, GameType.CONSOLE],
    '王者荣耀': [GameType.MOBILE],
    'honor of kings': [GameType.MOBILE],
    '和平精英': [GameType.MOBILE],
    'pubg mobile': [GameType.MOBILE],
    '我的世界': [GameType.MOBILE, GameType.PC, GameType.CONSOLE],
    'minecraft': [GameType.MOBILE, GameType.PC, GameType.CONSOLE]
  };

  // 检查特殊游戏名称
  for (const [specialName, types] of Object.entries(specialGameMappings)) {
    if (name.includes(specialName.toLowerCase())) {
      types.forEach(type => {
        if (!identifiedTypes.includes(type)) {
          identifiedTypes.push(type);
        }
      });
    }
  }

  // 如果没有识别出任何类型，默认为PC游戏
  if (identifiedTypes.length === 0) {
    identifiedTypes.push(GameType.PC);
  }

  return identifiedTypes;
}

/**
 * 智能选择游戏平台
 * 根据游戏类型和地区智能选择最佳平台
 */
export function selectGamePlatforms(
  gameName: string,
  region: 'cn' | 'intl' = 'cn',
  keywords?: string[],
  limit: number = 5
): GamePlatform[] {
  const gameTypes = identifyGameType(gameName, keywords);
  const allPossiblePlatforms: { platform: GamePlatform; score: number }[] = [];

  // 为每个平台计算匹配分数
  GAME_PLATFORMS.forEach(platform => {
    if (platform.region !== region) return;

    let score = 0;

    // 根据游戏类型匹配度评分
    gameTypes.forEach(gameType => {
      if (platform.gameTypes.includes(gameType)) {
        if (gameType === GameType.PC) score += 3;
        else if (gameType === GameType.CONSOLE) score += 3;
        else if (gameType === GameType.MOBILE) score += 3;
        else if (gameType === GameType.INDIE) score += 2;
      }
    });

    // 平台偏好加权
    const platformPreferences: Record<string, number> = {
      // 中国版偏好
      'steam-cn': 10,
      'taptap': 9,
      'epic-cn': 8,
      'wegame': 7,
      'xiaoheihe': 6,

      // 国际版偏好
      'steam-intl': 10,
      'epic-intl': 9,
      'playstation': 8,
      'xbox': 8,
      'nintendo': 8,
      'gog': 7,
      'itchio': 6
    };

    score += platformPreferences[platform.id] || 0;

    if (score > 0) {
      allPossiblePlatforms.push({ platform, score });
    }
  });

  // 按分数排序并返回前N个
  return allPossiblePlatforms
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.platform);
}

/**
 * 为推荐生成搜索引擎链接
 */
export function generateSearchLink(
  title: string,
  searchQuery: string,
  platform: string,
  locale: string = 'zh',
  category?: string,
  entertainmentType?: 'video' | 'game' | 'music' | 'review'
): SearchLink {

  // 平台映射：生成对应平台的搜索链接
  const platformSearchUrls: Record<string, Record<string, (query: string) => string>> = {
    zh: {
      // 购物平台 - 部分平台需登录，添加无需登录的替代方案
      '淘宝': (q) => `https://s.taobao.com/search?q=${encodeURIComponent(q)}`,  // 需登录
      '京东': (q) => `https://search.jd.com/Search?keyword=${encodeURIComponent(q)}`,  // 需登录
      '天猫': (q) => `https://list.tmall.com/search_product.htm?q=${encodeURIComponent(q)}`,
      '拼多多': (q) => `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(q)}`,
      '什么值得买': (q) => `https://search.smzdm.com/?c=home&s=${encodeURIComponent(q)}&v=b&mx_v=a`,  // 无需登录，好价推荐
      '慢慢买': (q) => `https://s.manmanbuy.com/pc/search/result?keyword=${encodeURIComponent(q)}&btnSearch=%E6%90%9C%E7%B4%A2`,  // 比价/折扣
      '苏宁易购': (q) => `https://search.suning.com/${encodeURIComponent(q)}/`,  // 无需登录
      '唯品会': (q) => `https://category.vip.com/suggest.php?keyword=${encodeURIComponent(q)}`,  // 品牌折扣
      '当当网': (q) => `http://search.dangdang.com/?key=${encodeURIComponent(q)}`,  // 图书为主
      '小红书购物': (q) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}&type=goods`,  // 种草购物
      '1688': (q) => `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(q)}`,  // 批发价格参考

      // 娱乐平台
      '豆瓣': (q) => `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(q)}`,  // cat=1002 是电影分类
      '豆瓣电影': (q) => `https://www.douban.com/search?cat=1002&q=${encodeURIComponent(q)}`,  // 电影专用
      'B站': (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`,
      '网易云音乐': (q) => `https://music.163.com/#/search/m/?s=${encodeURIComponent(q)}`,
      'QQ音乐': (q) => `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(q)}`,  // QQ音乐无需登录可试听
      '酷狗音乐': (q) => `https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=${encodeURIComponent(q)}`,  // 酷狗无需登录
      '汽水音乐': (q) => `https://www.qishui.com/search?keyword=${encodeURIComponent(q)}`,  // 汽水音乐
      '酷我音乐': (q) => `https://www.kuwo.cn/search/list?key=${encodeURIComponent(q)}`,  // 酷我音乐
      '笔趣阁': (q) => `https://m.bqgde.de/s?q=${encodeURIComponent(q)}`,  // 小说搜索
      'Steam': (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}&supportedlang=schinese&ndl=1`,
      'TapTap': (q) => `https://www.taptap.cn/search/${encodeURIComponent(q)}`,  // 正确URL格式
      'Epic Games': (q) => `https://www.epicgames.com/store/zh-CN/browse?q=${encodeURIComponent(q)}`,
      'WeGame': (q) => `https://www.wegame.com.cn/search.html?q=${encodeURIComponent(q)}`,
      '杉果': (q) => `https://www.sonkwo.cn/search/?keyword=${encodeURIComponent(q)}`,
      '小黑盒': (q) => `https://www.xiaoheihe.cn/search?q=${encodeURIComponent(q)}`,
      '3DM': (q) => `https://so.3dmgame.com/?keyword=${encodeURIComponent(q)}`,
      '游民星空': (q) => `https://www.gamersky.com/search/?keyword=${encodeURIComponent(q)}`,
      'B站游戏': (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)} 游戏`,
      '4399小游戏': (q) => `https://s.4399.com/search_default.php?keyword=${encodeURIComponent(q)}`,
      '爱奇艺': (q) => `https://so.iqiyi.com/so/q_${encodeURIComponent(q)}`,
      '腾讯视频': (q) => `https://v.qq.com/x/search/?q=${encodeURIComponent(q)}`,
      '优酷': (q) => `https://so.youku.com/search_video/q_${encodeURIComponent(q)}`,

      // 美食平台 - 增加更多选择
      '大众点评': (q) => `https://www.dianping.com/search/keyword/2/0_${encodeURIComponent(q)}`,
      '下厨房': (q) => `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(q)}&cat=1001`,
      '百度地图美食': (q) => `https://map.baidu.com/search/${encodeURIComponent(q)}`,
      '高德地图美食': (q) => `https://www.amap.com/search?query=${encodeURIComponent(q)}`,
      '腾讯地图美食': (q) => `https://map.qq.com/m/search?keyword=${encodeURIComponent(q)}`,
      '饿了么': (q) => `https://www.ele.me/search/${encodeURIComponent(q)}`,  // 外卖平台
      '美团': (q) => `https://www.meituan.com/s/${encodeURIComponent(q)}/`,  // 本地生活/外卖
      '百度美食': (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
      '豆果美食': (q) => `https://www.douguo.com/caipu/${encodeURIComponent(q)}`,  // 菜谱平台 - 正确URL格式
      '小红书美食': (q) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}&type=note`,  // 美食攻略

      // 旅游/出行平台 - 增加更多选择，去掉需登录的小红书
      '携程': (q) => `https://you.ctrip.com/globalsearch/?keyword=${encodeURIComponent(q)}`,  // 携程正确URL格式
      '去哪儿': (q) => `https://www.qunar.com/search?searchWord=${encodeURIComponent(q)}`,
      '小红书': (q) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}&type=note`,
      '马蜂窝': (q) => `https://www.mafengwo.cn/search/q.php?t=sales&q=${encodeURIComponent(q)}`,
      '飞猪': (q) => `https://s.fliggy.com/?q=${encodeURIComponent(q)}`,
      '穷游': (q) => `https://search.qyer.com/qp/?keyword=${encodeURIComponent(q)}&tab=bbs`,
      '途牛': (q) => `https://www.tuniu.com/search?q=${encodeURIComponent(q)}`,
      '同程旅行': (q) => `https://www.ly.com/search.html?kw=${encodeURIComponent(q)}`,
      '驴妈妈': (q) => `https://www.lvmama.com/search/?q=${encodeURIComponent(q)}`,
      '高德地图旅游': (q) => `https://ditu.amap.com/search?query=${encodeURIComponent(q + ' 景点')}`,
      '百度地图旅游': (q) => `https://map.baidu.com/search/${encodeURIComponent(q + ' 景点')}`,
      '大麦网': (q) => `https://search.damai.cn/search.htm?keyword=${encodeURIComponent(q)}`,  // 演出票务
      '智行火车票': (q) => `https://www.ly.com/huoche/${encodeURIComponent(q)}.html`,  // 火车票查询
      'Booking.com': (q) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`,
      'Agoda': (q) => `https://www.agoda.com/search/${encodeURIComponent(q)}.html`,
      'Airbnb': (q) => `https://www.airbnb.com/s/${encodeURIComponent(q)}/homes`,

      // 健身平台 - 去掉需登录的平台（小红书、抖音）
      'B站健身': (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q + ' 健身教程')}`,  // B站健身视频
      '腾讯视频健身': (q) => `https://v.qq.com/x/search/?q=${encodeURIComponent(q + ' 健身')}`,  // 腾讯视频健身
      '优酷健身': (q) => `https://so.youku.com/search_video/q_${encodeURIComponent(q + ' 健身')}`,  // 优酷健身视频
      '百度地图健身': (q) => `https://map.baidu.com/search/${encodeURIComponent(q + ' 健身房')}`,  // 百度地图搜健身房
      '高德地图健身': (q) => `https://ditu.amap.com/search?query=${encodeURIComponent(q + ' 健身房')}`,  // 高德地图搜健身房
      '腾讯地图健身': (q) => `https://map.qq.com/m/search?keyword=${encodeURIComponent(q + ' 健身房')}`,
      '百度健身': (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)} 健身教程 视频`,  // 百度搜索健身视频
      'Keep': (q) => `https://www.gotokeep.com/search?q=${encodeURIComponent(q)}`,
      '知乎': (q) => `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(q)}`,
      'FitnessVolt': (q) => `https://fitnessvolt.com/?s=${encodeURIComponent(q)}`,
      'GarageGymReviews': (q) => `https://www.garagegymreviews.com/?s=${encodeURIComponent(q)}`,

      // 通用搜索（降级）
      '百度': (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
    },
    en: {
      // Shopping platforms
      'Amazon': (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
      'eBay': (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
      'Walmart': (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,
      'Target': (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,
      'Etsy': (q) => `https://www.etsy.com/search?q=${encodeURIComponent(q)}`,
      'Slickdeals': (q) => `https://slickdeals.net/newsearch.php?q=${encodeURIComponent(q)}`,
      'Pinterest': (q) => `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}`,

      // Entertainment platforms
      'IMDb': (q) => `https://www.imdb.com/find?q=${encodeURIComponent(q)}`,
      'YouTube': (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      'TikTok': (q) => `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`,
      'JustWatch': (q) => `https://www.justwatch.com/us/search?q=${encodeURIComponent(q)}`,
      'Medium': (q) => `https://medium.com/search?q=${encodeURIComponent(q)}`,
      'Spotify': (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
      'Rotten Tomatoes': (q) => `https://www.rottentomatoes.com/search?search=${encodeURIComponent(q)}`,
      'Metacritic': (q) => `https://www.metacritic.com/search/all/${encodeURIComponent(q)}/results`,
      'Steam': (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}&supportedlang=schinese&ndl=1`,
      'Epic Games': (q) => `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(q)}`,
      'PlayStation Store': (q) => `https://store.playstation.com/en-us/search/${encodeURIComponent(q)}`,
      'Xbox Store': (q) => `https://www.xbox.com/en-US/search?q=${encodeURIComponent(q)}`,
      'Nintendo eShop': (q) => `https://www.nintendo.com/search?q=${encodeURIComponent(q)}&filter=cqf3hd31gd84sb462g4s007su9`,
      'GOG': (q) => `https://www.gog.com/search?query=${encodeURIComponent(q)}`,
      'Humble Bundle': (q) => `https://www.humblebundle.com/store/search?q=${encodeURIComponent(q)}`,
      'itch.io': (q) => `https://itch.io/search?q=${encodeURIComponent(q)}`,
      'Game Pass': (q) => `https://www.xbox.com/en-US/games/search?q=${encodeURIComponent(q)}&store=xbox-one`,
      'Green Man Gaming': (q) => `https://www.greenmangaming.com/search?q=${encodeURIComponent(q)}`,
      'Netflix': (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,

      // Food platforms
      '大众点评': (q) => `https://www.dianping.com/search/keyword/1/0_${encodeURIComponent(q)}`,
      'TripAdvisor': (q) => `https://www.tripadvisor.com/search?q=${encodeURIComponent(q)} restaurants`,
      'OpenTable': (q) => `https://www.opentable.com/s?term=${encodeURIComponent(q)}`,
      'Google Maps': (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}+restaurants+near+me`,
      'Uber Eats': (q) => `https://www.ubereats.com/search?diningMode=DELIVERY&q=${encodeURIComponent(q)}`,
      'DoorDash': (q) => `https://www.doordash.com/search/store/${encodeURIComponent(q)}/`,
      'Yelp': (q) => `https://www.yelp.com/search?find_desc=${encodeURIComponent(q)}`,
      'Zomato': (q) => `https://www.zomato.com/search?q=${encodeURIComponent(q)}`,
      'Allrecipes': (q) => `https://www.allrecipes.com/search?q=${encodeURIComponent(q)}`,
      'Love and Lemons': (q) => `https://www.loveandlemons.com/?s=${encodeURIComponent(q)}`,
      'Fantuan Delivery': () => `https://www.fantuanorder.com`,
      'HungryPanda': () => `https://www.hungrypanda.co/`,

      // Travel platforms
      'TripAdvisor Travel': (q) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(q)}`,
      'Booking.com': (q) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`,
      'Agoda': (q) => `https://www.agoda.com/search/${encodeURIComponent(q)}.html`,
      'Google Flights': (q) => `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`,
      'Expedia': (q) => `https://www.expedia.com/things-to-do/search?q=${encodeURIComponent(q)}`,
      'Airbnb': (q) => `https://www.airbnb.com/s/${encodeURIComponent(q)}/homes`,
      'Airbnb Experiences': (q) => `https://www.airbnb.com/experiences/${encodeURIComponent(q)}`,
      'Klook': (q) => `https://www.klook.com/search?keyword=${encodeURIComponent(q)}`,
      'GetYourGuide': (q) => `https://www.getyourguide.com/s/?q=${encodeURIComponent(q)}`,
      'Viator': (q) => `https://www.viator.com/searchResults?text=${encodeURIComponent(q)}`,
      'Lonely Planet': (q) => `https://www.lonelyplanet.com/search?q=${encodeURIComponent(q)}`,
      'Culture Trip': (q) => `https://theculturetrip.com/search?q=${encodeURIComponent(q)}`,
      'SANParks': (q) => `https://www.sanparks.org/search?q=${encodeURIComponent(q)}`,
      'Wanderlog': (q) => `https://wanderlog.com/search?q=${encodeURIComponent(q)}`,
      'Visit A City': (q) => `https://www.visitacity.com/en/search?q=${encodeURIComponent(q)}`,

      // Fitness platforms
      'YouTube Fitness': (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)} fitness`,
      'MyFitnessPal': (q) => `https://www.myfitnesspal.com/food/search?search=${encodeURIComponent(q)}`,
      'Peloton': (q) => `https://www.onepeloton.com/search?q=${encodeURIComponent(q)}`,
      'FitnessVolt': (q) => `https://fitnessvolt.com/?s=${encodeURIComponent(q)}`,
      'GarageGymReviews': (q) => `https://www.garagegymreviews.com/?s=${encodeURIComponent(q)}`,
      'Muscle & Strength': (q) => `https://www.muscleandstrength.com/store/search/articles?q=${encodeURIComponent(q)}`,
      'Best Buy': (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`,
      'Nike Training Club': () => `https://www.nike.com/ntc-app`,
      'Strava': () => `https://www.strava.com/search`,
      'Nike Run Club': () => `https://www.nike.com/nrc-app`,
      'Hevy': () => `https://www.hevyapp.com`,
      'Strong': () => `https://www.strong.app`,
      'Down Dog': () => `https://www.downdogapp.com`,

      // General search (fallback)
      'Google': (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
    }
  };

  // 获取平台搜索URL生成函数
  const localeUrls = platformSearchUrls[locale] || platformSearchUrls.zh;
  const getSearchUrl = localeUrls[platform] || localeUrls[locale === 'en' ? 'Google' : '百度'];

  // 优先使用 searchQuery，如果为空或太短，则使用标题
  let finalQuery = searchQuery && searchQuery.trim().length > 0 ? searchQuery.trim() : title;

  // 娱乐推荐的特殊处理
  if (category === 'entertainment' && entertainmentType) {
    // 确保搜索词与作品名称高度匹配
    switch (entertainmentType) {
      case 'video':
        // 视频类：豆瓣不添加额外关键词，其他平台可添加
        if (platform === '豆瓣' || platform === '豆瓣电影') {
          // 豆瓣搜索保持纯净，不添加任何后缀
          // 直接使用原始搜索词
        } else if (platform === 'B站' && !finalQuery.includes('观看') && !finalQuery.includes('全集')) {
          finalQuery = `${finalQuery} 观看 全集`;
        } else if (platform === '腾讯视频') {
          // 腾讯视频搜索保持干净关键词，避免混入影评/评分词
          finalQuery = finalQuery.replace(/豆瓣|评分|影评|解析/g, " ").replace(/\s+/g, " ").trim();
        } else if ((platform === '爱奇艺' || platform === '优酷') && !finalQuery.includes('在线观看') && !finalQuery.includes('在线播放')) {
          finalQuery = `${finalQuery} 在线观看`;
        } else if (platform === 'Netflix' && !finalQuery.includes('Netflix')) {
          finalQuery = `${finalQuery} Netflix`;
        }
        break;

      case 'game':
        // 游戏类：确保搜索到游戏下载/购买页面
        // Steam 不再添加后缀，直接使用游戏名搜索
        if ((platform === '淘宝' || platform === '京东') && !finalQuery.includes('购买') && !finalQuery.includes('下载')) {
          finalQuery = `${finalQuery} 购买 下载`;
        }
        break;

      case 'music':
        // 音乐类：搜索歌曲或专辑
        if (platform === '网易云音乐' && !finalQuery.includes('网易云音乐')) {
          finalQuery = `${finalQuery} 网易云音乐`;
        } else if (platform === 'Spotify' && !finalQuery.includes('Spotify')) {
          finalQuery = `${finalQuery} Spotify`;
        }
        break;

      case 'review':
        // 影评/资讯类：添加评论或资讯相关词
        if (platform !== '笔趣阁' && !finalQuery.includes('影评') && !finalQuery.includes('解析') && !finalQuery.includes('评测')) {
          finalQuery = `${finalQuery} 影评 解析`;
        }
        break;
    }
  }

  // 根据平台和分类调整搜索查询
  if (category !== 'travel' && !(category === 'entertainment' && entertainmentType)) {
    // 非旅游推荐使用原有的关键词逻辑
    if (platform === 'Google Maps' || platform === 'TripAdvisor') {
      // 对于点评和地图平台，根据类别添加相关关键词
      if (category === 'food') {
        // Google Maps 特殊处理：搜索菜系类型时保持简洁
        if (platform === 'Google Maps') {
          // 保持原始查询，让 Google Maps 基于位置搜索附近相关菜系
          // 不需要额外添加关键词，确保搜索菜系类型
        } else {
          // TripAdvisor 添加餐厅关键词
          if (!finalQuery.includes('restaurant') && !finalQuery.includes('餐厅') && !finalQuery.includes('美食')) {
            finalQuery = `${finalQuery} restaurant`;
          }
        }
      } else if (category === 'fitness') {
        // 健身平台的特殊处理已由 optimizeFitnessSearchQuery 完成，这里不再添加通用关键词
      }
    } else if (platform === '百度地图') {
      // 百度地图处理 - 不再用于健身，注释保留以备参考
      // if (category === 'fitness') {
      //   健身相关搜索改用 FitnessVolt 等专用平台
      // }
    } else if (platform === '大众点评') {
      // 大众点评专注于美食和服务
      if (category === 'food') {
        // 保持搜索词纯净，不添加任何后缀
      }
      // 健身相关已改用 GarageGymReviews 和 FitnessVolt
    } else if (platform === 'Allrecipes') {
      // Allrecipes 专注于食谱搜索
      if (category === 'food') {
        // Allrecipes 搜索优化：保持菜名简洁，不添加额外关键词
        // 让用户看到纯净的食谱搜索结果
      }
    } else if (platform === 'OpenTable') {
      // Keep the query clean so the search box matches the restaurant name.
    } else if (category === 'fitness' && (platform === 'B站' || platform === 'YouTube Fitness' || platform === 'YouTube')) {
      // 健身视频平台处理 - 搜索词已由 optimizeFitnessSearchQuery 优化
      // 这里不再进行额外处理
    } else if (category === 'fitness' && (platform === 'FitnessVolt' || platform === 'Muscle & Strength')) {
      // 健身计划文章平台 - 搜索词已优化，不需要额外处理
    } else if (category === 'fitness' && (platform === 'GarageGymReviews' || platform === 'Best Buy')) {
      // 健身器材评测平台 - 搜索词已优化，不需要额外处理
    } else if (category === 'fitness' && (platform === '淘宝' || platform === '京东' || platform === 'Amazon')) {
      // 不再使用购物平台用于健身推荐，已改用专业平台
      // 保留此逻辑作为备选方案
      if (!finalQuery.includes('购买') && !finalQuery.includes('buy')) {
        finalQuery = `${finalQuery} 健身器材`;
      }
    }
  }

  // 旅游平台的特殊处理
  if (platform === 'TripAdvisor' || platform === 'TripAdvisor Travel') {
    // TripAdvisor 专注于旅游景点和体验，但不添加通用关键词让搜索更精准
    // 对于已经优化的旅游查询，不再添加额外关键词
  } else if (platform === '携程' || platform === '去哪儿' || platform === '马蜂窝') {
    // 中文旅游平台 - 不再添加通用关键词
  } else if (platform === 'Booking.com') {
    // Booking.com 主要用于住宿预订，特别是度假村
    // 检查查询中是否包含度假村相关关键词
    const isResortRelated = /resort|度假村|温泉|spa|hotel/i.test(finalQuery);

    // 如果不是度假村相关的查询，保持原样（因为平台选择逻辑已经确保只有度假村才会使用Booking.com）
    // 这样确保了Booking.com只搜索度假村和住宿，而不是普通景点
    if (!isResortRelated && !finalQuery.includes('hotels')) {
      // 对于纯粹的景点名称，不添加任何关键词，让Booking.com显示该地点的住宿选项
      // 这里不再添加hotels，避免与查询目的冲突
    }
  } else if (platform === 'Agoda') {
    // Agoda - 住宿预订，专注亚洲
    // 与 Booking.com 保持一致的逻辑
    // 只对度假村相关的查询才添加住宿关键词
    const isResortRelated = /resort|度假村|温泉|spa|hotel/i.test(finalQuery);

    // 对于非度假村查询，保持原样，避免添加无关的住宿关键词
    if (!isResortRelated && !finalQuery.includes('hotels')) {
      // 保持查询精准
    }
  } else if (platform === 'Airbnb') {
    // 对于景点推荐，搜索附近的住宿
    if (!finalQuery.includes('homes') && !finalQuery.includes('stays')) {
      finalQuery = `${finalQuery} homes stays`;
    }
  } else if (platform === 'Google Flights') {
    // 航班搜索
    finalQuery = `${finalQuery} flights`;
  } else if (platform === 'Expedia' || platform === 'Klook' || platform === 'GetYourGuide' || platform === 'Viator') {
    // 旅游活动平台 - 添加活动相关关键词
    if (!finalQuery.includes('tours') && !finalQuery.includes('activities') && !finalQuery.includes('tickets')) {
      finalQuery = `${finalQuery} tours activities`;
    }
  } else if (platform === 'Airbnb Experiences') {
    // Airbnb体验
    finalQuery = `${finalQuery} experiences`;
  } else if (platform === '穷游' || platform === '携程旅行') {
    // 旅游攻略平台 - 不添加关键词保持精准
  } else if (platform === '途牛') {
    // 途牛旅游 - 不添加关键词保持精准
  }

  return {
    url: getSearchUrl(finalQuery),
    displayName: platform
  };
}

/**
 * 智能选择最佳平台
 * 对于游戏类型，使用 GAME_PLATFORMS 数组中定义的所有平台
 */
export function selectBestPlatform(
  category: string,
  suggestedPlatform?: string,
  locale: string = 'zh',
  entertainmentType?: 'video' | 'game' | 'music' | 'review'
): string {

  // 如果是娱乐分类的游戏类型，使用 GAME_PLATFORMS 数组
  if (category === 'entertainment' && entertainmentType === 'game') {
    const region = locale === 'zh' ? 'cn' : 'intl';
    const gamePlatforms = getGamePlatformsByRegion(region);
    const gamePlatformNames = gamePlatforms.map(p => p.name);

    // 如果 AI 建议的平台在游戏平台列表中，使用它
    if (suggestedPlatform && gamePlatformNames.includes(suggestedPlatform)) {
      return suggestedPlatform;
    }

    // 智能选择：根据推荐内容选择最佳游戏平台
    // 优先返回多样化的平台，而不是总是 Steam
    const platformRotation = locale === 'zh'
      ? ['TapTap']
      : ['Steam', 'Epic Games', 'GOG', 'PlayStation Store', 'Xbox Store', 'Nintendo eShop', 'Humble Bundle', 'itch.io'];

    // 如果有建议的平台，尝试匹配
    if (suggestedPlatform) {
      // 尝试模糊匹配平台名称
      const normalizedSuggestion = suggestedPlatform.toLowerCase();
      const matchedPlatform = gamePlatformNames.find(name =>
        name.toLowerCase().includes(normalizedSuggestion) ||
        normalizedSuggestion.includes(name.toLowerCase())
      );
      if (matchedPlatform) {
        return matchedPlatform;
      }
    }

    // 返回默认平台（第一个）
    return platformRotation[0];
  }

  // 针对其他娱乐类型的平台映射
  const entertainmentPlatformMap: Record<string, Record<string, string[]>> = {
    zh: {
      video: ['腾讯视频', '优酷', '爱奇艺'],
      music: ['网易云音乐', '酷狗音乐', 'QQ音乐'],
      game: ['TapTap', 'Steam'],
      review: ['笔趣阁', '豆瓣', '百度']
    },
    en: {
      video: ['YouTube', 'IMDb', 'Netflix', 'Rotten Tomatoes'],
      game: ['Steam', 'Metacritic', 'Epic Games'],
      music: ['Spotify', 'YouTube'],
      review: ['IMDb', 'Rotten Tomatoes', 'Metacritic']
    }
  };

  const categoryPlatforms: Record<string, Record<string, string[]>> = {
    zh: {
      entertainment: entertainmentPlatformMap.zh[entertainmentType || 'video'] || ['豆瓣', 'B站', '爱奇艺'],
      shopping: ['京东', '淘宝', '拼多多', '唯品会', '什么值得买', '慢慢买'],
      food: ['大众点评', '高德地图美食', '百度地图美食', '腾讯地图美食', '美团', '下厨房'],
      travel: ['携程', '去哪儿', '马蜂窝', '穷游', '小红书'],
      fitness: ['B站健身', '知乎', '什么值得买', '优酷健身', 'Keep', '大众点评', '美团', '百度地图健身', '高德地图健身', '腾讯地图健身']
    },
    en: {
      entertainment: entertainmentPlatformMap.en[entertainmentType || 'video'] || ['IMDb', 'YouTube', 'Netflix'],
      shopping: ['Amazon', 'eBay', 'Walmart', 'Google Maps'],
      food: ['Uber Eats', 'Love and Lemons', 'Google Maps', 'Yelp'],
      travel: ['Booking.com', 'TripAdvisor', 'SANParks', 'YouTube'],
      fitness: ['YouTube Fitness', 'Muscle & Strength', 'Google Maps']
    }
  };

  const availablePlatforms = categoryPlatforms[locale]?.[category] ||
    (locale === 'en' ? ['Google'] : ['百度']);

  // 如果 AI 建议的平台在可用列表中，使用它
  if (suggestedPlatform && availablePlatforms.includes(suggestedPlatform)) {
    return suggestedPlatform;
  }

  // 否则返回第一个默认平台
  return availablePlatforms[0];
}

/**
 * 为食物推荐轮换选择平台，确保推荐多样性
 * 用于英文环境 (INTL) 的食物推荐
 */
export function selectFoodPlatformWithRotation(
  index: number,
  suggestedPlatform?: string,
  locale: string = 'zh'
): string {
  // 对于中文环境，使用新的平台列表（增加大众点评、小红书美食）
  if (locale === 'zh') {
    const cnPlatforms = ['下厨房', '大众点评', '高德地图美食', '百度地图美食', '腾讯地图美食', '小红书美食'];
    if (suggestedPlatform && cnPlatforms.includes(suggestedPlatform)) {
      return suggestedPlatform;
    }
    return cnPlatforms[index % cnPlatforms.length];
  }

  // 英文环境的食物平台轮换
  const enFoodPlatforms = ['Uber Eats', 'Love and Lemons', 'Google Maps', 'Yelp'];

  // 如果 AI 建议的平台在可用列表中，使用它
  if (suggestedPlatform && enFoodPlatforms.includes(suggestedPlatform)) {
    return suggestedPlatform;
  }

  // 否则按照索引轮换，确保三个平台都会被使用
  return enFoodPlatforms[index % enFoodPlatforms.length];
}
