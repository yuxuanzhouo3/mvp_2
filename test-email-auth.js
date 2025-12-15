#!/usr/bin/env node

/**
 * Test Email Authentication
 * 测试邮箱认证功能
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

// 创建客户端（使用 anon key）
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEmailAuth() {
    console.log('🧪 Testing Email Authentication\n');

    // 测试邮箱
    const testEmail = 'test@example.com';
    const testPassword = 'TestPassword123!';

    try {
        // 1. 测试注册
        console.log('1. Testing email signup...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword,
            options: {
                emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
            }
        });

        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                console.log('   ✅ User already exists (this is OK)');
            } else {
                console.error('   ❌ Signup error:', signUpError.message);
                return;
            }
        } else {
            console.log('   ✅ Signup initiated successfully');
            console.log('   📧 Confirmation email sent to:', testEmail);

            if (signUpData.user && !signUpData.user.email_confirmed_at) {
                console.log('   ⚠️  Email confirmation required');
            }
        }

        // 2. 测试登录（如果邮箱已确认）
        console.log('\n2. Testing email login...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });

        if (signInError) {
            if (signInError.message.includes('Email not confirmed')) {
                console.log('   ⚠️  Login failed: Email not confirmed');
                console.log('   💡 Please check your email and click the confirmation link');
            } else {
                console.error('   ❌ Login error:', signInError.message);
            }
        } else {
            console.log('   ✅ Login successful!');
            console.log('   👤 User ID:', signInData.user.id);
            console.log('   📧 Email:', signInData.user.email);

            // 3. 测试 profiles 表
            console.log('\n3. Testing profiles table...');
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', signInData.user.id)
                .single();

            if (profileError) {
                console.error('   ❌ Profile error:', profileError.message);
            } else {
                console.log('   ✅ Profile found:', profile);
            }
        }

        // 4. 检查配置
        console.log('\n4. Configuration Check:');
        console.log(`   ✅ Supabase URL: ${supabaseUrl}`);
        console.log(`   ✅ App URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
        console.log(`   ✅ Redirect URL: ${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// 运行测试
testEmailAuth().then(() => {
    console.log('\n✨ Test completed!');
    console.log('\nNext steps:');
    console.log('1. If signup worked, check your email for confirmation link');
    console.log('2. After confirming, run this test again to verify login');
    console.log('3. Test the actual web interface: npm run dev');
}).catch(console.error);