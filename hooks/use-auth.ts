"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isChinaRegion } from "@/lib/config/region";

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

export interface AuthSessionData {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

function toAuthUser(input: any): AuthUser | null {
  if (!input) return null;

  const id = input.id || input._id;
  if (!id) return null;

  const subscriptionPlan =
    input.subscription_plan ||
    input.plan ||
    input.user_metadata?.subscription_plan ||
    input.metadata?.plan ||
    "free";

  const subscriptionStatus =
    input.subscription_status || input.user_metadata?.subscription_status;

  return {
    id,
    email: input.email,
    name: input.name || input.user_metadata?.full_name,
    avatar: input.avatar || input.user_metadata?.avatar_url,
    subscriptionTier: subscriptionPlan as AuthUser["subscriptionTier"],
    subscriptionPlan,
    subscriptionStatus,
    isPro: subscriptionPlan === "pro" || subscriptionPlan === "enterprise",
  };
}

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
        const { getStoredAuthState } = await import("@/lib/auth/auth-state-manager");
        const authState = getStoredAuthState();

        const localUser = toAuthUser(authState?.user);
        if (localUser) {
          setUser(localUser);
          return;
        }

        // local state may be gone after WebView/process recycle; recover from cookie session.
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          setUser(null);
          return;
        }

        const payload = await response.json().catch(() => null);
        setUser(toAuthUser(payload?.user));
        return;
      }

      // INTL: prefer cache, then fallback to provider session.
      const { getSupabaseUserCache } = await import("@/lib/auth/auth-state-manager-intl");
      const cachedUser = getSupabaseUserCache();

      if (cachedUser) {
        setUser(toAuthUser(cachedUser));
        return;
      }

      const { auth } = await import("@/lib/auth/client");
      const { data } = await auth.getUser();
      setUser(toAuthUser(data?.user));
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

    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === "supabase-user-cache" ||
        e.key === "auth-state" ||
        e.key === "auth-token" ||
        e.key === "app-auth-state"
      ) {
        loadUser();
      }
    };

    const handleUserChanged = () => {
      loadUser();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("supabase-user-changed", handleUserChanged);
    window.addEventListener("auth-state-changed", handleUserChanged);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("supabase-user-changed", handleUserChanged);
      window.removeEventListener("auth-state-changed", handleUserChanged);
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
