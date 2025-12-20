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
  RECOMMENDATION_USAGE: 'recommendation_usage',

  // 用户反馈相关
  USER_FEEDBACKS: 'user_feedbacks',

  // 用户 Onboarding 相关
  ONBOARDING_PROGRESS: 'onboarding_progress',

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
 * 对于CN环境，返回北京时间（UTC+8）
 */
export function nowISO(): string {
  const now = new Date();
  // 获取北京时间（UTC+8）
  const beijingOffset = 8 * 60; // 8小时转分钟
  const utcOffset = now.getTimezoneOffset(); // 本地时区与UTC的差值（分钟）
  const beijingTime = new Date(now.getTime() + (beijingOffset + utcOffset) * 60 * 1000);
  return beijingTime.toISOString();
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

/**
 * 判断错误是否为可重试的网络错误
 */
function isRetryableError(error: any): boolean {
  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'];
  return retryableCodes.includes(error?.code) ||
         error?.message?.includes('socket disconnected') ||
         error?.message?.includes('network');
}

/**
 * 带重试机制的 CloudBase 操作执行器
 * @param operation 要执行的异步操作
 * @param operationName 操作名称（用于日志）
 * @param maxRetries 最大重试次数，默认 3
 * @param baseDelay 基础延迟时间（毫秒），默认 500ms
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // 如果不是可重试的错误，直接抛出
      if (!isRetryableError(error)) {
        throw error;
      }

      // 如果是最后一次尝试，抛出错误
      if (attempt === maxRetries) {
        console.error(`[CloudBase] ${operationName} 失败，已重试 ${maxRetries} 次:`, error.message);
        throw error;
      }

      // 指数退避延迟
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`[CloudBase] ${operationName} 第 ${attempt} 次失败 (${error.code || error.message})，${delay}ms 后重试...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

