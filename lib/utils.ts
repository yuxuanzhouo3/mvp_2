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
 * 验证字符串是否是有效的 CloudBase ID 格式
 * CloudBase ID 是 32 位十六进制字符串（无连字符）
 */
export function isValidCloudBaseId(str: string): boolean {
  const cloudbaseIdRegex = /^[0-9a-f]{24,32}$/i;
  return cloudbaseIdRegex.test(str);
}

/**
 * 检查用户 ID 是否有效
 * 支持两种格式：
 * - UUID 格式（Supabase/INTL）：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * - CloudBase 格式（CN）：32位十六进制字符串
 */
export function isValidUserId(userId: string | null | undefined): userId is string {
  if (!userId || userId === "anonymous") return false;
  // 同时支持 UUID（Supabase）和 CloudBase ID 格式
  return isValidUUID(userId) || isValidCloudBaseId(userId);
}
