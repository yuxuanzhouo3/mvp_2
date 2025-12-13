/**
 * CloudBase 数据库客户端封装
 * 
 * 提供 CloudBase 文档型数据库的客户端初始化和基础操作
 */

import cloudbase from '@cloudbase/node-sdk';

// CloudBase 应用实例缓存
let cachedApp: ReturnType<typeof cloudbase.init> | null = null;

/**
 * 初始化并获取 CloudBase 应用实例
 */
export function getCloudBaseApp() {
  if (cachedApp) {
    return cachedApp;
  }

  const envId = process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID;
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;

  if (!envId) {
    throw new Error('Missing NEXT_PUBLIC_WECHAT_CLOUDBASE_ID environment variable');
  }

  if (!secretId || !secretKey) {
    throw new Error('Missing CLOUDBASE_SECRET_ID or CLOUDBASE_SECRET_KEY environment variables');
  }

  cachedApp = cloudbase.init({
    env: envId,
    secretId,
    secretKey,
  });

  return cachedApp;
}

/**
 * 获取 CloudBase 数据库实例
 */
export function getCloudBaseDatabase() {
  const app = getCloudBaseApp();
  return app.database();
}

/**
 * 获取指定集合
 */
export function getCollection(collectionName: string) {
  const db = getCloudBaseDatabase();
  return db.collection(collectionName);
}

/**
 * CloudBase 集合名称常量
 */
export const CloudBaseCollections = {
  // 用户相关
  USERS: 'users',
  USER_PROFILES: 'user_profiles',
  
  // 推荐系统相关
  RECOMMENDATION_HISTORY: 'recommendation_history',
  USER_PREFERENCES: 'user_preferences',
  RECOMMENDATION_CLICKS: 'recommendation_clicks',
  RECOMMENDATION_CACHE: 'recommendation_cache',
  
  // 订阅和支付相关
  USER_SUBSCRIPTIONS: 'user_subscriptions',
  PAYMENTS: 'payments',
  SUBSCRIPTIONS: 'subscriptions',
} as const;

/**
 * 生成唯一 ID（模拟 UUID）
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 获取当前 ISO 时间字符串
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * CloudBase 数据库命令对象
 * 用于复杂查询操作
 */
export function getDbCommand() {
  const db = getCloudBaseDatabase();
  return db.command;
}

/**
 * 检查 CloudBase 连接是否正常
 */
export async function checkCloudBaseConnection(): Promise<boolean> {
  try {
    const db = getCloudBaseDatabase();
    // 尝试获取一个集合的信息
    await db.collection(CloudBaseCollections.USERS).count();
    return true;
  } catch (error) {
    console.error('[CloudBase] Connection check failed:', error);
    return false;
  }
}

/**
 * CloudBase 错误处理辅助函数
 */
export function handleCloudBaseError(error: any, operation: string): Error {
  console.error(`[CloudBase] ${operation} failed:`, error);
  
  if (error.code === 'DATABASE_COLLECTION_NOT_EXIST') {
    return new Error(`Collection does not exist. Please run the initialization script.`);
  }
  
  if (error.code === 'PERMISSION_DENIED') {
    return new Error('Permission denied. Check your CloudBase credentials.');
  }
  
  return error instanceof Error ? error : new Error(String(error));
}

