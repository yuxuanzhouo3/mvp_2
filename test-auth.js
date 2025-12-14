// 临时测试脚本：检查认证状态
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAuth() {
  console.log('=== Supabase Auth Status Check ===');

  try {
    // 检查session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log('Session exists:', !!sessionData.session);
    if (sessionError) {
      console.log('Session error:', sessionError.message);
    }
    if (sessionData.session) {
      console.log('User ID:', sessionData.session.user.id);
      console.log('Access token length:', sessionData.session.access_token?.length || 0);
    }

    // 尝试获取用户信息
    const { data: userData, error: userError } = await supabase.auth.getUser();
    console.log('User exists:', !!userData.user);
    if (userError) {
      console.log('User error:', userError.message);
    }
    if (userData.user) {
      console.log('User email:', userData.user.email);
    }

  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

checkAuth();



