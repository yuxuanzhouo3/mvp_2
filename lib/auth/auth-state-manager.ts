/**
 * Auth State Manager
 * 原子性管理认证状态（token + user + metadata）
 * 支持 Refresh Token 自动刷新
 */

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  subscription_plan?: string;
  [key: string]: any;
}

export interface StoredAuthState {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tokenMeta: {
    accessTokenExpiresIn: number; // 秒数
    refreshTokenExpiresIn: number; // 秒数
  };
  savedAt: number; // 毫秒
}

const AUTH_STATE_KEY = "app-auth-state";

/**
 * 初始化认证状态管理器
 * 清理旧格式的 localStorage 键
 */
export function initAuthStateManager(): void {
  if (typeof window === "undefined") return;

  try {
    // 清除旧格式的键（如果存在）
    const oldKeys = ["auth-token", "auth-user", "auth-logged-in"];
    const hasNewState = !!localStorage.getItem(AUTH_STATE_KEY);

    // 只在新状态存在时清除旧键（避免误删用户的旧登录状态）
    if (hasNewState) {
      oldKeys.forEach((key) => {
        if (localStorage.getItem(key)) {
          console.log(`[Auth] Clearing old localStorage key: ${key}`);
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.warn("[Auth] Error cleaning old localStorage keys:", error);
  }
}

/**
 * 原子性保存认证状态
 * 成功保存后会 dispatch 'auth-state-changed' 事件
 */
export function saveAuthState(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
  tokenMeta: { accessTokenExpiresIn: number; refreshTokenExpiresIn: number }
): void {
  if (typeof window === "undefined") return;

  try {
    const authState: StoredAuthState = {
      accessToken,
      refreshToken,
      user,
      tokenMeta,
      savedAt: Date.now(),
    };

    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(authState));
    console.log("[Auth] Auth state saved");

    // 触发自定义事件（用于同标签页内同步）
    window.dispatchEvent(new CustomEvent("auth-state-changed"));
  } catch (error) {
    console.error("[Auth] Failed to save auth state:", error);
    // 保存失败则清除
    localStorage.removeItem(AUTH_STATE_KEY);
  }
}

/**
 * 获取存储的认证状态
 */
export function getStoredAuthState(): StoredAuthState | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(AUTH_STATE_KEY);
    if (!stored) return null;

    const authState: StoredAuthState = JSON.parse(stored);

    // 验证数据完整性
    if (
      !authState.accessToken ||
      !authState.refreshToken ||
      !authState.user?.id ||
      !authState.tokenMeta
    ) {
      console.warn("[Auth] Stored auth state is incomplete");
      clearAuthState();
      return null;
    }

    return authState;
  } catch (error) {
    console.error("[Auth] Failed to parse auth state:", error);
    clearAuthState();
    return null;
  }
}

/**
 * 获取有效的 access token
 * 若本地已过期但 refreshToken 有效，自动调用刷新端点
 * 若刷新失败或都过期，返回 null（由调用者处理重新登录）
 */
export async function getValidAccessToken(): Promise<string | null> {
  const authState = getStoredAuthState();
  if (!authState) return null;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  // 提前 60 秒判定为过期（留出时间刷新）
  if (Date.now() <= accessTokenExpiresAt - 60000) {
    // Token 仍然有效，直接返回
    return authState.accessToken;
  }

  console.log("[Auth] Access token expired or expiring soon, refreshing...");

  // Token 已过期，检查 refresh token 是否有效
  if (!isRefreshTokenValid()) {
    console.log("[Auth] Refresh token also expired, need to re-login");
    clearAuthState();
    return null;
  }

  // 尝试刷新 token
  try {
    console.log("[Auth] Calling refresh endpoint...");
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken: authState.refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("[Auth] Refresh failed:", response.status);
      if (response.status === 401) {
        // Refresh token 已过期或无效
        clearAuthState();
      }
      return null;
    }

    const data = await response.json();

    if (!data.accessToken) {
      console.error("[Auth] Refresh response missing accessToken");
      return null;
    }

    console.log("[Auth] Token refreshed successfully");

    // 更新本地存储
    updateAccessToken(data.accessToken, data.tokenMeta?.accessTokenExpiresIn);

    return data.accessToken;
  } catch (error) {
    console.error("[Auth] Error refreshing token:", error);
    return null;
  }
}

