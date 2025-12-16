import { createClient } from '@supabase/supabase-js';

// 简化的 UUID 验证函数
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidUserId(userId: string | null | undefined): userId is string {
  if (!userId || userId === "anonymous") return false;
  return isValidUUID(userId);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserHistory() {
  console.log('=== 检查用户推荐历史记录 ===\n');

  // 1. 检查 recommendation_history 表的总记录数
  const { count: totalCount, error: countError } = await supabase
    .from('recommendation_history')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('获取总记录数失败:', countError);
  } else {
    console.log`总记录数: ${totalCount || 0}`;
  }

  // 2. 列出所有有记录的用户
  const { data: userRecords, error: userError } = await supabase
    .from('recommendation_history')
    .select('user_id')
    .not('user_id', 'eq', 'anonymous');

  if (userError) {
    console.error('获取用户记录失败:', userError);
  } else {
    const uniqueUsers = [...new Set(userRecords?.map(r => r.user_id))];
    console.log(`\n有历史记录的用户数: ${uniqueUsers.length}`);
    console.log('用户ID列表:');
    uniqueUsers.forEach(userId => {
      const valid = isValidUserId(userId);
      console.log(`  - ${userId} ${valid ? '(有效)' : '(无效)'}`);
    });
  }

  // 3. 检查最近24小时的记录
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: recentRecords, error: recentError } = await supabase
    .from('recommendation_history')
    .select('*')
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentError) {
    console.error('\n获取最近记录失败:', recentError);
  } else {
    console.log(`\n最近24小时的记录数: ${recentRecords?.length || 0}`);
    if (recentRecords && recentRecords.length > 0) {
      console.log('最近的记录:');
      recentRecords.forEach(record => {
        console.log(`  - 用户: ${record.user_id}, 分类: ${record.category}, 标题: ${record.title.substring(0, 30)}..., 创建时间: ${record.created_at}`);
      });
    }
  }

  // 4. 检查是否有无效的user_id
  const { data: invalidRecords, error: invalidError } = await supabase
    .from('recommendation_history')
    .select('user_id, created_at')
    .eq('user_id', 'anonymous');

  if (invalidError) {
    console.error('\n获取匿名记录失败:', invalidError);
  } else {
    console.log(`\n匿名用户的记录数: ${invalidRecords?.length || 0}`);
  }

  // 5. 检查数据库表结构
  const { data: tableInfo, error: tableError } = await supabase
    .from('recommendation_history')
    .select('*')
    .limit(1);

  if (tableError) {
    console.error('\n检查表结构失败:', tableError);
  } else if (tableInfo && tableInfo.length > 0) {
    console.log('\n表字段示例:');
    console.log(Object.keys(tableInfo[0]));
  }
}

checkUserHistory().catch(console.error);