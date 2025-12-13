// list-users.js - 列出所有用户
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function listUsers() {
  try {
    console.log('获取用户列表...\n');

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('获取用户列表失败:', error);
      return;
    }

    console.log(`找到 ${users.length} 个用户:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. 用户ID: ${user.id}`);
      console.log(`   邮箱: ${user.email}`);
      console.log(`   创建时间: ${user.created_at}`);
      console.log(`   订阅计划: ${user.user_metadata?.subscription_plan || '未设置'}`);
      console.log(`   订阅状态: ${user.user_metadata?.subscription_status || '未设置'}`);
      console.log('---');
    });

    // 同时查询 user_subscriptions 表
    console.log('\n查询 user_subscriptions 表中的活跃订阅:\n');

    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('user_id, status, subscription_end, plan_type')
      .eq('status', 'active')
      .gte('subscription_end', new Date().toISOString());

    if (subError) {
      console.error('查询订阅失败:', subError);
    } else {
      subscriptions.forEach(sub => {
        console.log(`用户 ${sub.user_id} 有活跃订阅:`);
        console.log(`  状态: ${sub.status}`);
        console.log(`  到期时间: ${sub.subscription_end}`);
        console.log(`  计划类型: ${sub.plan_type}`);
        console.log('---');
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

listUsers();