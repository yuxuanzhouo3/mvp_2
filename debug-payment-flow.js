// debug-payment-flow.js - 调试支付流程中可能的问题
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

async function debugPaymentFlow() {
  console.log('=== 调试支付流程问题 ===\n');

  try {
    // 1. 查询最近的支付记录
    console.log('1. 查询最近的支付记录:');
    const { data: recentPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (paymentsError) {
      console.error('查询支付记录失败:', paymentsError);
    } else {
      recentPayments.forEach(payment => {
        console.log(`\n支付 ID: ${payment.id}`);
        console.log(`用户 ID: ${payment.user_id}`);
        console.log(`金额: ${payment.amount} ${payment.currency}`);
        console.log(`状态: ${payment.status}`);
        console.log(`支付方式: ${payment.payment_method}`);
        console.log(`交易ID: ${payment.transaction_id}`);
        console.log(`元数据:`, payment.metadata);
        console.log(`创建时间: ${payment.created_at}`);
        console.log(`完成时间: ${payment.completed_at}`);
      });
    }

    // 2. 查询支付对应的订阅记录
    console.log('\n\n2. 查询支付对应的订阅记录:');
    const { data: subscriptions, error: subsError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (subsError) {
      console.error('查询订阅记录失败:', subsError);
    } else {
      subscriptions.forEach(sub => {
        console.log(`\n订阅 ID: ${sub.id}`);
        console.log(`用户 ID: ${sub.user_id}`);
        console.log(`状态: ${sub.status}`);
        console.log(`计划类型: ${sub.plan_type}`);
        console.log(`到期时间: ${sub.subscription_end}`);
        console.log(`创建时间: ${sub.created_at}`);
        console.log(`更新时间: ${sub.updated_at}`);
      });
    }

    // 3. 检查用户元数据中的订阅状态
    console.log('\n\n3. 检查用户元数据中的订阅状态:');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('获取用户列表失败:', usersError);
    } else {
      users.forEach(user => {
        const metadata = user.user_metadata;
        console.log(`\n用户: ${user.email} (${user.id})`);
        console.log(`订阅计划: ${metadata?.subscription_plan || '未设置'}`);
        console.log(`订阅状态: ${metadata?.subscription_status || '未设置'}`);
        console.log(`订阅到期: ${metadata?.subscription_end || '未设置'}`);
      });
    }

    // 4. 查找支付成功但订阅状态未更新的情况
    console.log('\n\n4. 查找支付成功但订阅状态可能不一致的情况:');

    // 获取所有状态为 completed 的支付
    const { data: completedPayments, error: completedError } = await supabase
      .from('payments')
      .select('user_id, status, created_at')
      .eq('status', 'completed');

    if (completedError) {
      console.error('查询已完成支付失败:', completedError);
    } else {
      // 对每个有完成支付的用户，检查订阅状态
      for (const payment of completedPayments) {
        const { data: userSub, error: subError } = await supabase
          .from('user_subscriptions')
          .select('status, subscription_end')
          .eq('user_id', payment.user_id)
          .eq('status', 'active')
          .gte('subscription_end', new Date().toISOString())
          .single();

        console.log(`\n用户 ${payment.user_id}:`);
        console.log(`  - 有完成支付于: ${payment.created_at}`);
        if (subError) {
          console.log(`  - 没有活跃订阅 (错误: ${subError.message})`);
        } else {
          console.log(`  - 有活跃订阅，到期于: ${userSub.subscription_end}`);
        }
      }
    }

    // 5. 检查 webhook 是否被正确调用
    console.log('\n\n5. 检查潜在的 webhook 问题:');
    console.log('- 检查 PayPal webhook URL 是否正确配置');
    console.log('- 检查是否有重复的支付记录（可能导致重复处理被跳过）');
    console.log('- 检查支付记录中的 metadata 是否包含必要的订阅信息');

    // 查找可能有问题的支付记录
    const { data: problematicPayments } = await supabase
      .from('payments')
      .select('*')
      .eq('status', 'completed')
      .is('metadata', null);

    if (problematicPayments && problematicPayments.length > 0) {
      console.log(`\n发现 ${problematicPayments.length} 个缺少元数据的已完成支付记录:`);
      problematicPayments.forEach(p => {
        console.log(`  - 支付ID: ${p.id}, 用户ID: ${p.user_id}`);
      });
    }

  } catch (error) {
    console.error('调试过程出错:', error);
  }
}

// 运行调试
debugPaymentFlow();