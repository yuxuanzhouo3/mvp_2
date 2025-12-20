import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenFromRequest,
  verifyAuthToken,
} from "@/lib/auth/auth-utils";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
const isProduction = process.env.NODE_ENV === "production";

export async function POST(request: NextRequest) {
  try {
    // Extract accessToken from Authorization header (optional for logout)
    const { token } = extractTokenFromRequest(request);

    if (token) {
      const authResult = await verifyAuthToken(token);

      if (authResult.success && authResult.userId) {
        console.log("[/api/auth/logout] Logout request from userId:", authResult.userId);
        // In a production system, you would revoke refresh tokens here
      }
    } else {
      console.log("[/api/auth/logout] Logout request without token (client-side cleanup)");
    }

    // Always return success - logout should clear client state regardless
    const response = NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );

    // 清除所有可能的认证cookies
    response.cookies.set("sb-access-token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("sb-refresh-token", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    // 尝试清除所有可能的Supabase认证cookies
    // 这些cookies可能存在于不同的路径或域名下
    const possibleAuthCookies = [
      "sb-access-token",
      "sb-refresh-token",
      "supabase.auth.token",
      "supabase.auth.expiresAt",
      "supabase.auth.refreshToken"
    ];

    possibleAuthCookies.forEach(name => {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    });

    return response;
  } catch (error: any) {
    console.error("[/api/auth/logout] Error:", error.message);

    // Still return success for logout - client should clear state
    const response = NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );

    // 清除所有可能的认证cookies
    response.cookies.set("sb-access-token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    response.cookies.set("sb-refresh-token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    // 尝试清除所有可能的Supabase认证cookies
    // 这些cookies可能存在于不同的路径或域名下
    const possibleAuthCookies = [
      "sb-access-token",
      "sb-refresh-token",
      "supabase.auth.token",
      "supabase.auth.expiresAt",
      "supabase.auth.refreshToken"
    ];

    possibleAuthCookies.forEach(name => {
      response.cookies.set(name, "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    });

    return response;
  }
}
