/**
 * 推荐卡片图标映射
 * 为所有推荐类型提供统一的图标映射
 */

export type LinkType =
    | 'article'
    | 'music'
    | 'recipe'
    | 'restaurant'
    | 'product'
    | 'video'
    | 'search'
    | 'book'
    | 'location'
    | 'app'
    | 'movie'
    | 'game'
    | 'hotel'
    | 'course';

/**
 * 链接类型对应的 emoji 图标
 */
export const linkTypeEmojis: Record<LinkType, string> = {
    // 用户要求的主要类型
    article: '📄',      // Article - 文章
    music: '🎵',        // Music - 音乐
    recipe: '👨‍🍳',      // Recipe - 食谱
    restaurant: '🍽️',   // Restaurant - 餐厅
    product: '🛒',      // Product - 商品
    video: '🎬',        // Video - 视频
    search: '🔍',       // Search - 搜索

    // 其他类型
    book: '📚',         // Book - 图书
    location: '📍',     // Location - 地点
    app: '📱',          // App - 应用
    movie: '🎥',        // Movie - 电影
    game: '🎮',         // Game - 游戏
    hotel: '🏨',        // Hotel - 酒店
    course: '📖',       // Course - 课程
};

/**
 * 链接类型标签（支持多语言）
 */
export const linkTypeLabels: Record<LinkType, { zh: string; en: string }> = {
    article: { zh: '文章', en: 'Article' },
    music: { zh: '音乐', en: 'Music' },
    recipe: { zh: '食谱', en: 'Recipe' },
    restaurant: { zh: '餐厅', en: 'Restaurant' },
    product: { zh: '商品', en: 'Product' },
    video: { zh: '视频', en: 'Video' },
    search: { zh: '搜索', en: 'Search' },
    book: { zh: '图书', en: 'Book' },
    location: { zh: '地点', en: 'Location' },
    app: { zh: '应用', en: 'App' },
    movie: { zh: '电影', en: 'Movie' },
    game: { zh: '游戏', en: 'Game' },
    hotel: { zh: '酒店', en: 'Hotel' },
    course: { zh: '课程', en: 'Course' },
};

/**
 * 根据链接类型和元数据获取对应的图标
 * @param linkType 链接类型
 * @param metadata 元数据（可选）
 * @returns 对应的 emoji 图标
 */
export function getIconForLinkType(linkType: string, metadata?: any): string {
    // 首先检查是否有映射的图标
    const mappedIcon = linkTypeEmojis[linkType as LinkType];
    if (mappedIcon) {
        return mappedIcon;
    }

    // 如果当前链接类型是搜索类型，或者被明确标记为搜索链接且没有其他类型，则返回搜索图标
    if (linkType === 'search' || (metadata?.isSearchLink && !mappedIcon)) {
        return linkTypeEmojis.search;
    }

    // 返回默认的链接图标
    return '🔗';
}

/**
 * 获取链接类型的标签
 * @param linkType 链接类型
 * @param locale 语言设置（'zh' 或 'en'）
 * @returns 对应的标签
 */
export function getLabelForLinkType(linkType: string, locale: 'zh' | 'en' = 'zh'): string {
    const labels = linkTypeLabels[linkType as LinkType];
    return labels ? labels[locale] : linkType;
}

/**
 * 验证链接类型是否有效
 * @param linkType 链接类型
 * @returns 是否有效
 */
export function isValidLinkType(linkType: string): linkType is LinkType {
    return linkType in linkTypeEmojis;
}
