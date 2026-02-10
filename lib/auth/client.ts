/**
 * 前端认证客户端
 *
 * 根据 DEPLOY_REGION 环境变量提供统一的认证接口
 * 这个文件应该被前端组件使用，而不是直接使用 supabase 客户端
 */

import { isChinaRegion } from "@/lib/config/region";
import { getAuth } from "@/lib/auth/adapter";

/**
 * 统一的用户类型
 */
export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

/**
 * 统一的会话类型
 */
export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: AuthUser;
}

/**
 * 统一的认证响应类型
 */
export interface AuthResponse {
  data: {
    user: AuthUser | null;
    session: AuthSession | null;
  };
  error: Error | null;
}

/**
 * 统一的认证客户端接口
 */
export interface AuthClient {
  signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse>;

  signUp(params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
      verificationCode?: string;
    };
  }): Promise<AuthResponse>;

  signInWithOAuth(params: {
    provider: string;
    options?: any;
  }): Promise<{ data: any; error: Error | null }>;

  toDefaultLoginPage?(redirectUrl?: string): Promise<void>;

  updateUser(params: {
    password?: string;
    email?: string;
    data?: Record<string, any>;
  }): Promise<{ data: { user: AuthUser | null }; error: Error | null }>;

  signInWithOtp(params: {
    email: string;
    options?: any;
  }): Promise<{ error: Error | null }>;

  sendEmailVerificationCode?(params: {
    email: string;
    purpose: "register" | "reset_password";
  }): Promise<{
    data: { success: boolean; expiresInSeconds?: number } | null;
    error: Error | null;
    code?: string;
    retryAfterSeconds?: number;
  }>;

  resetPasswordWithCode?(params: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  }): Promise<{
    data: { success: boolean } | null;
    error: Error | null;
    code?: string;
  }>;

  verifyOtp(params: {
    email: string;
    token: string;
    type: string;
  }): Promise<AuthResponse>;

  signOut(): Promise<{ error: Error | null }>;

  getUser(): Promise<{ data: { user: AuthUser | null }; error: Error | null }>;

  getSession(): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }>;

  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } };
}

/**
 * Supabase 认证客户端（国际版）
 */
class SupabaseAuthClient implements AuthClient {
  private supabase: any;
  private supabasePromise: Promise<any> | null = null;

  constructor() {
    this.supabasePromise = import("@/lib/integrations/supabase").then(({ supabase }) => {
      this.supabase = supabase;
      return supabase;
    });
  }

  private async ensureSupabase() {
    if (this.supabase) {
      return this.supabase;
    }
    if (this.supabasePromise) {
      return await this.supabasePromise;
    }
    throw new Error("Supabase client initialization failed");
  }

