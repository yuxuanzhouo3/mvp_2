/**
 * Random Fitness 专门推荐处理器
 * 为健身推荐提供特殊规则和增强体验
 * 
 * 规则：
 * 1. 必须包含健身课程（Video - YouTube视频教程）
 * 2. 必须包含健身器材评测文章（Equipment - GarageGymReviews等器材评测网站）
 * 3. 必须包含健身计划文章（Plan - FitnessVolt等健身计划文章）
 */

export type FitnessRecommendationType = 'video' | 'equipment' | 'plan';

export interface FitnessRecommendation {
    title: string;
    description: string;
    reason: string;
    tags: string[];
    searchQuery: string;
    platform: string;
    fitnessType: FitnessRecommendationType;  // 健身推荐的子分类
    metadata?: Record<string, any>;
}

/**
 * 验证推荐是否包含所有必需的健身类型
 * 返回：{ isValid: boolean, missingTypes: FitnessRecommendationType[] }
 */
export function validateFitnessRecommendationDiversity(
    recommendations: any[]
): { isValid: boolean; missingTypes: FitnessRecommendationType[] } {
    const requiredTypes: FitnessRecommendationType[] = ['video', 'equipment', 'plan'];
    const foundTypes = new Set<FitnessRecommendationType>();

    // 识别每个推荐的健身类型
    recommendations.forEach((rec) => {
        const fitnessType = identifyFitnessType(rec);
        if (fitnessType) {
            foundTypes.add(fitnessType);
        }
    });

    const missingTypes = requiredTypes.filter((type) => !foundTypes.has(type));
    const isValid = missingTypes.length === 0;

    return { isValid, missingTypes };
}

/**
 * 识别推荐的健身类型
 */
export function identifyFitnessType(recommendation: any): FitnessRecommendationType | null {
    const title = recommendation.title?.toLowerCase() || '';
    const searchQuery = recommendation.searchQuery?.toLowerCase() || '';
    const platform = recommendation.platform?.toLowerCase() || '';
    const tags = (recommendation.tags || []).map((t: string) => t.toLowerCase());
    const description = recommendation.description?.toLowerCase() || '';

    // 健身视频教程特征 - 视频平台
    const videoKeywords = ['教程', '视频', '课程', '训练', '视频课程', 'tutorial', 'video', 'workout', 'class', 'lesson', 'youtube'];
    const videoPlatforms = ['youtube', 'youtube fitness', 'b站', 'b站健身', '腾讯视频健身', '优酷健身', 'peloton', '腾讯', '优酷'];  // 去掉需登录的抖音、小红书
    const isVideo = videoKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw)) ||
        videoPlatforms.some((plat) => platform.includes(plat)) ||
        tags.some((tag: string) => videoKeywords.some((kw) => tag.includes(kw)));

    // 健身器材评测特征 - 器材评测和购买指南
    const equipmentKeywords = ['哑铃', '器材', '设备', '跑步机', '瑜伽垫', '杠铃', '健身球', '拉力器', '健身器材',
        'dumbbell', 'equipment', 'barbell', 'treadmill', 'yoga mat', 'kettlebell', 'mat', 'gear', 'equipment review'];
    const equipmentTutorialKeywords = ['评测', '评价', '评选', '推荐', '购买指南', '最佳', 'review', 'best', 'guide', 'recommendation'];
    const isEquipment = equipmentKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw)) &&
        (equipmentTutorialKeywords.some((kw) => searchQuery.includes(kw) || description.includes(kw)) ||
            (platform.toLowerCase().includes('garage') || platform.toLowerCase().includes('review')));

    // 健身计划文章特征 - 健身计划和训练指南文章
    const planKeywords = ['计划', '计画', '方案', '计划表', '目标', '增肌', '减脂', '训练计划', '健身目标',
        'plan', 'program', 'routine', 'guide', 'workout plan', 'muscle building', 'fat loss'];
    const planPlatforms = ['fitnessvolt', 'fitness', 'muscle', 'training'];
    const isPlan = planKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw)) ||
        planPlatforms.some((plat) => platform.toLowerCase().includes(plat)) ||
        tags.some((tag: string) => planKeywords.some((kw) => tag.includes(kw))) ||
        description.includes('计划') || description.includes('增肌') || description.includes('减脂');

    // 判断逻辑：按优先级返回
    if (isEquipment) {
        return 'equipment';
    } else if (isPlan) {
        return 'plan';
    } else if (isVideo) {
        return 'video';
    }

    return null;
}

