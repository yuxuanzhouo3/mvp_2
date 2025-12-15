import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/integrations/supabase";
import { isChinaRegion } from "@/lib/config/region";

const DEFAULT_REDIRECT_PATH = "/dashboard";
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 14; // 14 days
const isProduction = process.env.NODE_ENV === "production";

function getBaseUrl(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    request.nextUrl.origin
  );
}

function resolveRedirectPath(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("next");
  if (!requested) return DEFAULT_REDIRECT_PATH;

  try {
    const url = new URL(requested, request.nextUrl.origin);
    // Prevent open redirects
    if (url.origin === request.nextUrl.origin) {
      return url.pathname + url.search;
    }
  } catch {
    // ignore malformed redirect
  }

  return DEFAULT_REDIRECT_PATH;
}

export async function GET(request: NextRequest) {
  if (isChinaRegion()) {
    return NextResponse.redirect(
      new URL("/login?error=region_not_supported", request.nextUrl.origin)
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=no_code", request.nextUrl.origin)
    );
  }

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      console.error("[/api/auth/callback] Failed to exchange code:", error);
      return NextResponse.redirect(
        new URL("/login?error=auth_failed", request.nextUrl.origin)
      );
    }

    const baseUrl = getBaseUrl(request);
    const redirectPath = resolveRedirectPath(request);
    const redirectUrl = new URL(redirectPath, baseUrl);

    const response = NextResponse.redirect(redirectUrl, { status: 307 });

    // HttpOnly cookies for Supabase tokens
    response.cookies.set("sb-access-token", data.session.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: data.session.expires_in ?? 60 * 60,
    });

    if (data.session.refresh_token) {
      response.cookies.set("sb-refresh-token", data.session.refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: REFRESH_TOKEN_MAX_AGE,
      });
    }

    return response;
  } catch (err) {
    console.error("[/api/auth/callback] Unexpected error:", err);
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", request.nextUrl.origin)
    );
  }
}
