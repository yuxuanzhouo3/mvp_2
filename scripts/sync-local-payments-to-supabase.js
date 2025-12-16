// 同步本地支付记录到 Supabase 云端
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 云端 Supabase 配置
const supabaseCloud = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function syncPayments() {
  console.log('Starting payment synchronization...');

  // 获取本地支付记录（从数据库或文件）
  // 这里我们使用之前的数据
  const localPayments = [
    {
      id: "8e2430e2-1c4a-4cd9-b3c8-7d06e5ece7a6",
      user_id: "165e098a-25e7-4bf8-9e9c-ae74e9ddb46b",
      amount: 9.99,
      currency: "USD",
      status: "completed",
      payment_method: "paypal",
      transaction_id: "0KA34839E1441301S",
      subscription_id: null,
      metadata: "{\"days\": 30, \"planType\": \"pro\", \"billingCycle\": \"monthly\"}",
      created_at: "2025-12-16T06:14:13.775047+00:00",
      updated_at: "2025-12-16T06:14:43.138244+00:00",
      completed_at: "2025-12-16T06:14:43.043+00:00"
    },
    {
      id: "d8e943ec-7ceb-4c3d-b2e6-3141ba50485e",
      user_id: "165e098a-25e7-4bf8-9e9c-ae74e9ddb46b",
      amount: 49.99,
      currency: "USD",
      status: "completed",
      payment_method: "paypal",
      transaction_id: "1HG45165A5870520Y",
      subscription_id: null,
      metadata: "{\"days\": 30, \"planType\": \"enterprise\", \"billingCycle\": \"monthly\"}",
      created_at: "2025-12-16T06:20:04.95977+00:00",
      updated_at: "2025-12-16T06:20:31.529076+00:00",
      completed_at: "2025-12-16T06:20:31.421+00:00"
    }
  ];

  console.log(`\nChecking if payments already exist in Supabase...`);

  for (const payment of localPayments) {
    // 检查是否已存在
    const { data: existing } = await supabaseCloud
      .from('payments')
      .select('id')
      .eq('id', payment.id)
      .single();

    if (existing) {
      console.log(`✓ Payment ${payment.id} already exists in Supabase`);
      continue;
    }

    // 插入记录
    console.log(`\nSyncing payment: ${payment.id}`);
    console.log(`- Amount: $${payment.amount}`);
    console.log(`- User: ${payment.user_id}`);
    console.log(`- Transaction: ${payment.transaction_id}`);

    const { data, error } = await supabaseCloud
      .from('payments')
      .upsert(payment);

    if (error) {
      console.error(`✗ Failed to sync payment ${payment.id}:`, error);
    } else {
      console.log(`✓ Successfully synced payment ${payment.id}`);
    }
  }

  // 验证同步结果
  console.log('\n\nVerifying synchronization...');
  const { data: userPayments, error: queryError } = await supabaseCloud
    .from('payments')
    .select('*')
    .eq('user_id', '165e098a-25e7-4bf8-9e9c-ae74e9ddb46b')
    .eq('status', 'completed');

  if (queryError) {
    console.error('Error verifying sync:', queryError);
  } else {
    console.log(`\nUser now has ${userPayments.length} completed payments in Supabase:`);
    userPayments.forEach(p => {
      console.log(`- $${p.amount} via ${p.payment_method} on ${new Date(p.created_at).toLocaleDateString()}`);
    });
  }
}

// 运行同步
syncPayments().then(() => {
  console.log('\nSync complete!');
}).catch(error => {
  console.error('Sync failed:', error);
});