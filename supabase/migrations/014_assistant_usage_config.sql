-- =============================================
-- 014: AI assistant usage config
-- Allows admin to configure free and VIP usage limits.
-- =============================================

CREATE TABLE IF NOT EXISTS assistant_usage_config (
  id TEXT PRIMARY KEY,
  free_total INTEGER NOT NULL DEFAULT 3 CHECK (free_total >= 0),
  vip_daily_limit INTEGER NOT NULL DEFAULT 10 CHECK (vip_daily_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO assistant_usage_config (id, free_total, vip_daily_limit)
VALUES ('global', 3, 10)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE assistant_usage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access assistant_usage_config" ON assistant_usage_config;

CREATE POLICY "Service role access assistant_usage_config" ON assistant_usage_config
  FOR ALL USING (auth.role() = 'service_role');