/**
 * 获取 refresh token
 */
export function getRefreshToken(): string | null {
  const authState = getStoredAuthState();
  return authState?.refreshToken || null;
}

/**
 * 获取用户信息
 */
export function getUser(): AuthUser | null {
  const authState = getStoredAuthState();
  return authState?.user || null;
}

/**
 * 检查 refresh token 是否有效
 */
export function isRefreshTokenValid(): boolean {
  const authState = getStoredAuthState();
  if (!authState) return false;

  const refreshTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.refreshTokenExpiresIn * 1000;

  return Date.now() < refreshTokenExpiresAt;
}

/**
 * 更新 access token（刷新后调用）
 */
export function updateAccessToken(
  newAccessToken: string,
  newExpiresIn?: number
): void {
  if (typeof window === "undefined") return;

  try {
    const authState = getStoredAuthState();
    if (!authState) {
      console.warn("[Auth] No existing auth state, cannot update token");
      return;
    }

    // 更新 token 和过期时间
    authState.accessToken = newAccessToken;
    if (newExpiresIn) {
      authState.tokenMeta.accessTokenExpiresIn = newExpiresIn;
    }
    authState.savedAt = Date.now();

    localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(authState));
    console.log("[Auth] Access token updated");

    window.dispatchEvent(new CustomEvent("auth-state-changed"));
  } catch (error) {
    console.error("[Auth] Failed to update token:", error);
  }
}

/**
 * 获取认证头（同步版本，不触发自动刷新）
 * 用于不需要自动刷新的场景（如日志、分析等）
 */
export function getAuthHeader(): { Authorization: string } | null {
  const authState = getStoredAuthState();
  if (!authState) return null;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  // 检查 token 是否仍然有效（不尝试刷新）
  if (Date.now() > accessTokenExpiresAt - 60000) {
    return null;
  }

  return { Authorization: `Bearer ${authState.accessToken}` };
}

/**
 * 获取认证头（异步版本，支持自动刷新）
 * 用于 API 请求时自动刷新过期 token
 */
export async function getAuthHeaderAsync(): Promise<{
  Authorization: string;
} | null> {
  const token = await getValidAccessToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

/**
 * 清除所有认证状态
 */
export function clearAuthState(): void {
  if (typeof window === "undefined") return;

  try {
    // 清除新格式的认证状态
    localStorage.removeItem(AUTH_STATE_KEY);

    // 清除旧格式的localStorage键
    const oldKeys = ["auth-token", "auth-user", "auth-logged-in"];
    oldKeys.forEach((key) => {
      if (localStorage.getItem(key)) {
        console.log(`[Auth] Clearing old localStorage key: ${key}`);
        localStorage.removeItem(key);
      }
    });

    // 清除可能的sessionStorage认证相关数据
    const sessionKeys = ["auth-state", "auth-token", "auth-user"];
    sessionKeys.forEach((key) => {
      if (sessionStorage.getItem(key)) {
        console.log(`[Auth] Clearing sessionStorage key: ${key}`);
        sessionStorage.removeItem(key);
      }
    });

    // 清除用户画像和onboarding相关缓存
    const cacheKeys = ["user-profile-cache", "onboarding-state", "user-preferences-cache"];
    cacheKeys.forEach((key) => {
      if (localStorage.getItem(key)) {
        console.log(`[Auth] Clearing cache key: ${key}`);
        localStorage.removeItem(key);
      }
    });

    console.log("[Auth] All auth states cleared");

    window.dispatchEvent(new CustomEvent("auth-state-changed"));
  } catch (error) {
    console.error("[Auth] Failed to clear auth state:", error);
  }
}

/**
 * 检查用户是否已认证（同步检查，不触发自动刷新）
 * 用于快速检查，如 UI 条件渲染
 */
export function isAuthenticated(): boolean {
  const authState = getStoredAuthState();
  if (!authState || !authState.user?.id) return false;

  const accessTokenExpiresAt =
    authState.savedAt + authState.tokenMeta.accessTokenExpiresIn * 1000;

  // 检查 token 是否仍然有效（不尝试刷新）
  return Date.now() < accessTokenExpiresAt - 60000;
}
