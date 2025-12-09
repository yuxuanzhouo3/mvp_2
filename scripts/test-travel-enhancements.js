/**
 * 测试旅游推荐增强功能
 */

const { enhanceTravelRecommendation } = require('../lib/ai/travel-enhancer');
const { generateSearchLink } = require('../lib/search/search-engine');

console.log('Testing Travel Recommendation Enhancements\n');

// 测试案例
const testCases = [
  {
    title: '巴厘岛海神庙',
    description: '观赏壮丽的海浪拍打神庙，体验日出时分的美景。',
    reason: '用户历史行为显示对海岛和日出景观有浓厚兴趣。',
    tags: ['海岛', '日出', '印度尼西亚', '巴厘岛', '神庙'],
    searchQuery: 'Bali sea temple sunrise beach island vacation',
    platform: 'Booking.com',
    locale: 'zh'
  },
  {
    title: '东京迪士尼乐园',
    description: '体验全球最受欢迎的迪士尼乐园，畅游童话世界。',
    reason: '用户历史行为显示对主题公园和娱乐活动感兴趣。',
    tags: ['迪士尼', '东京', '日本', '乐园', '家庭游'],
    searchQuery: 'Tokyo Disneyland',
    platform: 'Booking.com',
    locale: 'zh'
  },
  {
    title: '巴黎塞纳河游船',
    description: '乘坐游船游览巴黎，欣赏埃菲尔铁塔和卢浮宫夜景。',
    reason: '用户历史行为显示对欧洲旅行和城市夜景有偏好。',
    tags: ['巴黎', '塞纳河', '法国', '游船', '夜景'],
    searchQuery: 'Paris Seine River cruise',
    platform: 'Agoda',
    locale: 'zh'
  },
  {
    title: '故宫博物院',
    description: '探索中国明清两代的皇家宫殿，感受深厚的历史文化底蕴。',
    reason: '用户历史行为显示对历史文化有浓厚兴趣。',
    tags: ['历史文化', '北京', '宫殿', '博物馆', '中国'],
    searchQuery: 'Forbidden City Beijing',
    platform: '携程',
    locale: 'zh'
  }
];

testCases.forEach((testCase, i) => {
  console.log(`\n${i + 1}. 测试案例: ${testCase.title}`);
  console.log(`   原始搜索查询: ${testCase.searchQuery}`);
  console.log(`   原始平台: ${testCase.platform}`);

  // 使用增强器处理
  const enhanced = enhanceTravelRecommendation(testCase, testCase.locale);

  console.log(`   增强后搜索查询: ${enhanced.searchQuery}`);
  console.log(`   增强后平台: ${enhanced.platform}`);
  console.log(`   目的地: ${enhanced.destination.name} (${enhanced.destination.country || 'N/A'})`);
  console.log(`   链接类型: ${enhanced.linkType}`);

  // 测试搜索引擎链接生成
  const searchLink = generateSearchLink(
    enhanced.title,
    enhanced.searchQuery,
    enhanced.platform,
    enhanced.locale,
    'travel'
  );

  console.log(`   生成的URL: ${searchLink.url}`);
  console.log(`   URL分析: ${analyzeURL(searchLink.url, enhanced.title)}\n`);
  console.log('---');
});

// 分析URL相关性
function analyzeURL(url, title) {
  const encodedTitle = encodeURIComponent(title);
  const encodedKeywords = [
    'hotels', 'resorts', 'accommodation',
    'attractions', 'things to do', 'tours'
  ];

  let analysis = [];

  if (url.includes(encodedTitle.substring(0, 10))) {
    analysis.push('✅ 包含目的地名称');
  }

  if (encodedKeywords.some(keyword => url.includes(keyword))) {
    const found = encodedKeywords.find(k => url.includes(k));
    analysis.push(`⚠️ 包含通用关键词: ${found}`);
  } else {
    analysis.push('✅ 没有通用关键词，搜索更精准');
  }

  return analysis.join(', ');
}

console.log('\n✅ 测试完成！');
console.log('\n改进说明:');
console.log('1. 旅游推荐使用具体的目的地名称，不再添加通用关键词');
console.log('2. 根据景点类型智能选择最合适的平台（TripAdvisor、携程、马蜂窝等）');
console.log('3. 中文目的地自动转换为英文名称，以便在国际平台获得更好的搜索结果');
console.log('4. Booking.com 仅对特定景点添加住宿关键词，确保搜索精准性');