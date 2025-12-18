-- =============================================
-- AI 智能推荐平台 - 用户画像系统数据库扩展
-- 创建日期: 2025-12-17
-- 基于现有表结构，最小化侵入式修改
-- =============================================

-- 1. 扩展 user_preferences 表（添加画像字段）
ALTER TABLE public.user_preferences 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS profile_completeness INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_profile_summary TEXT,
  ADD COLUMN IF NOT EXISTS personality_tags TEXT[];

-- 添加注释
COMMENT ON COLUMN user_preferences.onboarding_completed IS '用户是否完成问卷';
COMMENT ON COLUMN user_preferences.profile_completeness IS '画像完整度 0-100';
COMMENT ON COLUMN user_preferences.ai_profile_summary IS 'AI生成的画像摘要';
COMMENT ON COLUMN user_preferences.personality_tags IS '个性标签数组';

-- 2. 扩展 recommendation_clicks 表（添加追踪字段）
ALTER TABLE public.recommendation_clicks
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS time_on_page INT,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS feedback_triggered BOOLEAN DEFAULT FALSE;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_clicks_session ON recommendation_clicks(session_id);
CREATE INDEX IF NOT EXISTS idx_clicks_time ON recommendation_clicks(time_on_page);

COMMENT ON COLUMN recommendation_clicks.session_id IS '会话ID，用于追踪用户轨迹';
COMMENT ON COLUMN recommendation_clicks.time_on_page IS '页面停留时间（秒）';
COMMENT ON COLUMN recommendation_clicks.returned_at IS '用户返回时间';
COMMENT ON COLUMN recommendation_clicks.feedback_triggered IS '是否已触发反馈';

-- 3. 新建：问卷回答记录表
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user_category 
  ON onboarding_responses(user_id, category);
CREATE INDEX IF NOT EXISTS idx_onboarding_created 
  ON onboarding_responses(created_at DESC);

COMMENT ON TABLE onboarding_responses IS '用户问卷回答记录';
COMMENT ON COLUMN onboarding_responses.answer IS '答案内容，支持单选/多选，格式：字符串或数组';

-- 4. 新建：用户反馈表
CREATE TABLE IF NOT EXISTS public.user_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  recommendation_id UUID,
  
  -- 反馈类型
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('interest', 'purchase', 'rating', 'skip')),
  
  -- 反馈内容
  is_interested BOOLEAN,
  has_purchased BOOLEAN,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- 触发信息
  triggered_by TEXT DEFAULT 'return_visit',
  time_since_recommendation INTERVAL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON user_feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_recommendation ON user_feedbacks(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_type ON user_feedbacks(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created ON user_feedbacks(created_at DESC);

COMMENT ON TABLE user_feedbacks IS '用户反馈记录，用于优化推荐';
COMMENT ON COLUMN user_feedbacks.triggered_by IS '触发方式：return_visit/manual/after_click/dialog';

-- 5. 新建：用户会话表
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_clicks INT DEFAULT 0,
  categories_visited TEXT[],
  feedback_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON user_sessions(started_at DESC);

COMMENT ON TABLE user_sessions IS '用户会话记录，用于分析用户行为';

-- 6. RLS 策略（行级安全）
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "Users can view own onboarding responses" ON onboarding_responses;
DROP POLICY IF EXISTS "Users can insert own onboarding responses" ON onboarding_responses;
DROP POLICY IF EXISTS "Users can view own feedbacks" ON user_feedbacks;
DROP POLICY IF EXISTS "Users can insert own feedbacks" ON user_feedbacks;
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Service role full access onboarding" ON onboarding_responses;
DROP POLICY IF EXISTS "Service role full access feedbacks" ON user_feedbacks;
DROP POLICY IF EXISTS "Service role full access sessions" ON user_sessions;

-- 用户只能查看自己的数据
CREATE POLICY "Users can view own onboarding responses"
  ON onboarding_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding responses"
  ON onboarding_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedbacks"
  ON user_feedbacks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedbacks"
  ON user_feedbacks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role 完全访问
CREATE POLICY "Service role full access onboarding"
  ON onboarding_responses FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access feedbacks"
  ON user_feedbacks FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access sessions"
  ON user_sessions FOR ALL
  USING (auth.role() = 'service_role');

-- 7. 辅助函数：获取用户画像完整度
CREATE OR REPLACE FUNCTION get_profile_completeness(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_completeness INT := 0;
  v_onboarding_done BOOLEAN;
  v_usage_count INT;
  v_feedback_count INT;
BEGIN
  -- 检查问卷是否完成（80分）
  SELECT onboarding_completed INTO v_onboarding_done
  FROM user_preferences
  WHERE user_id = p_user_id
  LIMIT 1;
  
  IF v_onboarding_done THEN
    v_completeness := 80;
  END IF;
  
  -- 使用次数加分（最多 10 分，每2次+1分）
  SELECT COUNT(*) INTO v_usage_count
  FROM recommendation_history
  WHERE user_id = p_user_id;
  
  v_completeness := v_completeness + LEAST(10, v_usage_count / 2);
  
  -- 反馈次数加分（最多 10 分，每次+2分）
  SELECT COUNT(*) INTO v_feedback_count
  FROM user_feedbacks
  WHERE user_id = p_user_id;
  
  v_completeness := v_completeness + LEAST(10, v_feedback_count * 2);
  
  RETURN LEAST(100, v_completeness);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_profile_completeness IS '计算用户画像完整度：问卷80分+使用10分+反馈10分';

-- 8. 辅助函数：获取用户标签权重
CREATE OR REPLACE FUNCTION get_user_tag_weights(
  p_user_id UUID,
  p_category TEXT
)
RETURNS TABLE (tag TEXT, weight INT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    key as tag,
    (value::text)::INT as weight
  FROM user_preferences, 
       jsonb_each(preferences::jsonb)
  WHERE user_id = p_user_id 
    AND category = p_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tag_weights IS '获取用户在指定分类下的标签权重';

-- 9. 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ 
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; 
$$ LANGUAGE plpgsql;

-- 应用到相关表（如果还没有）
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 10. 验证脚本
DO $$
BEGIN
  RAISE NOTICE '=== 用户画像系统数据库扩展验证 ===';
  
  -- 检查新表
  RAISE NOTICE '新建表数量: %', (
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('onboarding_responses', 'user_feedbacks', 'user_sessions')
  );
  
  -- 检查扩展字段
  RAISE NOTICE 'user_preferences 新增字段数: %', (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_name = 'user_preferences'
    AND column_name IN ('onboarding_completed', 'profile_completeness', 'ai_profile_summary', 'personality_tags')
  );
  
  -- 检查索引
  RAISE NOTICE '新增索引数量: %', (
    SELECT COUNT(*) FROM pg_indexes
    WHERE tablename IN ('onboarding_responses', 'user_feedbacks', 'user_sessions', 'recommendation_clicks')
    AND indexname LIKE 'idx_%'
  );
  
  RAISE NOTICE '=== 验证完成 ===';
END $$;

