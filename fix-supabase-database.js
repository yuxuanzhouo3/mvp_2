#!/usr/bin/env node

/**
 * Manual Supabase Database Fix Script
 * 手动修复 Supabase 数据库脚本
 *
 * 运行方式: node fix-supabase-database.js
 * 前提：需要设置正确的环境变量
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// 创建 Supabase 客户端（使用 service role key）
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function fixDatabase() {
    console.log('🔧 Fixing Supabase database...\n');

    try {
        // 1. 检查当前数据库状态
        console.log('1. Checking current database state...');

        // 检查 profiles 表是否存在
        const { data: profilesCheck, error: profilesError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);

        if (profilesError && profilesError.code === 'PGRST116') {
            console.log('   ⚠️  profiles table does not exist');
        } else if (profilesError) {
            console.log('   ❌ Error checking profiles table:', profilesError.message);
        } else {
            console.log('   ✅ profiles table exists');
        }

        // 检查 user_profiles 表是否存在
        const { data: userProfilesCheck, error: userProfilesError } = await supabase
            .from('user_profiles')
            .select('id')
            .limit(1);

        if (userProfilesError && userProfilesError.code === 'PGRST116') {
            console.log('   ⚠️  user_profiles table does not exist');
        } else if (userProfilesError) {
            console.log('   ❌ Error checking user_profiles table:', userProfilesError.message);
        } else {
            console.log('   ✅ user_profiles table exists');
        }

        console.log('\n2. Executing SQL to fix database...');

        // 读取并执行 SQL 迁移文件
        const fs = await import('fs/promises');
        const sqlPath = path.join(__dirname, 'supabase/migrations/006_fix_profiles_table.sql');
        const sqlContent = await fs.readFile(sqlPath, 'utf-8');

        // 将 SQL 分割成单独的语句
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`   📝 Found ${statements.length} SQL statements to execute`);

        // 由于 Supabase JavaScript 客户端不支持直接执行 DDL，
        // 我们需要提供手动执行的指导
        console.log('\n3. Manual execution required:');
        console.log('   ⚠️  Due to limitations, please execute the following SQL manually:');
        console.log('\n   📋 SQL to execute (go to Supabase Dashboard > SQL Editor):');
        console.log('\n' + '='.repeat(60));
        console.log(sqlContent);
        console.log('='.repeat(60));

        console.log('\n4. Additional fixes needed:');
        console.log('   ✅ Fixed NEXT_PUBLIC_APP_URL in .env.local');
        console.log('   ✅ Fixed table name reference in app/api/upgrade/route.ts');

        console.log('\n5. Next steps:');
        console.log('   1. Go to your Supabase project dashboard');
        console.log('   2. Navigate to SQL Editor');
        console.log('   3. Copy and execute the SQL above');
        console.log('   4. Check Authentication > Settings for redirect URLs');
        console.log('   5. Test email signup and login');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// 检查认证配置
async function checkAuthConfig() {
    console.log('\n🔍 Checking authentication configuration...');

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.log('   ❌ Error checking users:', error.message);
        return;
    }

    console.log(`   ✅ Found ${users.length} users in auth system`);

    if (users.length > 0) {
        console.log('   📋 Recent users:');
        users.slice(-3).forEach(user => {
            console.log(`      - ${user.email} (created: ${user.created_at})`);
        });
    }
}

// 主函数
async function main() {
    console.log('🚀 Supabase Database Fix Tool\n');

    await fixDatabase();
    await checkAuthConfig();

    console.log('\n✨ Done! Please follow the manual steps above.');
    console.log('After completing the SQL execution, you can test with:');
    console.log('  npm run dev');
}

main().catch(console.error);