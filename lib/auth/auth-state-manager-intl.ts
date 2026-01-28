/**
 * Supabase (国际版) 用户缓存管理器
 * 只缓存 UI 需要的最小字段，遵循安全最佳实践
 */

export interface SupabaseUserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  subscription_plan?: string;
  subscription_status?: string;
  membership_expires_at?: string;
}

export interface SupabaseUserCache {
  user: SupabaseUserProfile;
  cachedAt: number; // 缓存时间戳 (毫秒)
  expiresIn: number; // 缓存有效期 (秒)
}

const SUPABASE_USER_CACHE_KEY = "supabase-user-cache";
const DEFAULT_CACHE_DURATION = 3600; // 1小时

/**
 * 保存用户信息到本地缓存
 */
export function saveSupabaseUserCache(
  user: Partial<SupabaseUserProfile> & { id: string; email: string },
  expiresIn: number = DEFAULT_CACHE_DURATION
): void {
  if (typeof window === "undefined") return;

  try {
    // 安全过滤：只保存明确定义的字段
    const sanitizedUser: SupabaseUserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      subscription_plan: user.subscription_plan,
      subscription_status: user.subscription_status,
      membership_expires_at: user.membership_expires_at,
    };

    const cache: SupabaseUserCache = {
      user: sanitizedUser,
      cachedAt: Date.now(),
      expiresIn,
    };

    localStorage.setItem(SUPABASE_USER_CACHE_KEY, JSON.stringify(cache));
    console.log("[Supabase Cache] User info cached:", {
      userId: sanitizedUser.id,
      email: sanitizedUser.email,
    });

    // 触发跨标签页同步事件
    window.dispatchEvent(
      new CustomEvent("supabase-user-changed", {
        detail: sanitizedUser,
      })
    );
  } catch (error) {
    console.error("[Supabase Cache] Failed to save user cache:", error);
    localStorage.removeItem(SUPABASE_USER_CACHE_KEY);
  }
}

/**
 * 从本地缓存获取用户信息
 */
export function getSupabaseUserCache(): SupabaseUserProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(SUPABASE_USER_CACHE_KEY);
    if (!cached) {
      return null;
    }

    const cache: SupabaseUserCache = JSON.parse(cached);

    // 验证数据完整性
    if (!cache.user?.id || !cache.user?.email) {
      console.warn("[Supabase Cache] Cache data incomplete");
      clearSupabaseUserCache();
      return null;
    }

    // 检查是否过期
    const age = Date.now() - cache.cachedAt;

    if (age > cache.expiresIn * 1000) {
      console.log("[Supabase Cache] Cache expired");
      clearSupabaseUserCache();
      return null;
    }

    return cache.user;
  } catch (error) {
    console.error("[Supabase Cache] Failed to read cache:", error);
    clearSupabaseUserCache();
    return null;
  }
}

/**
 * 清除本地缓存的用户信息
 */
export function clearSupabaseUserCache(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(SUPABASE_USER_CACHE_KEY);
    console.log("[Supabase Cache] User cache cleared");

    // 触发跨标签页同步事件
    window.dispatchEvent(
      new CustomEvent("supabase-user-changed", {
        detail: null,
      })
    );
  } catch (error) {
    console.error("[Supabase Cache] Failed to clear cache:", error);
  }
}

/**
 * 检查缓存是否有效
 */
export function isSupabaseCacheValid(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const cached = localStorage.getItem(SUPABASE_USER_CACHE_KEY);
    if (!cached) return false;

    const cache: SupabaseUserCache = JSON.parse(cached);
    const age = Date.now() - cache.cachedAt;

    return age <= cache.expiresIn * 1000;
  } catch {
    return false;
  }
}

/**
 * 更新缓存中的部分用户信息
 */
export function updateSupabaseUserCache(
  updates: Partial<SupabaseUserProfile>
): void {
  if (typeof window === "undefined") return;

  try {
    const cached = localStorage.getItem(SUPABASE_USER_CACHE_KEY);
    if (!cached) {
      console.warn("[Supabase Cache] No existing cache, cannot update");
      return;
    }

    const cache: SupabaseUserCache = JSON.parse(cached);

    // 合并更新
    cache.user = {
      ...cache.user,
      ...updates,
    };

    // 重置缓存时间
    cache.cachedAt = Date.now();

    localStorage.setItem(SUPABASE_USER_CACHE_KEY, JSON.stringify(cache));
    console.log("[Supabase Cache] User info updated:", updates);

    // 触发跨标签页同步事件
    window.dispatchEvent(
      new CustomEvent("supabase-user-changed", {
        detail: cache.user,
      })
    );
  } catch (error) {
    console.error("[Supabase Cache] Failed to update cache:", error);
  }
}
