// fix-duplicate-subscriptions.js - 修复重复订阅，叠加到期时间
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

async function fixDuplicateSubscriptions() {
  console.log('=== 修复重复订阅记录 ===\n');

  try {
    // 1. 查找所有有多个活跃订阅的用户
    const { data: allActiveSubscriptions, error: activeError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')
      .gte('subscription_end', new Date().toISOString())
      .order('user_id');

    if (activeError) {
      console.error('查询活跃订阅失败:', activeError);
      return;
    }

    // 按用户ID分组
    const subscriptionsByUser = {};
    allActiveSubscriptions.forEach(sub => {
      if (!subscriptionsByUser[sub.user_id]) {
        subscriptionsByUser[sub.user_id] = [];
      }
      subscriptionsByUser[sub.user_id].push(sub);
    });

    // 找出有重复订阅的用户
    const usersWithDuplicates = Object.entries(subscriptionsByUser)
      .filter(([userId, subs]) => subs.length > 1);

    console.log(`发现 ${usersWithDuplicates.length} 个用户有重复的活跃订阅\n`);

    // 2. 为每个用户合并订阅
    for (const [userId, subscriptions] of usersWithDuplicates) {
      console.log(`\n处理用户 ${userId} 的 ${subscriptions.length} 个订阅:`);

      // 获取用户信息
      const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
      const user = users.find(u => u.id === userId);

      console.log(`用户邮箱: ${user?.email || 'Unknown'}`);

      // 计算总订阅天数
      let totalDays = 0;
      let latestEndDate = new Date();

      subscriptions.forEach(sub => {
        console.log(`  - 订阅ID: ${sub.id}, 计划: ${sub.plan_type}, 到期: ${sub.subscription_end}`);

        // 计算每个订阅的天数
        const created = new Date(sub.created_at);
        const end = new Date(sub.subscription_end);
        const days = Math.floor((end - created) / (1000 * 60 * 60 * 24));
        totalDays += days;

        // 找出最晚的到期日期
        if (end > latestEndDate) {
          latestEndDate = end;
        }
      });

      // 从最晚的到期日期开始，叠加总天数
      const newEndDate = new Date(latestEndDate);
      newEndDate.setDate(newEndDate.getDate() + totalDays);

      console.log(`  - 叠加 ${totalDays} 天后新的到期日期: ${newEndDate.toISOString()}`);

      // 删除重复的订阅，只保留第一个
      const subsToDelete = subscriptions.slice(1);
      console.log(`  - 将删除 ${subsToDelete.length} 个重复订阅`);

      for (const sub of subsToDelete) {
        const { error: deleteError } = await supabase
          .from('user_subscriptions')
          .delete()
          .eq('id', sub.id);

        if (deleteError) {
          console.error(`    删除订阅 ${sub.id} 失败:`, deleteError);
        } else {
          console.log(`    ✓ 删除订阅 ${sub.id}`);
        }
      }

      // 更新保留的订阅
      const mainSub = subscriptions[0];
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          subscription_end: newEndDate.toISOString(),
          updated_at: new Date().toISOString(),
          plan_type: 'pro', // 统一设置为 pro
        })
        .eq('id', mainSub.id);

      if (updateError) {
        console.error(`  更新主订阅失败:`, updateError);
      } else {
        console.log(`  ✓ 更新主订阅 ${mainSub.id} 到期日期为: ${newEndDate.toISOString()}`);
      }

      // 更新用户元数据
      const { error: metaError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          user_metadata: {
            subscription_plan: 'pro',
            subscription_status: 'active',
            subscription_end: newEndDate.toISOString(),
          }
        }
      );

      if (metaError) {
        console.error(`  更新用户元数据失败:`, metaError);
      } else {
        console.log(`  ✓ 更新用户元数据`);
      }
    }

    // 3. 验证修复结果
    console.log('\n\n=== 验证修复结果 ===');

    for (const [userId] of usersWithDuplicates) {
      const { data: finalSubs, error: finalError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('subscription_end', new Date().toISOString());

      if (finalError) {
        console.error(`查询用户 ${userId} 最终订阅失败:`, finalError);
      } else {
        console.log(`\n用户 ${userId} 现在有 ${finalSubs.length} 个活跃订阅:`);
        finalSubs.forEach(sub => {
          console.log(`  - ID: ${sub.id}, 到期: ${sub.subscription_end}`);
        });
      }
    }

  } catch (error) {
    console.error('修复过程出错:', error);
  }
}

// 运行修复
fixDuplicateSubscriptions();