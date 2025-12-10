/**
 * 娱乐推荐多样性检查器
 * 确保推荐的娱乐内容涵盖多种类型
 */

import type { RecommendationItem } from './zhipu-recommendation';

export type EntertainmentType = 'video' | 'game' | 'music' | 'review';

/**
 * 分析推荐中的娱乐类型分布
 */
export function analyzeEntertainmentDiversity(recommendations: RecommendationItem[]): {
  types: Set<EntertainmentType>;
  distribution: Record<EntertainmentType, number>;
  isDiverse: boolean;
  missingTypes: EntertainmentType[];
} {
  const types = new Set<EntertainmentType>();
  const distribution: Record<EntertainmentType, number> = {
    video: 0,
    game: 0,
    music: 0,
    review: 0
  };

  recommendations.forEach(rec => {
    // 根据平台和标题推断类型
    const inferredType = inferEntertainmentType(rec);
    if (inferredType) {
      types.add(inferredType);
      distribution[inferredType]++;
    }
  });

  const isDiverse = types.size >= 3; // 至少涵盖3种类型
  const allTypes: EntertainmentType[] = ['video', 'game', 'music', 'review'];
  const missingTypes = allTypes.filter(type => !types.has(type));

  return {
    types,
    distribution,
    isDiverse,
    missingTypes
  };
}

/**
 * 根据推荐内容推断娱乐类型
 */
export function inferEntertainmentType(rec: RecommendationItem): EntertainmentType | null {
  const { title, description, tags, platform, searchQuery } = rec;
  const allText = `${title} ${description} ${tags.join(' ')} ${searchQuery}`.toLowerCase();

  // 视频类关键词
  const videoKeywords = [
    '电影', '电视剧', '综艺', '动漫', '纪录片', '剧集', '观看', '在线看',
    'movie', 'tv', 'show', 'series', 'anime', 'documentary', 'watch', 'stream',
    'season', 'episode', 'film'
  ];

  // 游戏类关键词
  const gameKeywords = [
    '游戏', 'steam', '下载', '游玩', 'rpg', 'fps', 'moba', '策略', '冒险',
    'game', 'play', 'download', 'gaming', 'pc', 'console', 'mobile', 'rpg'
  ];

  // 音乐类关键词
  const musicKeywords = [
    '音乐', '歌曲', '专辑', '演唱会', '音乐节', '单曲', 'mv', '歌手', '乐队',
    'music', 'song', 'album', 'concert', 'single', 'track', 'artist', 'band'
  ];

  // 影评/资讯类关键词
  const reviewKeywords = [
    '影评', '解析', '评测', '盘点', '排行榜', '评论', '分析', '资讯', '新闻',
    'review', 'analysis', 'critique', 'ranking', 'list', 'news', 'commentary'
  ];

  // 基于平台的判断
  const videoPlatforms = ['豆瓣', 'IMDb', 'B站', 'YouTube', '爱奇艺', '腾讯视频', 'Netflix', 'Hulu'];
  const gamePlatforms = ['Steam', 'Epic Games', 'Nintendo', 'PlayStation', 'Xbox', 'Twitch'];
  const musicPlatforms = ['网易云音乐', 'QQ音乐', 'Spotify', 'Apple Music', 'SoundCloud'];
  const reviewPlatforms = ['豆瓣', 'IMDb', 'Rotten Tomatoes', 'Metacritic', '知乎', 'Reddit'];

  // 计算匹配分数
  const scores = {
    video: 0,
    game: 0,
    music: 0,
    review: 0
  };

  // 关键词匹配
  videoKeywords.forEach(kw => {
    if (allText.includes(kw)) scores.video++;
  });
  gameKeywords.forEach(kw => {
    if (allText.includes(kw)) scores.game++;
  });
  musicKeywords.forEach(kw => {
    if (allText.includes(kw)) scores.music++;
  });
  reviewKeywords.forEach(kw => {
    if (allText.includes(kw)) scores.review++;
  });

  // 平台匹配
  if (videoPlatforms.some(p => platform.includes(p))) scores.video += 2;
  if (gamePlatforms.some(p => platform.includes(p))) scores.game += 2;
  if (musicPlatforms.some(p => platform.includes(p))) scores.music += 2;
  if (reviewPlatforms.some(p => platform.includes(p))) scores.review += 2;

  // 找出得分最高的类型
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return null;

  const topTypes = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([type]) => type as EntertainmentType);

  // 如果有平局，优先级：video > game > music > review
  if (topTypes.includes('video')) return 'video';
  if (topTypes.includes('game')) return 'game';
  if (topTypes.includes('music')) return 'music';
  if (topTypes.includes('review')) return 'review';

  return topTypes[0];
}

/**
 * 生成多样化的娱乐推荐
 * 如果当前推荐不够多样，返回需要补充的类型
 */
