// 检查当前用户的支付记录
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/integrations/supabase-admin";
import { requireAuth } from "@/lib/auth/auth";

export async function GET(request: NextRequest) {
  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user } = authResult;
    const userId = user.id;

    console.log(`[Debug] Current user ID: ${userId}`);
    console.log(`[Debug] User email: ${user.email}`);

    // 查询该用户的所有支付记录（包括各种状态）
    const { data: allUserPayments, error: allError } = await supabaseAdmin
      .from('payments')
      .select('id, status, amount, payment_method, created_at')
      .eq('user_id', userId);

    if (allError) {
      console.error('[Debug] Error querying user payments:', allError);
      return NextResponse.json({ error: allError.message }, { status: 500 });
    }

    // 查询该用户已完成的支付记录
    const { data: completedUserPayments, error: completedError } = await supabaseAdmin
      .from('payments')
      .select('id, status, amount, payment_method, created_at, transaction_id')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (completedError) {
      console.error('[Debug] Error querying completed payments:', completedError);
      return NextResponse.json({ error: completedError.message }, { status: 500 });
    }

    // 查询数据库中是否有其他用户的支付记录样本
    const { data: otherUserPayments, error: otherError } = await supabaseAdmin
      .from('payments')
      .select('user_id, count')
      .neq('user_id', userId)
      .eq('status', 'completed')
      .limit(5);

    return NextResponse.json({
      currentUser: {
        id: userId,
        email: user.email
      },
      userPaymentStats: {
        total: allUserPayments?.length || 0,
        completed: completedUserPayments?.length || 0
      },
      allUserPayments: allUserPayments || [],
      completedUserPayments: completedUserPayments || [],
      otherUsersSample: otherUserPayments || []
    });

  } catch (error: any) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}