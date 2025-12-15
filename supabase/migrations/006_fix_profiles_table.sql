-- =============================================
-- Fix Profiles Table Migration
-- 修复 Profiles 表迁移脚本
-- =============================================

-- This migration creates the missing 'profiles' table that Supabase Auth expects
-- 此迁移创建 Supabase Auth 期望的 'profiles' 表

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Create profiles table for Supabase Auth
-- 为 Supabase Auth 创建 profiles 表
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'active',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles (subscription_tier);

-- 触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- RLS (Row Level Security) 策略
-- =============================================
-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR
  SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR
  UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR
  INSERT WITH CHECK (auth.uid() = id);

-- 服务角色策略
DROP POLICY IF EXISTS "Service role full access to profiles" ON profiles;
CREATE POLICY "Service role full access to profiles" ON profiles FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- 数据迁移：从 user_profiles 迁移数据到 profiles
-- =============================================
-- 迁移现有数据（如果 user_profiles 表存在）
DO $$
BEGIN
    -- 检查 user_profiles 表是否存在
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        -- 迁移数据
        INSERT INTO profiles (id, email, full_name, subscription_tier, subscription_status)
        SELECT id, email, full_name, subscription_tier, subscription_status
        FROM user_profiles
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            subscription_tier = EXCLUDED.subscription_tier,
            subscription_status = EXCLUDED.subscription_status;

        RAISE NOTICE 'Data migrated from user_profiles to profiles table';
    ELSE
        RAISE NOTICE 'user_profiles table not found, creating empty profiles table';
    END IF;
END $$;

-- 创建实时更新函数（用于 Supabase Realtime）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 触发器：当新用户注册时自动创建 profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();