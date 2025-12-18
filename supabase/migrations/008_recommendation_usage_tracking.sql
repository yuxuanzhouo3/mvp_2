-- Migration: 008_recommendation_usage_tracking
-- Description: Add recommendation usage tracking table for subscription limits

-- Create recommendation_usage table
CREATE TABLE IF NOT EXISTS recommendation_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_recommendation_usage_user_id ON recommendation_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_usage_created_at ON recommendation_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_recommendation_usage_user_period ON recommendation_usage(user_id, created_at);

-- Enable RLS
ALTER TABLE recommendation_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own usage"
  ON recommendation_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert usage"
  ON recommendation_usage FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can manage all"
  ON recommendation_usage FOR ALL
  USING (auth.role() = 'service_role');

-- Add plan_type column to user_subscriptions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'plan_type'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN plan_type TEXT DEFAULT 'pro';
  END IF;
END $$;

-- Create recommendations table for storing recommendation history
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT,
  recommendation JSONB NOT NULL,
  reason JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_category ON recommendations(user_id, category);

-- Enable RLS for recommendations
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies for recommendations
CREATE POLICY "Users can view own recommendations"
  ON recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert recommendations"
  ON recommendations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can manage all recommendations"
  ON recommendations FOR ALL
  USING (auth.role() = 'service_role');

-- Function to clean up old recommendation history based on plan
CREATE OR REPLACE FUNCTION cleanup_old_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  retention_days INTEGER;
  cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Loop through each user
  FOR user_record IN
    SELECT DISTINCT r.user_id,
      COALESCE(
        (SELECT plan_type FROM user_subscriptions
         WHERE user_id = r.user_id
         AND status = 'active'
         AND subscription_end > NOW()
         ORDER BY created_at DESC LIMIT 1),
        'free'
      ) as plan_type
    FROM recommendations r
  LOOP
    -- Determine retention days based on plan
    CASE user_record.plan_type
      WHEN 'enterprise' THEN retention_days := 365;
      WHEN 'pro' THEN retention_days := 90;
      ELSE retention_days := 7;
    END CASE;

    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;

    -- Delete old recommendations
    DELETE FROM recommendations
    WHERE user_id = user_record.user_id
    AND created_at < cutoff_date;
  END LOOP;
END;
$$;

-- Comment on the cleanup function
COMMENT ON FUNCTION cleanup_old_recommendations IS 'Cleans up old recommendation history based on user subscription plan retention limits';

