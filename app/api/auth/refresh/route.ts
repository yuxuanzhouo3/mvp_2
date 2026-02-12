import { NextRequest, NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";
import * as jwt from "jsonwebtoken";
import cloudbase from "@cloudbase/node-sdk";
import { z } from "zod";
import { getJwtSecret } from "@/lib/auth/secrets";

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

let cachedApp: any = null;

function getCloudBaseApp() {
  if (cachedApp) {
    return cachedApp;
  }

  cachedApp = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });

  return cachedApp;
}

export async function POST(request: NextRequest) {
  try {
    const jwtSecret = getJwtSecret();
    const body = await request.json();

    const validationResult = refreshSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { refreshToken } = validationResult.data;

    if (isChinaRegion()) {
      // 中国区域：验证 refresh token
      let payload: any;
      try {
        payload = jwt.verify(
          refreshToken,
          jwtSecret
        );
      } catch (error) {
        console.error("[/api/auth/refresh] JWT verification failed:", error);
        return NextResponse.json(
          { error: "Invalid or expired refresh token" },
          { status: 401 }
        );
      }

      const { userId, email } = payload;

      if (!userId || !email) {
        return NextResponse.json(
          { error: "Invalid token payload" },
          { status: 401 }
        );
      }

      // 验证用户是否存在
      const app = getCloudBaseApp();
      const db = app.database();
      const userResult = await db.collection("users").doc(userId).get();

      if (!userResult.data || userResult.data.length === 0) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 401 }
        );
      }

      const user = userResult.data[0];

      // 生成新的 access token
      const newAccessToken = jwt.sign(
        { userId, email, region: "china" },
        jwtSecret,
        { expiresIn: "1h" }
      );

      // 生成新的 refresh token
      const newRefreshToken = jwt.sign(
        { userId, email, region: "china", type: "refresh" },
        jwtSecret,
        { expiresIn: "7d" }
      );

      return NextResponse.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: userId,
          email,
          name: user.name || "",
          avatar: user.avatar || "",
          subscription_plan: user.subscription_plan || "free",
          subscription_status: user.subscription_status || "active",
        },
        tokenMeta: {
          accessTokenExpiresIn: 3600,
          refreshTokenExpiresIn: 604800,
        },
      });
    } else {
      return NextResponse.json(
        {
          error: "International region uses Supabase SDK auto refresh",
        },
        { status: 501 }
      );
    }
  } catch (error: any) {
    console.error("[/api/auth/refresh] Error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
