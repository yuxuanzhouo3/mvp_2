// app/api/auth/me/route.ts - 获取当前用户信息API（统一 JWT 校验）
import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenFromRequest,
  verifyAuthToken,
} from "@/lib/auth/auth-utils";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * 通过 Authorization Bearer Token + 区域内校验（CloudBase/Supabase）获取用户信息
 */
export async function GET(request: NextRequest) {
  try {
    const { token, error } = extractTokenFromRequest(request);

    if (!token || error) {
      return NextResponse.json(
        { success: false, error: error || "Missing authorization header" },
        { status: 401 }
      );
    }

    const verification = await verifyAuthToken(token);

    if (!verification.success || !verification.user) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || "Invalid token",
        },
        { status: 401 }
      );
    }

    const { password, ...safeUser } = verification.user;

    return NextResponse.json({
      success: true,
      user: safeUser,
      session: {
        access_token: token,
        region: verification.region,
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
