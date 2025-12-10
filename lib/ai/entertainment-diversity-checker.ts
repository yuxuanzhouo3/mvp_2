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
  const supplements: RecommendationItem[] = [];

  for (const type of missingTypes) {
    // 生成该类型的特定推荐
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
  try {
    // 生成特定类型的推荐
    const prompt = locale === 'zh' ? `
你是一个专业的推荐系统分析师。

任务：为用户生成 1 个 ${getTypeLabel(type, 'zh')} 类型的推荐。

用户历史记录：
${JSON.stringify(userHistory.slice(0, 10), null, 2)}

要求类型：${type} (${getTypeLabel(type, 'zh')})

具体要求：
- 必须生成 ${getTypeLabel(type, 'zh')} 类型的内容
- 推荐内容必须是真实存在的作品或内容
- 标题要具体，不能模糊
- 搜索关键词要精确匹配作品名称

${getTypeSpecificRequirements(type, 'zh')}

返回 JSON 格式（严格遵守，不要有任何额外文字）：
{
  "title": "具体推荐名称",
  "description": "简短描述",
  "reason": "为什么推荐给这个用户",
  "tags": ["标签1", "标签2", "标签3"],
  "searchQuery": "用于搜索的关键词",
  "platform": "平台名称",
  "entertainmentType": "${type}"
}` : `
You are a professional recommendation system analyst.

Task: Generate 1 ${type} type recommendation for the user.

User history:
${JSON.stringify(userHistory.slice(0, 10), null, 2)}

Required type: ${type} (${getTypeLabel(type, 'en')})

Requirements:
- Must generate ${getTypeLabel(type, 'en')} type content
- Recommended content must be real existing works
- Title should be specific, not vague
- Search keywords must precisely match work titles

${getTypeSpecificRequirements(type, 'en')}

Return JSON format (strictly, no extra text):
{
  "title": "Specific recommendation name",
  "description": "Brief description",
  "reason": "Why recommend to this user",
  "tags": ["tag1", "tag2", "tag3"],
  "searchQuery": "Search keywords",
  "platform": "Platform name",
  "entertainmentType": "${type}"
}`;

    // 使用 generateRecommendations 函数，但我们需要一个更直接的方法
    // 让我们直接调用智谱 AI
    const { ZhipuAI } = await import('zhipuai');
    const client = new ZhipuAI({
      apiKey: process.env.ZHIPU_API_KEY
    });

    const response = await client.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content: locale === 'zh'
            ? '你是推荐分析师。只返回 JSON 对象，不要生成链接，不要有markdown标记。'
            : 'You are a recommendation analyst. Only return JSON object, no links, no markdown.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      top_p: 0.9
    });

    const content = response.choices[0].message.content || '';
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const result = JSON.parse(cleanContent);

    // 确保返回的是单个推荐对象
    if (Array.isArray(result)) {
      return result[0] || null;
    }

    return result;

  } catch (error) {
    console.error(`Failed to generate ${type} recommendation:`, error);

    // 如果AI调用失败，返回示例数据
    const examples: Record<string, Record<EntertainmentType, RecommendationItem>> = {
      zh: {
        video: {
          title: '流浪地球2',
          description: '中国科幻巨制，展现人类文明危机',
          reason: '基于您对科幻题材的偏好',
          tags: ['科幻', '电影', '冒险'],
          searchQuery: '流浪地球2 豆瓣评分',
          platform: '豆瓣',
          entertainmentType: 'video'
        },
        game: {
          title: '原神',
          description: '开放世界冒险RPG游戏',
          reason: '精美的画风和丰富的游戏内容',
          tags: ['RPG', '开放世界', '冒险'],
          searchQuery: '原神 下载 官方',
          platform: '官网',
          entertainmentType: 'game'
        },
        music: {
          title: '周杰伦最新专辑',
          description: '华语流行音乐天王的最新作品',
          reason: '融合多种音乐风格的创新之作',
          tags: ['流行', '华语', '专辑'],
          searchQuery: '周杰伦 新专辑 2024',
          platform: '网易云音乐',
          entertainmentType: 'music'
        },
        review: {
          title: '2024年电影排行榜盘点',
          description: '年度最佳电影深度解析',
          reason: '了解最新的电影动态和评价',
          tags: ['影评', '盘点', '电影'],
          searchQuery: '2024年电影排行榜 豆瓣',
          platform: '豆瓣',
          entertainmentType: 'review'
        }
      },
      en: {
        video: {
          title: 'Oppenheimer',
          description: 'Christopher Nolan\'s biographical thriller',
          reason: 'Based on your interest in historical dramas',
          tags: ['biography', 'thriller', 'history'],
          searchQuery: 'Oppenheimer 2023 review IMDb',
          platform: 'IMDb',
          entertainmentType: 'video'
        },
        game: {
          title: 'Baldur\'s Gate 3',
          description: 'Epic RPG adventure set in the Dungeons & Dragons universe',
          reason: 'Critically acclaimed with deep storytelling',
          tags: ['RPG', 'adventure', 'fantasy'],
          searchQuery: 'Baldur\'s Gate 3 Steam',
          platform: 'Steam',
          entertainmentType: 'game'
        },
        music: {
          title: 'Taylor Swift - The Tortured Poets Department',
          description: 'Latest album from the pop superstar',
          reason: 'Personal and introspective songwriting',
          tags: ['pop', 'album', '2024'],
          searchQuery: 'Taylor Swift new album Spotify',
          platform: 'Spotify',
          entertainmentType: 'music'
        },
        review: {
          title: 'Best TV Shows of 2024',
          description: 'Comprehensive review of the year\'s top television series',
          reason: 'Stay updated with quality entertainment',
          tags: ['TV', 'review', 'ranking'],
          searchQuery: 'best TV shows 2024 Rotten Tomatoes',
          platform: 'Rotten Tomatoes',
          entertainmentType: 'review'
        }
      }
    };

    return examples[locale]?.[type] || examples.zh[type];
  }
}

