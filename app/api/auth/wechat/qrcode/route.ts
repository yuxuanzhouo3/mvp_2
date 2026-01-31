import { NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";

/**
 * 获取微信扫码登录二维码 URL
 * GET /api/auth/wechat/qrcode?next=/path
 *
 * 仅在中国区域启用
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 非中国区域返回 404
  if (!isChinaRegion()) {
    return NextResponse.json(
      { error: "WeChat login is only available in China region" },
      { status: 404 }
    );
  }

  const appId = process.env.WECHAT_APP_ID || process.env.NEXT_PUBLIC_WECHAT_APP_ID;

  if (!appId) {
    console.error("[WeChat QRCode] Missing WECHAT_APP_ID");
    return NextResponse.json(
      { error: "WeChat login is not configured", supported: false },
      { status: 500 }
    );
  }

  try {
    // 获取 next 参数（登录成功后跳转路径）
    const { searchParams } = new URL(request.url);
    const next = searchParams.get("next") || "/";

    // 构建回调地址
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      request.headers.get("host");

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Cannot determine app URL" },
        { status: 500 }
      );
    }

    // 确保 baseUrl 有协议
    const normalizedBaseUrl = baseUrl.startsWith("http")
      ? baseUrl
      : `https://${baseUrl}`;

    const redirectUri = encodeURIComponent(
      `${normalizedBaseUrl}/auth/callback`
    );

    // 使用 base64 编码 state 参数保存 next 路径
    const stateData = JSON.stringify({ next });
    const state = Buffer.from(stateData).toString("base64");

    // 构建微信 OAuth 二维码 URL
    // 参考: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
    const qrcodeUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${encodeURIComponent(state)}#wechat_redirect`;

    console.log("[WeChat QRCode] Generated QRCode URL:", {
      appId,
      redirectUri: decodeURIComponent(redirectUri),
      next,
    });

    return NextResponse.json({
      supported: true,
      appId,
      qrcodeUrl,
      redirectUri: decodeURIComponent(redirectUri),
      state,
    });
  } catch (error) {
    console.error("[WeChat QRCode] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate WeChat QR code" },
      { status: 500 }
    );
  }
}
