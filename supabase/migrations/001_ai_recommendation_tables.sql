-- =============================================
-- AI 智能推荐系统数据库迁移脚本
-- AI Smart Recommendation System Database Migration
-- =============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. 用户推荐历史表 (Recommendation History)
-- =============================================
-- 存储每次推荐给用户的内容
CREATE TABLE IF NOT EXISTS recommendation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('entertainment', 'shopping', 'food', 'travel', 'fitness')),
  title TEXT NOT NULL,
  description TEXT,
  link TEXT NOT NULL,  -- 外部链接 (必填)
  link_type TEXT CHECK (link_type IN ('product', 'video', 'book', 'location', 'article', 'app', 'music', 'movie', 'game', 'restaurant', 'recipe', 'hotel', 'course')),
  metadata JSONB DEFAULT '{}',  -- 额外信息: {price, rating, duration, calories, etc.}
  reason TEXT,  -- AI 推荐理由
  clicked BOOLEAN DEFAULT FALSE,
  saved BOOLEAN DEFAULT FALSE,  -- 用户是否收藏
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_recommendation_history_user_id ON recommendation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_category ON recommendation_history(category);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_user_category ON recommendation_history(user_id, category);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_created_at ON recommendation_history(created_at DESC);

-- =============================================
-- 2. 用户偏好表 (User Preferences)
-- =============================================
-- 存储用户在各分类下的偏好标签
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('entertainment', 'shopping', 'food', 'travel', 'fitness')),
  preferences JSONB DEFAULT '{}',  -- 偏好标签和权重: {"科幻": 0.8, "动作": 0.6}
  tags TEXT[] DEFAULT '{}',  -- 用户显式选择的标签
  click_count INTEGER DEFAULT 0,  -- 该分类点击次数
  view_count INTEGER DEFAULT 0,   -- 该分类浏览次数
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON user_preferences(category);

-- =============================================
-- 3. 推荐点击记录表 (Recommendation Clicks)
-- =============================================
-- 记录用户对推荐的点击行为
CREATE TABLE IF NOT EXISTS recommendation_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  recommendation_id UUID REFERENCES recommendation_history(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'click', 'save', 'share', 'dismiss')),
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_recommendation_clicks_user_id ON recommendation_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_clicks_recommendation_id ON recommendation_clicks(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_clicks_action ON recommendation_clicks(action);
CREATE INDEX IF NOT EXISTS idx_recommendation_clicks_clicked_at ON recommendation_clicks(clicked_at DESC);

-- =============================================
-- 4. 推荐缓存表 (Recommendation Cache)
-- =============================================
-- 缓存 AI 生成的推荐，减少 API 调用
CREATE TABLE IF NOT EXISTS recommendation_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('entertainment', 'shopping', 'food', 'travel', 'fitness')),
  preference_hash TEXT NOT NULL,  -- 用户偏好的哈希值，用于匹配相似用户
  recommendations JSONB NOT NULL,  -- 缓存的推荐列表
  expires_at TIMESTAMPTZ NOT NULL,  -- 过期时间
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建唯一约束（用于 upsert 操作）
ALTER TABLE recommendation_cache ADD CONSTRAINT recommendation_cache_category_preference_hash_key
  UNIQUE (category, preference_hash);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_category ON recommendation_cache(category);
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_preference_hash ON recommendation_cache(preference_hash);
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_expires_at ON recommendation_cache(expires_at);

-- =============================================
-- 5. 触发器函数：自动更新 updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要的表添加触发器
DROP TRIGGER IF EXISTS update_recommendation_history_updated_at ON recommendation_history;
CREATE TRIGGER update_recommendation_history_updated_at
  BEFORE UPDATE ON recommendation_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 6. RLS (Row Level Security) 策略
-- =============================================
-- 启用 RLS
ALTER TABLE recommendation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

-- recommendation_history 策略
DROP POLICY IF EXISTS "Users can view own recommendation history" ON recommendation_history;
CREATE POLICY "Users can view own recommendation history"
  ON recommendation_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recommendation history" ON recommendation_history;
CREATE POLICY "Users can insert own recommendation history"
  ON recommendation_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recommendation history" ON recommendation_history;
CREATE POLICY "Users can update own recommendation history"
  ON recommendation_history FOR UPDATE
  USING (auth.uid() = user_id);

-- user_preferences 策略
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- recommendation_clicks 策略
DROP POLICY IF EXISTS "Users can view own clicks" ON recommendation_clicks;
CREATE POLICY "Users can view own clicks"
  ON recommendation_clicks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own clicks" ON recommendation_clicks;
CREATE POLICY "Users can insert own clicks"
  ON recommendation_clicks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- recommendation_cache 策略 (只读)
