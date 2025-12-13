// test-subscription-update.js - 测试用户订阅状态更新
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  process.exit(1);
}

// 使用服务角色密钥创建客户端
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testSubscriptionUpdate() {
  try {
    // 1. 获取一个测试用户（第一个未设置订阅的用户）
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('获取用户列表失败:', listError);
      process.exit(1);
    }

    // 找到第一个未设置订阅的用户
    const testUser = users.find(u => !u.user_metadata?.subscription_plan || u.user_metadata.subscription_plan === 'free');
    const testUserId = testUser ? testUser.id : users[0].id;

    console.log('\n测试用户:', testUser?.email || 'Unknown', '(ID:', testUserId, ')');

    console.log('\n=== 测试用户订阅状态更新 ===');
    console.log('用户ID:', testUserId);

    // 2. 查看当前用户状态
    console.log('\n--- 1. 查看当前用户状态 ---');

    // 检查 user_metadata
    const { data: { users: userList }, error: authError } = await supabase.auth.admin.listUsers();
    const user = userList.find(u => u.id === testUserId);

    if (user) {
      console.log('用户元数据 (user_metadata):', user.user_metadata);
    } else {
      console.log('未找到用户');
      return;
    }

    // 检查 user_subscriptions 表
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', testUserId)
      .eq('status', 'active')
      .gte('subscription_end', new Date().toISOString());

    if (subError) {
      console.error('查询订阅失败:', subError);
    } else {
      console.log('活跃订阅:', subscriptions);
    }

    // 检查 user_profiles 表（如果存在）
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', testUserId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('查询 profile 失败:', profileError);
    } else if (profiles) {
      console.log('用户 Profile:', profiles);
    }

    // 3. 模拟更新订阅状态
    console.log('\n--- 2. 模拟更新订阅状态 ---');

    const subscriptionEnd = new Date();
    subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);

    // 更新 user_subscriptions 表
    const { error: updateSubError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: testUserId,
        status: 'active',
        subscription_end: subscriptionEnd.toISOString(),
        plan_type: 'monthly',
        currency: 'USD',
        updated_at: new Date().toISOString(),
      });

    if (updateSubError) {
      console.error('更新订阅表失败:', updateSubError);
    } else {
      console.log('✓ 成功更新 user_subscriptions 表');
    }

    // 更新用户元数据
    const { error: updateMetaError } = await supabase.auth.admin.updateUserById(
      testUserId,
      {
        user_metadata: {
          subscription_plan: 'pro',
          subscription_status: 'active',
          subscription_end: subscriptionEnd.toISOString(),
        }
      }
    );

    if (updateMetaError) {
      console.error('更新用户元数据失败:', updateMetaError);
      console.error('详细错误:', JSON.stringify(updateMetaError, null, 2));
    } else {
      console.log('✓ 成功更新用户元数据');
    }

    // 4. 验证更新结果
    console.log('\n--- 3. 验证更新结果 ---');

    // 重新获取用户信息
    const { data: { users: updatedUsers }, error: reAuthError } = await supabase.auth.admin.listUsers();
    const updatedUser = updatedUsers.find(u => u.id === testUserId);

    if (updatedUser) {
      console.log('更新后的用户元数据:', updatedUser.user_metadata);
    }

    // 重新获取订阅信息
    const { data: updatedSubscriptions, error: reSubError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', testUserId);

    if (reSubError) {
      console.error('重新查询订阅失败:', reSubError);
    } else {
      console.log('更新后的订阅记录:', updatedSubscriptions);
    }

    // 5. 测试 refresh-subscription API
    console.log('\n--- 4. 测试 refresh-subscription API ---');

    // 创建一个临时 JWT token
    const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });

    if (signInError) {
      console.error('生成测试 token 失败:', signInError);
    } else {
      // 使用生成的访问令牌
      const testResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/refresh_subscription_status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${signInData.properties.access_token}`,
          'apikey': supabaseServiceKey,
          'Content-Type': 'application/json'
        }
      });

      if (testResponse.ok) {
        const result = await testResponse.json();
        console.log('API 响应:', result);
      } else {
        console.error('API 调用失败:', testResponse.status, await testResponse.text());
      }
    }

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testSubscriptionUpdate();