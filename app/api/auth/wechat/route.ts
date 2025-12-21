import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isChinaRegion } from "@/lib/config/region";
import { cloudbaseSignInWithWechat } from "@/lib/auth/cloudbase-auth";
import { getCloudBaseDatabase, CloudBaseCollections } from "@/lib/database/cloudbase-client";

/**
 * 微信 OAuth 回调处理
 * POST /api/auth/wechat
 *
 * 请求体: { code: string, state?: string }
 *
 * 流程:
 * 1. 使用授权码换取 access_token 和 openid
 * 2. 获取微信用户信息
 * 3. 创建或更新本地用户
 * 4. 查询用户订阅状态
 * 5. 生成会话 token 并设置 cookie
 */
export async function POST(request: Request) {
  // 非中国区域返回 404
  if (!isChinaRegion()) {
    return NextResponse.json(
      { error: "WeChat login is only available in China region" },
      { status: 404 }
    );
  }

  const appId = process.env.WECHAT_APP_ID || process.env.NEXT_PUBLIC_WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  if (!appId || !appSecret) {
    console.error("[WeChat Auth] Missing WECHAT_APP_ID or WECHAT_APP_SECRET");
    return NextResponse.json(
      { error: "WeChat login is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { code, state } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    console.log("[WeChat Auth] Processing login with code:", code.substring(0, 10) + "...");

    // 1. 使用授权码换取 access_token 和 openid
    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.errcode) {
      console.error("[WeChat Auth] Token exchange failed:", tokenData);
      return NextResponse.json(
        { error: "WeChat authorization failed", details: tokenData.errmsg },
        { status: 401 }
      );
    }

    const { access_token, openid, unionid } = tokenData;
    console.log("[WeChat Auth] Got openid:", openid);

    // 2. 获取微信用户信息
    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${access_token}&openid=${openid}`;

    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = await userInfoResponse.json();

    if (userInfo.errcode) {
      console.error("[WeChat Auth] Failed to get user info:", userInfo);
      // 即使获取用户信息失败，也尝试使用 openid 登录
    }

    const nickname = userInfo.nickname || null;
    const avatar = userInfo.headimgurl || null;

    console.log("[WeChat Auth] Got user info:", { nickname, avatar: avatar ? "yes" : "no" });

    // 3. 调用 CloudBase 认证服务创建或更新用户
    const result = await cloudbaseSignInWithWechat({
      openid,
      unionid: unionid || null,
      nickname,
      avatar,
    });

    if (!result.success || !result.user) {
      console.error("[WeChat Auth] CloudBase signIn failed:", result.message);
      return NextResponse.json(
        { error: "Login failed", details: result.message },
        { status: 500 }
      );
    }

    console.log("[WeChat Auth] User signed in:", result.user._id);

    // 4. 查询用户订阅状态
    let subscriptionData = {
      pro: result.user.pro || false,
      plan: result.user.plan || "free",
      plan_exp: result.user.plan_exp || null,
      subscription_status: "inactive" as string,
    };

    try {
      const db = getCloudBaseDatabase();
      const now = new Date().toISOString();

      const subscriptionResult = await db
        .collection(CloudBaseCollections.USER_SUBSCRIPTIONS)
        .where({
          user_id: result.user._id,
          status: "active",
        })
        .orderBy("subscription_end", "desc")
        .limit(1)
        .get();

      if (subscriptionResult.data && subscriptionResult.data.length > 0) {
        const subscription = subscriptionResult.data[0];
        // 检查订阅是否过期
        if (subscription.subscription_end > now) {
          subscriptionData = {
            pro: true,
            plan: subscription.plan_type || "pro",
            plan_exp: subscription.subscription_end,
            subscription_status: "active",
          };
          console.log("[WeChat Auth] Found active subscription:", subscription.plan_type);
        }
      }
    } catch (subError) {
      console.warn("[WeChat Auth] Error checking subscription:", subError);
      // 订阅查询失败不影响登录
    }

    // 5. 设置 auth-token cookie
    const cookieStore = await cookies();
    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user._id,
        email: result.user.email,
        name: result.user.name,
        avatar: result.user.avatar,
        createdAt: result.user.createdAt,
        // 订阅相关字段
        subscription_plan: subscriptionData.plan,
        subscription_status: subscriptionData.subscription_status,
        metadata: {
          pro: subscriptionData.pro,
          region: result.user.region || "CN",
          plan: subscriptionData.plan,
          plan_exp: subscriptionData.plan_exp,
          hide_ads: result.user.hide_ads || subscriptionData.pro,
        },
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenMeta: result.tokenMeta,
    });

    // 设置 httpOnly cookie
    response.cookies.set("auth-token", result.accessToken!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[WeChat Auth] Error:", error);
    return NextResponse.json(
      { error: "WeChat login failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
