/**
 * CloudBase 用户数据库适配器
 * 
 * 实现 UserDatabaseAdapter 接口，用于 CN 环境
 */

import {
  getCloudBaseDatabase,
  CloudBaseCollections,
  nowISO,
  getDbCommand,
  handleCloudBaseError,
} from '../cloudbase-client';
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

/**
 * CloudBase 用户数据库适配器实现
 */
export class CloudBaseUserAdapter implements UserDatabaseAdapter {
  private get db() {
    return getCloudBaseDatabase();
  }

  private get cmd() {
    return getDbCommand();
  }

  /**
   * 根据 ID 获取用户
   */
  async getUserById(userId: string): Promise<SingleResult<User>> {
    try {
      const collection = this.db.collection(CloudBaseCollections.USERS);

      const result = await collection.doc(userId).get();

      if (!result.data || result.data.length === 0) {
        return { data: null, error: null }; // 用户不存在
      }

      const userData = result.data[0] || result.data;

      return {
        data: {
          id: userData._id || userId,
          email: userData.email,
          name: userData.name,
          avatar: userData.avatar,
          subscription_plan: userData.subscription_plan || 'free',
          subscription_status: userData.subscription_status || 'active',
          region: 'china',
          created_at: userData.createdAt || userData.created_at,
          updated_at: userData.updatedAt || userData.updated_at,
        },
        error: null,
      };
    } catch (error) {
      return { 
        data: null, 
        error: handleCloudBaseError(error, 'getUserById') 
      };
    }
  }

  /**
   * 根据邮箱获取用户
   */
  async getUserByEmail(email: string): Promise<SingleResult<User>> {
    try {
      const collection = this.db.collection(CloudBaseCollections.USERS);

      const result = await collection.where({ email }).get();

      if (!result.data || result.data.length === 0) {
        return { data: null, error: null }; // 用户不存在
      }

      const userData = result.data[0];

      return {
        data: {
          id: userData._id,
          email: userData.email,
          name: userData.name,
          avatar: userData.avatar,
          subscription_plan: userData.subscription_plan || 'free',
          subscription_status: userData.subscription_status || 'active',
          region: 'china',
          created_at: userData.createdAt || userData.created_at,
          updated_at: userData.updatedAt || userData.updated_at,
        },
        error: null,
      };
    } catch (error) {
      return { 
        data: null, 
        error: handleCloudBaseError(error, 'getUserByEmail') 
      };
    }
  }

