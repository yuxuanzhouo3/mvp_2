-- =============================================
-- 013: AI 助手附近门店数据库
-- 功能：支持 /assistant “附近”场景后端真实门店检索
-- =============================================

CREATE TABLE IF NOT EXISTS assistant_nearby_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL CHECK (region IN ('CN', 'INTL')),
  city TEXT NOT NULL,
  district TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('food', 'fitness', 'travel', 'shopping', 'entertainment', 'local_life')
  ),
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  rating NUMERIC(2,1),
  price_range TEXT,
  business_hours TEXT,
  estimated_time TEXT,
  phone TEXT,
  platform TEXT,
  search_query TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistant_nearby_region_active
  ON assistant_nearby_stores(region, is_active);

CREATE INDEX IF NOT EXISTS idx_assistant_nearby_region_category
  ON assistant_nearby_stores(region, category);

CREATE INDEX IF NOT EXISTS idx_assistant_nearby_city_district
  ON assistant_nearby_stores(city, district);

CREATE INDEX IF NOT EXISTS idx_assistant_nearby_location
  ON assistant_nearby_stores(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_assistant_nearby_tags
  ON assistant_nearby_stores USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_assistant_nearby_metadata
  ON assistant_nearby_stores USING GIN(metadata);

ALTER TABLE assistant_nearby_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role access assistant_nearby_stores" ON assistant_nearby_stores;

CREATE POLICY "Service role access assistant_nearby_stores" ON assistant_nearby_stores
  FOR ALL USING (auth.role() = 'service_role');

