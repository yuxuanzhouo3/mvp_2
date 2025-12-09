/**
 * 搜索引擎链接生成器
 * 根据平台和搜索词生成真实可用的搜索链接
 */

interface SearchLink {
  url: string;
  displayName: string;
}

/**
 * 为推荐生成搜索引擎链接
 */
export function generateSearchLink(
  title: string,
  searchQuery: string,
  platform: string,
  locale: string = 'zh',
  category?: string
): SearchLink {

  // 平台映射：生成对应平台的搜索链接
  const platformSearchUrls: Record<string, Record<string, (query: string) => string>> = {
    zh: {
      // 购物平台
      '淘宝': (q) => `https://s.taobao.com/search?q=${encodeURIComponent(q)}`,
      '京东': (q) => `https://search.jd.com/Search?keyword=${encodeURIComponent(q)}`,
      '天猫': (q) => `https://list.tmall.com/search_product.htm?q=${encodeURIComponent(q)}`,
      '拼多多': (q) => `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(q)}`,

      // 娱乐平台
      '豆瓣': (q) => `https://www.douban.com/search?q=${encodeURIComponent(q)}`,
      'B站': (q) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`,
      '网易云音乐': (q) => `https://music.163.com/#/search/m/?s=${encodeURIComponent(q)}`,
      'Steam': (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`,
      '爱奇艺': (q) => `https://so.iqiyi.com/so/q_${encodeURIComponent(q)}`,
      '腾讯视频': (q) => `https://v.qq.com/x/search/?q=${encodeURIComponent(q)}`,

      // 美食平台
      '大众点评': (q) => `https://www.dianping.com/search/keyword/2/0_${encodeURIComponent(q)}`,
      '美团': (q) => `https://www.meituan.com/s/${encodeURIComponent(q)}`,
      '下厨房': (q) => `https://www.xiachufang.com/search/?keyword=${encodeURIComponent(q)}`,
      '百度美食': (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)} 美食`,

      // 旅游平台
      '携程': (q) => `https://www.ctrip.com/s/?q=${encodeURIComponent(q)}`,
      '去哪儿': (q) => `https://www.qunar.com/search?searchWord=${encodeURIComponent(q)}`,
      '马蜂窝': (q) => `https://www.mafengwo.cn/search/q.php?q=${encodeURIComponent(q)}`,
      '飞猪': (q) => `https://s.fliggy.com/?q=${encodeURIComponent(q)}`,
      '穷游': (q) => `https://www.qyer.com/search?q=${encodeURIComponent(q)}`,
      '携程旅行': (q) => `https://you.ctrip.com/sight/search/${encodeURIComponent(q)}.html`,
      '途牛': (q) => `https://www.tuniu.com/search?q=${encodeURIComponent(q)}`,
      'Booking.com': (q) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`,
      'Agoda': (q) => `https://www.agoda.com/search/${encodeURIComponent(q)}.html`,
      'Airbnb': (q) => `https://www.airbnb.com/s/${encodeURIComponent(q)}/homes`,

      // 健身平台
      'Keep': (q) => `https://www.gotokeep.com/search?keyword=${encodeURIComponent(q)}`,
      '小红书': (q) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}`,

      // 通用搜索（降级）
      '百度': (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
    },
    en: {
      // Shopping platforms
      'Amazon': (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
      'eBay': (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
      'Walmart': (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,
      'Target': (q) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,

      // Entertainment platforms
      'IMDb': (q) => `https://www.imdb.com/find?q=${encodeURIComponent(q)}`,
      'YouTube': (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      'Spotify': (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
      'Steam': (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`,
      'Netflix': (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,

      // Food platforms
      '大众点评': (q) => `https://www.dianping.com/search/keyword/1/0_${encodeURIComponent(q)}`,
      'TripAdvisor': (q) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(q)}`,
      'OpenTable': (q) => `https://www.opentable.com/search?q=${encodeURIComponent(q)}`,
      'Google Maps': (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)} restaurants`,
      'Yelp': (q) => `https://www.yelp.com/search?find_desc=${encodeURIComponent(q)}`,
      'Zomato': (q) => `https://www.zomato.com/search?q=${encodeURIComponent(q)}`,

      // Travel platforms
      'TripAdvisor Travel': (q) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(q)}`,
      'Booking.com': (q) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`,
      'Agoda': (q) => `https://www.agoda.com/search/${encodeURIComponent(q)}.html`,
      'Google Flights': (q) => `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`,
      'Expedia': (q) => `https://www.expedia.com/things-to-do/search?q=${encodeURIComponent(q)}`,
      'Airbnb': (q) => `https://www.airbnb.com/s/${encodeURIComponent(q)}/homes`,
      'Airbnb Experiences': (q) => `https://www.airbnb.com/experiences/${encodeURIComponent(q)}`,
      'Klook': (q) => `https://www.klook.com/search?keyword=${encodeURIComponent(q)}`,
      'GetYourGuide': (q) => `https://www.getyourguide.com/search?q=${encodeURIComponent(q)}`,
      'Viator': (q) => `https://www.viator.com/searchResults?text=${encodeURIComponent(q)}`,
      'Lonely Planet': (q) => `https://www.lonelyplanet.com/search?q=${encodeURIComponent(q)}`,
      'Culture Trip': (q) => `https://theculturetrip.com/search?q=${encodeURIComponent(q)}`,

      // Fitness platforms
      'YouTube Fitness': (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)} fitness`,
      'MyFitnessPal': (q) => `https://www.myfitnesspal.com/food/search?q=${encodeURIComponent(q)}`,
      'Peloton': (q) => `https://www.onepeloton.com/search?q=${encodeURIComponent(q)}`,

      // General search (fallback)
      'Google': (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
    }
  };

  // 获取平台搜索URL生成函数
  const localeUrls = platformSearchUrls[locale] || platformSearchUrls.zh;
  const getSearchUrl = localeUrls[platform] || localeUrls[locale === 'en' ? 'Google' : '百度'];

  // 优先使用 searchQuery，如果为空或太短，则使用标题
  let finalQuery = searchQuery && searchQuery.trim().length > 0 ? searchQuery.trim() : title;

  // 根据平台和分类调整搜索查询
  if (category !== 'travel') {
    // 非旅游推荐使用原有的关键词逻辑
    if (platform === 'Google Maps' || platform === 'Yelp' || platform === 'Zomato') {
      // 对于美食点评平台，添加餐厅相关关键词
      if (!finalQuery.includes('restaurant') && !finalQuery.includes('餐厅') && !finalQuery.includes('美食')) {
        finalQuery = `${finalQuery} restaurant`;
      }
    } else if (platform === '大众点评') {
      // 大众点评专注于美食和服务
      if (!finalQuery.includes('餐厅') && !finalQuery.includes('美食')) {
        finalQuery = `${finalQuery} 美食`;
      }
    } else if (platform === 'OpenTable') {
      // OpenTable 是预订平台
      finalQuery = `${finalQuery} reservation`;
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
 */
export function selectBestPlatform(
  category: string,
  suggestedPlatform?: string,
  locale: string = 'zh'
): string {

  const categoryPlatforms: Record<string, Record<string, string[]>> = {
    zh: {
      entertainment: ['豆瓣', 'B站', '爱奇艺'],
      shopping: ['京东', '淘宝', '天猫'],
      food: ['大众点评', '美团', '百度美食'],
      travel: ['Booking.com', 'Agoda', 'TripAdvisor', '携程', '马蜂窝'],
      fitness: ['Keep', 'B站', '小红书']
    },
    en: {
      entertainment: ['IMDb', 'YouTube', 'Netflix'],
      shopping: ['Amazon', 'eBay', 'Walmart'],
      food: ['大众点评', 'OpenTable', 'TripAdvisor'],
      travel: ['Booking.com', 'Agoda', 'TripAdvisor', 'Expedia', 'Klook', 'Airbnb'],
      fitness: ['YouTube Fitness', 'MyFitnessPal', 'Peloton']
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