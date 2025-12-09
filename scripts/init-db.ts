/**
 * 数据库初始化脚本
 * 用于检查和创建 AI 推荐系统所需的数据库表
 *
 * 运行方式: npx ts-node scripts/init-db.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase configuration');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(tableName).select('id').limit(1);
    // 如果表不存在，会返回错误
    return !error || !error.message.includes('does not exist');
  } catch {
    return false;
  }
}

async function testConnection() {
  console.log('Testing Supabase connection...');
  console.log(`URL: ${supabaseUrl}`);

  try {
    // 简单查询测试连接
    const { error } = await supabase.from('recommendation_history').select('id').limit(1);

    if (error && error.message.includes('does not exist')) {
      console.log('Connection successful, but tables need to be created.');
      return { connected: true, tablesExist: false };
    } else if (error) {
      console.error('Connection error:', error.message);
      return { connected: false, tablesExist: false };
    }

    console.log('Connection successful, tables exist.');
    return { connected: true, tablesExist: true };
  } catch (err) {
    console.error('Connection failed:', err);
    return { connected: false, tablesExist: false };
  }
}

async function checkAllTables() {
  console.log('\n--- Checking Database Tables ---\n');

  const tables = [
    'recommendation_history',
    'user_preferences',
    'recommendation_clicks',
    'recommendation_cache',
  ];

  const results: Record<string, boolean> = {};

  for (const table of tables) {
    const exists = await checkTableExists(table);
    results[table] = exists;
    console.log(`${exists ? '✓' : '✗'} ${table}`);
  }

  return results;
}

async function testInsertAndQuery() {
  console.log('\n--- Testing Insert and Query Operations ---\n');

  const testUserId = '00000000-0000-0000-0000-000000000000';

  // 测试 user_preferences 表
  try {
    console.log('Testing user_preferences...');

    // 尝试插入
    const { data: insertData, error: insertError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: testUserId,
        category: 'entertainment',
        preferences: { test: 0.5 },
        tags: ['test'],
        click_count: 0,
        view_count: 0,
      }, {
        onConflict: 'user_id,category'
      })
      .select()
      .single();

    if (insertError) {
      console.log(`  Insert: ✗ ${insertError.message}`);
    } else {
      console.log(`  Insert: ✓ (id: ${insertData?.id})`);
    }

    // 查询
    const { data: queryData, error: queryError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', testUserId)
      .eq('category', 'entertainment')
      .single();

    if (queryError) {
      console.log(`  Query: ✗ ${queryError.message}`);
    } else {
      console.log(`  Query: ✓`);
    }

    // 清理测试数据
    await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', testUserId);
    console.log(`  Cleanup: ✓`);

  } catch (err) {
    console.error('user_preferences test failed:', err);
  }

  // 测试 recommendation_history 表
  try {
    console.log('\nTesting recommendation_history...');

    const { data: insertData, error: insertError } = await supabase
      .from('recommendation_history')
      .insert({
        user_id: testUserId,
        category: 'entertainment',
        title: 'Test Recommendation',
        description: 'Test description',
        link: 'https://example.com',
        link_type: 'article',
        metadata: {},
        reason: 'Test reason',
      })
      .select()
      .single();

    if (insertError) {
      console.log(`  Insert: ✗ ${insertError.message}`);
    } else {
      console.log(`  Insert: ✓ (id: ${insertData?.id})`);

      // 清理
      await supabase
        .from('recommendation_history')
        .delete()
        .eq('id', insertData.id);
      console.log(`  Cleanup: ✓`);
    }
  } catch (err) {
    console.error('recommendation_history test failed:', err);
  }

  // 测试 recommendation_cache 表
  try {
    console.log('\nTesting recommendation_cache...');

    const { data: insertData, error: insertError } = await supabase
      .from('recommendation_cache')
      .insert({
        category: 'entertainment',
        preference_hash: 'test_hash',
        recommendations: [{ title: 'Test', link: 'https://example.com' }],
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.log(`  Insert: ✗ ${insertError.message}`);
    } else {
      console.log(`  Insert: ✓ (id: ${insertData?.id})`);

      // 清理
      await supabase
        .from('recommendation_cache')
        .delete()
        .eq('id', insertData.id);
      console.log(`  Cleanup: ✓`);
    }
  } catch (err) {
    console.error('recommendation_cache test failed:', err);
  }
}

async function main() {
  console.log('===========================================');
  console.log('AI Recommendation System - Database Check');
  console.log('===========================================\n');

  const { connected, tablesExist } = await testConnection();

  if (!connected) {
    console.error('\nFailed to connect to Supabase. Please check your configuration.');
    process.exit(1);
  }

  if (!tablesExist) {
    console.log('\n===========================================');
    console.log('IMPORTANT: Tables need to be created!');
    console.log('===========================================\n');
    console.log('Please run the migration script in Supabase SQL Editor:');
    console.log('  File: supabase/migrations/001_ai_recommendation_tables.sql\n');
    console.log('Steps:');
    console.log('  1. Go to your Supabase dashboard');
    console.log('  2. Navigate to SQL Editor');
    console.log('  3. Copy and paste the contents of the migration file');
    console.log('  4. Click "Run" to execute the script');
    console.log('  5. Run this script again to verify\n');
    process.exit(0);
  }

  await checkAllTables();
  await testInsertAndQuery();

  console.log('\n===========================================');
  console.log('Database check completed successfully!');
  console.log('===========================================\n');
}

main().catch(console.error);
