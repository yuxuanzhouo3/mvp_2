/**
 * 统一认证工具
 * 根据部署区域（NEXT_PUBLIC_DEPLOY_REGION）自动选择 CloudBase 或 Supabase 认证
 */

import { isChinaRegion } from "@/lib/config/region";
import { supabase } from "@/lib/integrations/supabase";
import cloudbase from "@cloudbase/node-sdk";
import * as jwt from "jsonwebtoken";

let cachedApp: any = null;

function getCloudBaseApp() {
  if (cachedApp) {
    return cachedApp;
  }

  cachedApp = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });

  return cachedApp;
}

/**
 * 验证并获取用户信息
 */
export async function verifyAuthToken(token: string): Promise<{
  success: boolean;
  userId?: string;
  user?: any;
  error?: string;
  region?: "CN" | "INTL";
}> {
  if (!token) {
    return { success: false, error: "Missing token" };
  }

  try {
    const region = isChinaRegion() ? "CN" : "INTL";

    if (region === "CN") {
      // 中国区域：CloudBase JWT 验证
      let payload: any;
      try {
        payload = jwt.verify(
          token,
          process.env.JWT_SECRET || "fallback-secret-key-for-development-only"
        );
      } catch (error) {
        console.error("[Auth Utils] JWT verification failed:", error);
        return {
          success: false,
          error: "Invalid token signature or expired",
          region,
        };
      }

      // 提取 userId
      const userId = payload.userId;
      if (!userId) {
        return { success: false, error: "Invalid token payload", region };
      }

      // 验证用户是否存在
      const db = getCloudBaseApp().database();
      const res = await db.collection("users").doc(userId).get();

      if (!res.data || res.data.length === 0) {
        return { success: false, error: "User not found", region };
      }

      return {
        success: true,
        userId,
        user: {
          id: userId,
          ...res.data[0],
        },
        region,
      };
    } else {
      // 国际区域：Supabase
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
          return { success: false, error: "Invalid Supabase token", region };
        }

        return {
          success: true,
          userId: user.id,
          user,
          region,
        };
      } catch (supabaseError) {
        console.error("[Auth Utils] Supabase auth error:", supabaseError);
        return {
          success: false,
          error: "Supabase authentication failed",
          region,
        };
      }
    }
  } catch (error) {
    console.error("[Auth Utils] Token verification error:", error);
    return { success: false, error: "Token verification failed" };
  }
}

/**
 * 从请求头中提取 token
 */
export function extractTokenFromHeader(authHeader: string | null): {
  token: string | null;
  error: string | null;
} {
  if (!authHeader) {
    return { token: null, error: "Missing authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { token: null, error: "Invalid authorization header format" };
  }

  const token = authHeader.replace("Bearer ", "");
  return { token, error: null };
}

/**
 * 获取数据库实例
 * 国内版返回 CloudBase db，国际版返回 Supabase client
 */
export function getDatabase() {
  if (isChinaRegion()) {
    return getCloudBaseApp().database();
  } else {
    return supabase;
  }
}
