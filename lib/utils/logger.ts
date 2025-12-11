/**
 * 日志和安全事件记录工具
 */

export type SecurityEventType =
  | "csrf_token_missing"
  | "csrf_token_invalid"
  | "region_blocked"
  | "debug_mode_blocked"
  | "auth_failed"
  | "rate_limit_exceeded";

/**
 * 记录安全事件
 */
export function logSecurityEvent(
  eventType: SecurityEventType,
  userId?: string,
  ip?: string,
  details?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    userId,
    ip,
    details,
  };

  // 在开发环境下打印到控制台
  if (process.env.NODE_ENV === "development") {
    console.warn(`[Security Event] ${eventType}:`, logEntry);
  } else {
    // 生产环境：发送到日志服务
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * 通用日志工具
 */
export const logger = {
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEBUG] ${message}`, data || "");
    }
  },

  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, data || "");
  },

  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, data || "");
  },

  error: (message: string, error?: Error | Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, error || "");
  },
};

