-- =============================================
-- 修复 onboarding 进度跟踪功能
-- 问题: onboarding_responses 表结构不支持进度保存
-- 解决方案: 创建独立的进度表
-- 创建时间: 2024-12-19
-- =============================================

-- 1. 创建专门的进度跟踪表
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  answers JSONB DEFAULT '{}',
  current_category_index INT DEFAULT 0,
  current_question_index INT DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id
  ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_updated
  ON onboarding_progress(updated_at DESC);

-- 3. 添加注释
COMMENT ON TABLE onboarding_progress IS '用户问卷填写进度';
COMMENT ON COLUMN onboarding_progress.user_id IS '用户ID (唯一)';
COMMENT ON COLUMN onboarding_progress.answers IS '用户所有问卷答案 (JSON格式)';
COMMENT ON COLUMN onboarding_progress.current_category_index IS '当前问卷分类索引';
COMMENT ON COLUMN onboarding_progress.current_question_index IS '当前问题索引';
COMMENT ON COLUMN onboarding_progress.is_completed IS '问卷是否已完成';

-- 4. RLS 策略
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的进度
DROP POLICY IF EXISTS "Users can view own progress" ON onboarding_progress;
CREATE POLICY "Users can view own progress"
  ON onboarding_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON onboarding_progress;
CREATE POLICY "Users can insert own progress"
  ON onboarding_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON onboarding_progress;
CREATE POLICY "Users can update own progress"
  ON onboarding_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role 完全访问
DROP POLICY IF EXISTS "Service role full access progress" ON onboarding_progress;
CREATE POLICY "Service role full access progress"
  ON onboarding_progress FOR ALL
  USING (auth.role() = 'service_role');

-- 5. 自动更新 updated_at 触发器
DROP TRIGGER IF EXISTS update_onboarding_progress_updated_at ON onboarding_progress;
CREATE TRIGGER update_onboarding_progress_updated_at
  BEFORE UPDATE ON onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. 验证
DO $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'onboarding_progress'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE '✅ onboarding_progress 表创建成功';
  ELSE
    RAISE WARNING '❌ onboarding_progress 表创建失败';
  END IF;
END $$;
