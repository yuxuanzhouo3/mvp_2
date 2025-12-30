import { NextRequest, NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";
import { cloudbaseSignInWithWechat } from "@/lib/auth/cloudbase-auth";

/**
 * 微信小程序登录预检查 API
 * POST /api/wxlogin/check
 *
 * 用于小程序端使用 wx.login() 获取的 code 换取用户信息和 token
 * 注意：code 只能使用一次，被此 API 消耗后返回 token
 */
export async function POST(request: NextRequest) {
  // 仅限 CN 环境
  if (!isChinaRegion()) {
    return NextResponse.json(
      { success: false, error: "NOT_SUPPORTED", message: "仅支持中国区域" },
      { status: 404 }
    );
  }

  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: "INVALID_PARAMS", message: "code is required" },
        { status: 400 }
      );
    }

    // 获取小程序配置（优先使用小程序专用配置）
    const appId = process.env.WX_MINI_APPID || process.env.WECHAT_APP_ID;
    const appSecret = process.env.WX_MINI_SECRET || process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
      console.error("[wxlogin/check] Missing WX_MINI_APPID or WX_MINI_SECRET");
      return NextResponse.json(
        { success: false, error: "CONFIG_ERROR", message: "服务端配置错误" },
        { status: 500 }
      );
    }

    // 调用微信 jscode2session API（消耗 code）
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    console.log("[wxlogin/check] Calling jscode2session...");
    const wxResponse = await fetch(wxUrl);
    const wxData = await wxResponse.json();

    if (wxData.errcode || !wxData.openid) {
      console.error("[wxlogin/check] jscode2session error:", wxData);
      return NextResponse.json(
        { success: false, error: "INVALID_CODE", message: wxData.errmsg || "code 无效或已过期" },
        { status: 401 }
      );
    }

    const { openid, unionid, session_key } = wxData;
    console.log("[wxlogin/check] Got openid:", openid);

    // 使用 CloudBase 认证服务创建或查询用户
    const result = await cloudbaseSignInWithWechat({
      openid,
      unionid: unionid || null,
      nickname: null, // 小程序端会单独获取用户信息
      avatar: null,
    });

    if (!result.success || !result.user) {
      console.error("[wxlogin/check] CloudBase signIn failed:", result.message);
      return NextResponse.json(
        { success: false, error: "LOGIN_FAILED", message: result.message },
        { status: 500 }
      );
    }

    const user = result.user;
    const hasProfile = !!(user.name && user.name !== "微信用户" && user.avatar);
    const expiresIn = result.tokenMeta?.accessTokenExpiresIn || 7 * 24 * 60 * 60; // 默认 7 天

    console.log("[wxlogin/check] Success:", { openid, userId: user._id, hasProfile });

    return NextResponse.json({
      success: true,
      exists: true,
      hasProfile,
      openid,
      token: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn,
      userName: user.name || null,
      userAvatar: user.avatar || null,
      userId: user._id,
    });
  } catch (error) {
    console.error("[wxlogin/check] Error:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "服务器错误" },
      { status: 500 }
    );
  }
}
