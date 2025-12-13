/**
 * Supabase 用户数据库适配器
 * 
 * 实现 UserDatabaseAdapter 接口，用于 INTL 环境
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  UserDatabaseAdapter,
  User,
  UserSubscription,
  Payment,
  QueryOptions,
  QueryResult,
  SingleResult,
  MutationResult,
} from '../types';

// Supabase 客户端缓存
let supabaseInstance: SupabaseClient | null = null;

/**
 * 获取 Supabase 服务端客户端
 */
function getServiceClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase configuration');
  }

  supabaseInstance = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
}

/**
 * Supabase 用户数据库适配器实现
 */
export class SupabaseUserAdapter implements UserDatabaseAdapter {
  private get supabase() {
    return getServiceClient();
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(userId: string): Promise<SingleResult<User>> {
    try {
      // 首先从 auth.users 获取基本信息
      const { data: authData, error: authError } = await this.supabase.auth.admin.getUserById(userId);

      if (authError || !authData.user) {
        // 尝试从 user_profiles 表获取
        const { data: profileData, error: profileError } = await this.supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profileError || !profileData) {
          return { data: null, error: new Error('User not found') };
        }

        return {
          data: {
            id: profileData.id,
            email: profileData.email,
            name: profileData.full_name,
            subscription_plan: profileData.subscription_tier,
            subscription_status: profileData.subscription_status,
            created_at: profileData.created_at,
            updated_at: profileData.updated_at,
          },
          error: null,
        };
      }

      // 获取额外的用户资料信息
      const { data: profileData } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      return {
        data: {
          id: authData.user.id,
          email: authData.user.email || '',
          name: authData.user.user_metadata?.name || profileData?.full_name,
          avatar: authData.user.user_metadata?.avatar_url,
          subscription_plan: profileData?.subscription_tier || 'free',
          subscription_status: profileData?.subscription_status || 'active',
          created_at: authData.user.created_at,
          updated_at: profileData?.updated_at,
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * 根据邮箱获取用户
   */
  async getUserByEmail(email: string): Promise<SingleResult<User>> {
    try {
      // 从 user_profiles 表查找
      const { data: profileData, error: profileError } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (profileError || !profileData) {
        return { data: null, error: null }; // 用户不存在
      }

      return {
        data: {
          id: profileData.id,
          email: profileData.email,
          name: profileData.full_name,
          subscription_plan: profileData.subscription_tier,
          subscription_status: profileData.subscription_status,
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * 创建用户（通常由认证系统自动处理）
   */
  async createUser(
    user: Omit<User, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MutationResult> {
    try {
      // Supabase 用户创建通常通过 auth.signUp 完成
      // 这里只创建 user_profiles 记录
      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert({
          email: user.email,
          full_name: user.name,
          subscription_tier: user.subscription_plan || 'free',
          subscription_status: user.subscription_status || 'active',
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, id: data?.id };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 更新用户
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<MutationResult> {
    try {
      const updateData: any = {};

      if (updates.name !== undefined) updateData.full_name = updates.name;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.subscription_plan !== undefined) updateData.subscription_tier = updates.subscription_plan;
      if (updates.subscription_status !== undefined) updateData.subscription_status = updates.subscription_status;

      const { error } = await this.supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, id: userId };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 获取用户活跃订阅
   */
  async getActiveSubscription(userId: string): Promise<SingleResult<UserSubscription>> {
    try {
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('subscription_end', new Date().toISOString())
        .order('subscription_end', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return { data: null, error: null }; // 没有活跃订阅
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * 创建订阅
   */
  async createSubscription(
    subscription: Omit<UserSubscription, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MutationResult> {
    try {
      const { data, error } = await this.supabase
        .from('user_subscriptions')
        .insert(subscription)
        .select('id')
        .single();

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      // 同时更新用户资料
      await this.supabase
        .from('user_profiles')
        .update({
          subscription_tier: subscription.plan_type,
          subscription_status: subscription.status,
        })
        .eq('id', subscription.user_id);

      return { success: true, id: data?.id };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 更新订阅
   */
  async updateSubscription(
    subscriptionId: string,
    updates: Partial<UserSubscription>
  ): Promise<MutationResult> {
    try {
      // 获取订阅信息以获取 user_id
      const { data: subscription } = await this.supabase
        .from('user_subscriptions')
        .select('user_id')
        .eq('id', subscriptionId)
        .single();

      const { error } = await this.supabase
        .from('user_subscriptions')
        .update(updates)
        .eq('id', subscriptionId);

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      // 如果状态或计划类型更改，同时更新用户资料
      if (subscription && (updates.status || updates.plan_type)) {
        const profileUpdates: any = {};
        if (updates.status) profileUpdates.subscription_status = updates.status;
        if (updates.plan_type) profileUpdates.subscription_tier = updates.plan_type;

        await this.supabase
          .from('user_profiles')
          .update(profileUpdates)
          .eq('id', subscription.user_id);
      }

      return { success: true, id: subscriptionId };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 获取支付历史
   */
  async getPaymentHistory(
    userId: string,
    options: QueryOptions = {}
  ): Promise<QueryResult<Payment>> {
    try {
      const { limit = 20, offset = 0 } = options;

      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: data || [], error: null, count: data?.length || 0 };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  }

  /**
   * 创建支付记录
   */
  async createPayment(
    payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MutationResult> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .insert(payment)
        .select('id')
        .single();

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, id: data?.id };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * 更新支付记录
   */
  async updatePayment(
    paymentId: string,
    updates: Partial<Payment>
  ): Promise<MutationResult> {
    try {
      const { error } = await this.supabase
        .from('payments')
        .update(updates)
        .eq('id', paymentId);

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, id: paymentId };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
}

