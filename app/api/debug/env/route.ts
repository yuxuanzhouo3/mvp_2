// 调试环境变量端点
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";

export async function GET() {
  const debugInfo = {
    // 检查环境变量是否存在（不暴露值）
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXT_PUBLIC_DEPLOY_REGION: process.env.NEXT_PUBLIC_DEPLOY_REGION,
      NODE_ENV: process.env.NODE_ENV
    },
    // 测试 Supabase 连接
    supabaseConnection: null as any
  };

  // 测试 Supabase 连接
  try {
    const { data, error } = await supabaseAdmin.from('payments').select('count').limit(1);
    debugInfo.supabaseConnection = {
      success: !error,
      error: error?.message || null
    };
  } catch (e: any) {
    debugInfo.supabaseConnection = {
      success: false,
      error: e.message
    };
  }

  return NextResponse.json(debugInfo, { status: 200 });
}