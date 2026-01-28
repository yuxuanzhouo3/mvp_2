import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { isChinaRegion } from "@/lib/config/region";
import cloudbase from "@cloudbase/node-sdk";
import { extractTokenFromRequest, verifyAuthToken } from "@/lib/auth/auth-utils";

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// CloudBase 应用缓存
let cachedCloudBaseApp: any = null;

function getCloudBaseApp() {
  if (cachedCloudBaseApp) {
    return cachedCloudBaseApp;
  }

  cachedCloudBaseApp = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });

  return cachedCloudBaseApp;
}

/**
 * GET /api/profile
 * Returns the current user's profile information
 * Supports both INTL (Supabase) and CN (CloudBase) regions
 */
export async function GET(request: NextRequest) {
  try {
    if (isChinaRegion()) {
      // ==================== CN 环境：CloudBase ====================
      return await handleChinaProfile(request);
    } else {
      // ==================== INTL 环境：Supabase ====================
      return await handleIntlProfile(request);
    }
  } catch (error: any) {
    console.error("[/api/profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * CN 环境：使用 CloudBase 获取用户资料
 */
async function handleChinaProfile(request: NextRequest) {
  // 提取并验证 token
  const { token, error: tokenError } = extractTokenFromRequest(request);
  
  if (!token || tokenError) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const verification = await verifyAuthToken(token);
  
  if (!verification.success || !verification.user) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }

  const user = verification.user;
  const userId = verification.userId || user.id || user._id;

  // 获取 CloudBase 数据库
  const db = getCloudBaseApp().database();

  // 获取用户基本信息
  let userData = user;
  
  // 尝试从 users 集合获取最新数据
  try {
    const userResult = await db.collection("users").doc(userId).get();
    if (userResult.data && userResult.data.length > 0) {
      userData = userResult.data[0];
    } else if (userResult.data && !Array.isArray(userResult.data)) {
      userData = userResult.data;
    }
  } catch {
    console.log("[/api/profile CN] Failed to fetch user from users collection");
  }

  // 获取用户订阅状态
  let subscriptionData: any = null;
  try {
    const now = new Date().toISOString();
    const subscriptionResult = await db
      .collection("user_subscriptions")
      .where({
        user_id: userId,
        status: "active",
      })
      .orderBy("subscription_end", "desc")
      .limit(1)
      .get();

    if (subscriptionResult.data && subscriptionResult.data.length > 0) {
      const subscription = subscriptionResult.data[0];
      // 检查是否过期
      if (subscription.subscription_end > now) {
        subscriptionData = subscription;
      }
    }
  } catch {
    console.log("[/api/profile CN] No active subscription found");
  }

  // 确定订阅计划
  const normalizePlan = (plan?: string | null): string => {
    const val = (plan || "").toLowerCase();
    if (val.includes("enterprise")) return "enterprise";
    if (val.includes("pro")) return "pro";
    return "free";
  };

  let resolvedPlan = "free";
  let resolvedStatus = "inactive";

  if (subscriptionData) {
    resolvedPlan = normalizePlan(subscriptionData.plan_type);
    resolvedStatus = subscriptionData.status || "active";
  } else if (userData.subscription_plan) {
    resolvedPlan = normalizePlan(userData.subscription_plan);
    resolvedStatus = userData.subscription_status || "inactive";
  } else if (userData.pro === true) {
    resolvedPlan = "pro";
    resolvedStatus = "active";
  }

  // 构建响应
  const userProfile = {
    id: userId,
    email: userData.email || "",
    name: userData.name || userData.full_name || "",
    avatar: userData.avatar || userData.avatar_url || "",
    subscription_plan: resolvedPlan,
    subscription_status: resolvedStatus,
    membership_expires_at: subscriptionData?.subscription_end || null,
    region: "CN",
  };

  console.log("[/api/profile CN] Returning profile for user:", userId);

  return NextResponse.json(userProfile);
}

/**
 * INTL 环境：使用 Supabase 获取用户资料
 */
async function handleIntlProfile(request: NextRequest) {
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

  // 获取用户的实际订阅状态（从 user_subscriptions 表）
  let subscriptionData: any = null;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: subscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .gte("subscription_end", new Date().toISOString())
      .single();

    subscriptionData = subscription;
    console.log("[/api/profile] Found active subscription:", subscription?.plan_type);
  } catch {
    console.log("[/api/profile] No active subscription found or table doesn't exist");
  }

  // 获取最近一次成功支付的信息作为兜底
  let latestPayment: any = null;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("metadata, status, created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    latestPayment = payment;
  } catch {
    console.log("[/api/profile] Failed to fetch latest payment");
  }

  // 确定正确的订阅计划
  const normalizePlan = (plan?: string | null): string => {
    const val = (plan || "").toLowerCase();
    if (val.includes("enterprise")) return "enterprise";
    if (val.includes("pro")) return "pro";
    return "free";
  };

  // 优先级：user_subscriptions > payments metadata > user_profiles > default
  let resolvedPlan = "free";
  let resolvedStatus = "inactive";

  if (subscriptionData) {
    resolvedPlan = normalizePlan(subscriptionData.plan_type);
    resolvedStatus = subscriptionData.status || "active";
  } else if (latestPayment?.metadata) {
    const meta = latestPayment.metadata;
    const paymentPlan = normalizePlan(
      meta?.planType || meta?.tier || meta?.plan || meta?.plan_type || meta?.subscription_plan
    );
    if (paymentPlan !== "free") {
      resolvedPlan = paymentPlan;
      resolvedStatus = "active";
    }
  } else if (profileData?.subscription_tier) {
    resolvedPlan = normalizePlan(profileData.subscription_tier);
    resolvedStatus = profileData.subscription_status || "inactive";
  }

  console.log("[/api/profile] Resolved subscription plan:", resolvedPlan, "status:", resolvedStatus);

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
    subscription_plan: resolvedPlan,
    subscription_status: resolvedStatus,
    membership_expires_at: subscriptionData?.subscription_end || latestProfileData?.membership_expires_at || user.user_metadata?.membership_expires_at || null,
    region: "INTL",
  };

  console.log("[/api/profile] Returning profile for user:", user.id);

  return NextResponse.json(userProfile);
}
