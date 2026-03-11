/**
 * 娱乐推荐多样性检查器
 * 确保推荐的娱乐内容涵盖多种类型
 */

import { callRecommendationAI, type AIMessage, type RecommendationItem } from './zhipu-recommendation';

export type EntertainmentType = 'video' | 'game' | 'music' | 'review';

const SUPPLEMENT_HISTORY_BUDGET_BYTES = 1600;
const SUPPLEMENT_PROMPT_BUDGET_BYTES = 6 * 1024;

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (!value || maxBytes <= 0) {
    return '';
  }

  if (getUtf8ByteLength(value) <= maxBytes) {
    return value;
  }

  let result = value;
  while (result.length > 0 && getUtf8ByteLength(result) > maxBytes) {
    result = result.slice(0, Math.max(1, Math.floor(result.length * 0.8)));
  }

  return result;
}

function shrinkPromptWhitespace(value: string): string {
  return value
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function stringifyWithinBudget(value: unknown, maxBytes: number): string {
  const serialized = JSON.stringify(value, null, 2);
  if (getUtf8ByteLength(serialized) <= maxBytes) {
    return serialized;
  }

  return truncateUtf8(serialized, maxBytes);
}

function compactSupplementHistory(userHistory: any[]): Array<Record<string, unknown>> {
  return (Array.isArray(userHistory) ? userHistory : [])
    .slice(0, 6)
    .map((item) => {
      const metadata = item && typeof item.metadata === 'object' && item.metadata
        ? {
            tags: Array.isArray(item.metadata.tags)
              ? item.metadata.tags
                  .filter((tag: unknown): tag is string => typeof tag === 'string' && tag.trim().length > 0)
                  .slice(0, 3)
                  .map((tag: string) => truncateUtf8(tag, 24))
              : undefined,
            searchQuery:
              typeof item.metadata.searchQuery === 'string' && item.metadata.searchQuery.trim().length > 0
                ? truncateUtf8(item.metadata.searchQuery, 60)
                : undefined,
            platform:
              typeof item.metadata.platform === 'string' && item.metadata.platform.trim().length > 0
                ? truncateUtf8(item.metadata.platform, 24)
                : undefined,
            entertainmentType:
              typeof item.metadata.entertainmentType === 'string' && item.metadata.entertainmentType.trim().length > 0
                ? item.metadata.entertainmentType
                : undefined,
          }
        : undefined;

      return {
        category: typeof item?.category === 'string' ? item.category : undefined,
        title: truncateUtf8(String(item?.title || ''), 80),
        clicked: Boolean(item?.clicked),
        saved: Boolean(item?.saved),
        metadata,
      };
    })
    .filter((item) => typeof item.title === 'string' && item.title.trim().length > 0);
}

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

  const isDiverse = types.size >= 3; // 至少覆盖 3 种类型
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
  const tagsText = Array.isArray(tags) ? tags.join(' ') : '';
  const allText = `${title} ${description} ${tagsText} ${searchQuery}`.toLowerCase();

  // 视频类关键词
  const videoKeywords = [
    '电影', '电视剧', '综艺', '动漫', '纪录片', '剧集', '观看', '在线播放',
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
    '小说', '网文', '连载', '章节', '完结', '书名', '作者', '书单',
    'review', 'analysis', 'critique', 'ranking', 'list', 'news', 'commentary'
  ];

  // 基于平台的判断
  const videoPlatforms = ['豆瓣', 'IMDb', 'B站', 'YouTube', '爱奇艺', '腾讯视频', 'Netflix', 'Hulu'];
  const gamePlatforms = ['Steam', 'Epic Games', 'Nintendo', 'PlayStation', 'Xbox', 'Twitch'];
  const musicPlatforms = ['网易云音乐', 'QQ音乐', 'Spotify', 'Apple Music', 'SoundCloud'];
  const reviewPlatforms = ['笔趣阁', '豆瓣', 'IMDb', 'Rotten Tomatoes', 'Metacritic', '知乎', 'Reddit'];

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
  const safePlatform = platform || '';
  if (safePlatform && videoPlatforms.some(p => safePlatform.includes(p))) scores.video += 2;
  if (safePlatform && gamePlatforms.some(p => safePlatform.includes(p))) scores.game += 2;
  if (safePlatform && musicPlatforms.some(p => safePlatform.includes(p))) scores.music += 2;
  if (safePlatform && reviewPlatforms.some(p => safePlatform.includes(p))) scores.review += 2;

  // 找出得分最高的类型
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return null;

  const topTypes = Object.entries(scores)
    .filter(([, score]) => score === maxScore)
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

  return supplements;
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
    const compactHistory = compactSupplementHistory(userHistory);
    const historyPayload = stringifyWithinBudget(compactHistory, SUPPLEMENT_HISTORY_BUDGET_BYTES);

    console.log('[AI][EntertainmentSupplement] Build context:', {
      type,
      locale,
      historyCount: Array.isArray(userHistory) ? userHistory.length : 0,
      compactHistoryCount: compactHistory.length,
      historyPayloadBytes: getUtf8ByteLength(historyPayload),
      promptBudgetBytes: SUPPLEMENT_PROMPT_BUDGET_BYTES,
    });

    let promptMode: 'full' | 'minimal' = 'full';
    let prompt = locale === 'zh'
      ? `
为用户生成 1 个 ${getTypeLabel(type, 'zh')} 类型推荐。

用户历史摘要：
${historyPayload}

要求：
- 必须是 ${getTypeLabel(type, 'zh')} 类型
- 标题必须具体且真实存在
- searchQuery 必须可直接搜索
- 只返回单个 JSON 对象

${getTypeSpecificRequirements(type, 'zh')}

返回字段：title, description, reason, tags, searchQuery, platform, entertainmentType。
entertainmentType 必须为 ${type}。`
      : `
Generate 1 ${getTypeLabel(type, 'en')} recommendation.

User history summary:
${historyPayload}

Requirements:
- Must be ${getTypeLabel(type, 'en')} content
- Title must be specific and real
- searchQuery must be directly searchable
- Return a single JSON object only

${getTypeSpecificRequirements(type, 'en')}

Return fields: title, description, reason, tags, searchQuery, platform, entertainmentType.
entertainmentType must be ${type}.`;

    if (getUtf8ByteLength(prompt) > SUPPLEMENT_PROMPT_BUDGET_BYTES) {
      promptMode = 'minimal';
      const minimalHistoryPayload = stringifyWithinBudget(compactHistory.slice(0, 3), 800);
      prompt = locale === 'zh'
        ? `
为用户生成 1 个 ${getTypeLabel(type, 'zh')} 类型推荐。
历史摘要：${minimalHistoryPayload}
只返回单个 JSON 对象，字段：title, description, reason, tags, searchQuery, platform, entertainmentType。
entertainmentType 必须为 ${type}，不要链接，不要 Markdown。`
        : `
Generate 1 ${getTypeLabel(type, 'en')} recommendation.
History summary: ${minimalHistoryPayload}
Return a single JSON object with: title, description, reason, tags, searchQuery, platform, entertainmentType.
entertainmentType must be ${type}, no links, no markdown.`;
    }

    prompt = truncateUtf8(shrinkPromptWhitespace(prompt), SUPPLEMENT_PROMPT_BUDGET_BYTES - 64);

    console.log('[AI][EntertainmentSupplement] Prompt ready:', {
      type,
      locale,
      promptMode,
      promptBytes: getUtf8ByteLength(prompt),
      promptBudgetBytes: SUPPLEMENT_PROMPT_BUDGET_BYTES,
      compactHistoryCount: compactHistory.length,
    });

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: locale === 'zh'
          ? '你是推荐分析师。只返回 JSON 对象，不要链接，不要 markdown。'
          : 'You are a recommendation analyst. Only return JSON object, no links, no markdown.'
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const cleanContent = (await callRecommendationAI(messages, 0.8)).content;
    if (!cleanContent) {
      throw new Error('AI 返回空内容');
    }

    // 增强 JSON 解析，处理可能的格式问题
    let result;
    try {
      // 清理可能的 markdown 标记
      const cleaned = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('JSON 解析失败，使用 fallback:', parseError);
      throw new Error('JSON 解析失败');
    }

    // 确保返回的是单个推荐对象
    if (Array.isArray(result)) {
      result = result[0] || null;
    }

    // 验证必需字段并设置默认值
    if (result && typeof result === 'object') {
      result.entertainmentType = type; // 强制设置正确的类型
      result.title = result.title || `${getTypeLabel(type, locale as 'zh' | 'en')}推荐`;
      result.description = result.description || '';
      result.reason = result.reason || '';
      result.tags = Array.isArray(result.tags) ? result.tags : [];
      result.searchQuery = result.searchQuery || result.title;
      result.platform = result.platform || (locale === 'zh' ? '百度' : 'Google');
    }

    return result;

  } catch (error) {
    console.error(`Failed to generate ${type} recommendation:`, error);

    // 如果 AI 调用失败，返回示例数据
    const examples: Record<string, Record<EntertainmentType, RecommendationItem>> = {
      zh: {
        video: {
          title: '流浪地球2',
          description: '国产科幻电影，节奏紧凑，适合喜欢宏大叙事的用户。',
          reason: '基于你对科幻题材和高完成度作品的偏好。',
          tags: ['科幻', '电影', '冒险'],
          searchQuery: '流浪地球2',
          platform: '腾讯视频',
          entertainmentType: 'video'
        },
        game: {
          title: '原神',
          description: '开放世界冒险 RPG，内容丰富，探索感强。',
          reason: '适合喜欢持续探索和角色养成的用户。',
          tags: ['RPG', '开放世界', '冒险'],
          searchQuery: '原神',
          platform: 'TapTap',
          entertainmentType: 'game'
        },
        music: {
          title: '周杰伦最新专辑',
          description: '华语流行作品，旋律性强，适合日常循环收听。',
          reason: '适合偏好旋律感和熟悉歌手作品的用户。',
          tags: ['流行', '华语', '专辑'],
          searchQuery: '周杰伦 最新专辑 2024',
          platform: '酷狗音乐',
          entertainmentType: 'music'
        },
        review: {
          title: '诡秘之主',
          description: '设定完整、世界观宏大的长篇小说。',
          reason: '适合喜欢沉浸式阅读和长线剧情推进的用户。',
          tags: ['小说', '奇幻', '长篇'],
          searchQuery: '诡秘之主',
          platform: '笔趣阁',
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
      zh: '小说/网文',
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
      zh: `视频要求：
- 可推荐电影、电视剧、综艺、动漫、纪录片
- 示例："流浪地球2"、"狂飙"、"脱口秀大会"
- searchQuery 只保留作品名或核心关键词，不要加链接或平台后缀`,
      en: `
Video requirements:
- Can recommend movies, TV shows, variety shows, anime, documentaries
- Examples: "Inception", "Breaking Bad", "The Tonight Show"
- Search format: use the title or core keyword only, without links or noisy suffixes.`
    },
    game: {
      zh: `游戏要求：
- 可推荐 PC、主机、手机游戏
- 示例："艾尔登法环"、"原神"、"塞尔达传说"
- searchQuery 只保留游戏名，不要附带下载、平台或攻略字样`,
      en: `
Game requirements:
- Can recommend PC games, mobile games, console games
- Examples: "Elden Ring", "Genshin Impact", "The Legend of Zelda"
- Search format: use the game name only, without download or platform suffixes.`
    },
    music: {
      zh: `音乐要求：
- 可推荐歌曲、专辑、演唱会
- 示例："周杰伦 新专辑"、"林俊杰 演唱会"、"Taylor Swift 单曲"
- searchQuery 建议为歌手 + 歌名或专辑名，不要附带平台后缀`,
      en: `
Music requirements:
- Can recommend songs, albums, concerts
- Examples: "Taylor Swift new album", "Ed Sheeran concert", "Billie Eilish single"
- Search format: use artist + song/album title, without platform suffixes.`
    },
    review: {
      zh: `图文/小说要求：
- 推荐具体小说、文章或评论内容，不要只给泛泛榜单
- 示例："诡秘之主"、"庆余年"、"年度高分影评"
- searchQuery 只保留标题或标题 + 作者，不要附带 TXT、下载、全文 等后缀`,
      en: `
Review/News requirements:
- Can recommend reviews, entertainment news, commentary, and articles
- Examples: "Oscars 2024 predictions", "Best movies of the year", "Celebrity news"
- Search format: use the title or keyword only, without noisy suffixes.`
    }
  };

  return requirements[type][locale];
}



