import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 验证字符串是否是有效的 UUID 格式
 */
export function isValidUUID(str: string): boolean {
  // 支持 UUID v1-v5 和 NIL UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * 检查用户 ID 是否有效（非 anonymous 且是有效 UUID）
 */
export function isValidUserId(userId: string | null | undefined): userId is string {
  if (!userId || userId === "anonymous") return false;
  return isValidUUID(userId);
}
