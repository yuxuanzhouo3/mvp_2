// check-duplicates.js - 检查并修复重复订阅
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

async function checkAndFixDuplicates() {
  console.log('=== 检查并修复重复订阅 ===\n');

  try {
    // 查询所有用户的活跃订阅
    const { data: allSubs, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')
      .order('user_id');

    if (error) {
      console.error('查询失败:', error);
      return;
    }

    // 按用户分组
    const subsByUser = {};
    allSubs.forEach(sub => {
      if (!subsByUser[sub.user_id]) {
        subsByUser[sub.user_id] = [];
      }
      subsByUser[sub.user_id].push(sub);
    });

    // 找出有重复的用户
    const duplicates = Object.entries(subsByUser)
      .filter(([userId, subs]) => subs.length > 1);

    console.log(`发现 ${duplicates.length} 个用户有重复订阅\n`);

    // 修复每个用户的重复订阅
    for (const [userId, subs] of duplicates) {
      console.log(`\n用户 ${userId} 有 ${subs.length} 个订阅:`);

      // 获取最晚的到期时间
      let latestEnd = new Date();
      let mainSub = null;

      subs.forEach(sub => {
        const end = new Date(sub.subscription_end);
        console.log(`  - 订阅ID: ${sub.id}, 到期: ${sub.subscription_end}`);

        if (end > latestEnd) {
          latestEnd = end;
          mainSub = sub;
        }
      });

      // 删除除了主订阅之外的其他订阅
      const toDelete = subs.filter(s => s.id !== mainSub.id);
      console.log(`\n保留订阅 ${mainSub.id}, 删除 ${toDelete.length} 个重复订阅`);

      for (const sub of toDelete) {
        const { error: deleteError } = await supabase
          .from('user_subscriptions')
          .delete()
          .eq('id', sub.id);

        if (deleteError) {
          console.error(`删除失败:`, deleteError);
        } else {
          console.log(`✓ 删除订阅 ${sub.id}`);
        }
      }
    }

    // 验证修复结果
    console.log('\n\n=== 验证修复结果 ===');
    const { data: finalSubs } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('status', 'active');

    const finalSubsByUser = {};
    finalSubs?.forEach(sub => {
      finalSubsByUser[sub.user_id] = (finalSubsByUser[sub.user_id] || 0) + 1;
    });

    const stillHaveDuplicates = Object.entries(finalSubsByUser)
      .filter(([userId, count]) => count > 1);

    if (stillHaveDuplicates.length === 0) {
      console.log('✓ 所有重复订阅已修复！');
    } else {
      console.log(`仍有 ${stillHaveDuplicates.length} 个用户有重复订阅`);
    }

  } catch (error) {
    console.error('错误:', error);
  }
}

checkAndFixDuplicates();