// lib/auth/fetch-with-auth.ts - 带认证的 fetch 工具函数

import { isChinaRegion } from "@/lib/config/region";

/**
 * 获取认证 headers
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let authToken: string | null = null;

  if (isChinaRegion()) {
    // 中国版：从 auth-state-manager 获取有效的 access token
    if (typeof window !== "undefined") {
      try {
        const { getValidAccessToken } = await import("@/lib/auth/auth-state-manager");
        authToken = await getValidAccessToken();
      } catch (error) {
        console.error("[fetchWithAuth] Failed to get auth token:", error);
        // 回退到旧的 auth-token 键（兼容性）
        authToken = localStorage.getItem("auth-token");
      }
    }
  } else {
    // 国际版：优先使用当前 session，没有则强制刷新
    try {
      const supabase = await import("@/lib/integrations/supabase");

      // 先尝试获取现有 session（Supabase 会自动处理续期）
      const { data: sessionData } = await supabase.supabase.auth.getSession();
      if (sessionData.session?.access_token) {
        authToken = sessionData.session.access_token;
      } else {
        // 兜底刷新 session
        const { data: refreshData } = await supabase.supabase.auth.refreshSession();
        if (refreshData.session?.access_token) {
          authToken = refreshData.session.access_token;
        }
      }
    } catch (error) {
      console.error("Failed to refresh session:", error);
    }
  }

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  return headers;
}

/**
 * 带认证的 fetch 函数
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = await getAuthHeaders();

  // 处理相对 URL，确保在客户端环境中正确解析
  let finalUrl = url;
  if (typeof window !== "undefined" && url.startsWith("/")) {
    // 在浏览器环境中，将相对 URL 解析为绝对 URL
    finalUrl = window.location.origin + url;
  }

  const mergedOptions: RequestInit = {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {}),
    },
  };

  return fetch(finalUrl, mergedOptions);
}
