import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/integrations/supabase";
import { requireAuth } from "@/lib/auth/auth";

export async function POST(request: NextRequest) {
  try {
    // 验证用户认证
    const authResult = await requireAuth(request);
    if (!authResult) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { user } = authResult;
    const { recommendationId, action = 'click' } = await request.json();

    // 记录点击
    await supabase.from('recommendation_clicks').insert({
      user_id: user.id,
      recommendation_id: recommendationId,
      action
    });

    // 更新推荐状态
    if (action === 'click') {
      await supabase
        .from('recommendation_history')
        .update({ clicked: true })
        .eq('id', recommendationId);

      // 更新用户偏好点击计数
      const { data: rec } = await supabase
        .from('recommendation_history')
        .select('category')
        .eq('id', recommendationId)
        .single();

      if (rec) {
        await supabase.rpc('increment', {
          table_name: 'user_preferences',
          column_name: 'click_count',
          row_id: user.id,
          category: rec.category
        }).catch(() => {
          // 如果RPC不存在，使用普通更新
          supabase
            .from('user_preferences')
            .update({
              click_count: supabase.raw('click_count + 1'),
              last_activity: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('category', rec.category);
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}