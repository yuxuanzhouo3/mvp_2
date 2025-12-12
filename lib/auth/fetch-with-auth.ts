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
    // 中国版：从 localStorage 获取
    if (typeof window !== "undefined") {
      authToken = localStorage.getItem("auth-token");
    }
  } else {
    // 国际版：强制刷新session以确保token有效
    try {
      const supabase = await import("@/lib/integrations/supabase");

      // 强制刷新session，确保token有效
      const { data: refreshData } = await supabase.supabase.auth.refreshSession();

      if (refreshData.session?.access_token) {
        // 检查token是否即将过期（5分钟内）
        const expiresAt = refreshData.session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const timeToExpiry = expiresAt - now;

        if (timeToExpiry > 60) { // 还有1分钟以上才使用
          authToken = refreshData.session.access_token;
        }
      }
    } catch (error) {
      console.warn("Failed to refresh session:", error);
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
