/**
 * 数据库适配器统一入口
 * 
 * 根据部署区域自动选择正确的数据库适配器
 * 支持 Supabase (INTL) 和 CloudBase (CN)
 */

import { isChinaDeployment } from '@/lib/config/deployment.config';
import type {
  DatabaseAdapter,
  RecommendationDatabaseAdapter,
  UserDatabaseAdapter,
} from './types';

// 导出所有类型
export * from './types';

// 适配器实例缓存
let databaseAdapterInstance: DatabaseAdapter | null = null;

/**
 * 获取推荐系统数据库适配器
 * 
 * 根据部署区域返回对应的适配器实例
 */
export async function getRecommendationAdapter(): Promise<RecommendationDatabaseAdapter> {
  if (isChinaDeployment()) {
    const { CloudBaseRecommendationAdapter } = await import('./adapters/cloudbase-recommendation');
    return new CloudBaseRecommendationAdapter();
  } else {
    const { SupabaseRecommendationAdapter } = await import('./adapters/supabase-recommendation');
    return new SupabaseRecommendationAdapter();
  }
}

/**
 * 获取用户数据库适配器
 * 
 * 根据部署区域返回对应的适配器实例
 */
export async function getUserAdapter(): Promise<UserDatabaseAdapter> {
  if (isChinaDeployment()) {
    const { CloudBaseUserAdapter } = await import('./adapters/cloudbase-user');
    return new CloudBaseUserAdapter();
  } else {
    const { SupabaseUserAdapter } = await import('./adapters/supabase-user');
    return new SupabaseUserAdapter();
  }
}

/**
 * 获取统一数据库适配器
 * 
 * 提供对所有数据库操作的统一访问接口
 * 使用单例模式，确保整个应用只使用一个适配器实例
 */
export async function getDatabaseAdapter(): Promise<DatabaseAdapter> {
  if (databaseAdapterInstance) {
    return databaseAdapterInstance;
  }

  const recommendation = await getRecommendationAdapter();
  const user = await getUserAdapter();
  const provider = isChinaDeployment() ? 'cloudbase' : 'supabase';

  databaseAdapterInstance = {
    recommendation,
    user,
    getProvider: () => provider,
  };

  return databaseAdapterInstance;
}

/**
 * 重置数据库适配器（用于测试）
 */
export function resetDatabaseAdapter(): void {
  databaseAdapterInstance = null;
}

/**
 * 数据库健康检查
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  provider: 'supabase' | 'cloudbase';
  message: string;
}> {
  try {
    const adapter = await getDatabaseAdapter();
    const provider = adapter.getProvider();

    if (provider === 'cloudbase') {
      const { checkCloudBaseConnection } = await import('./cloudbase-client');
      const connected = await checkCloudBaseConnection();
      return {
        healthy: connected,
        provider,
        message: connected ? 'CloudBase connection successful' : 'CloudBase connection failed',
      };
    } else {
      // Supabase 健康检查
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        return {
          healthy: false,
          provider,
          message: 'Missing Supabase environment variables',
        };
      }

      const supabase = createClient(supabaseUrl, anonKey);
      const { error } = await supabase.from('recommendation_history').select('count').limit(1);

      return {
        healthy: !error,
        provider,
        message: error ? `Supabase error: ${error.message}` : 'Supabase connection successful',
      };
    }
  } catch (error) {
    return {
      healthy: false,
      provider: isChinaDeployment() ? 'cloudbase' : 'supabase',
      message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * 便捷函数：直接获取数据库操作对象
 */
export const db = {
  /**
   * 获取推荐系统数据库操作
   */
  get recommendation() {
    return getRecommendationAdapter();
  },

  /**
   * 获取用户数据库操作
   */
  get user() {
    return getUserAdapter();
  },

  /**
   * 获取当前数据库提供商
   */
  getProvider(): 'supabase' | 'cloudbase' {
    return isChinaDeployment() ? 'cloudbase' : 'supabase';
  },

  /**
   * 是否使用 Supabase
   */
  isSupabase(): boolean {
    return !isChinaDeployment();
  },

  /**
   * 是否使用 CloudBase
   */
  isCloudBase(): boolean {
    return isChinaDeployment();
  },
};

