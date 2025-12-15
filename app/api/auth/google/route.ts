import { NextRequest, NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";
import { supabase } from "@/lib/integrations/supabase";

const DEFAULT_NEXT = "/dashboard";

function getBaseUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    request.nextUrl.origin
  );
}

function resolveNext(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("redirectTo");
  if (!requested) return DEFAULT_NEXT;

  try {
    const url = new URL(requested, request.nextUrl.origin);
    if (url.origin === request.nextUrl.origin) {
      return url.pathname + url.search;
    }
  } catch {
    // ignore invalid redirect
  }

  return DEFAULT_NEXT;
}

/**
 * Google 登录 (Supabase OAuth)
 * GET /api/auth/google?redirectTo=<path>
 */
export async function GET(request: NextRequest) {
  if (isChinaRegion()) {
    return NextResponse.json(
      { error: "Google login is only available for the international site" },
      { status: 400 }
    );
  }

  const baseUrl = getBaseUrl(request);
  const nextPath = resolveNext(request);

  const callbackUrl = new URL("/api/auth/callback", baseUrl);
  callbackUrl.searchParams.set("next", nextPath);

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error || !data?.url) {
      return NextResponse.json(
        { error: error?.message || "Failed to start Google login" },
        { status: 500 }
      );
    }

    const wantsJson = request.headers
      .get("accept")
      ?.toLowerCase()
      .includes("application/json");

    if (wantsJson) {
      return NextResponse.json({ url: data.url });
    }

    return NextResponse.redirect(data.url, { status: 307 });
  } catch (err) {
    console.error("[/api/auth/google] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
