// verify-subscriptions.js - 验证所有用户的订阅状态
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifySubscriptions() {
  console.log('=== 验证所有用户的订阅状态 ===\n');

  try {
    // 1. 获取所有用户
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      console.error('获取用户失败:', usersError);
      return;
    }

    console.log(`总共有 ${users.length} 个用户\n`);

    // 2. 对每个用户检查订阅状态
    for (const user of users) {
      console.log(`用户: ${user.email} (${user.id})`);

      // 检查用户元数据
      const metadata = user.user_metadata;
      console.log(`  元数据中的订阅计划: ${metadata?.subscription_plan || 'free'}`);
      console.log(`  元数据中的订阅状态: ${metadata?.subscription_status || 'inactive'}`);
      console.log(`  元数据中的订阅到期: ${metadata?.subscription_end || '未设置'}`);

      // 检查数据库中的订阅
      const { data: subscriptions, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (subError) {
        console.log('  数据库订阅查询失败:', subError.message);
      } else {
        if (subscriptions && subscriptions.length > 0) {
          if (subscriptions.length > 1) {
            console.log(`  ⚠️  发现 ${subscriptions.length} 个活跃订阅（应该只有1个）`);
          }
          const sub = subscriptions[0];
          console.log(`  活跃订阅ID: ${sub.id}`);
          console.log(`  订阅状态: ${sub.status}`);
          console.log(`  计划类型: ${sub.plan_type}`);
          console.log(`  到期时间: ${sub.subscription_end}`);

          // 计算剩余天数
          const now = new Date();
          const endDate = new Date(sub.subscription_end);
          const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
          console.log(`  剩余天数: ${daysLeft} 天`);
        } else {
          console.log('  没有活跃订阅');
        }
      }

      // 检查支付记录
      const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('status, amount, created_at, completed_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(3);

      if (!payError && payments && payments.length > 0) {
        console.log('  最近的支付记录:');
        payments.forEach(p => {
          console.log(`    - ${p.amount} USD (${p.created_at})`);
        });
      }

      console.log('---\n');
    }

    // 3. 统计信息
    console.log('\n=== 统计信息 ===');
    const { data: activeSubs } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('status', 'active');

    const activeUsersCount = activeSubs?.length || 0;
    console.log(`活跃订阅用户数: ${activeUsersCount}/${users.length}`);
    console.log(`付费用户比例: ${((activeUsersCount / users.length) * 100).toFixed(1)}%`);

    // 检查 pending 状态的支付
    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('user_id, amount, created_at')
      .eq('status', 'pending');

    if (pendingPayments && pendingPayments.length > 0) {
      console.log(`\n⚠️  有 ${pendingPayments.length} 个待处理的支付`);
    }

  } catch (error) {
    console.error('验证失败:', error);
  }
}

// 运行验证
verifySubscriptions();