/**
 * 获取娱乐类型的标签
 */
function getTypeLabel(type: EntertainmentType, locale: 'zh' | 'en'): string {
  const labels: Record<EntertainmentType, Record<'zh' | 'en', string>> = {
    video: {
      zh: '视频',
      en: 'video'
    },
    game: {
      zh: '游戏',
      en: 'game'
    },
    music: {
      zh: '音乐',
      en: 'music'
    },
    review: {
      zh: '影评/资讯',
      en: 'review/news'
    }
  };

  return labels[type][locale];
}

/**
 * 获取特定类型的要求
 */
function getTypeSpecificRequirements(type: EntertainmentType, locale: 'zh' | 'en'): string {
  const requirements: Record<EntertainmentType, Record<'zh' | 'en', string>> = {
    video: {
      zh: `
视频类要求：
- 可以推荐电影、电视剧、综艺、动漫、纪录片等
- 示例：电影《满江红》、电视剧《狂飙》、综艺《向往的生活》
- 搜索词格式："作品名称 平台"（如："满江红 豆瓣评分"）`,
      en: `
Video requirements:
- Can recommend movies, TV shows, variety shows, anime, documentaries
- Examples: "Inception", "Breaking Bad", "The Tonight Show"
- Search format: "Title platform" (e.g., "Inception IMDb rating")`
    },
    game: {
      zh: `
游戏类要求：
- 可以推荐PC游戏、手机游戏、主机游戏等
- 示例：《艾尔登法环》、《原神》、《塞尔达传说》
- 搜索词格式："游戏名 下载/购买 平台"（如："艾尔登法环 Steam"）`,
      en: `
Game requirements:
- Can recommend PC games, mobile games, console games
- Examples: "Elden Ring", "Genshin Impact", "The Legend of Zelda"
- Search format: "Game name download platform" (e.g., "Elden Ring Steam")`
    },
    music: {
      zh: `
音乐类要求：
- 可以推荐歌曲、专辑、演唱会等
- 示例：周杰伦新专辑、林俊杰演唱会、泰勒·斯威夫特单曲
- 搜索词格式："歌手/作品名 平台"（如："周杰伦 新专辑 网易云音乐"）`,
      en: `
Music requirements:
- Can recommend songs, albums, concerts
- Examples: "Taylor Swift new album", "Ed Sheeran concert", "Billie Eilish single"
- Search format: "Artist/work platform" (e.g., "Taylor Swift new album Spotify")`
    },
    review: {
      zh: `
影评/资讯类要求：
- 可以推荐影评、娱乐新闻、明星资讯、作品盘点等
- 示例：奥本海默影评、2024年电影盘点、娱乐圈新闻
- 搜索词格式："关键词 盘点/影评"（如："2024年电影排行榜 豆瓣"）`,
      en: `
Review/News requirements:
- Can recommend movie reviews, entertainment news, celebrity updates, rankings
- Examples: "Oscars 2024 predictions", "Best movies of the year", "Celebrity news"
- Search format: "Keyword review/ranking" (e.g., "best movies 2024 Rotten Tomatoes")`
    }
  };

  return requirements[type][locale];
}