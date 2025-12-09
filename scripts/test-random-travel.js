// 测试 Random Travel 推荐功能
const fetch = require('node-fetch');

async function testRandomTravelRecommendations() {
  console.log('🧪 测试 Random Travel 推荐功能...\n');

  try {
    // 测试中文用户
    console.log('1️⃣ 测试中文用户请求旅游推荐:');
    const zhResponse = await fetch('http://localhost:3005/api/recommend/ai/travel?userId=test-user&count=3&locale=zh', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (zhResponse.ok) {
      const zhData = await zhResponse.json();
      console.log('✅ 中文请求成功');
      console.log('推荐数量:', zhData.recommendations?.length || 0);
      console.log('来源:', zhData.source);

      if (zhData.recommendations?.length > 0) {
        const firstRec = zhData.recommendations[0];
        console.log('\n第一个推荐示例:');
        console.log('- 标题:', firstRec.title);
        console.log('- 描述:', firstRec.description);
        console.log('- 理由:', firstRec.reason);
        console.log('- 平台:', firstRec.platform);
        console.log('- 链接类型:', firstRec.linkType);

        if (firstRec.metadata.destination) {
          console.log('- 目的地:', firstRec.metadata.destination);
        }
        if (firstRec.metadata.highlights) {
          console.log('- 亮点:', firstRec.metadata.highlights);
        }
      }
    } else {
      console.error('❌ 中文请求失败:', zhResponse.statusText);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // 测试英文用户
    console.log('2️⃣ 测试英文用户请求旅游推荐:');
    const enResponse = await fetch('http://localhost:3005/api/recommend/ai/travel?userId=test-user&count=3&locale=en', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (enResponse.ok) {
      const enData = await enResponse.json();
      console.log('✅ 英文请求成功');
      console.log('推荐数量:', enData.recommendations?.length || 0);
      console.log('来源:', enData.source);

      if (enData.recommendations?.length > 0) {
        const firstRec = enData.recommendations[0];
        console.log('\n第一个推荐示例:');
        console.log('- Title:', firstRec.title);
        console.log('- Description:', firstRec.description);
        console.log('- Reason:', firstRec.reason);
        console.log('- Platform:', firstRec.platform);
        console.log('- Link Type:', firstRec.linkType);

        if (firstRec.metadata.destination) {
          console.log('- Destination:', firstRec.metadata.destination);
        }
        if (firstRec.metadata.highlights) {
          console.log('- Highlights:', firstRec.metadata.highlights);
        }
      }
    } else {
      console.error('❌ 英文请求失败:', enResponse.statusText);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 等待服务器启动
setTimeout(() => {
  testRandomTravelRecommendations();
}, 3000);