DROP POLICY IF EXISTS "Anyone can read cache" ON recommendation_cache;
CREATE POLICY "Anyone can read cache"
  ON recommendation_cache FOR SELECT
  USING (true);

-- =============================================
-- 7. 服务角色策略 (用于后端 API)
-- =============================================
-- 为 service_role 创建策略，允许后端 API 完全访问
DROP POLICY IF EXISTS "Service role full access to recommendation_history" ON recommendation_history;
CREATE POLICY "Service role full access to recommendation_history"
  ON recommendation_history FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to user_preferences" ON user_preferences;
CREATE POLICY "Service role full access to user_preferences"
  ON user_preferences FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to recommendation_clicks" ON recommendation_clicks;
CREATE POLICY "Service role full access to recommendation_clicks"
  ON recommendation_clicks FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to recommendation_cache" ON recommendation_cache;
CREATE POLICY "Service role full access to recommendation_cache"
  ON recommendation_cache FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- 8. 辅助函数
-- =============================================

-- 获取用户在某分类的最近推荐历史
CREATE OR REPLACE FUNCTION get_user_recommendation_history(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  title TEXT,
  description TEXT,
  link TEXT,
  link_type TEXT,
  metadata JSONB,
  reason TEXT,
  clicked BOOLEAN,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rh.id,
    rh.category,
    rh.title,
    rh.description,
    rh.link,
    rh.link_type,
    rh.metadata,
    rh.reason,
    rh.clicked,
    rh.created_at
  FROM recommendation_history rh
  WHERE rh.user_id = p_user_id
    AND (p_category IS NULL OR rh.category = p_category)
  ORDER BY rh.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新用户偏好（UPSERT）
CREATE OR REPLACE FUNCTION upsert_user_preferences(
  p_user_id UUID,
  p_category TEXT,
  p_new_preferences JSONB DEFAULT NULL,
  p_new_tags TEXT[] DEFAULT NULL,
  p_increment_click BOOLEAN DEFAULT FALSE,
  p_increment_view BOOLEAN DEFAULT FALSE
)
RETURNS user_preferences AS $$
DECLARE
  result user_preferences;
BEGIN
  INSERT INTO user_preferences (user_id, category, preferences, tags, click_count, view_count, last_activity)
  VALUES (
    p_user_id,
    p_category,
    COALESCE(p_new_preferences, '{}'),
    COALESCE(p_new_tags, '{}'),
    CASE WHEN p_increment_click THEN 1 ELSE 0 END,
    CASE WHEN p_increment_view THEN 1 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (user_id, category)
  DO UPDATE SET
    preferences = CASE
      WHEN p_new_preferences IS NOT NULL THEN p_new_preferences
      ELSE user_preferences.preferences
    END,
    tags = CASE
      WHEN p_new_tags IS NOT NULL THEN p_new_tags
      ELSE user_preferences.tags
    END,
    click_count = CASE
      WHEN p_increment_click THEN user_preferences.click_count + 1
      ELSE user_preferences.click_count
    END,
    view_count = CASE
      WHEN p_increment_view THEN user_preferences.view_count + 1
      ELSE user_preferences.view_count
    END,
    last_activity = NOW(),
    updated_at = NOW()
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 清理过期缓存
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM recommendation_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 9. 示例数据（可选，用于测试）
-- =============================================
-- 如果需要测试数据，取消下面的注释

/*
-- 插入测试用户偏好
INSERT INTO user_preferences (user_id, category, preferences, tags) VALUES
  ('00000000-0000-0000-0000-000000000001', 'entertainment', '{"科幻": 0.9, "动作": 0.7, "游戏": 0.8}', ARRAY['科幻', '游戏']),
  ('00000000-0000-0000-0000-000000000001', 'food', '{"川菜": 0.8, "日料": 0.6}', ARRAY['辣', '面食']),
  ('00000000-0000-0000-0000-000000000001', 'shopping', '{"电子": 0.9, "时尚": 0.5}', ARRAY['数码', '手机']);

-- 插入测试推荐历史
INSERT INTO recommendation_history (user_id, category, title, description, link, link_type, metadata, reason) VALUES
  ('00000000-0000-0000-0000-000000000001', 'entertainment', '三体', '刘慈欣经典科幻小说', 'https://book.douban.com/subject/2567698/', 'book', '{"rating": 9.4, "author": "刘慈欣"}', '基于您对科幻的偏好'),
  ('00000000-0000-0000-0000-000000000001', 'food', '海底捞火锅', '知名连锁火锅品牌', 'https://www.dianping.com/shop/12345', 'restaurant', '{"price": "人均120元", "rating": 4.5}', '基于您对川菜���偏好');
*/

-- =============================================
-- 迁移完成
-- =============================================
