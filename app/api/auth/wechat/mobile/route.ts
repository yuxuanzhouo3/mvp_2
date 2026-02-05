import { NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";
import { cloudbaseSignInWithWechat } from "@/lib/auth/cloudbase-auth";
import { getCloudBaseDatabase, CloudBaseCollections } from "@/lib/database/cloudbase-client";
import { parseWeChatSignedState } from "@/lib/auth/wechat-oauth";

export async function POST(request: Request) {
  if (!isChinaRegion()) {
    return NextResponse.json(
      { error: "WeChat login is only available in China region" },
      { status: 404 }
    );
  }

  const appId = process.env.WECHAT_MOBILE_APP || process.env.WECHAT_MOBILE_APP_ID;
  const appSecret = process.env.WECHAT_MOBILE_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "WeChat mobile app login is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json().catch(() => ({} as any));
    const code = (body as any)?.code as string | undefined;
    const state = (body as any)?.state as string | undefined;

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 }
      );
    }

    if (!state) {
      return NextResponse.json(
        { error: "缺少 state", errorCode: "MISSING_STATE" },
        { status: 400 }
      );
    }

    let signedState = null;
    try {
      signedState = parseWeChatSignedState(state);
    } catch {
      return NextResponse.json(
        { error: "WeChat state validation failed" },
        { status: 500 }
      );
    }

    if (!signedState || signedState.t !== "mobile_app") {
      return NextResponse.json(
        { error: "无效的 state", errorCode: "INVALID_STATE" },
        { status: 401 }
      );
    }

    const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${encodeURIComponent(
      appId
    )}&secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(
      code
    )}&grant_type=authorization_code`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = (await tokenResponse.json().catch(() => null)) as any;

    if (!tokenResponse.ok || !tokenData) {
      return NextResponse.json(
        { error: "WeChat authorization failed" },
        { status: 401 }
      );
    }

    if (tokenData.errcode) {
      return NextResponse.json(
        { error: "WeChat authorization failed", details: tokenData.errmsg },
        { status: 401 }
      );
    }

    const { access_token, openid, unionid } = tokenData as {
      access_token: string;
      openid: string;
      unionid?: string;
    };

    if (!openid || !access_token) {
      return NextResponse.json(
        { error: "WeChat authorization failed" },
        { status: 401 }
      );
    }

    const userInfoUrl = `https://api.weixin.qq.com/sns/userinfo?access_token=${encodeURIComponent(
      access_token
    )}&openid=${encodeURIComponent(openid)}`;

    const userInfoResponse = await fetch(userInfoUrl);
    const userInfo = (await userInfoResponse.json().catch(() => null)) as any;

    const nickname = userInfo?.nickname || null;
    const avatar = userInfo?.headimgurl || null;

    const result = await cloudbaseSignInWithWechat({
      openid,
      unionid: unionid || null,
      nickname,
      avatar,
    });

    if (!result.success || !result.user || !result.accessToken) {
      return NextResponse.json(
        { error: "Login failed", details: result.message },
        { status: 500 }
      );
    }

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
        if (subscription.subscription_end > now) {
          subscriptionData = {
            pro: true,
            plan: subscription.plan_type || "pro",
            plan_exp: subscription.subscription_end,
            subscription_status: "active",
          };
        }
      }
    } catch {}

    const response = NextResponse.json({
      success: true,
      user: {
        id: result.user._id,
        email: result.user.email,
        name: result.user.name,
        avatar: result.user.avatar,
        createdAt: result.user.createdAt,
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

    response.cookies.set("auth-token", result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "WeChat mobile app login failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