/**
 * 补充缺失的健身推荐类型
 */
export async function supplementFitnessTypes(
    currentRecommendations: any[],
    missingTypes: FitnessRecommendationType[],
    userHistory: any[],
    locale: string = 'zh'
): Promise<any[]> {
    const supplements: any[] = [];

    for (const type of missingTypes) {
        const supplement = generateFitnessSupplementRecommendation(type, userHistory, locale);
        if (supplement) {
            supplements.push(supplement);
        }
    }

    return supplements;
}

/**
 * 为缺失的类型生成补充推荐
 */
function generateFitnessSupplementRecommendation(
    type: FitnessRecommendationType,
    userHistory: any[],
    locale: string
): any {
    if (locale === 'zh') {
        switch (type) {
            case 'video':
                return {
                    title: '30分钟瑜伽入门课程',
                    description: '适合初学者的瑜伽基础视频教程，由专业教练指导，缓解压力，增强柔韧性',
                    reason: '根据初学者需求推荐的热门健身视频课程',
                    tags: ['瑜伽', '初学者', '视频教程', '放松'],
                    searchQuery: '瑜伽入门视频教程',
                    platform: 'B站健身',  // 改用B站健身
                    fitnessType: 'video',
                };

            case 'plan':
                return {
                    title: '12周肌肉训练计划',
                    description: '科学的增肌训练计划，包含详细的健身目标设置、训练方案和进度跟踪',
                    reason: '帮你制定个性化的健身计划，按步骤达成目标',
                    tags: ['健身计划', '增肌', '训练方案'],
                    searchQuery: '肌肉训练计划 增肌方案',
                    platform: 'FitnessVolt',
                    fitnessType: 'plan',
                };

            case 'equipment':
                return {
                    title: '哑铃评测与购买指南',
                    description: '最全面的家用哑铃评测和选购指南，包含多个品牌对比、性价比分析',
                    reason: '帮你选择适合的健身器材，科学购买',
                    tags: ['哑铃评测', '器材推荐', '购买指南'],
                    searchQuery: '哑铃评测推荐',
                    platform: 'GarageGymReviews',
                    fitnessType: 'equipment',
                };
        }
    } else {
        // English versions
        switch (type) {
            case 'video':
                return {
                    title: '30-Minute Yoga Video Course',
                    description: 'Professional yoga video tutorial perfect for beginners with stress relief and flexibility enhancement',
                    reason: 'Popular fitness video course recommended for beginners',
                    tags: ['yoga', 'beginner', 'video tutorial', 'relaxation'],
                    searchQuery: 'yoga for beginners video tutorial',
                    platform: 'YouTube',
                    fitnessType: 'video',
                };

            case 'plan':
                return {
                    title: '12-Week Muscle Building Program',
                    description: 'Scientific muscle building plan with detailed fitness goals, workout routines and progress tracking',
                    reason: 'Help you build a personalized fitness plan to achieve your goals',
                    tags: ['fitness plan', 'muscle building', 'training program'],
                    searchQuery: 'muscle building training program',
                    platform: 'FitnessVolt',
                    fitnessType: 'plan',
                };

            case 'equipment':
                return {
                    title: 'Dumbbell Reviews and Buying Guide',
                    description: 'Comprehensive dumbbell reviews and purchasing guide with brand comparisons and value analysis',
                    reason: 'Help you choose suitable fitness equipment with smart purchasing decisions',
                    tags: ['dumbbell review', 'equipment recommendation', 'buying guide'],
                    searchQuery: 'dumbbell reviews recommendation',
                    platform: 'GarageGymReviews',
                    fitnessType: 'equipment',
                };
        }
    }

    return null;
}

/**
 * 根据健身类型选择最佳平台
 * 确保每种类型使用合适的平台
 */
