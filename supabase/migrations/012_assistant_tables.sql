-- =============================================
-- 012: AI 超级助手相关表
-- 功能：会员专属 AI 助手的对话记录、使用追踪、偏好管理
-- =============================================

-- 1. AI 助手使用次数追踪表
CREATE TABLE IF NOT EXISTS assistant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引：按用户查询 + 按日期范围查询
CREATE INDEX IF NOT EXISTS idx_assistant_usage_user_id ON assistant_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_usage_created_at ON assistant_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_usage_user_date ON assistant_usage(user_id, created_at);

-- 2. AI 助手对话记录表
CREATE TABLE IF NOT EXISTS assistant_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  structured_response JSONB DEFAULT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_conv_user_id ON assistant_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_conv_created_at ON assistant_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_conv_user_date ON assistant_conversations(user_id, created_at);

-- 3. AI 助手用户偏好表
CREATE TABLE IF NOT EXISTS assistant_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_pref_user_id ON assistant_preferences(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assistant_pref_user_name ON assistant_preferences(user_id, name);

-- RLS 策略
ALTER TABLE assistant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_preferences ENABLE ROW LEVEL SECURITY;

-- 允许 service role 访问（API 通过 service role key 操作）
CREATE POLICY "Service role access assistant_usage" ON assistant_usage
  FOR ALL USING (true);

CREATE POLICY "Service role access assistant_conversations" ON assistant_conversations
  FOR ALL USING (true);

CREATE POLICY "Service role access assistant_preferences" ON assistant_preferences
  FOR ALL USING (true);
