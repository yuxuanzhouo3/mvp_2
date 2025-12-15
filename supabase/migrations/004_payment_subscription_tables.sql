-- =============================================
-- 支付与订阅系统数据库迁移脚本
-- Payment and Subscription System Database Migration
-- =============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. 用户订阅表 (User Subscriptions)
-- =============================================
-- 存储用户订阅状态和到期时间
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL,
    subscription_end TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active' CHECK (
        status IN (
            'active',
            'expired',
            'cancelled'
        )
    ),
    plan_type TEXT DEFAULT 'pro', -- pro, enterprise
    currency TEXT DEFAULT 'USD',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_end ON user_subscriptions (subscription_end);

-- =============================================
-- 2. 支付记录表 (Payments)
-- =============================================
-- 存储所有支付交易记录
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'completed',
            'failed',
            'cancelled',
            'refunded'
        )
    ),
    payment_method TEXT CHECK (
        payment_method IN ('stripe', 'paypal')
    ),
    transaction_id TEXT,
    subscription_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);

CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments (transaction_id);

CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments (subscription_id);

CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_metadata ON payments USING gin (metadata);

-- =============================================
-- 3. 传统订阅表 (Legacy Subscriptions - 可选)
-- =============================================
-- 保留与源项目的兼容性
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    user_id UUID NOT NULL,
    plan_id TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (
        status IN (
            'active',
            'canceled',
            'past_due',
            'unpaid'
        )
    ),
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);

-- =============================================
-- 4. 用户资料表扩展 (User Profiles Enhancement)
-- =============================================
-- 为现有的 auth.users 添加额外信息
-- 注意：Supabase 默认使用 auth.users，我们在这里添加一个扩展表

-- 检查是否已存在 user_profiles 表，如果不存在则创建
DO $$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
      CREATE TABLE user_profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        email TEXT,
        full_name TEXT,
        subscription_tier TEXT DEFAULT 'free',
        subscription_status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

-- 创建索引
CREATE INDEX idx_user_profiles_email ON user_profiles (email);

CREATE INDEX idx_user_profiles_subscription_tier ON user_profiles (subscription_tier);

END IF;

END $$;

-- =============================================
-- 5. 触发器：自动更新时间戳
-- =============================================

-- 为 user_subscriptions 添加触发器
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;

CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 payments 添加触发器
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 subscriptions 添加触发器
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 user_profiles 添加触发器（如果存在）
DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
      EXECUTE 'DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles';
      EXECUTE 'CREATE TRIGGER update_user_profiles_updated_at
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()';
    END IF;
  END $$;

-- =============================================
-- 6. RLS (Row Level Security) 策略
-- =============================================

-- 启用 RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- user_subscriptions 策略
DROP POLICY IF EXISTS "Users can view own subscriptions" ON user_subscriptions;

CREATE POLICY "Users can view own subscriptions" ON user_subscriptions FOR
SELECT USING (auth.uid () = user_id);

DROP POLICY IF EXISTS "Users can insert own subscriptions" ON user_subscriptions;

CREATE POLICY "Users can insert own subscriptions" ON user_subscriptions FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON user_subscriptions;

CREATE POLICY "Users can update own subscriptions" ON user_subscriptions FOR
UPDATE USING (auth.uid () = user_id);

-- payments 策略
DROP POLICY IF EXISTS "Users can view own payments" ON payments;

CREATE POLICY "Users can view own payments" ON payments FOR
SELECT USING (auth.uid () = user_id);

DROP POLICY IF EXISTS "Users can insert own payments" ON payments;

CREATE POLICY "Users can insert own payments" ON payments FOR
INSERT
WITH
    CHECK (auth.uid () = user_id);

DROP POLICY IF EXISTS "Users can update own payments" ON payments;

CREATE POLICY "Users can update own payments" ON payments FOR
UPDATE USING (auth.uid () = user_id);

-- subscriptions 策略（传统表）
DROP POLICY IF EXISTS "Users can view own legacy subscriptions" ON subscriptions;

CREATE POLICY "Users can view own legacy subscriptions" ON subscriptions FOR
SELECT USING (auth.uid () = user_id);

