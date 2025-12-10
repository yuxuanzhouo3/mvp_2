/**
 * 测试娱乐多样性检查器的功能
 */

import {
  analyzeEntertainmentDiversity,
  supplementEntertainmentTypes,
  generateDiverseRecommendations
} from '../lib/ai/entertainment-diversity-checker.js';
import type { RecommendationItem } from '../lib/ai/zhipu-recommendation.js';

// 测试数据：只有视频类型的推荐
const testRecommendations: RecommendationItem[] = [
  {
    title: '流浪地球2',
    description: '中国科幻巨制，展现人类文明危机',
    reason: '基于您对科幻题材的偏好',
    tags: ['科幻', '电影', '冒险'],
    searchQuery: '流浪地球2 豆瓣评分',
    platform: '豆瓣',
    entertainmentType: 'video'
  },
  {
    title: '狂飙',
    description: '2023年热播的刑侦剧',
    reason: '紧张刺激的剧情发展',
    tags: ['刑侦', '剧情', '电视剧'],
    searchQuery: '狂飙 电视剧 观看',
    platform: '爱奇艺',
    entertainmentType: 'video'
  }
];

async function testDiversityAnalysis() {
  console.log('\n=== 测试娱乐类型多样性分析 ===');

  const analysis = analyzeEntertainmentDiversity(testRecommendations);

  console.log('当前类型分布:', analysis.distribution);
  console.log('是否足够多样:', analysis.isDiverse);
  console.log('缺失的类型:', analysis.missingTypes);

  return analysis;
}

async function testDiverseGeneration() {
  console.log('\n=== 测试多样化推荐生成 ===');

  const result = generateDiverseRecommendations(testRecommendations, 3);

  console.log('是否需要更多推荐:', result.needsMore);
  console.log('建议补充的类型:', result.suggestedTypes);

  return result;
}

async function testTypeSupplementation() {
  console.log('\n=== 测试类型补充功能 ===');

  const analysis = analyzeEntertainmentDiversity(testRecommendations);

  if (analysis.missingTypes.length > 0) {
    console.log('尝试补充缺失的类型...');

    const supplemented = await supplementEntertainmentTypes(
      testRecommendations,
      analysis.missingTypes.slice(0, 2), // 最多补充2种类型
      [], // 空的历史记录
      'zh'
    );

    console.log('\n原始推荐数量:', testRecommendations.length);
    console.log('补充后推荐数量:', supplemented.length);

    // 显示补充的推荐
    supplemented.slice(testRecommendations.length).forEach((rec, index) => {
      console.log(`\n补充推荐 ${index + 1}:`);
      console.log(`标题: ${rec.title}`);
      console.log(`类型: ${rec.entertainmentType}`);
      console.log(`平台: ${rec.platform}`);
      console.log(`搜索词: ${rec.searchQuery}`);
    });

    // 再次分析多样性
    const newAnalysis = analyzeEntertainmentDiversity(supplemented);
    console.log('\n补充后的类型分布:', newAnalysis.distribution);
    console.log('是否足够多样:', newAnalysis.isDiverse);

    return supplemented;
  } else {
    console.log('当前推荐已经足够多样，无需补充');
    return testRecommendations;
  }
}

async function testFullWorkflow() {
  console.log('\n=== 测试完整工作流程 ===');

  // 模拟一个只有单一类型的推荐列表
  const singleTypeRecs: RecommendationItem[] = [
    {
      title: '复仇者联盟4',
      description: 'Marvel超级英雄巨制',
      reason: '史诗级的终章之战',
      tags: ['动作', '科幻', '超级英雄'],
      searchQuery: '复仇者联盟4 观看',
      platform: 'Disney+',
      entertainmentType: 'video'
    }
  ];

  console.log('1. 初始推荐数量:', singleTypeRecs.length);

  // 分析多样性
  const analysis = analyzeEntertainmentDiversity(singleTypeRecs);
  console.log('2. 缺失类型:', analysis.missingTypes);

  // 生成多样化推荐
  const diverseResult = generateDiverseRecommendations(singleTypeRecs, 3);
  console.log('3. 需要补充的类型:', diverseResult.suggestedTypes);

  // 补充类型
  if (diverseResult.needsMore && diverseResult.suggestedTypes.length > 0) {
    const finalRecs = await supplementEntertainmentTypes(
      singleTypeRecs,
      diverseResult.suggestedTypes,
      [],
      'zh'
    );

    console.log('\n4. 最终推荐列表:');
    finalRecs.forEach((rec, index) => {
      console.log(`\n推荐 ${index + 1}:`);
      console.log(`  标题: ${rec.title}`);
      console.log(`  类型: ${rec.entertainmentType}`);
      console.log(`  描述: ${rec.description}`);
      console.log(`  平台: ${rec.platform}`);
    });

    // 最终分析
    const finalAnalysis = analyzeEntertainmentDiversity(finalRecs);
    console.log('\n5. 最终类型分布:', finalAnalysis.distribution);
    console.log('   是否足够多样:', finalAnalysis.isDiverse);
  }
}

// 运行所有测试
async function runAllTests() {
  try {
    await testDiversityAnalysis();
    await testDiverseGeneration();
    await testTypeSupplementation();
    await testFullWorkflow();

    console.log('\n✅ 所有测试完成！');

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAllTests();
}

export {
  testDiversityAnalysis,
  testDiverseGeneration,
  testTypeSupplementation,
  testFullWorkflow
};