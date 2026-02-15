-- =============================================
-- 015: free assistant limits (daily + monthly)
-- Adds free_daily_limit and free_monthly_limit.
-- =============================================

CREATE TABLE IF NOT EXISTS assistant_usage_config (
  id TEXT PRIMARY KEY,
  free_total INTEGER NOT NULL DEFAULT 23 CHECK (free_total >= 0),
  free_daily_limit INTEGER NOT NULL DEFAULT 6 CHECK (free_daily_limit >= 0),
  free_monthly_limit INTEGER NOT NULL DEFAULT 23 CHECK (free_monthly_limit >= 0),
  vip_daily_limit INTEGER NOT NULL DEFAULT 10 CHECK (vip_daily_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE assistant_usage_config
  ADD COLUMN IF NOT EXISTS free_daily_limit INTEGER,
  ADD COLUMN IF NOT EXISTS free_monthly_limit INTEGER;

UPDATE assistant_usage_config
SET
  free_daily_limit = COALESCE(free_daily_limit, 6),
  free_monthly_limit = COALESCE(free_monthly_limit, 23),
  free_total = COALESCE(free_monthly_limit, 23),
  updated_at = NOW();

ALTER TABLE assistant_usage_config
  ALTER COLUMN free_daily_limit SET DEFAULT 6,
  ALTER COLUMN free_monthly_limit SET DEFAULT 23;

ALTER TABLE assistant_usage_config
  ALTER COLUMN free_daily_limit SET NOT NULL,
  ALTER COLUMN free_monthly_limit SET NOT NULL;

ALTER TABLE assistant_usage_config
  DROP CONSTRAINT IF EXISTS assistant_usage_config_free_daily_limit_check,
  DROP CONSTRAINT IF EXISTS assistant_usage_config_free_monthly_limit_check;

ALTER TABLE assistant_usage_config
  ADD CONSTRAINT assistant_usage_config_free_daily_limit_check CHECK (free_daily_limit >= 0),
  ADD CONSTRAINT assistant_usage_config_free_monthly_limit_check CHECK (free_monthly_limit >= 0);

INSERT INTO assistant_usage_config (
  id,
  free_total,
  free_daily_limit,
  free_monthly_limit,
  vip_daily_limit
)
VALUES ('global', 23, 6, 23, 10)
ON CONFLICT (id) DO UPDATE
SET
  free_daily_limit = COALESCE(assistant_usage_config.free_daily_limit, EXCLUDED.free_daily_limit),
  free_monthly_limit = COALESCE(assistant_usage_config.free_monthly_limit, EXCLUDED.free_monthly_limit),
  free_total = COALESCE(assistant_usage_config.free_total, EXCLUDED.free_total),
  vip_daily_limit = COALESCE(assistant_usage_config.vip_daily_limit, EXCLUDED.vip_daily_limit),
  updated_at = NOW();

ALTER TABLE assistant_usage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access assistant_usage_config" ON assistant_usage_config;

CREATE POLICY "Service role access assistant_usage_config" ON assistant_usage_config
  FOR ALL USING (auth.role() = 'service_role');