export function selectFitnessPlatform(
    fitnessType: FitnessRecommendationType,
    currentPlatform: string,
    locale: string = 'zh'
): string {
    if (locale === 'zh') {
        switch (fitnessType) {
            case 'video':
                // 健身视频课程优先使用国内视频平台（去掉需登录的抖音、小红书）
                const videoVideoPlatforms = ['B站健身', '腾讯视频健身', '优酷健身', 'YouTube', 'YouTube Fitness', 'B站'];
                return videoVideoPlatforms.includes(currentPlatform) ? currentPlatform : 'B站健身';

            case 'plan':
                // 健身计划优先使用FitnessVolt
                const planPlatforms = ['FitnessVolt', 'B站健身'];
                return planPlatforms.includes(currentPlatform) ? currentPlatform : 'FitnessVolt';

            case 'equipment':
                // 器材评测优先使用GarageGymReviews
                const equipmentPlatforms = ['GarageGymReviews', 'B站健身'];
                return equipmentPlatforms.includes(currentPlatform) ? currentPlatform : 'GarageGymReviews';

            default:
                return currentPlatform;
        }
    } else {
        // English
        switch (fitnessType) {
            case 'video':
                const engVideoVideoPlatforms = ['YouTube', 'YouTube Fitness', 'Peloton', 'MyFitnessPal'];
                return engVideoVideoPlatforms.includes(currentPlatform) ? currentPlatform : 'YouTube';

            case 'plan':
                const engPlanPlatforms = ['FitnessVolt', 'Medium', 'Muscle & Strength'];
                return engPlanPlatforms.includes(currentPlatform) ? currentPlatform : 'FitnessVolt';

            case 'equipment':
                const engEquipmentPlatforms = ['GarageGymReviews', 'Amazon', 'Best Buy'];
                return engEquipmentPlatforms.includes(currentPlatform) ? currentPlatform : 'GarageGymReviews';

            default:
                return currentPlatform;
        }
    }
}

/**
 * 优化健身推荐的搜索查询
 * 确保搜索词与推荐类型相匹配
 */
export function optimizeFitnessSearchQuery(
    title: string,
    searchQuery: string,
    fitnessType: FitnessRecommendationType,
    locale: string = 'zh'
): string {
    let optimized = searchQuery || title;

    if (locale === 'zh') {
        switch (fitnessType) {
            case 'video':
                // 视频课程：添加视频关键词
                if (!optimized.includes('视频') && !optimized.includes('课程') && !optimized.includes('教程')) {
                    optimized += ' 视频课程';
                }
                break;

            case 'plan':
                // 健身计划：添加计划关键词
                if (!optimized.includes('计划') && !optimized.includes('方案') && !optimized.includes('增肌') && !optimized.includes('减脂')) {
                    optimized += ' 健身计划';
                }
                break;

            case 'equipment':
                // 器材评测：强调评测和推荐
                if (optimized.includes('购买') || optimized.includes('买')) {
                    optimized = optimized.replace(/购买|买/g, '评测');
                }
                if (!optimized.includes('评测') && !optimized.includes('推荐') && !optimized.includes('购买指南')) {
                    optimized += ' 评测推荐';
                }
                break;
        }
    } else {
        // English
        switch (fitnessType) {
            case 'video':
                if (!optimized.includes('video') && !optimized.includes('tutorial') && !optimized.includes('course')) {
                    optimized += ' video course';
                }
                break;

            case 'plan':
                if (!optimized.includes('plan') && !optimized.includes('program') && !optimized.includes('routine')) {
                    optimized += ' training plan';
                }
                break;

            case 'equipment':
                if (optimized.includes('buy') || optimized.includes('purchase')) {
                    optimized = optimized.replace(/buy|purchase/g, 'review');
                }
                if (!optimized.includes('review') && !optimized.includes('recommendation') && !optimized.includes('guide')) {
                    optimized += ' review recommendation';
                }
                break;
        }
    }

    return optimized.trim();
}

/**
 * 增强健身推荐内容
 */
export function enhanceFitnessRecommendation(
    recommendation: any,
    locale: string = 'zh'
): FitnessRecommendation {
    const fitnessType = identifyFitnessType(recommendation) || 'video';

    // 优化搜索查询
    const optimizedSearchQuery = optimizeFitnessSearchQuery(
        recommendation.title,
        recommendation.searchQuery,
        fitnessType,
        locale
    );

    // 选择最佳平台
    const bestPlatform = selectFitnessPlatform(fitnessType, recommendation.platform, locale);

    return {
        ...recommendation,
        fitnessType,
        searchQuery: optimizedSearchQuery,
        platform: bestPlatform,
    };
}
