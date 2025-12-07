import { NextRequest, NextResponse } from "next/server";
import { isChinaRegion } from "@/lib/config/region";
import { z } from "zod";
import bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import cloudbase from "@cloudbase/node-sdk";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
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
    const body = await request.json();

    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { email, password } = validationResult.data;

    if (isChinaRegion()) {
      console.log("[/api/auth/login] China region login:", email);

      const app = getCloudBaseApp();
      const db = app.database();
      const usersCollection = db.collection("users");

      // 查找用户
      const userResult = await usersCollection.where({ email }).get();

      if (!userResult.data || userResult.data.length === 0) {
        return NextResponse.json(
          { error: "User not found or password incorrect" },
          { status: 401 }
        );
      }

      const user = userResult.data[0];

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "User not found or password incorrect" },
          { status: 401 }
        );
      }

      // 生成 JWT Token
      const accessToken = jwt.sign(
        { userId: user._id, email: user.email, region: "china" },
        process.env.JWT_SECRET || "fallback-secret-key-for-development-only",
        { expiresIn: "1h" }
      );

      const refreshToken = jwt.sign(
        { userId: user._id, email: user.email, region: "china", type: "refresh" },
        process.env.JWT_SECRET || "fallback-secret-key-for-development-only",
        { expiresIn: "7d" }
      );

      return NextResponse.json({
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
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
        { error: "Not implemented for international region" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("[/api/auth/login] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
