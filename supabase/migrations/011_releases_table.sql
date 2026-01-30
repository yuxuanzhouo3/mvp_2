CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version TEXT NOT NULL,
  platform TEXT NOT NULL,
  arch TEXT,
  file_name TEXT,
  file_size BIGINT,
  sha256 TEXT,
  storage_ref TEXT NOT NULL,
  active BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_releases_created_at
  ON public.releases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_releases_platform
  ON public.releases(platform);
CREATE INDEX IF NOT EXISTS idx_releases_platform_arch_active
  ON public.releases(platform, arch, active);

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access releases" ON public.releases;
CREATE POLICY "Service role full access releases"
  ON public.releases FOR ALL
  USING (auth.role() = 'service_role');

