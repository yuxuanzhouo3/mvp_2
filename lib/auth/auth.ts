// lib/auth/auth.ts - 璁よ瘉宸ュ叿鍑芥暟
import { NextRequest, NextResponse } from "next/server";
import {
  extractTokenFromHeader,
  verifyAuthToken,
} from "@/lib/auth/auth-utils";

/**
 * 楠岃瘉鐢ㄦ埛璁よ瘉鐘舵€?
 */
export async function requireAuth(request: NextRequest): Promise<{
  user: any;
  session: any;
} | null> {
  try {
    const { token, error: tokenError } = extractTokenFromHeader(
      request.headers.get("authorization")
    );

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
 * 鍒涘缓璁よ瘉澶辫触鐨勫搷搴?
 */
export function createAuthErrorResponse(
  message: string = "Authentication required"
) {
  return NextResponse.json(
    { error: message, code: "AUTH_REQUIRED" },
    { status: 401 }
  );
}
