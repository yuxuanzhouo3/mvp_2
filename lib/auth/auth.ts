// lib/auth/auth.ts - 认证工具函数
import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenFromRequest,
  verifyAuthToken,
} from "@/lib/auth/auth-utils";

/**
 * 验证用户认证状态
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: any;
  session: any;
} | null> {
  try {
    const { token, error: tokenError } = extractTokenFromRequest(request);

    if (!token || tokenError) {
      console.error("Missing or invalid authorization header", tokenError);
      return null;
    }

    const verification = await verifyAuthToken(token);
    if (!verification.success || !verification.user) {
      console.error(
        "Auth verification failed:",
        verification.error || "Unknown error"
      );
      return null;
    }

    // Remove sensitive fields like hashed password if present
    const { password, ...safeUser } = verification.user;
    void password;

    return {
      user: safeUser,
      session: {
        access_token: token,
        region: verification.region,
      },
    };
  } catch (error) {
    console.error("Auth verification error:", error);
    return null;
  }
}

/**
 * 创建认证失败的响应
 */
export function createAuthErrorResponse(
  message: string = "Authentication required"
) {
  return NextResponse.json(
    { error: message, code: "AUTH_REQUIRED" },
    { status: 401 }
  );
}
