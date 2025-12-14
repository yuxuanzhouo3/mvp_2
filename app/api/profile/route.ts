import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { isChinaRegion } from "@/lib/config/region";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

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

    // Try to get additional profile data from user_profiles table
    let profileData: any = null;
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      profileData = profile;
    } catch {
      // user_profiles table might not exist or profile not found
      console.log("[/api/profile] No user_profiles table or profile not found");
    }

    // Update or create user_profiles record
    try {
      const supabaseAdmin = getSupabaseAdmin();

      const profileUpdate = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || profileData?.full_name || "",
        subscription_tier: profileData?.subscription_tier || "free",
        subscription_status: profileData?.subscription_status || "active",
        updated_at: new Date().toISOString(),
      };

      if (profileData) {
        // Update existing profile
        console.log("[/api/profile] Updating existing user profile");
        await supabaseAdmin
          .from("user_profiles")
          .update(profileUpdate)
          .eq("id", user.id);
      } else {
        // Insert new profile
        console.log("[/api/profile] Creating new user profile");
        await supabaseAdmin
          .from("user_profiles")
          .insert({
            ...profileUpdate,
            created_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error("[/api/profile] Failed to update user_profiles table:", error);
      // Continue with the response even if profile update fails
    }

    // Get the latest profile data after update
    let latestProfileData = profileData;
    try {
      const { data: updatedProfile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (updatedProfile) {
        latestProfileData = updatedProfile;
      }
    } catch (error) {
      console.warn("[/api/profile] Failed to fetch updated profile:", error);
    }

    // Build the response matching SupabaseUserProfile interface
    const userProfile = {
      id: user.id,
      email: user.email || "",
      name: latestProfileData?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
      avatar: latestProfileData?.avatar || latestProfileData?.avatar_url || user.user_metadata?.avatar_url || "",
      subscription_plan: latestProfileData?.subscription_tier || "free",
      subscription_status: latestProfileData?.subscription_status || "active",
      membership_expires_at: latestProfileData?.membership_expires_at || user.user_metadata?.membership_expires_at || null,
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
