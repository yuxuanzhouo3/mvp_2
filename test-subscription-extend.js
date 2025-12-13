// test-subscription-extend.js - 测试订阅时间叠加功能
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

async function testSubscriptionExtend() {
  console.log('=== 测试订阅时间叠加功能 ===\n');

  try {
    // 选择一个测试用户
    const testUserId = '07f9cc50-c954-4d4d-9ae4-f231dd2b30ed'; // 使用第一个用户

    // 1. 查看当前订阅状态
    console.log('1. 查看当前订阅状态:');
    const { data: currentSub, error: currentError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', testUserId)
      .eq('status', 'active')
      .single();

    if (currentError) {
      if (currentError.code === 'PGRST116') {
        console.log('用户当前没有活跃订阅');
      } else {
        console.error('查询当前订阅失败:', currentError);
        return;
      }
    } else {
      console.log(`当前订阅结束时间: ${currentSub.subscription_end}`);
    }

    // 2. 模拟添加30天订阅
    console.log('\n2. 模拟添加30天订阅:');

    let subscriptionEnd;

    if (currentSub) {
      // 从当前订阅结束时间开始叠加
      subscriptionEnd = new Date(currentSub.subscription_end);
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
      console.log(`从 ${currentSub.subscription_end} 叠加30天`);
    } else {
      // 从今天开始计算
      subscriptionEnd = new Date();
      subscriptionEnd.setDate(subscriptionEnd.getDate() + 30);
      console.log('从今天开始添加30天');
    }

    console.log(`新的订阅结束时间: ${subscriptionEnd.toISOString()}`);

    // 3. 更新订阅
    console.log('\n3. 更新订阅记录:');
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: testUserId,
        status: 'active',
        subscription_end: subscriptionEnd.toISOString(),
        plan_type: 'monthly',
        currency: 'USD',
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error('更新订阅失败:', updateError);
      return;
    }

    console.log('✓ 订阅记录更新成功');

    // 4. 更新用户元数据
    console.log('\n4. 更新用户元数据:');
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.id === testUserId);

    if (userError || !user) {
      console.error('获取用户信息失败:', userError);
      return;
    }

    const { error: metaError } = await supabase.auth.admin.updateUserById(
      testUserId,
      {
        user_metadata: {
          subscription_plan: 'pro',
          subscription_status: 'active',
          subscription_end: subscriptionEnd.toISOString(),
        }
      }
    );

    if (metaError) {
      console.error('更新用户元数据失败:', metaError);
    } else {
      console.log('✓ 用户元数据更新成功');
    }

    // 5. 验证结果
    console.log('\n5. 验证更新结果:');
    const { data: finalSub, error: finalError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', testUserId)
      .eq('status', 'active')
      .single();

    if (finalError) {
      console.error('查询最终结果失败:', finalError);
    } else {
      console.log(`最终订阅结束时间: ${finalSub.subscription_end}`);

      // 计算剩余天数
      const now = new Date();
      const endDate = new Date(finalSub.subscription_end);
      const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

      console.log(`剩余天数: ${daysLeft} 天`);
    }

    // 6. 测试第二次叠加
    console.log('\n6. 测试第二次叠加15天:');
    const { data: subForSecond } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', testUserId)
      .eq('status', 'active')
      .single();

    if (subForSecond) {
      const newEndDate = new Date(subForSecond.subscription_end);
      newEndDate.setDate(newEndDate.getDate() + 15);

      const { error: secondError } = await supabase
        .from('user_subscriptions')
        .update({
          subscription_end: newEndDate.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subForSecond.id);

      if (secondError) {
        console.error('第二次叠加失败:', secondError);
      } else {
        console.log(`✓ 第二次叠加成功，新结束时间: ${newEndDate.toISOString()}`);
      }
    }

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testSubscriptionExtend();