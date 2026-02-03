import { NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";
import { createWeChatSignedState } from "@/lib/auth/wechat-oauth";
import { randomUUID } from "node:crypto";

function normalizeRedirectPath(input: string | null): string {
  if (!input) return "/";
  if (!input.startsWith("/")) return "/";
  if (input.startsWith("//")) return "/";
  return input;
}

export async function GET(request: Request) {
  if (!isChinaRegion()) {
    return NextResponse.json(
      { error: "WeChat login is only available in China region" },
      { status: 404 }
    );
  }

  const appId = process.env.WECHAT_MOBILE_APP || process.env.WECHAT_MOBILE_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: "WeChat mobile app login is not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const redirectPath = normalizeRedirectPath(searchParams.get("redirect"));

  try {
    const state = createWeChatSignedState({
      nonce: randomUUID(),
      redirectPath,
      loginType: "mobile_app",
    });

    return NextResponse.json({ state, appId, redirectPath });
  } catch (error) {
    return NextResponse.json(
      { error: "WeChat state secret is not configured" },
      { status: 500 }
    );
  }
}
