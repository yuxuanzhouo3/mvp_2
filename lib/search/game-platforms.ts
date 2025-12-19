/**
 * 游戏平台搜索引擎配置
 * 支持 20+ 游戏平台，包括中国版和国际版
 */

export interface GamePlatformConfig {
  id: string;
  name: string;
  searchUrl: (query: string) => string;
  region: 'CN' | 'INTL' | 'BOTH';
  type: 'pc' | 'mobile' | 'console' | 'web' | 'all';
  description: string;
  priority: number; // 优先级，数字越大优先级越高
}

// 中国版游戏平台
export const cnGamePlatforms: GamePlatformConfig[] = [
  {
    id: 'steam',
    name: 'Steam',
    searchUrl: (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`,
    region: 'BOTH',
    type: 'pc',
    description: '全球最大PC游戏平台',
    priority: 10
  },
  {
    id: 'taptap',
    name: 'TapTap',
    searchUrl: (q) => `https://www.taptap.cn/search?kw=${encodeURIComponent(q)}`,
    region: 'CN',
    type: 'mobile',
    description: '国内最大手游平台',
    priority: 9
  },
  {
    id: 'epic',
    name: 'Epic游戏商城',
    searchUrl: (q) => `https://store.epicgames.com/zh-CN/browse?q=${encodeURIComponent(q)}`,
    region: 'BOTH',
    type: 'pc',
    description: '经常免费送游戏',
    priority: 8
  },
  {
    id: 'wegame',
    name: 'WeGame',
    searchUrl: (q) => `https://www.wegame.com.cn/search.html?q=${encodeURIComponent(q)}`,
    region: 'CN',
    type: 'pc',
    description: '腾讯游戏平台',
    priority: 7
  },
  {
    id: 'sonkwo',
    name: '杉果游戏',
    searchUrl: (q) => `https://www.sonkwo.cn/search/?keyword=${encodeURIComponent(q)}`,
    region: 'CN',
    type: 'pc',
    description: '国内正版游戏商城',
    priority: 6
  },
  {
    id: 'xiaoheihe',
    name: '小黑盒',
    searchUrl: (q) => `https://www.xiaoheihe.cn/search?q=${encodeURIComponent(q)}`,
    region: 'CN',
    type: 'all',
    description: 'Steam社区+资讯',
    priority: 6
  },
  {
    id: '3dm',
    name: '3DM游戏',
    searchUrl: (q) => `https://so.3dmgame.com/?keyword=${encodeURIComponent(q)}`,
    region: 'CN',
    type: 'all',
    description: '游戏资讯和攻略',
    priority: 5
  },
  {
    id: 'gamersky',
    name: '游民星空',
    searchUrl: (q) => `https://www.gamersky.com/search/?keyword=${encodeURIComponent(q)}`,
    region: 'CN',
    type: 'all',
    description: '游戏资讯和下载',
    priority: 5
  },
  {
    id: 'bilibili_game',
    name: 'B站游戏',
    searchUrl: (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)} 游戏`,
    region: 'CN',
    type: 'all',
    description: 'B站游戏专区',
    priority: 6
  },
  {
    id: '4399',
    name: '4399小游戏',
    searchUrl: (q) => `https://s.4399.com/search_default.php?keyword=${encodeURIComponent(q)}`,
    region: 'CN',
    type: 'web',
    description: '网页小游戏',
    priority: 3
  }
];

// 国际版游戏平台
export const intlGamePlatforms: GamePlatformConfig[] = [
  {
    id: 'steam',
    name: 'Steam',
    searchUrl: (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`,
    region: 'BOTH',
    type: 'pc',
    description: 'The largest PC gaming platform',
    priority: 10
  },
  {
    id: 'epic',
    name: 'Epic Games',
    searchUrl: (q) => `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(q)}`,
    region: 'BOTH',
    type: 'pc',
    description: 'Free games and exclusives',
    priority: 9
  },
  {
    id: 'playstation',
    name: 'PlayStation Store',
    searchUrl: (q) => `https://store.playstation.com/en-us/search/${encodeURIComponent(q)}`,
    region: 'INTL',
    type: 'console',
    description: 'Sony official store',
    priority: 8
  },
  {
    id: 'xbox',
    name: 'Xbox Store',
    searchUrl: (q) => `https://www.xbox.com/en-US/search?q=${encodeURIComponent(q)}`,
    region: 'INTL',
    type: 'console',
    description: 'Microsoft official store',
    priority: 8
  },
  {
    id: 'nintendo',
    name: 'Nintendo eShop',
    searchUrl: (q) => `https://www.nintendo.com/search?q=${encodeURIComponent(q)}&filter=cqf3hd31gd84sb462g4s007su9`,
    region: 'INTL',
    type: 'console',
    description: 'Nintendo official store',
    priority: 8
  },
  {
    id: 'gog',
    name: 'GOG',
    searchUrl: (q) => `https://www.gog.com/games?query=${encodeURIComponent(q)}`,
    region: 'INTL',
    type: 'pc',
    description: 'DRM-free games',
    priority: 7
  },
  {
    id: 'humble',
    name: 'Humble Bundle',
    searchUrl: (q) => `https://www.humblebundle.com/store/search?q=${encodeURIComponent(q)}`,
    region: 'INTL',
    type: 'pc',
    description: 'Charity game bundles',
    priority: 6
  },
  {
    id: 'itch',
    name: 'itch.io',
    searchUrl: (q) => `https://itch.io/search?q=${encodeURIComponent(q)}`,
    region: 'INTL',
    type: 'all',
    description: 'Indie game platform',
    priority: 6
  },
  {
    id: 'gamepass',
    name: 'Game Pass',
    searchUrl: (q) => `https://www.xbox.com/en-US/games/search?q=${encodeURIComponent(q)}&store=xbox-one`,
    region: 'INTL',
    type: 'all',
    description: 'Xbox subscription service',
    priority: 7
  },
  {
    id: 'gmg',
    name: 'Green Man Gaming',
    searchUrl: (q) => `https://www.greenmangaming.com/search?q=${encodeURIComponent(q)}`,
    region: 'INTL',
    type: 'pc',
    description: 'Game key store',
    priority: 5
  }
];

