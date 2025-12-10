/**
 * 测试娱乐多样性检查器的功能
 */

// 测试多样性分析功能
async function testDiversityAnalysis() {
  console.log('\n=== 测试娱乐类型多样性分析 ===');

  // 测试数据：只有视频类型的推荐
  const testRecommendations = [
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

  // 手动分析类型分布
  const types = new Set();
  const distribution = {
    video: 0,
    game: 0,
    music: 0,
    review: 0
  };

  testRecommendations.forEach(rec => {
    if (rec.entertainmentType) {
      types.add(rec.entertainmentType);
      distribution[rec.entertainmentType]++;
    }
  });

  const isDiverse = types.size >= 3;
  const allTypes = ['video', 'game', 'music', 'review'];
  const missingTypes = allTypes.filter(type => !types.has(type));

  console.log('当前推荐列表:');
  testRecommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.title} (${rec.entertainmentType})`);
  });

  console.log('\n类型分布:', distribution);
  console.log('是否足够多样:', isDiverse);
  console.log('缺失的类型:', missingTypes);

  return {
    recommendations: testRecommendations,
    distribution,
    isDiverse,
    missingTypes
  };
}

// 测试通过API调用娱乐推荐
async function testEntertainmentAPI() {
  console.log('\n=== 测试娱乐推荐API ===');

  try {
    // 模拟用户历史：只有电影观看记录
    const userHistory = [
      { category: 'entertainment', title: '流浪地球', clicked: true },
      { category: 'entertainment', title: '满江红', clicked: true },
      { category: 'entertainment', title: '阿凡达2', clicked: true }
    ];

    // 调用API（跳过缓存以确保获取最新的推荐）
    const response = await fetch(`http://localhost:3000/api/recommend/ai/entertainment?userId=test-user&count=3&locale=zh&skipCache=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();

      console.log('\nAPI响应成功！');
      console.log('推荐数量:', data.recommendations.length);

      console.log('\n推荐列表:');
      data.recommendations.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.title}`);
        console.log(`   类型: ${rec.entertainmentType || '未指定'}`);
        console.log(`   描述: ${rec.description}`);
        console.log(`   平台: ${rec.platform}`);
        console.log(`   链接类型: ${rec.linkType}`);
      });

      // 分析返回的推荐多样性
      const types = new Set();
      const distribution = { video: 0, game: 0, music: 0, review: 0 };

      data.recommendations.forEach(rec => {
        if (rec.entertainmentType) {
          types.add(rec.entertainmentType);
          distribution[rec.entertainmentType]++;
        }
      });

      console.log('\n返回推荐的类型分布:', distribution);
      console.log('是否足够多样:', types.size >= 3);
      console.log('覆盖的类型:', Array.from(types));

    } else {
      console.error('API调用失败:', response.status, response.statusText);
      const errorData = await response.json();
      console.error('错误详情:', errorData);
    }

  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n提示：请确保开发服务器正在运行 (npm run dev)');
  }
}

// 运行所有测试
async function runTests() {
  console.log('开始测试娱乐多样性功能...\n');

  // 测试1：分析功能
  await testDiversityAnalysis();

  // 测试2：API调用
  await testEntertainmentAPI();

  console.log('\n✅ 测试完成！');
}

// 运行测试
runTests().catch(console.error);