/**
 * AI 超级助手类型定义
 * 
 * 功能描述：定义会员专属 AI 助手的所有核心数据结构
 * 包括消息类型、意图类型、候选结果、动作按钮等
 */

// =============================================
// 消息类型
// =============================================

/**
 * 助手意图类型
 * - search_nearby: 附近搜索（地图POI/美食/商店等）
 * - food_delivery: 外卖搜索
 * - shopping: 电商搜索
 * - local_life: 本地生活服务
 * - preference_save: 保存偏好
 * - preference_recall: 召回偏好
 * - general: 通用对话
 */
export type AssistantIntentType =
  | "search_nearby"
  | "food_delivery"
  | "shopping"
  | "local_life"
  | "preference_save"
  | "preference_recall"
  | "general";

/**
 * 候选结果卡片
 * 展示搜索到的店铺/商品/服务信息
 */
export interface CandidateResult {
  /** 唯一标识 */
  id: string;
  /** 名称/标题 */
  name: string;
  /** 简短描述 */
  description: string;
  /** 分类标签 */
  category: string;
  /** 距离（如"1.2km"） */
  distance?: string;
  /** 评分（1-5） */
  rating?: number;
  /** 价格区间 */
  priceRange?: string;
  /** 预计送达时间 */
  estimatedTime?: string;
  /** 营业时间 */
  businessHours?: string;
  /** 电话号码 */
  phone?: string;
  /** 地址 */
  address?: string;
  /** 标签 */
  tags?: string[];
  /** 图片 URL */
  imageUrl?: string;
  /** 跳转平台 */
  platform: string;
  /** 搜索关键词（用于生成深链） */
  searchQuery: string;
}

/**
 * 动作按钮类型
 */
export type ActionType =
  | "open_map"       // 打开地图导航
  | "open_app"       // 打开目标 App
  | "call_phone"     // 拨打电话
  | "copy_text"      // 复制文字
  | "open_web"       // 打开网页
  | "save_preference" // 保存偏好
  | "adjust_filter";  // 调整筛选条件

/**
 * 动作按钮
 */
export interface AssistantAction {
  /** 动作类型 */
  type: ActionType;
  /** 按钮文字 */
  label: string;
  /** 目标 URL / 电话号码 / 复制内容 */
  payload: string;
  /** 关联平台 ID（用于深链解析） */
  providerId?: string;
  /** 图标名称 */
  icon?: string;
}

/**
 * 执行计划步骤
 */
export interface PlanStep {
  /** 步骤序号 */
  step: number;
  /** 步骤描述 */
  description: string;
  /** 步骤状态 */
  status: "pending" | "running" | "done" | "error";
}

/**
 * 追问建议
 */
export interface FollowUpSuggestion {
  /** 显示文本 */
  text: string;
  /** 建议类型 */
  type: "refine" | "expand" | "change";
}

// =============================================
// AI 助手响应结构
// =============================================

/**
 * AI 助手响应 - 单条消息中可能包含的结构化内容
 */
export interface AssistantResponse {
  /** 响应类型 */
  type: "plan" | "results" | "clarify" | "text" | "preference_saved" | "error";
  /** 纯文本消息 */
  message: string;
  /** 识别的意图 */
  intent?: AssistantIntentType;
  /** 执行计划 */
  plan?: PlanStep[];
  /** 候选结果列表 */
  candidates?: CandidateResult[];
  /** 可执行动作 */
  actions?: AssistantAction[];
  /** 追问建议 */
  followUps?: FollowUpSuggestion[];
  /** 需要用户提供的信息 */
  clarifyQuestions?: string[];
  /** 偏好数据（保存/召回时使用） */
  preferenceData?: Record<string, unknown>;
}

// =============================================
// 对话消息
// =============================================

/**
 * 对话消息角色
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * 对话消息
 */
export interface ChatMessage {
  /** 消息 ID */
  id: string;
  /** 角色 */
  role: MessageRole;
  /** 纯文本内容 */
  content: string;
  /** 结构化响应（仅 assistant 消息） */
  structuredResponse?: AssistantResponse;
  /** 创建时间 */
  createdAt: string;
  /** 是否正在加载/流式传输 */
  isLoading?: boolean;
}

// =============================================
// 用户偏好
// =============================================

/**
 * 助手用户偏好
 */
export interface AssistantPreference {
  /** 用户 ID */
  userId: string;
  /** 偏好名称 */
  name: string;
  /** 偏好内容 */
  filters: {
    /** 距离限制（km） */
    maxDistance?: number;
    /** 最低评分 */
    minRating?: number;
    /** 价格区间 */
    priceRange?: string;
    /** 口味偏好 */
    tasteTags?: string[];
    /** 平台偏好 */
    preferredPlatforms?: string[];
    /** 品类偏好 */
    categoryTags?: string[];
    /** 送达时间限制（分钟） */
    maxDeliveryTime?: number;
    /** 其他自定义偏好 */
    [key: string]: unknown;
  };
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

// =============================================
// 使用限制
// =============================================

/**
 * AI 助手使用限制配置
 */
export interface AssistantUsageLimits {
  /** 免费用户总计可用次数 */
  freeTotal: number;
  /** 会员用户每日可用次数 */
  proDailyLimit: number;
  /** 企业用户每日可用次数 */
  enterpriseDailyLimit: number;
}

/**
 * 默认使用限制
 */
export const ASSISTANT_USAGE_LIMITS: AssistantUsageLimits = {
  freeTotal: 3,
  proDailyLimit: 10,
  enterpriseDailyLimit: -1, // 无限
};

/**
 * 助手使用统计
 */
export interface AssistantUsageStats {
  userId: string;
  planType: "free" | "pro" | "enterprise";
  /** 当前周期已使用次数 */
  used: number;
  /** 限制总次数（-1 无限） */
  limit: number;
  /** 剩余次数（-1 无限） */
  remaining: number;
  /** 周期类型 */
  periodType: "total" | "daily";
}

// =============================================
// API 请求/响应
// =============================================

/**
 * 聊天请求
 */
export interface ChatRequest {
  /** 用户消息 */
  message: string;
  /** 对话历史（最近 N 条） */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** 用户位置 */
  location?: { lat: number; lng: number };
  /** 语言 */
  locale: "zh" | "en";
  /** 区域 */
  region: "CN" | "INTL";
  /** 是否为移动端 */
  isMobile?: boolean;
}

/**
 * 聊天响应
 */
export interface ChatApiResponse {
  success: boolean;
  response?: AssistantResponse;
  usage?: AssistantUsageStats;
  error?: string;
}
