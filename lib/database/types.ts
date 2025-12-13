/**
 * 数据库类型定义
 * 
 * 定义所有数据库实体和操作的通用类型
 * 这些类型在 Supabase 和 CloudBase 之间通用
 */

// =============================================
// 用户相关类型
// =============================================

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  subscription_plan?: 'free' | 'pro' | 'enterprise';
  subscription_status?: 'active' | 'expired' | 'cancelled';
  region?: 'china' | 'intl';
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  subscription_status: 'active' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// =============================================
// 推荐系统相关类型
// =============================================

export type RecommendationCategory = 
  | 'entertainment' 
  | 'shopping' 
  | 'food' 
  | 'travel' 
  | 'fitness';

export type LinkType = 
  | 'product' 
  | 'video' 
  | 'book' 
  | 'location' 
  | 'article' 
  | 'app' 
  | 'music' 
  | 'movie' 
  | 'game' 
  | 'restaurant' 
  | 'recipe' 
  | 'hotel' 
  | 'course' 
  | 'search';

export type UserAction = 'view' | 'click' | 'save' | 'share' | 'dismiss';

export interface RecommendationHistory {
  id: string;
  user_id: string;
  category: RecommendationCategory;
  title: string;
  description?: string;
  link: string;
  link_type?: LinkType;
  metadata?: Record<string, any>;
  reason?: string;
  clicked: boolean;
  saved: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPreference {
  id: string;
  user_id: string;
  category: RecommendationCategory;
  preferences: Record<string, number>;
  tags: string[];
  click_count: number;
  view_count: number;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

export interface RecommendationClick {
  id: string;
  user_id: string;
  recommendation_id: string;
  action: UserAction;
  clicked_at: string;
}

export interface RecommendationCache {
  id: string;
  category: RecommendationCategory;
  preference_hash: string;
  recommendations: any[];
  expires_at: string;
  created_at: string;
}

export interface AIRecommendation {
  id?: string;
  category: RecommendationCategory;
  title: string;
  description?: string;
  link: string;
  linkType?: LinkType;
  metadata?: Record<string, any>;
  reason?: string;
}

// =============================================
// 订阅和支付相关类型
// =============================================

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'refunded';
export type PaymentMethod = 'stripe' | 'paypal' | 'wechat' | 'alipay';
export type PlanType = 'pro' | 'enterprise';

export interface UserSubscription {
  id: string;
  user_id: string;
  subscription_end: string;
  status: SubscriptionStatus;
  plan_type: PlanType;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method?: PaymentMethod;
  transaction_id?: string;
  subscription_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// =============================================
// 数据库操作类型
// =============================================

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
}

export interface QueryResult<T> {
  data: T[] | null;
  error: Error | null;
  count?: number;
}

export interface SingleResult<T> {
  data: T | null;
  error: Error | null;
}

export interface MutationResult {
  success: boolean;
  id?: string;
  error?: Error;
}

// =============================================
// 数据库适配器接口
// =============================================

/**
 * 推荐系统数据库适配器接口
 */
export interface RecommendationDatabaseAdapter {
  // 推荐历史
  getRecommendationHistory(
    userId: string,
    category?: RecommendationCategory,
    options?: QueryOptions
  ): Promise<QueryResult<RecommendationHistory>>;

  saveRecommendation(
    userId: string,
    recommendation: AIRecommendation
  ): Promise<MutationResult>;

  saveRecommendations(
    userId: string,
    recommendations: AIRecommendation[]
  ): Promise<MutationResult & { ids?: string[] }>;

  updateRecommendation(
    id: string,
    updates: Partial<RecommendationHistory>
  ): Promise<MutationResult>;

  deleteRecommendations(
    userId: string,
    ids?: string[],
    category?: RecommendationCategory
  ): Promise<MutationResult & { deletedCount?: number }>;

  // 用户偏好
  getUserPreferences(
    userId: string,
    category?: RecommendationCategory
  ): Promise<QueryResult<UserPreference>>;

  upsertUserPreference(
    userId: string,
    category: RecommendationCategory,
    updates: {
      preferences?: Record<string, number>;
      tags?: string[];
      incrementClick?: boolean;
      incrementView?: boolean;
    }
  ): Promise<SingleResult<UserPreference>>;

  // 点击记录
  recordClick(
    userId: string,
    recommendationId: string,
    action: UserAction
  ): Promise<MutationResult>;

  // 缓存
  getCachedRecommendations(
    category: RecommendationCategory,
    preferenceHash: string
  ): Promise<SingleResult<RecommendationCache>>;

  cacheRecommendations(
    category: RecommendationCategory,
    preferenceHash: string,
    recommendations: any[],
    expirationMinutes?: number
  ): Promise<MutationResult>;

  cleanupExpiredCache(): Promise<{ deletedCount: number }>;
}

/**
 * 用户数据库适配器接口
 */
export interface UserDatabaseAdapter {
  // 用户操作
  getUserById(userId: string): Promise<SingleResult<User>>;
  getUserByEmail(email: string): Promise<SingleResult<User>>;
  createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<MutationResult>;
  updateUser(userId: string, updates: Partial<User>): Promise<MutationResult>;

  // 订阅操作
  getActiveSubscription(userId: string): Promise<SingleResult<UserSubscription>>;
  createSubscription(subscription: Omit<UserSubscription, 'id' | 'created_at' | 'updated_at'>): Promise<MutationResult>;
  updateSubscription(subscriptionId: string, updates: Partial<UserSubscription>): Promise<MutationResult>;
  
  // 支付操作
  getPaymentHistory(userId: string, options?: QueryOptions): Promise<QueryResult<Payment>>;
  createPayment(payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>): Promise<MutationResult>;
  updatePayment(paymentId: string, updates: Partial<Payment>): Promise<MutationResult>;
}

/**
 * 统一数据库适配器接口
 */
export interface DatabaseAdapter {
  recommendation: RecommendationDatabaseAdapter;
  user: UserDatabaseAdapter;
  getProvider(): 'supabase' | 'cloudbase';
}

// =============================================
// 偏好分析相关类型
// =============================================

export interface UserPreferenceSummary {
  category: RecommendationCategory;
  topTags: string[];
  clickCount: number;
  viewCount: number;
  lastActivity: string;
}

export interface UserPreferenceAnalysis {
  userId: string;
  preferences: UserPreferenceSummary[];
  totalInteractions: number;
  favoriteCategory: RecommendationCategory | null;
  lastActiveAt: string | null;
}