  /**
   * 创建用户
   */
  async createUser(
    user: Omit<User, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MutationResult> {
    try {
      const collection = this.db.collection(CloudBaseCollections.USERS);
      const now = nowISO();

      const newUser = {
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        subscription_plan: user.subscription_plan || 'free',
        subscription_status: user.subscription_status || 'active',
        region: 'china',
        createdAt: now,
        updatedAt: now,
      };

      const result = await collection.add(newUser);

      return { success: true, id: result.id };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'createUser') 
      };
    }
  }

  /**
   * 更新用户
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<MutationResult> {
    try {
      const collection = this.db.collection(CloudBaseCollections.USERS);

      const updateData: any = {
        updatedAt: nowISO(),
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
      if (updates.subscription_plan !== undefined) updateData.subscription_plan = updates.subscription_plan;
      if (updates.subscription_status !== undefined) updateData.subscription_status = updates.subscription_status;

      await collection.doc(userId).update(updateData);

      return { success: true, id: userId };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'updateUser') 
      };
    }
  }

  /**
   * 获取用户活跃订阅
   */
  async getActiveSubscription(userId: string): Promise<SingleResult<UserSubscription>> {
    try {
      const collection = this.db.collection(CloudBaseCollections.USER_SUBSCRIPTIONS);
      const now = nowISO();

      const result = await collection
        .where({
          user_id: userId,
          status: 'active',
          subscription_end: this.cmd.gt(now),
        })
        .orderBy('subscription_end', 'desc')
        .limit(1)
        .get();

      if (!result.data || result.data.length === 0) {
        return { data: null, error: null }; // 没有活跃订阅
      }

      const subscription = result.data[0];

      return {
        data: {
          id: subscription._id,
          user_id: subscription.user_id,
          subscription_end: subscription.subscription_end,
          status: subscription.status,
          plan_type: subscription.plan_type,
          currency: subscription.currency,
          created_at: subscription.created_at,
          updated_at: subscription.updated_at,
        },
        error: null,
      };
    } catch (error) {
      return { 
        data: null, 
        error: handleCloudBaseError(error, 'getActiveSubscription') 
      };
    }
  }

  /**
   * 创建订阅
   */
  async createSubscription(
    subscription: Omit<UserSubscription, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MutationResult> {
    try {
      const collection = this.db.collection(CloudBaseCollections.USER_SUBSCRIPTIONS);
      const now = nowISO();

      const newSubscription = {
        ...subscription,
        created_at: now,
        updated_at: now,
      };

      const result = await collection.add(newSubscription);

      // 同时更新用户的订阅状态
      await this.updateUser(subscription.user_id, {
        subscription_plan: subscription.plan_type,
        subscription_status: subscription.status,
      });

      return { success: true, id: result.id };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'createSubscription') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.USER_SUBSCRIPTIONS);

      // 先获取订阅信息
      const existingResult = await collection.doc(subscriptionId).get();
      const existing = existingResult.data?.[0] || existingResult.data;

      const updateData: any = {
        ...updates,
        updated_at: nowISO(),
      };

      // 移除不应该更新的字段
      delete updateData.id;
      delete updateData.user_id;
      delete updateData.created_at;

      await collection.doc(subscriptionId).update(updateData);

      // 如果状态或计划类型更改，同时更新用户资料
      if (existing && (updates.status || updates.plan_type)) {
        const userUpdates: any = {};
        if (updates.status) userUpdates.subscription_status = updates.status;
        if (updates.plan_type) userUpdates.subscription_plan = updates.plan_type;

        await this.updateUser(existing.user_id, userUpdates);
      }

      return { success: true, id: subscriptionId };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'updateSubscription') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.PAYMENTS);

      const result = await collection
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .skip(offset)
        .limit(limit)
        .get();

      const data = (result.data || []).map((item: any) => ({
        id: item._id,
        user_id: item.user_id,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        payment_method: item.payment_method,
        transaction_id: item.transaction_id,
        subscription_id: item.subscription_id,
        metadata: item.metadata,
        created_at: item.created_at,
        updated_at: item.updated_at,
        completed_at: item.completed_at,
      }));

      return { data, error: null, count: data.length };
    } catch (error) {
      return { 
        data: null, 
        error: handleCloudBaseError(error, 'getPaymentHistory') 
      };
    }
  }

  /**
   * 创建支付记录
   */
  async createPayment(
    payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<MutationResult> {
    try {
      const collection = this.db.collection(CloudBaseCollections.PAYMENTS);
      const now = nowISO();

      const newPayment = {
        ...payment,
        created_at: now,
        updated_at: now,
      };

      const result = await collection.add(newPayment);

      return { success: true, id: result.id };
    } catch (error) {
      return { 
        success: false, 
        error: handleCloudBaseError(error, 'createPayment') 
      };
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
      const collection = this.db.collection(CloudBaseCollections.PAYMENTS);

      const updateData: any = {
        ...updates,
        updated_at: nowISO(),
      };

      // 移除不应该更新的字段
      delete updateData.id;
      delete updateData.user_id;
      delete updateData.created_at;

      await collection.doc(paymentId).update(updateData);

      return { success: true, id: paymentId };
    } catch (error) {
      return {
        success: false,
        error: handleCloudBaseError(error, 'updatePayment')
      };
    }
  }

  /**
   * 获取单个支付记录
   */
  async getPaymentById(paymentId: string): Promise<SingleResult<Payment>> {
    try {
      const collection = this.db.collection(CloudBaseCollections.PAYMENTS);

      const result = await collection.doc(paymentId).get();

      if (!result.data || result.data.length === 0) {
        return { data: null, error: null }; // 支付记录不存在
      }

      const item = result.data[0] || result.data;

      return {
        data: {
          id: item._id,
          user_id: item.user_id,
          amount: item.amount,
          currency: item.currency,
          status: item.status,
          payment_method: item.payment_method,
          transaction_id: item.transaction_id,
          subscription_id: item.subscription_id,
          metadata: item.metadata,
          created_at: item.created_at,
          updated_at: item.updated_at,
          completed_at: item.completed_at,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: handleCloudBaseError(error, 'getPaymentById')
      };
    }
  }

  /**
   * 删除支付记录
   */
  async deletePayment(paymentId: string): Promise<MutationResult> {
    try {
      const collection = this.db.collection(CloudBaseCollections.PAYMENTS);

      await collection.doc(paymentId).remove();

      return { success: true, id: paymentId };
    } catch (error) {
      return {
        success: false,
        error: handleCloudBaseError(error, 'deletePayment')
      };
    }
  }
}