/**
 * 根据关键词智能选择游戏平台
 */
export function selectGamePlatform(
  keywords: string,
  region: 'CN' | 'INTL'
): GamePlatformConfig {
  const platforms = region === 'CN' ? cnGamePlatforms : intlGamePlatforms;
  const keywordsLower = keywords.toLowerCase();

  // 关键词匹配规则
  const rules: Array<{ pattern: RegExp; platformId: string }> = [
    // PC 游戏
    { pattern: /pc|电脑|steam/i, platformId: 'steam' },
    { pattern: /免费|f2p|epic/i, platformId: 'epic' },
    
    // 主机游戏
    { pattern: /ps5|ps4|playstation|索尼/i, platformId: 'playstation' },
    { pattern: /xbox|微软/i, platformId: 'xbox' },
    { pattern: /switch|任天堂|ns|nintendo/i, platformId: 'nintendo' },
    
    // 手机游戏
    { pattern: /手游|手机|mobile|android|ios/i, platformId: region === 'CN' ? 'taptap' : 'itch' },
    
    // 独立游戏
    { pattern: /独立|indie/i, platformId: region === 'CN' ? 'sonkwo' : 'itch' },
    
    // 小游戏
    { pattern: /小游戏|休闲|网页/i, platformId: region === 'CN' ? '4399' : 'itch' },
    
    // 腾讯游戏
    { pattern: /腾讯|qq|wegame/i, platformId: 'wegame' },
    
    // DRM-Free
    { pattern: /drm.?free|gog/i, platformId: 'gog' },
    
    // 订阅服务
    { pattern: /game.?pass|订阅/i, platformId: 'gamepass' },
  ];

  // 匹配规则
  for (const rule of rules) {
    if (rule.pattern.test(keywordsLower)) {
      const platform = platforms.find(p => p.id === rule.platformId);
      if (platform) return platform;
    }
  }

  // 默认返回 Steam（优先级最高）
  return platforms.find(p => p.id === 'steam') || platforms[0];
}

/**
 * 获取所有可用游戏平台
 */
export function getAvailableGamePlatforms(region: 'CN' | 'INTL'): GamePlatformConfig[] {
  const platforms = region === 'CN' ? cnGamePlatforms : intlGamePlatforms;
  return platforms.sort((a, b) => b.priority - a.priority);
}

/**
 * 根据游戏类型获取推荐平台列表
 */
export function getGamePlatformsByType(
  gameType: 'pc' | 'mobile' | 'console' | 'indie' | 'web',
  region: 'CN' | 'INTL'
): GamePlatformConfig[] {
  const platforms = region === 'CN' ? cnGamePlatforms : intlGamePlatforms;
  
  const typeMapping: Record<string, string[]> = {
    pc: ['steam', 'epic', 'gog', 'wegame', 'sonkwo', 'gmg'],
    mobile: ['taptap', 'itch', 'bilibili_game'],
    console: ['playstation', 'xbox', 'nintendo'],
    indie: ['itch', 'gog', 'humble', 'sonkwo'],
    web: ['4399', 'itch']
  };

  const targetIds = typeMapping[gameType] || typeMapping.pc;
  
  return platforms
    .filter(p => targetIds.includes(p.id) || p.type === gameType || p.type === 'all')
    .sort((a, b) => b.priority - a.priority);
}

/**
 * 生成游戏搜索链接
 */
export function generateGameSearchLink(
  gameName: string,
  region: 'CN' | 'INTL',
  preferredPlatform?: string
): { url: string; platform: string; platformId: string } {
  const platforms = region === 'CN' ? cnGamePlatforms : intlGamePlatforms;
  
  // 如果指定了平台，尝试使用
  if (preferredPlatform) {
    const platform = platforms.find(
      p => p.name.toLowerCase() === preferredPlatform.toLowerCase() ||
           p.id === preferredPlatform.toLowerCase()
    );
    if (platform) {
      return {
        url: platform.searchUrl(gameName),
        platform: platform.name,
        platformId: platform.id
      };
    }
  }

  // 智能选择平台
  const selectedPlatform = selectGamePlatform(gameName, region);
  
  return {
    url: selectedPlatform.searchUrl(gameName),
    platform: selectedPlatform.name,
    platformId: selectedPlatform.id
  };
}

/**
 * 获取平台多样化推荐（避免总是推荐同一平台）
 */
export function getDiversePlatformRecommendations(
  count: number = 3,
  region: 'CN' | 'INTL',
  excludePlatforms: string[] = []
): GamePlatformConfig[] {
  const platforms = getAvailableGamePlatforms(region)
    .filter(p => !excludePlatforms.includes(p.id));
  
  // 从不同类型中选择
  const result: GamePlatformConfig[] = [];
  const types = ['pc', 'mobile', 'console', 'all'];
  
  for (const type of types) {
    if (result.length >= count) break;
    
    const platformOfType = platforms.find(
      p => p.type === type && !result.some(r => r.id === p.id)
    );
    
    if (platformOfType) {
      result.push(platformOfType);
    }
  }

  // 如果还不够，从剩余平台中补充
  for (const platform of platforms) {
    if (result.length >= count) break;
    if (!result.some(r => r.id === platform.id)) {
      result.push(platform);
    }
  }

  return result;
}

