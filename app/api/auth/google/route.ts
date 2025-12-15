import { NextRequest, NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";
import { supabase } from "@/lib/integrations/supabase";

/**
 * 国际版 Google 登录（Supabase OAuth）
 * GET /api/auth/google?redirectTo=<url>
 */
export async function GET(request: NextRequest) {
  if (isChinaRegion()) {
    return NextResponse.json(
      { error: "Google login is only available for the international site" },
      { status: 400 }
    );
  }

  const redirectTo =
    request.nextUrl.searchParams.get("redirectTo") ||
    `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/callback`;

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error || !data?.url) {
      return NextResponse.json(
        { error: error?.message || "Failed to start Google login" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err) {
    console.error("[/api/auth/google] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
