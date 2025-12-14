// app/api/auth/me/route.ts - 获取当前用户信息API（中国版）
import { NextRequest, NextResponse } from "next/server";
import { getStoredAuthState } from "@/lib/auth/auth-state-manager";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me
 * 获取当前用户信息（中国版认证）
 */
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取JWT token
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // 获取存储的认证状态
    const authState = getStoredAuthState();

    // 验证token是否匹配
    if (!authState || !authState.accessToken || authState.accessToken !== token) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401 }
      );
    }

    // 检查token是否过期
    if (authState.tokenMeta?.accessTokenExpiresIn) {
      const expiresAt = new Date(authState.createdAt || 0).getTime() +
        (authState.tokenMeta.accessTokenExpiresIn * 1000);
      if (Date.now() > expiresAt) {
        return NextResponse.json(
          { success: false, error: "Token expired" },
          { status: 401 }
        );
      }
    }

    // 返回用户信息
    return NextResponse.json({
      success: true,
      user: authState.user,
      session: {
        access_token: authState.accessToken,
        refresh_token: authState.refreshToken,
      },
    });
  } catch (error) {
    console.error("Auth verification error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}