export function generateDiverseRecommendations(
  recommendations: RecommendationItem[],
  requiredCount: number = 3
): {
  recommendations: RecommendationItem[];
  needsMore: boolean;
  suggestedTypes: EntertainmentType[];
} {
  const analysis = analyzeEntertainmentDiversity(recommendations);

  // 如果已经足够多样，直接返回
  if (analysis.isDiverse && recommendations.length >= requiredCount) {
    return {
      recommendations,
      needsMore: false,
      suggestedTypes: []
    };
  }

  // 确定需要补充的类型
  let suggestedTypes: EntertainmentType[] = [];

  if (recommendations.length < requiredCount) {
    // 需要更多推荐
    const allTypes: EntertainmentType[] = ['video', 'game', 'music', 'review'];
    suggestedTypes = allTypes.filter(type => !analysis.types.has(type));

    // 如果已有类型覆盖了大多数，优先选择缺失的类型
    if (suggestedTypes.length === 0) {
      // 选择数量最少的类型进行补充
      const sortedTypes = Object.entries(analysis.distribution)
        .sort(([, a], [, b]) => a - b)
        .map(([type]) => type as EntertainmentType);
      suggestedTypes = sortedTypes.slice(0, requiredCount - recommendations.length);
    }
  }

  return {
    recommendations,
    needsMore: true,
    suggestedTypes
  };
}

/**
 * 为推荐补充缺失的娱乐类型
 */
export async function supplementEntertainmentTypes(
  recommendations: RecommendationItem[],
  missingTypes: EntertainmentType[],
  userHistory: any[],
  locale: string = 'zh'
): Promise<RecommendationItem[]> {
  // 这里可以调用AI生成特定类型的推荐
  // 暂时返回空，实际实现需要与zhipu-recommendation集成
  const supplements: RecommendationItem[] = [];

  for (const type of missingTypes) {
    // 生成该类型的示例推荐
    const supplement = await generateTypeSpecificRecommendation(type, userHistory, locale);
    if (supplement) {
      supplements.push(supplement);
    }
  }

  return [...recommendations, ...supplements];
}

/**
 * 生成特定类型的推荐
 */
async function generateTypeSpecificRecommendation(
  type: EntertainmentType,
  userHistory: any[],
  locale: string = 'zh'
): Promise<RecommendationItem | null> {
  // 示例实现，实际应该调用AI生成
  const examples: Record<string, Record<EntertainmentType, RecommendationItem>> = {
    zh: {
      video: {
        title: '流浪地球2',
        description: '中国科幻巨制，展现人类文明危机',
        reason: '基于您对科幻题材的偏好',
        tags: ['科幻', '电影', '冒险'],
        searchQuery: '流浪地球2 豆瓣评分',
        platform: '豆瓣'
      },
      game: {
        title: '原神',
        description: '开放世界冒险RPG游戏',
        reason: '精美的画风和丰富的游戏内容',
        tags: ['RPG', '开放世界', '冒险'],
        searchQuery: '原神 下载 官方',
        platform: '官网'
      },
      music: {
        title: '周杰伦最新专辑',
        description: '华语流行音乐天王的最新作品',
        reason: '融合多种音乐风格的创新之作',
        tags: ['流行', '华语', '专辑'],
        searchQuery: '周杰伦 新专辑 2024',
        platform: '网易云音乐'
      },
      review: {
        title: '2024年电影排行榜盘点',
        description: '年度最佳电影深度解析',
        reason: '了解最新的电影动态和评价',
        tags: ['影评', '盘点', '电影'],
        searchQuery: '2024年电影排行榜 豆瓣',
        platform: '豆瓣'
      }
    },
    en: {
      video: {
        title: 'Oppenheimer',
        description: 'Christopher Nolan\'s biographical thriller',
        reason: 'Based on your interest in historical dramas',
        tags: ['biography', 'thriller', 'history'],
        searchQuery: 'Oppenheimer 2023 review IMDb',
        platform: 'IMDb'
      },
      game: {
        title: 'Baldur\'s Gate 3',
        description: 'Epic RPG adventure set in the Dungeons & Dragons universe',
        reason: 'Critically acclaimed with deep storytelling',
        tags: ['RPG', 'adventure', 'fantasy'],
        searchQuery: 'Baldur\'s Gate 3 Steam',
        platform: 'Steam'
      },
      music: {
        title: 'Taylor Swift - The Tortured Poets Department',
        description: 'Latest album from the pop superstar',
        reason: 'Personal and introspective songwriting',
        tags: ['pop', 'album', '2024'],
        searchQuery: 'Taylor Swift new album Spotify',
        platform: 'Spotify'
      },
      review: {
        title: 'Best TV Shows of 2024',
        description: 'Comprehensive review of the year\'s top television series',
        reason: 'Stay updated with quality entertainment',
        tags: ['TV', 'review', 'ranking'],
        searchQuery: 'best TV shows 2024 Rotten Tomatoes',
        platform: 'Rotten Tomatoes'
      }
    }
  };

  return examples[locale]?.[type] || examples.zh[type];
}