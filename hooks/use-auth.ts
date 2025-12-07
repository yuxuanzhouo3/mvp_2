"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isChinaRegion } from "@/lib/config/region";

/**
 * 统一的用户类型
 */
export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  subscriptionTier?: "free" | "pro" | "enterprise";
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  isPro?: boolean;
}

/**
 * Auth session 类型
 */
export interface AuthSessionData {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * 统一的认证 Hook
 * 根据部署区域自动选择 Supabase (国际版) 或 CloudBase (中国版) 认证
 */
export function useAuth(): AuthSessionData & {
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    try {
      if (isChinaRegion()) {
        // 中国版：从 localStorage 读取
        const { getStoredAuthState } = await import(
          "@/lib/auth/auth-state-manager"
        );
        const authState = getStoredAuthState();

        if (authState?.user) {
          setUser({
            id: authState.user.id,
            email: authState.user.email,
            name: authState.user.name,
            avatar: authState.user.avatar,
            subscriptionTier:
              (authState.user.subscription_plan as AuthUser["subscriptionTier"]) ||
              "free",
            subscriptionPlan: authState.user.subscription_plan,
            subscriptionStatus: authState.user.subscription_status,
            isPro: authState.user.subscription_plan === "pro" ||
              authState.user.subscription_plan === "enterprise",
          });
        } else {
          setUser(null);
        }
      } else {
        // 国际版：优先从缓存读取，然后检查 Supabase session
        const { getSupabaseUserCache } = await import(
          "@/lib/auth/auth-state-manager-intl"
        );
        const cachedUser = getSupabaseUserCache();

        if (cachedUser) {
          setUser({
            id: cachedUser.id,
            email: cachedUser.email,
            name: cachedUser.name,
            avatar: cachedUser.avatar,
            subscriptionTier:
              (cachedUser.subscription_plan as AuthUser["subscriptionTier"]) ||
              "free",
            subscriptionPlan: cachedUser.subscription_plan,
            subscriptionStatus: cachedUser.subscription_status,
            isPro:
              cachedUser.subscription_plan === "pro" ||
              cachedUser.subscription_plan === "enterprise",
          });
        } else {
          // 尝试从 Supabase 获取
          const { auth } = await import("@/lib/auth/client");
          const { data } = await auth.getUser();

          if (data?.user) {
            setUser({
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.full_name,
              avatar: data.user.user_metadata?.avatar_url,
              subscriptionTier:
                (data.user.user_metadata?.subscription_plan as AuthUser["subscriptionTier"]) ||
                "free",
              subscriptionPlan: data.user.user_metadata?.subscription_plan,
              subscriptionStatus: data.user.user_metadata?.subscription_status,
              isPro:
                data.user.user_metadata?.subscription_plan === "pro" ||
                data.user.user_metadata?.subscription_plan === "enterprise",
            });
          } else {
            setUser(null);
          }
        }
      }
    } catch (error) {
      console.error("[useAuth] Error loading user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { auth } = await import("@/lib/auth/client");
      await auth.signOut();
      setUser(null);
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("[useAuth] Error signing out:", error);
    }
  }, [router]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadUser();
  }, [loadUser]);

  useEffect(() => {
    loadUser();

    // 监听用户状态变化（跨标签页同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "supabase-user-cache" ||
        e.key === "auth-state" ||
        e.key === "auth-token"
      ) {
        loadUser();
      }
    };

    // 监听自定义事件（同标签页同步）
    const handleUserChanged = () => {
      loadUser();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("supabase-user-changed", handleUserChanged);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("supabase-user-changed", handleUserChanged);
    };
  }, [loadUser]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut,
    refresh,
  };
}

/**
 * 简化的 session 格式，兼容 next-auth 的 useSession
 */
export function useSession(): {
  data: { user: AuthUser | null } | null;
  status: "loading" | "authenticated" | "unauthenticated";
} {
  const { user, isLoading, isAuthenticated } = useAuth();

  return {
    data: user ? { user } : null,
    status: isLoading
      ? "loading"
      : isAuthenticated
      ? "authenticated"
      : "unauthenticated",
  };
}
