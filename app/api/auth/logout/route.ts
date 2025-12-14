import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/auth-utils";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Extract accessToken from Authorization header (optional for logout)
    const authHeader = request.headers.get("authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7); // Remove "Bearer " prefix
      const authResult = await verifyAuthToken(token);

      if (authResult.success && authResult.userId) {
        console.log("[/api/auth/logout] Logout request from userId:", authResult.userId);
        // In a production system, you would revoke refresh tokens here
      }
    } else {
      console.log("[/api/auth/logout] Logout request without token (client-side cleanup)");
    }

    // Always return success - logout should clear client state regardless
    return NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[/api/auth/logout] Error:", error.message);

    // Still return success for logout - client should clear state
    return NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );
  }
}