-- user_profiles 策略（如果存在）
DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
      EXECUTE 'DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles';
      EXECUTE 'CREATE POLICY "Users can view own profile"
        ON user_profiles FOR SELECT
        USING (auth.uid() = id)';

      EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles';
      EXECUTE 'CREATE POLICY "Users can update own profile"
        ON user_profiles FOR UPDATE
        USING (auth.uid() = id)';

      EXECUTE 'DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles';
      EXECUTE 'CREATE POLICY "Users can insert own profile"
        ON user_profiles FOR INSERT
        WITH CHECK (auth.uid() = id)';
    END IF;
  END $$;

  -- =============================================
  -- 7. 服务角色策略 (Service Role Policies)
  -- =============================================
  -- 允许后端 API 完全访问

  DROP POLICY IF EXISTS "Service role full access to user_subscriptions" ON user_subscriptions;
  CREATE POLICY "Service role full access to user_subscriptions"
    ON user_subscriptions FOR ALL
    USING (auth.role() = 'service_role');

  DROP POLICY IF EXISTS "Service role full access to payments" ON payments;
  CREATE POLICY "Service role full access to payments"
    ON payments FOR ALL
    USING (auth.role() = 'service_role');

  DROP POLICY IF EXISTS "Service role full access to subscriptions" ON subscriptions;
  CREATE POLICY "Service role full access to subscriptions"
    ON subscriptions FOR ALL
    USING (auth.role() = 'service_role');

  -- user_profiles 服务角色策略（如果存在）
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
      EXECUTE 'DROP POLICY IF EXISTS "Service role full access to user_profiles" ON user_profiles';
      EXECUTE 'CREATE POLICY "Service role full access to user_profiles"
        ON user_profiles FOR ALL
        USING (auth.role() = 'service_role')';
    END IF;
  END $$;

  -- =============================================
  -- 8. 辅助函数 (Helper Functions)
  -- =============================================

  -- 获取用户当前活跃订阅
  CREATE OR REPLACE FUNCTION get_user_active_subscription(p_user_id UUID)
  RETURNS user_subscriptions AS $$
  DECLARE
    result user_subscriptions;
  BEGIN
    SELECT * INTO result
    FROM user_subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND subscription_end > NOW()
    ORDER BY subscription_end DESC
    LIMIT 1;

    RETURN result;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 检查用户是否有活跃订阅
CREATE OR REPLACE FUNCTION is_user_subscribed(p_user_id UUID)
  RETURNS BOOLEAN AS $$
  DECLARE
    subscription user_subscriptions;
  BEGIN
    SELECT * INTO subscription
    FROM get_user_active_subscription(p_user_id);

    RETURN subscription.id IS NOT NULL;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取用户支付历史
CREATE OR REPLACE FUNCTION get_user_payments(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
  )
  RETURNS TABLE (
    id UUID,
    amount DECIMAL(10,2),
    currency TEXT,
    status TEXT,
    payment_method TEXT,
    transaction_id TEXT,
    created_at TIMESTAMPTZ,
    metadata JSONB
  ) AS $$
  BEGIN
    RETURN QUERY
    SELECT
      p.id,
      p.amount,
      p.currency,
      p.status,
      p.payment_method,
      p.transaction_id,
      p.created_at,
      p.metadata
    FROM payments p
    WHERE p.user_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 9. 示例数据 (Optional - for testing)
-- =============================================

/*
-- 取消注释下面的代码来插入测试数据

-- 插入测试用户订阅
INSERT INTO user_subscriptions (user_id, subscription_end, plan_type, currency) VALUES
('00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '30 days', 'pro', 'USD'),
('00000000-0000-0000-0000-000000000002', NOW() + INTERVAL '365 days', 'enterprise', 'USD');

-- 插入测试支付记录
INSERT INTO payments (user_id, amount, currency, status, payment_method, transaction_id, metadata) VALUES
('00000000-0000-0000-0000-000000000001', 9.99, 'USD', 'completed', 'stripe', 'pi_test_1234567890', '{"billingCycle": "monthly", "planType": "pro"}'),
('00000000-0000-0000-0000-000000000002', 99.99, 'USD', 'completed', 'paypal', 'PAYID-TEST-1234567890', '{"billingCycle": "yearly", "planType": "pro"}');

-- 插入测试用户资料（如果表存在）
DO $$
BEGIN
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
INSERT INTO user_profiles (id, email, subscription_tier) VALUES
('00000000-0000-0000-0000-000000000001', 'test@example.com', 'pro'),
('00000000-0000-0000-0000-000000000002', 'enterprise@example.com', 'enterprise')
ON CONFLICT (id) DO NOTHING;
END IF;
END $$;
*/

-- =============================================
-- 迁移完成
-- =============================================