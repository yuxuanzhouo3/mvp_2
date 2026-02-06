/**
 * Random Fitness 专门推荐处理器
 * 为健身推荐提供特殊规则和增强体验
 * 
 * 规则：
 * 1. 必须包含附近场所（nearby_place）
 * 2. 必须包含健身教程（tutorial）
 * 3. 必须包含器材使用教程（equipment）
 * 4. Web(CN) 场景可使用健身原理文章（theory_article）
 */

export type FitnessRecommendationType = 'nearby_place' | 'tutorial' | 'equipment' | 'theory_article';

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
    recommendations: any[],
    requiredTypes: FitnessRecommendationType[] = ['nearby_place', 'tutorial', 'equipment']
): { isValid: boolean; missingTypes: FitnessRecommendationType[] } {
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
    const declared = recommendation.fitnessType;
    if (declared === 'nearby_place' || declared === 'tutorial' || declared === 'equipment' || declared === 'theory_article') {
        return declared;
    }
    if (declared === 'article' || declared === 'theory' || declared === 'principle' || declared === 'knowledge') {
        return 'theory_article';
    }
    if (declared === 'video' || declared === 'plan') return 'tutorial';
    if (declared === 'equipment') return 'equipment';

    const title = recommendation.title?.toLowerCase() || '';
    const searchQuery = recommendation.searchQuery?.toLowerCase() || '';
    const platform = recommendation.platform?.toLowerCase() || '';
    const tags = (recommendation.tags || []).map((t: string) => t.toLowerCase());
    const description = recommendation.description?.toLowerCase() || '';

    const placeKeywords = [
        '附近', '周边', '健身房', '健身中心', '场馆', '场地', '球场', '泳池', '游泳', '攀岩', '羽毛球', '篮球', '网球',
        '拳馆', '拳击', '搏击', '普拉提', '瑜伽馆', '体能馆', '操房', 'crossfit', 'gym', 'nearby', 'near me', 'map', '地图', '点评', '美团'
    ];
    const placePlatforms = ['大众点评', '美团', '高德地图健身', '百度地图健身', '腾讯地图健身', 'google maps', 'yelp', 'keep'];
    const isPlace =
        placeKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw) || description.includes(kw)) ||
        placePlatforms.some((plat) => platform.includes(plat.toLowerCase())) ||
        tags.some((tag: string) => placeKeywords.some((kw) => tag.includes(kw)));

    const equipmentKeywords = [
        '哑铃', '杠铃', '壶铃', '深蹲架', '史密斯', '引体向上', '拉力器', '弹力带', '拉力带', '跑步机', '划船机',
        '瑜伽垫', '泡沫轴', '筋膜枪', '护腕', '护膝', '腰带', '器材', '设备', '健身器材',
        'dumbbell', 'barbell', 'kettlebell', 'treadmill', 'rowing', 'yoga mat', 'foam roller', 'massage gun', 'gear', 'equipment'
    ];
    const equipmentHowtoKeywords = ['使用教程', '怎么用', '入门', '动作要点', 'setup', 'how to', 'tutorial', 'tips'];
    const equipmentCommercialKeywords = ['购买', '选购', '性价比', 'best', 'guide', 'review', '评测', '购买指南'];
    const isEquipment =
        equipmentKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw)) &&
        (equipmentHowtoKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw) || description.includes(kw)) ||
            equipmentCommercialKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw) || description.includes(kw)));

    const theoryKeywords = [
        '原理', '机制', '科学', '生理', '解剖', '为什么', '误区', '小白', '科普', '基础知识', '训练原理',
        'progressive overload', 'mechanism', 'science', 'physiology', 'principles', 'beginner'
    ];
    const theoryPlatforms = ['知乎', 'fitnessvolt', 'muscle & strength'];
    const isTheory =
        theoryKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw) || description.includes(kw)) ||
        theoryPlatforms.some((plat) => platform.includes(plat)) ||
        tags.some((tag: string) => theoryKeywords.some((kw) => tag.includes(kw)));

    const tutorialKeywords = ['教程', '跟练', '训练', '动作', '课程', '视频课', 'tutorial', 'workout', 'class', 'lesson', 'video'];
    const tutorialPlatforms = ['youtube', 'youtube fitness', 'b站', 'b站健身', '优酷健身', 'peloton', 'keep'];
    const isTutorial =
        tutorialKeywords.some((kw) => title.includes(kw) || searchQuery.includes(kw) || description.includes(kw)) ||
        tutorialPlatforms.some((plat) => platform.includes(plat)) ||
        tags.some((tag: string) => tutorialKeywords.some((kw) => tag.includes(kw)));

    if (isEquipment) return 'equipment';
    if (isTheory && !isPlace) return 'theory_article';
    if (isPlace && !isTutorial) return 'nearby_place';
    if (isPlace && isTutorial) return 'tutorial';
    if (isTutorial) return 'tutorial';
    if (isTheory) return 'theory_article';
    if (isPlace) return 'nearby_place';
    return 'tutorial';
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
            case 'nearby_place':
                return {
                    title: '附近健身房推荐（先看评论）',
                    description: '优先选择通风好、异味少的场馆；留意深蹲架数量是否够用、是否需要排队；尽量选步行15分钟内更容易坚持',
                    reason: '补齐“附近场所”类型，方便你快速找到周边可去的健身地点',
                    tags: ['附近', '健身房', '深蹲架', '通风'],
                    searchQuery: '附近 健身房 步行15分钟 深蹲架 通风',
                    platform: '大众点评',
                    fitnessType: 'nearby_place',
                };

            case 'tutorial':
                return {
                    title: '45分钟全身力量跟练教程',
                    description: '适合新手的全身力量训练跟练视频，包含热身、主训练和拉伸收操，动作要点清晰',
                    reason: '补齐“教程”类型，便于直接跟练并快速开始',
                    tags: ['力量训练', '跟练', '新手', '教程'],
                    searchQuery: '全身力量 跟练 教程 视频课 新手',
                    platform: 'B站健身',
                    fitnessType: 'tutorial',
                };

            case 'equipment':
                return {
                    title: '哑铃使用教程：动作要点与常见错误',
                    description: '哑铃训练常见动作的正确发力与动作要点，避免肩肘受伤；适合家庭训练快速上手',
                    reason: '补齐“器材”类型，优先给你可直接照做的使用教程',
                    tags: ['哑铃', '使用教程', '动作要点', '入门'],
                    searchQuery: '哑铃 使用教程 动作要点 入门',
                    platform: 'B站健身',
                    fitnessType: 'equipment',
                };
            case 'theory_article':
                return {
                    title: '健身小白必读：肌肉增长与恢复原理',
                    description: '用通俗方式讲清训练刺激、恢复与进步的关系，帮你避开常见误区',
                    reason: '补齐“健身原理”类型，建立正确训练观念',
                    tags: ['健身原理', '小白', '科普', '误区'],
                    searchQuery: '健身小白 原理 科普 肌肉增长 恢复',
                    platform: '知乎',
                    fitnessType: 'theory_article',
                };
        }
    } else {
        // English versions
        switch (type) {
            case 'nearby_place':
                return {
                    title: 'Nearby Gym Options',
                    description: 'Prioritize good ventilation, enough squat racks, and walkable distance to stay consistent',
                    reason: 'Fill the “nearby place” type so you can find a real location nearby',
                    tags: ['nearby', 'gym', 'squat rack', 'ventilation'],
                    searchQuery: 'gym near me squat racks ventilation',
                    platform: 'Google Maps',
                    fitnessType: 'nearby_place',
                };

            case 'tutorial':
                return {
                    title: '30-Minute Yoga Video Course',
                    description: 'Professional yoga video tutorial perfect for beginners with stress relief and flexibility enhancement',
                    reason: 'Popular fitness video course recommended for beginners',
                    tags: ['yoga', 'beginner', 'video tutorial', 'relaxation'],
                    searchQuery: 'yoga for beginners video tutorial',
                    platform: 'YouTube Fitness',
                    fitnessType: 'tutorial',
                };

            case 'equipment':
                return {
                    title: 'How to Use Dumbbells Safely (Form Tips)',
                    description: 'Beginner-friendly dumbbell usage tutorial with key form cues and common mistakes to avoid',
                    reason: 'Fill the “equipment” type with practical how-to guidance',
                    tags: ['dumbbell', 'how to', 'form tips', 'beginner'],
                    searchQuery: 'how to use dumbbells form tips',
                    platform: 'YouTube Fitness',
                    fitnessType: 'equipment',
                };
            case 'theory_article':
                return {
                    title: 'Strength Training Basics: Progressive Overload Explained',
                    description: 'Plain-language explanation of training stimulus, recovery, and how progress actually happens',
                    reason: 'Fill the theory type with practical science-backed guidance',
                    tags: ['principles', 'science', 'beginner', 'progress'],
                    searchQuery: 'progressive overload basics training science',
                    platform: 'Muscle & Strength',
                    fitnessType: 'theory_article',
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
            case 'nearby_place': {
                const placePlatforms = ['大众点评', '美团', 'Keep', '百度地图健身', '高德地图健身', '腾讯地图健身'];
                return placePlatforms.includes(currentPlatform) ? currentPlatform : '大众点评';
            }

            case 'tutorial': {
                const tutorialPlatforms = ['B站健身', '优酷健身', 'Keep', 'B站'];
                return tutorialPlatforms.includes(currentPlatform) ? currentPlatform : 'B站健身';
            }

            case 'equipment':
                {
                    const equipmentPlatforms = ['B站健身', '优酷健身', 'B站'];
                    return equipmentPlatforms.includes(currentPlatform) ? currentPlatform : 'B站健身';
                }
            case 'theory_article':
                return '知乎';

            default:
                return currentPlatform;
        }
    } else {
        // English
        switch (fitnessType) {
            case 'nearby_place': {
                const placePlatforms = ['Google Maps', 'Yelp'];
                return placePlatforms.includes(currentPlatform) ? currentPlatform : 'Google Maps';
            }

            case 'tutorial': {
                const engVideoVideoPlatforms = ['YouTube', 'YouTube Fitness', 'Peloton', 'MyFitnessPal'];
                return engVideoVideoPlatforms.includes(currentPlatform) ? currentPlatform : 'YouTube Fitness';
            }

            case 'equipment':
                {
                    const engEquipmentPlatforms = ['YouTube', 'YouTube Fitness', 'GarageGymReviews'];
                    return engEquipmentPlatforms.includes(currentPlatform) ? currentPlatform : 'YouTube Fitness';
                }
            case 'theory_article': {
                const engTheoryPlatforms = ['Muscle & Strength', 'FitnessVolt'];
                return engTheoryPlatforms.includes(currentPlatform) ? currentPlatform : 'Muscle & Strength';
            }

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
            case 'nearby_place':
                if (!optimized.includes('附近') && !optimized.includes('周边')) {
                    optimized = `附近 ${optimized}`;
                }
                if (!optimized.includes('健身房') && !optimized.includes('场馆') && !optimized.includes('场地')) {
                    optimized += ' 健身房';
                }
                if (!optimized.includes('步行') && !optimized.includes('地铁') && !optimized.includes('商圈') && !optimized.includes('街道')) {
                    optimized += ' 步行';
                }
                break;

            case 'tutorial':
                if (!optimized.includes('教程') && !optimized.includes('跟练') && !optimized.includes('训练') && !optimized.includes('视频')) {
                    optimized += ' 跟练教程 视频课';
                }
                break;

            case 'equipment':
                if (optimized.includes('购买') || optimized.includes('买')) {
                    optimized = optimized.replace(/购买|买/g, '使用');
                }
                if (!optimized.includes('使用教程') && !optimized.includes('怎么用') && !optimized.includes('入门') && !optimized.includes('动作要点')) {
                    optimized += ' 使用教程 动作要点';
                }
                break;
            case 'theory_article':
                if (!optimized.includes('原理') && !optimized.includes('机制') && !optimized.includes('科学') && !optimized.includes('小白')) {
                    optimized += ' 原理 科普 小白';
                }
                break;
        }
    } else {
        // English
        switch (fitnessType) {
            case 'nearby_place':
                if (!optimized.includes('near me') && !optimized.includes('nearby')) {
                    optimized += ' near me';
                }
                break;

            case 'tutorial':
                if (!optimized.includes('video') && !optimized.includes('tutorial') && !optimized.includes('course')) {
                    optimized += ' video tutorial';
                }
                break;

            case 'equipment':
                if (optimized.includes('buy') || optimized.includes('purchase')) {
                    optimized = optimized.replace(/buy|purchase/g, 'use');
                }
                if (!optimized.includes('how to') && !optimized.includes('tips') && !optimized.includes('form')) {
                    optimized += ' how to use form tips';
                }
                break;
            case 'theory_article':
                if (!optimized.includes('science') && !optimized.includes('principles')) {
                    optimized += ' training science principles';
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
    const fitnessType = identifyFitnessType(recommendation) || 'tutorial';

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
