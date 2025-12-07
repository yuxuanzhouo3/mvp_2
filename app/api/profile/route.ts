import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isChinaRegion } from "@/lib/config/region";

/**
 * GET /api/profile
 * Returns the current user's profile information
 * Used by the Supabase auth client to refresh user info after login
 */
export async function GET(request: NextRequest) {
  try {
    // This endpoint is only for international (Supabase) region
    if (isChinaRegion()) {
      return NextResponse.json(
        { error: "This endpoint is not available in China region" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[/api/profile] Missing Supabase environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Get the authorization header or cookies for authentication
    const authHeader = request.headers.get("authorization");
    const cookies = request.cookies;

    // Try to get access token from various sources
    let accessToken: string | undefined;

    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
    }

    // Supabase stores tokens in cookies with specific names
    const supabaseAuthToken = cookies.get("sb-access-token")?.value
      || cookies.get(`sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`)?.value;

    if (supabaseAuthToken) {
      try {
        const parsed = JSON.parse(supabaseAuthToken);
        accessToken = parsed.access_token || accessToken;
      } catch {
        // If not JSON, use as-is
        accessToken = supabaseAuthToken;
      }
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get the current user using the session
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      console.log("[/api/profile] No authenticated user found");
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Try to get additional profile data from profiles table if it exists
    let profileData: any = null;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      profileData = profile;
    } catch {
      // profiles table might not exist, which is fine
      console.log("[/api/profile] No profiles table or profile not found");
    }

    // Build the response matching SupabaseUserProfile interface
    const userProfile = {
      id: user.id,
      email: user.email || "",
      name: profileData?.name || profileData?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
      avatar: profileData?.avatar || profileData?.avatar_url || user.user_metadata?.avatar_url || "",
      subscription_plan: profileData?.subscription_plan || user.user_metadata?.subscription_plan || "free",
      subscription_status: profileData?.subscription_status || user.user_metadata?.subscription_status || "active",
      membership_expires_at: profileData?.membership_expires_at || user.user_metadata?.membership_expires_at || null,
    };

    console.log("[/api/profile] Returning profile for user:", user.id);

    return NextResponse.json(userProfile);
  } catch (error: any) {
    console.error("[/api/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
