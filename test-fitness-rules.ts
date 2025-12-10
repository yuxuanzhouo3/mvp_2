/**
 * Random Fitness 特殊规则验证测试脚本
 * 验证健身推荐是否包含三种必需的类型：
 * 1. 健身视频教程 (video)
 * 2. 健身房地点推荐 (location)
 * 3. 器材使用教程 (equipment)
 */

import {
    validateFitnessRecommendationDiversity,
    supplementFitnessTypes,
    enhanceFitnessRecommendation,
    selectFitnessPlatform,
    optimizeFitnessSearchQuery
} from '@/lib/ai/fitness-enhancer';

// 模拟推荐数据
const mockRecommendations = [
    {
        title: '30分钟瑜伽入门教程',
        description: '适合初学者的瑜伽基础练习',
        reason: '帮助你轻松开始瑜伽之旅',
        tags: ['瑜伽', '初学者', '拉伸'],
        searchQuery: '瑜伽入门教程',
        platform: 'B站'
    },
    {
        title: '附近健身房推荐',
        description: '查找你身边的优质健身场所',
        reason: '方便你随时开始健身训练',
        tags: ['健身房', '训练'],
        searchQuery: '附近健身房',
        platform: '百度地图'
    },
    // 缺少器材教程
];

async function testFitnessRules() {
    console.log('='.repeat(60));
    console.log('🏋️  Random Fitness 特殊规则验证测试');
    console.log('='.repeat(60));

    // 测试 1: 验证多样性
    console.log('\n【测试 1】验证推荐多样性');
    console.log('---'.repeat(20));
    const validation = validateFitnessRecommendationDiversity(mockRecommendations);
    console.log('✓ 验证结果:', validation);
    console.log(`  - 是否有效: ${validation.isValid ? '✓ 是' : '✗ 否'}`);
    console.log(`  - 缺少类型: ${validation.missingTypes.length > 0 ? validation.missingTypes.join(', ') : '无'}`);

    // 测试 2: 补充缺失类型
    if (validation.missingTypes.length > 0) {
        console.log('\n【测试 2】补充缺失的健身类型');
        console.log('---'.repeat(20));
        const supplements = await supplementFitnessTypes(
            mockRecommendations,
            validation.missingTypes,
            [],
            'zh'
        );
        console.log(`✓ 生成了 ${supplements.length} 个补充推荐`);
        supplements.forEach((rec, idx) => {
            console.log(`\n  补充推荐 ${idx + 1}:`);
            console.log(`    - 标题: ${rec.title}`);
            console.log(`    - 健身类型: ${rec.fitnessType}`);
            console.log(`    - 平台: ${rec.platform}`);
            console.log(`    - 搜索词: ${rec.searchQuery}`);
        });
    }

    // 测试 3: 增强推荐
    console.log('\n【测试 3】增强推荐内容');
    console.log('---'.repeat(20));
    const enhanced = enhanceFitnessRecommendation(mockRecommendations[0], 'zh');
    console.log('✓ 增强后的推荐:');
    console.log(`  - 标题: ${enhanced.title}`);
    console.log(`  - 健身类型: ${enhanced.fitnessType}`);
    console.log(`  - 平台: ${enhanced.platform}`);
    console.log(`  - 搜索词: ${enhanced.searchQuery}`);

    // 测试 4: 平台选择
    console.log('\n【测试 4】平台智能选择');
    console.log('---'.repeat(20));
    const videoPlatform = selectFitnessPlatform('video', '京东', 'zh');
    const locationPlatform = selectFitnessPlatform('location', '淘宝', 'zh');
    const equipmentPlatform = selectFitnessPlatform('equipment', 'Amazon', 'zh');

    console.log('✓ 健身视频教程平台:');
    console.log(`  期望: B站, 获得: ${videoPlatform}`);
    console.log('✓ 健身房地点推荐平台:');
    console.log(`  期望: 百度地图, 获得: ${locationPlatform}`);
    console.log('✓ 器材使用教程平台:');
    console.log(`  期望: B站, 获得: ${equipmentPlatform}`);

    // 测试 5: 搜索查询优化
    console.log('\n【测试 5】搜索查询优化');
    console.log('---'.repeat(20));
    const videoQuery = optimizeFitnessSearchQuery('瑜伽教程', '瑜伽', 'video', 'zh');
    const locationQuery = optimizeFitnessSearchQuery('附近健身房', '健身房', 'location', 'zh');
    const equipmentQuery = optimizeFitnessSearchQuery('哑铃', '哑铃', 'equipment', 'zh');

    console.log('✓ 健身视频查询优化:');
    console.log(`  原始: 瑜伽 → 优化: ${videoQuery}`);
    console.log('✓ 健身房查询优化:');
    console.log(`  原始: 健身房 → 优化: ${locationQuery}`);
    console.log('✓ 器材教程查询优化:');
    console.log(`  原始: 哑铃 → 优化: ${equipmentQuery}`);

    // 测试 6: 英文环境
    console.log('\n【测试 6】英文环境验证');
    console.log('---'.repeat(20));
    const engVideoPlatform = selectFitnessPlatform('video', 'Amazon', 'en');
    const engLocationPlatform = selectFitnessPlatform('location', 'Amazon', 'en');
    const engEquipmentPlatform = selectFitnessPlatform('equipment', 'Amazon', 'en');

    console.log('✓ 英文 - 健身视频平台:', engVideoPlatform);
    console.log('✓ 英文 - 健身房平台:', engLocationPlatform);
    console.log('✓ 英文 - 器材教程平台:', engEquipmentPlatform);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试完成！');
    console.log('='.repeat(60));
}

// 运行测试
testFitnessRules().catch(console.error);
