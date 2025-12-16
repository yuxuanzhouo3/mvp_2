// 测试支付记录查询端点
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";

export async function GET() {
  try {
    console.log('[Debug] Testing supabaseAdmin connection...');

    // 1. 测试连接
    const { data: testData, error: testError } = await supabaseAdmin
      .from('payments')
      .select('count')
      .limit(1);

    if (testError) {
      console.error('[Debug] Test query failed:', testError);
      return NextResponse.json({
        error: 'Database connection failed',
        details: testError
      }, { status: 500 });
    }

    // 2. 测试查询已完成的支付记录
    const { data: completedPayments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('id, user_id, amount, status, created_at')
      .eq('status', 'completed')
      .limit(10);

    if (paymentsError) {
      console.error('[Debug] Payments query failed:', paymentsError);
      return NextResponse.json({
        error: 'Failed to query payments',
        details: paymentsError
      }, { status: 500 });
    }

    // 3. 统计
    const { count, error: countError } = await supabaseAdmin
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    return NextResponse.json({
      success: true,
      testConnection: { success: !testError },
      completedPaymentsCount: completedPayments?.length || 0,
      totalCompletedCount: count || 0,
      samplePayments: completedPayments?.slice(0, 3) || []
    });

  } catch (error: any) {
    console.error('[Debug] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message
    }, { status: 500 });
  }
}