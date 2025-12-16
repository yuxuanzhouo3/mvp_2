import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 使用从日志中看到的实际用户ID
const testUserId = '07f9cc50-c954-4d4d-9ae4-f231dd2b30ed';
const testCategory = 'entertainment';

async function testSpecificUserHistory() {
  console.log(`=== 测试用户 ${testUserId} 的推荐历史 ===\n`);

  // 1. 测试获取该用户的所有历史记录
  console.log('1. 获取所有历史记录...');
  const { data: allHistory, error: allError } = await supabase
    .from('recommendation_history')
    .select('*')
    .eq('user_id', testUserId)
    .order('created_at', { ascending: false });

  if (allError) {
    console.error('失败:', allError);
  } else {
    console.log(`成功！总记录数: ${allHistory?.length || 0}`);
  }

  // 2. 测试获取该用户的娱乐分类历史记录
  console.log(`\n2. 获取 ${testCategory} 分类的历史记录...`);
  const { data: categoryHistory, error: categoryError } = await supabase
    .from('recommendation_history')
    .select('*')
    .eq('user_id', testUserId)
    .eq('category', testCategory)
    .order('created_at', { ascending: false })
    .limit(50);

  if (categoryError) {
    console.error('失败:', categoryError);
  } else {
    console.log(`成功！记录数: ${categoryHistory?.length || 0}`);
    if (categoryHistory && categoryHistory.length > 0) {
      console.log('\n最近的推荐:');
      categoryHistory.slice(0, 5).forEach((record, index) => {
        console.log(`${index + 1}. ${record.title}`);
        console.log(`   - 描述: ${record.description?.substring(0, 100)}...`);
        console.log(`   - 链接: ${record.link}`);
        console.log(`   - 创建时间: ${record.created_at}\n`);
      });
    }
  }

  // 3. 测试调用实际的 API 端点
  console.log('\n3. 测试调用 API 端点...');
  try {
    const apiUrl = `http://localhost:3000/api/recommend/ai/${testCategory}?userId=${testUserId}&count=5&skipCache=true`;
    console.log(`请求 URL: ${apiUrl}`);

    const response = await fetch(apiUrl);
    const data = await response.json();

    console.log('\nAPI 响应:');
    console.log(JSON.stringify(data, null, 2));
  } catch (fetchError) {
    console.error('API 调用失败:', fetchError);
    console.log('\n请确保开发服务器正在运行 (npm run dev)');
  }

  // 4. 检查最近保存的记录
  console.log('\n4. 检查最近保存的记录...');
  const { data: recentRecords, error: recentError } = await supabase
    .from('recommendation_history')
    .select('*')
    .eq('user_id', testUserId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentError) {
    console.error('失败:', recentError);
  } else {
    console.log('最近5条记录:');
    recentRecords?.forEach((record, index) => {
      console.log(`\n${index + 1}. ID: ${record.id}`);
      console.log(`   分类: ${record.category}`);
      console.log(`   标题: ${record.title}`);
      console.log(`   创建: ${record.created_at}`);
      console.log(`   点击: ${record.clicked}`);
      console.log(`   收藏: ${record.saved}`);
    });
  }
}

testSpecificUserHistory().catch(console.error);