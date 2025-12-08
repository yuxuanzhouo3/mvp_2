/**
 * AI 智能推荐系统类型定义
 * AI Smart Recommendation System Types
 */

// =============================================
// 基础类型
// =============================================

/**
 * 推荐分类类型
 */
export type RecommendationCategory =
  | "entertainment"
  | "shopping"
  | "food"
  | "travel"
  | "fitness";

/**
 * 链接类型
 */
export type LinkType =
  | "product"
  | "video"
  | "book"
  | "location"
  | "article"
  | "app"
  | "music"
  | "movie"
  | "game"
  | "restaurant"
  | "recipe"
  | "hotel"
  | "course";

/**
 * 用户行为类型
 */
export type UserAction = "view" | "click" | "save" | "share" | "dismiss";

// =============================================
// 推荐相关类型
// =============================================

/**
 * 推荐项元数据
 */
export interface RecommendationMetadata {
  price?: string;
  rating?: number;
  duration?: string;
  calories?: number;
  author?: string;
  platform?: string;
  address?: string;
  distance?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * AI 推荐项
 */
export interface AIRecommendation {
  id?: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  link: string;
  linkType: LinkType;
  metadata: RecommendationMetadata;
  reason: string;
}

/**
 * 推荐历史记录（数据库模型）
 */
export interface RecommendationHistory {
  id: string;
  user_id: string;
  category: RecommendationCategory;
  title: string;
  description: string | null;
  link: string;
  link_type: LinkType | null;
  metadata: RecommendationMetadata;
  reason: string | null;
  clicked: boolean;
  saved: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 推荐点击记录（数据库模型）
 */
export interface RecommendationClick {
  id: string;
  user_id: string;
  recommendation_id: string;
  action: UserAction;
  clicked_at: string;
}

// =============================================
// 用户偏好相关类型
// =============================================

/**
 * 偏好权重映射
 */
export interface PreferenceWeights {
  [tag: string]: number;
}

/**
 * 用户偏好（数据库模型）
 */
export interface UserPreference {
  id: string;
  user_id: string;
  category: RecommendationCategory;
  preferences: PreferenceWeights;
  tags: string[];
  click_count: number;
  view_count: number;
  last_activity: string;
  created_at: string;
  updated_at: string;
}

/**
 * 用户偏好摘要
 */
export interface UserPreferenceSummary {
  category: RecommendationCategory;
  topTags: string[];
  clickCount: number;
  viewCount: number;
  lastActivity: string;
}

/**
 * 完整用户偏好分析
 */
export interface UserPreferenceAnalysis {
  userId: string;
  preferences: UserPreferenceSummary[];
  totalInteractions: number;
  favoriteCategory: RecommendationCategory | null;
  lastActiveAt: string | null;
}

// =============================================
// API 请求/响应类型
// =============================================

/**
 * AI 推荐请求
 */
export interface AIRecommendRequest {
  category: RecommendationCategory;
  userId?: string;
  count?: number;
  locale?: "zh" | "en";
}

/**
 * AI 推荐响应
 */
export interface AIRecommendResponse {
  success: boolean;
  recommendations: AIRecommendation[];
  source: "ai" | "fallback" | "cache";
  error?: string;
}

/**
 * 记录用户行为请求
 */
export interface RecordActionRequest {
  userId: string;
  category: RecommendationCategory;
  recommendation: AIRecommendation;
  action: UserAction;
}

/**
 * 记录用户行为响应
 */
export interface RecordActionResponse {
  success: boolean;
  historyId?: string;
  clickId?: string;
  error?: string;
}

/**
 * 用户偏好响应
 */
export interface UserPreferencesResponse {
  success: boolean;
  analysis: UserPreferenceAnalysis | null;
  error?: string;
}

// =============================================
// 分类配置类型
// =============================================

/**
 * 分类链接模板
 */
export interface CategoryLinkTemplate {
  category: RecommendationCategory;
  linkTypes: LinkType[];
  platforms: {
    cn: string[];
    intl: string[];
  };
  exampleLinks: {
    cn: Record<string, string>;
    intl: Record<string, string>;
  };
}

/**
 * 分类配置
 */
export interface CategoryConfig {
  id: RecommendationCategory;
  title: {
    zh: string;
    en: string;
  };
  icon: string;
  color: string;
  description: {
    zh: string;
    en: string;
  };
  linkTemplates: CategoryLinkTemplate;
}

// =============================================
// Groq API 相关类型
// =============================================

/**
 * Groq 消息
 */
export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Groq API 响应
 */
export interface GroqResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// =============================================
// 缓存相关类型
// =============================================

/**
 * 推荐缓存条目
 */
export interface RecommendationCacheEntry {
  id: string;
  category: RecommendationCategory;
  preference_hash: string;
  recommendations: AIRecommendation[];
  expires_at: string;
  created_at: string;
}

// =============================================
// 降级策略相关类型
// =============================================

/**
 * 降级推荐数据
 */
export interface FallbackRecommendation {
  category: RecommendationCategory;
  recommendations: AIRecommendation[];
}

/**
 * 降级策略配置
 */
export interface FallbackConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelayMs: number;
  cacheExpirationMinutes: number;
}