  async refreshUserProfile(): Promise<void> {
    try {
      console.log("[Supabase] Refreshing user info...");

      // Get access token from the current session
      const supabase = await this.ensureSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.warn("[Supabase] No session found, cannot refresh user info");
        return;
      }

      const response = await fetch("/api/profile", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const fullProfile = await response.json();
        const {
          saveSupabaseUserCache,
        } = await import("@/lib/auth/auth-state-manager-intl");
        saveSupabaseUserCache(fullProfile);
        console.log("[Supabase] User info refreshed successfully");
      } else {
        console.warn("[Supabase] Failed to refresh user info:", response.status);
      }
    } catch (error) {
      console.warn("[Supabase] Failed to refresh user info:", error);
    }
  }

  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      const supabase = await this.ensureSupabase();
      const result = await supabase.auth.signInWithPassword(params);

      if (result.data.user && !result.error) {
        await this.refreshUserProfile();
      }

      return result;
    } catch (error) {
      return {
        data: { user: null, session: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async signUp(params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
      verificationCode?: string;
    };
  }): Promise<AuthResponse> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.signUp(params);
    } catch (error) {
      return {
        data: { user: null, session: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async signInWithOAuth(params: {
    provider: string;
    options?: any;
  }): Promise<{ data: any; error: Error | null }> {
    try {
      const supabase = await this.ensureSupabase();
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" ? window.location.origin : "") ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000";
      const authCallbackPath =
        process.env.NEXT_PUBLIC_AUTH_CALLBACK_PATH || "/auth/callback";
      const redirectTo =
        params.options?.redirectTo ||
        `${baseUrl.replace(/\/$/, "")}${authCallbackPath}`;

      return await supabase.auth.signInWithOAuth({
        provider: params.provider,
        options: {
          ...params.options,
          redirectTo,
        },
      });
    } catch (error) {
      return {
        data: null,
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async updateUser(params: {
    password?: string;
    email?: string;
    data?: Record<string, any>;
  }): Promise<{ data: { user: AuthUser | null }; error: Error | null }> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.updateUser(params);
    } catch (error) {
      return {
        data: { user: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async signInWithOtp(params: {
    email: string;
    options?: any;
  }): Promise<{ error: Error | null }> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.signInWithOtp(params);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async sendEmailVerificationCode(params: {
    email: string;
    purpose: "register" | "reset_password";
  }): Promise<{
    data: { success: boolean; expiresInSeconds?: number } | null;
    error: Error | null;
    code?: string;
    retryAfterSeconds?: number;
  }> {
    try {
      const response = await fetch("/api/auth/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          data: null,
          error: new Error(payload.error || "Failed to send verification code"),
          code: payload.code,
          retryAfterSeconds: payload.retryAfterSeconds,
        };
      }

      return {
        data: {
          success: true,
          expiresInSeconds: payload.expiresInSeconds,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      };
    }
  }

  async resetPasswordWithCode(params: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  }): Promise<{
    data: { success: boolean } | null;
    error: Error | null;
    code?: string;
  }> {
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          data: null,
          error: new Error(payload.error || "Failed to reset password"),
          code: payload.code,
        };
      }

      return {
        data: { success: true },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      };
    }
  }

  async verifyOtp(params: {
    email: string;
    token: string;
    type: string;
  }): Promise<AuthResponse> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.verifyOtp(params);
    } catch (error) {
      return {
        data: { user: null, session: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {
    try {
      const supabase = await this.ensureSupabase();
      const result = await supabase.auth.signOut();

      const { clearSupabaseUserCache } = await import(
        "@/lib/auth/auth-state-manager-intl"
      );
      clearSupabaseUserCache();

      return result;
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async getUser(): Promise<{
    data: { user: AuthUser | null };
    error: Error | null;
  }> {
    try {
      const { getSupabaseUserCache } = await import(
        "@/lib/auth/auth-state-manager-intl"
      );
      const cachedUser = getSupabaseUserCache();

      if (cachedUser) {
        console.log("[Supabase] Using cached user info");
        return {
          data: {
            user: {
              id: cachedUser.id,
              email: cachedUser.email,
              user_metadata: {
                full_name: cachedUser.name,
                avatar_url: cachedUser.avatar,
              },
            },
          },
          error: null,
        };
      }

      console.log("[Supabase] Cache miss, using Supabase session");
      const supabase = await this.ensureSupabase();
      return await supabase.auth.getUser();
    } catch (error) {
      return {
        data: { user: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  async getSession(): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }> {
    try {
      const supabase = await this.ensureSupabase();
      return await supabase.auth.getSession();
    } catch (error) {
      return {
        data: { session: null },
        error:
          error instanceof Error
            ? error
            : new Error("Supabase client not initialized"),
      };
    }
  }

  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } } {
    if (!this.supabase) {
      return {
        data: { subscription: { unsubscribe: () => {} } },
      };
    }
    return this.supabase.auth.onAuthStateChange(callback);
  }
}

/**
 * CloudBase 认证客户端（中国版）
 */
class CloudBaseAuthClient implements AuthClient {
  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    try {
      console.log(`[CloudBase] Login attempt: ${params.email}`);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[CloudBase] Login failed: ${errorData.error}`);
        return {
          data: { user: null, session: null },
          error: new Error(
            errorData.details || errorData.error || "Login failed"
          ),
        };
      }

      const data = await response.json();
      console.log(`[CloudBase] Login successful, userId=${data.user?.id}`);

      // 保存认证状态
      if (data.accessToken && data.user && typeof window !== "undefined") {
        try {
          const { saveAuthState } = await import("@/lib/auth/auth-state-manager");

          saveAuthState(
            data.accessToken,
            data.refreshToken || data.accessToken,
            data.user,
            data.tokenMeta || {
              accessTokenExpiresIn: 3600,
              refreshTokenExpiresIn: 604800,
            }
          );
        } catch (error) {
          console.error("[CloudBase] Failed to save auth state:", error);
          // 回退到旧格式
          if (data.accessToken && data.user) {
            localStorage.setItem("auth-token", data.accessToken);
            localStorage.setItem("auth-user", JSON.stringify(data.user));
            localStorage.setItem("auth-logged-in", "true");
          }
        }
      }

      const accessToken =
        data.accessToken || data.token || data.session?.access_token;
      return {
        data: {
          user: data.user,
          session:
            data.session ||
            (accessToken
              ? { access_token: accessToken, user: data.user }
              : null),
        },
        error: null,
      };
    } catch (error) {
      console.error(`[CloudBase] Login error: ${error}`);
      return {
        data: { user: null, session: null },
        error: error as Error,
      };
    }
  }

  async signUp(params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
      verificationCode?: string;
    };
  }): Promise<AuthResponse> {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          confirmPassword: params.password,
          fullName: params.options?.data?.name || params.email.split("@")[0],
          verificationCode: params.options?.verificationCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: { user: null, session: null },
          error: new Error(
            errorData.details || errorData.error || "Registration failed"
          ),
        };
      }

      const data = await response.json();
      return {
        data: {
          user: data.user,
          session: data.session,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null, session: null },
        error: error as Error,
      };
    }
  }

  async signInWithOAuth(params: {
    provider: string;
    options?: any;
  }): Promise<{ data: any; error: Error | null }> {
    if (params.provider === "wechat") {
      this.toDefaultLoginPage?.(params.options?.redirectTo);
      return { data: null, error: null };
    }
    return {
      data: null,
      error: new Error(
        "Only WeChat OAuth is supported in China region."
      ),
    };
  }

  async toDefaultLoginPage(redirectUrl?: string): Promise<void> {
    const adapter = getAuth();
    if (adapter.toDefaultLoginPage) {
      await adapter.toDefaultLoginPage(redirectUrl);
    } else {
      throw new Error("toDefaultLoginPage is not supported in this region");
    }
  }

  async updateUser(params: {
    password?: string;
    email?: string;
    data?: Record<string, any>;
  }): Promise<{ data: { user: AuthUser | null }; error: Error | null }> {
    try {
      const response = await fetch("/api/auth/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: { user: null },
          error: new Error(
            errorData.details || errorData.error || "Update failed"
          ),
        };
      }

      const data = await response.json();
      return {
        data: { user: data.user },
        error: null,
      };
    } catch (error) {
      return {
        data: { user: null },
        error: error as Error,
      };
    }
  }

  async signInWithOtp(params: {
    email: string;
    options?: any;
  }): Promise<{ error: Error | null }> {
    void params;
    return {
      error: new Error(
        "OTP is not supported in China region. Please use WeChat login."
      ),
    };
  }

  async sendEmailVerificationCode(params: {
    email: string;
    purpose: "register" | "reset_password";
  }): Promise<{
    data: { success: boolean; expiresInSeconds?: number } | null;
    error: Error | null;
    code?: string;
    retryAfterSeconds?: number;
  }> {
    try {
      const response = await fetch("/api/auth/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          data: null,
          error: new Error(payload.error || "Failed to send verification code"),
          code: payload.code,
          retryAfterSeconds: payload.retryAfterSeconds,
        };
      }

      return {
        data: {
          success: true,
          expiresInSeconds: payload.expiresInSeconds,
        },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      };
    }
  }

  async resetPasswordWithCode(params: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  }): Promise<{
    data: { success: boolean } | null;
    error: Error | null;
    code?: string;
  }> {
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          data: null,
          error: new Error(payload.error || "Failed to reset password"),
          code: payload.code,
        };
      }

      return {
        data: { success: true },
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        error: error as Error,
      };
    }
  }

  async verifyOtp(params: {
    email: string;
    token: string;
    type: string;
  }): Promise<AuthResponse> {
    void params;
    return {
      data: { user: null, session: null },
      error: new Error(
        "OTP is not supported in China region. Please use WeChat login."
      ),
    };
  }

  async signOut(): Promise<{ error: Error | null }> {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }

      if (typeof window !== "undefined") {
        // 清除新格式的认证状态
        const { clearAuthState } = await import("@/lib/auth/auth-state-manager");
        clearAuthState();
        
        // 清除旧格式的localStorage键
        const oldKeys = ["auth-token", "auth-user", "auth-logged-in"];
        oldKeys.forEach((key) => {
          if (localStorage.getItem(key)) {
            console.log(`[CloudBase] Clearing old localStorage key on logout: ${key}`);
            localStorage.removeItem(key);
          }
        });
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }

  async getUser(): Promise<{
    data: { user: AuthUser | null };
    error: Error | null;
  }> {
    try {
      const { getStoredAuthState } = await import("@/lib/auth/auth-state-manager");
      const authState = getStoredAuthState();

      if (!authState || !authState.user) {
        console.log("[CloudBase] No auth state found");
        return { data: { user: null }, error: null };
      }

      const authUser: AuthUser = {
        id: authState.user.id,
        email: authState.user.email,
        user_metadata: {
          full_name:
            authState.user.name ||
            authState.user.email?.split("@")[0] ||
            "User",
          avatar_url: authState.user.avatar,
        },
      };

      console.log("[CloudBase] Got user:", authUser.id);
      return {
        data: { user: authUser },
        error: null,
      };
    } catch (error) {
      console.error("[CloudBase] getUser error:", error);
      return { data: { user: null }, error: error as Error };
    }
  }

  async getSession(): Promise<{
    data: { session: AuthSession | null };
    error: Error | null;
  }> {
    if (typeof window !== "undefined") {
      try {
        const { getStoredAuthState } = await import("@/lib/auth/auth-state-manager");
        const authState = getStoredAuthState();

        if (authState && authState.user) {
          const authUser: AuthUser = {
            id: authState.user.id,
            email: authState.user.email,
            user_metadata: {
              full_name:
                authState.user.name ||
                authState.user.email?.split("@")[0] ||
                "User",
              avatar_url: authState.user.avatar,
            },
          };

          return {
            data: {
              session: {
                access_token: authState.accessToken,
                user: authUser,
              },
            },
            error: null,
          };
        }
      } catch (error) {
        console.warn("[CloudBase] getSession error:", error);
      }
    }

    return { data: { session: null }, error: null };
  }

  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { data: { subscription: { unsubscribe: () => void } } } {
    // CloudBase 不支持实时状态变化监听
    void callback;
    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  }
}

/**
 * 创建认证客户端实例
 */
function createAuthClient(): AuthClient {
  if (isChinaRegion()) {
    console.log("[Auth] Using CloudBase client (China)");
    return new CloudBaseAuthClient();
  } else {
    console.log("[Auth] Using Supabase client (International)");
    return new SupabaseAuthClient();
  }
}

/**
 * 全局认证客户端实例（单例）
 */
let authClientInstance: AuthClient | null = null;

/**
 * 获取认证客户端
 */
export function getAuthClient(): AuthClient {
  if (!authClientInstance) {
    authClientInstance = createAuthClient();
  }
  return authClientInstance;
}

/**
 * 认证客户端的命名空间对象
 * 提供类似 supabase.auth 的 API
 */
export const auth = {
  get client() {
    return getAuthClient();
  },
  signInWithPassword: (params: { email: string; password: string }) =>
    getAuthClient().signInWithPassword(params),
  signUp: (params: {
    email: string;
    password: string;
    options?: {
      data?: Record<string, any>;
      emailRedirectTo?: string;
      verificationCode?: string;
    };
  }) => getAuthClient().signUp(params),
  signInWithOtp: (params: { email: string; options?: any }) =>
    getAuthClient().signInWithOtp(params),
  sendEmailVerificationCode: (params: {
    email: string;
    purpose: "register" | "reset_password";
  }) => getAuthClient().sendEmailVerificationCode?.(params),
  resetPasswordWithCode: (params: {
    email: string;
    code: string;
    password: string;
    confirmPassword: string;
  }) => getAuthClient().resetPasswordWithCode?.(params),
  verifyOtp: (params: { email: string; token: string; type: string }) =>
    getAuthClient().verifyOtp(params),
  signOut: () => getAuthClient().signOut(),
  getUser: () => getAuthClient().getUser(),
  getSession: () => getAuthClient().getSession(),
  onAuthStateChange: (
    callback: (event: string, session: AuthSession | null) => void
  ) => getAuthClient().onAuthStateChange(callback),
  signInWithOAuth: (params: { provider: string; options?: any }) =>
    getAuthClient().signInWithOAuth(params),
  toDefaultLoginPage: (redirectUrl?: string) =>
    getAuthClient().toDefaultLoginPage?.(redirectUrl),
};
