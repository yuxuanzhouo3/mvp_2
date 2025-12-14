-- =============================================
-- 添加数据库约束
-- Add database constraints
-- =============================================

-- =============================================
-- 1. payments 表 - 添加 transaction_id 唯一约束
-- =============================================

-- 首先删除可能存在的重复记录（保留最新的）
DELETE FROM payments a USING payments b
WHERE a.id < b.id
AND a.transaction_id = b.transaction_id
AND a.transaction_id IS NOT NULL;

-- 添加唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_transaction_id_unique'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_transaction_id_unique UNIQUE (transaction_id);
  END IF;
END $$;

-- 创建部分索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id_not_null 
ON payments(transaction_id) 
WHERE transaction_id IS NOT NULL;

-- =============================================
-- 2. user_subscriptions 表 - 添加 user_id 唯一约束
-- =============================================

-- 首先删除可能存在的重复记录（保留最新的）
DELETE FROM user_subscriptions a USING user_subscriptions b
WHERE a.created_at < b.created_at
AND a.user_id = b.user_id;

-- 添加唯一约束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_user_id_unique'
  ) THEN
    ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

