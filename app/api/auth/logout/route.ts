import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenFromRequest,
  verifyAuthToken,
} from "@/lib/auth/auth-utils";

// Force dynamic rendering for this route
export const dynamic = "force-dynamic";
const isProduction = process.env.NODE_ENV === "production";

function clearAuthCookies(response: NextResponse, secure: boolean) {
  const possibleAuthCookies = [
    "auth-token",
    "sb-access-token",
    "sb-refresh-token",
    "supabase.auth.token",
    "supabase.auth.expiresAt",
    "supabase.auth.refreshToken",
  ];

  possibleAuthCookies.forEach((name) => {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    // Extract access token from request (optional for logout)
    const { token } = extractTokenFromRequest(request);

    if (token) {
      const authResult = await verifyAuthToken(token);

      if (authResult.success && authResult.userId) {
        console.log("[/api/auth/logout] Logout request from userId:", authResult.userId);
        // In a production system, you would revoke refresh tokens here.
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

    clearAuthCookies(response, isProduction);
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

    clearAuthCookies(response, true);
    return response;
  }
}
