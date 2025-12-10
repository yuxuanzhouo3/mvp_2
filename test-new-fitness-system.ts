/**
 * 新健身推荐系统测试
 * 验证三大类型：课程（YouTube）、器材（GarageGymReviews）、健身计划（FitnessVolt）
 */

import {
    validateFitnessRecommendationDiversity,
    identifyFitnessType,
    selectFitnessPlatform,
    optimizeFitnessSearchQuery,
    enhanceFitnessRecommendation,
} from '@/lib/ai/fitness-enhancer';
import { generateSearchLink, selectBestPlatform } from '@/lib/search/search-engine';

// 测试数据：三大类型的健身推荐
const testRecommendations = [
    // 1. 课程类型 - YouTube视频
    {
        title: '30分钟瑜伽入门课程',
        description: '专业教练的瑜伽视频教程',
        reason: '适合初学者',
        tags: ['瑜伽', '视频课程', '初学者'],
        searchQuery: '瑜伽入门视频课程',
        platform: 'YouTube',
        fitnessType: 'video'
    },
    // 2. 器材类型 - GarageGymReviews
    {
        title: '哑铃评测与购买指南',
        description: '最全面的家用哑铃评测',
        reason: '帮你选择合适的健身器材',
        tags: ['哑铃评测', '器材推荐', '购买指南'],
        searchQuery: '哑铃评测推荐',
        platform: 'GarageGymReviews',
        fitnessType: 'equipment'
    },
    // 3. 计划类型 - FitnessVolt
    {
        title: '12周肌肉训练计划',
        description: '科学的增肌训练计划',
        reason: '帮你制定个性化的健身计划',
        tags: ['健身计划', '增肌', '训练方案'],
        searchQuery: '肌肉训练计划增肌',
        platform: 'FitnessVolt',
        fitnessType: 'plan'
    }
];

console.log('=== 新健身推荐系统验证测试 ===\n');

// 1. 验证多样性检查
console.log('【测试 1】健身推荐多样性验证');
const diversity = validateFitnessRecommendationDiversity(testRecommendations);
console.log('包含的类型:', Array.from(new Set(testRecommendations.map(r => r.fitnessType))));
console.log('是否完整:', diversity.isValid ? '✓ 是' : '✗ 否');
if (!diversity.isValid) {
    console.log('缺失的类型:', diversity.missingTypes);
}

// 2. 验证类型识别
console.log('\n【测试 2】健身类型自动识别');
testRecommendations.forEach((rec, idx) => {
    const identified = identifyFitnessType(rec);
    const match = identified === rec.fitnessType ? '✓' : '✗';
    console.log(`${match} 推荐 ${idx + 1}: 实际=${rec.fitnessType}, 识别=${identified}`);
});

// 3. 验证平台选择
console.log('\n【测试 3】不同类型的平台选择');
const fitnessTypes = ['video', 'equipment', 'plan'] as const;
fitnessTypes.forEach(type => {
    const platform = selectFitnessPlatform(type as any, 'YouTube', 'zh');
    console.log(`${type} -> ${platform}`);
});

// 4. 验证搜索查询优化
console.log('\n【测试 4】搜索查询优化');
const queryTests = [
    { title: '瑜伽课程', query: '瑜伽初学者', type: 'video' as const },
    { title: '哑铃器材', query: '哑铃', type: 'equipment' as const },
    { title: '健身计划', query: '肌肉训练', type: 'plan' as const }
];
queryTests.forEach(test => {
    const optimized = optimizeFitnessSearchQuery(test.title, test.query, test.type as any, 'zh');
    console.log(`${test.type}: "${test.query}" -> "${optimized}"`);
});

// 5. 验证搜索链接生成
console.log('\n【测试 5】搜索链接生成');
const linkTests = [
    { title: '瑜伽视频', platform: 'YouTube', fitnessType: 'video' },
    { title: '哑铃评测', platform: 'GarageGymReviews', fitnessType: 'equipment' },
    { title: '健身计划', platform: 'FitnessVolt', fitnessType: 'plan' }
];
linkTests.forEach(test => {
    const link = generateSearchLink(test.title, test.title, test.platform, 'zh', 'fitness');
    console.log(`\n${test.fitnessType}:`);
    console.log(`  平台: ${test.platform}`);
    console.log(`  链接: ${link.url}`);
});

// 6. 验证推荐增强
console.log('\n【测试 6】推荐内容增强');
testRecommendations.forEach((rec, idx) => {
    const enhanced = enhanceFitnessRecommendation(rec, 'zh');
    console.log(`\n推荐 ${idx + 1}: ${rec.title}`);
    console.log(`  类型: ${enhanced.fitnessType}`);
    console.log(`  平台: ${enhanced.platform}`);
    console.log(`  搜索词: ${enhanced.searchQuery}`);
});

// 7. 验证英文版本
console.log('\n【测试 7】英文版本验证');
const enRecommendations = [
    {
        title: 'Yoga Video Course',
        description: 'Professional yoga tutorial',
        reason: 'Great for beginners',
        tags: ['yoga', 'video course'],
        searchQuery: 'yoga video tutorial',
        platform: 'YouTube',
        fitnessType: 'video'
    },
    {
        title: 'Dumbbell Reviews',
        description: 'Comprehensive reviews',
        reason: 'Choose right equipment',
        tags: ['dumbbell', 'equipment'],
        searchQuery: 'dumbbell reviews',
        platform: 'GarageGymReviews',
        fitnessType: 'equipment'
    },
    {
        title: 'Muscle Building Program',
        description: 'Training plan',
        reason: 'Complete fitness plan',
        tags: ['muscle', 'training'],
        searchQuery: 'muscle building program',
        platform: 'FitnessVolt',
        fitnessType: 'plan'
    }
];

const enDiversity = validateFitnessRecommendationDiversity(enRecommendations);
console.log('英文版多样性检查:', enDiversity.isValid ? '✓ 完整' : '✗ 不完整');

enRecommendations.forEach((rec, idx) => {
    const enhanced = enhanceFitnessRecommendation(rec, 'en');
    console.log(`\n推荐 ${idx + 1}: ${rec.title}`);
    console.log(`  平台: ${enhanced.platform}`);
    console.log(`  搜索词: ${enhanced.searchQuery}`);
});

console.log('\n=== 测试完成 ===\n');
console.log('✓ 系统已更新为三大类型:');
console.log('  1. 课程（YouTube） - 视频课程教学');
console.log('  2. 器材（GarageGymReviews） - 器材评测推荐');
console.log('  3. 计划（FitnessVolt） - 健身计划文章');
