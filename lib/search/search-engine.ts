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
  category?: string,
  entertainmentType?: 'video' | 'game' | 'music' | 'review'
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
      '百度地图': (q) => `https://map.baidu.com/s?wd=${encodeURIComponent(q)} 健身房`,
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

      // Entertainment platforms
      'IMDb': (q) => `https://www.imdb.com/find?q=${encodeURIComponent(q)}`,
      'YouTube': (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
      'Spotify': (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
      'Steam': (q) => `https://store.steampowered.com/search/?term=${encodeURIComponent(q)}`,
      'Netflix': (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,

      // Food platforms
      '大众点评': (q) => `https://www.dianping.com/search/keyword/1/0_${encodeURIComponent(q)}`,
      'TripAdvisor': (q) => `https://www.tripadvisor.com/search?q=${encodeURIComponent(q)} restaurants`,
      'OpenTable': (q) => `https://www.opentable.com/search?q=${encodeURIComponent(q)}`,
      'Google Maps': (q) => `https://www.google.com/maps/search/${encodeURIComponent(q)}+restaurants+near+me`,
      'Zomato': (q) => `https://www.zomato.com/search?q=${encodeURIComponent(q)}`,
      'Allrecipes': (q) => `https://www.allrecipes.com/search?q=${encodeURIComponent(q)}`,

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
      'FitnessVolt': (q) => `https://fitnessvolt.com/?s=${encodeURIComponent(q)}`,
      'GarageGymReviews': (q) => `https://www.garagegymreviews.com/?s=${encodeURIComponent(q)}`,
      'Muscle & Strength': (q) => `https://www.muscleandstrength.com/?s=${encodeURIComponent(q)}`,
      'Best Buy': (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`,

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
        // 视频类：添加平台相关关键词
        if (platform === '豆瓣' && !finalQuery.includes('豆瓣评分')) {
          finalQuery = `${finalQuery} 豆瓣评分`;
        } else if (platform === 'B站' && !finalQuery.includes('观看') && !finalQuery.includes('全集')) {
          finalQuery = `${finalQuery} 观看 全集`;
        } else if ((platform === '爱奇艺' || platform === '腾讯视频' || platform === '优酷') && !finalQuery.includes('在线观看')) {
          finalQuery = `${finalQuery} 在线观看`;
        } else if (platform === 'Netflix' && !finalQuery.includes('Netflix')) {
          finalQuery = `${finalQuery} Netflix`;
        }
        break;

      case 'game':
        // 游戏类：确保搜索到游戏下载/购买页面
        if (platform === 'Steam' && !finalQuery.includes('Steam')) {
          finalQuery = `${finalQuery} Steam`;
        } else if ((platform === '淘宝' || platform === '京东') && !finalQuery.includes('购买') && !finalQuery.includes('下载')) {
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
        if (!finalQuery.includes('影评') && !finalQuery.includes('解析') && !finalQuery.includes('评测')) {
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
        if (!finalQuery.includes('餐厅') && !finalQuery.includes('美食')) {
          finalQuery = `${finalQuery} 美食`;
        }
      }
      // 健身相关已改用 GarageGymReviews 和 FitnessVolt
    } else if (platform === 'Allrecipes') {
      // Allrecipes 专注于食谱搜索
      if (category === 'food') {
        // Allrecipes 搜索优化：保持菜名简洁，不添加额外关键词
        // 让用户看到纯净的食谱搜索结果
      }
    } else if (platform === 'OpenTable') {
      // OpenTable 专注于餐厅预订
      if (category === 'food') {
        // OpenTable 搜索优化：确保包含预订相关信息
        if (!finalQuery.includes('reservation') && !finalQuery.includes('booking') && !finalQuery.includes('table')) {
          finalQuery = `${finalQuery} reservation`;
        }
      }
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
 */
export function selectBestPlatform(
  category: string,
  suggestedPlatform?: string,
  locale: string = 'zh',
  entertainmentType?: 'video' | 'game' | 'music' | 'review'
): string {

  // 针对娱乐类型的详细平台映射
  const entertainmentPlatformMap: Record<string, Record<string, string[]>> = {
    zh: {
      video: ['豆瓣', 'B站', '爱奇艺', '腾讯视频', '优酷'],
      game: ['Steam', 'B站', '淘宝', '京东'],
      music: ['网易云音乐', 'B站', '豆瓣'],
      review: ['豆瓣', 'B站']
    },
    en: {
      video: ['IMDb', 'YouTube', 'Netflix', 'Rotten Tomatoes'],
      game: ['Steam', 'YouTube', 'Twitch', 'IGN'],
      music: ['Spotify', 'YouTube', 'IMDb'],
      review: ['IMDb', 'Rotten Tomatoes', 'YouTube']
    }
  };

  const categoryPlatforms: Record<string, Record<string, string[]>> = {
    zh: {
      entertainment: entertainmentPlatformMap.zh[entertainmentType || 'video'] || ['豆瓣', 'B站', '爱奇艺'],
      shopping: ['京东', '淘宝', '天猫'],
      food: ['大众点评', '美团', '百度美食'],
      travel: ['Booking.com', 'Agoda', 'TripAdvisor', '携程', '马蜂窝'],
      fitness: ['YouTube', 'GarageGymReviews', 'FitnessVolt']
    },
    en: {
      entertainment: entertainmentPlatformMap.en[entertainmentType || 'video'] || ['IMDb', 'YouTube', 'Netflix'],
      shopping: ['Amazon', 'eBay', 'Walmart'],
      food: ['Allrecipes', 'Google Maps', 'OpenTable'],
      travel: ['Booking.com', 'Agoda', 'TripAdvisor', 'Expedia', 'Klook', 'Airbnb'],
      fitness: ['YouTube', 'GarageGymReviews', 'FitnessVolt']
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
  // 对于中文环境，保持原有逻辑
  if (locale === 'zh') {
    const cnPlatforms = ['大众点评', '美团', '百度美食'];
    if (suggestedPlatform && cnPlatforms.includes(suggestedPlatform)) {
      return suggestedPlatform;
    }
    return cnPlatforms[index % cnPlatforms.length];
  }

  // 英文环境的食物平台轮换
  const enFoodPlatforms = ['Allrecipes', 'Google Maps', 'OpenTable'];

  // 如果 AI 建议的平台在可用列表中，使用它
  if (suggestedPlatform && enFoodPlatforms.includes(suggestedPlatform)) {
    return suggestedPlatform;
  }

  // 否则按照索引轮换，确保三个平台都会被使用
  return enFoodPlatforms[index % enFoodPlatforms.length];
}