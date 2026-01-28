import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/integrations/supabase";
import { isChinaRegion } from "@/lib/config/region";
import { z } from "zod";
import bcrypt from "bcryptjs";
import cloudbase from "@cloudbase/node-sdk";
import { nowISO } from "@/lib/database/cloudbase-client";

const registerSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    fullName: z
      .string()
      .min(1, "Full name is required")
      .max(100, "Full name too long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
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

    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { email, password, fullName } = validationResult.data;

    if (isChinaRegion()) {
      // 中国区域：使用 CloudBase
      const app = getCloudBaseApp();
      const db = app.database();
      const usersCollection = db.collection("users");

      // 检查邮箱是否已存在
      const existingUserResult = await usersCollection.where({ email }).get();

      if (existingUserResult.data && existingUserResult.data.length > 0) {
        return NextResponse.json(
          {
            error: "Email already registered",
            code: "EMAIL_EXISTS",
          },
          { status: 409 }
        );
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建新用户
      const newUser = {
        email,
        password: hashedPassword,
        name: fullName,
        pro: false,
        region: "china",
        subscription_plan: "free",
        subscription_status: "active",
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };

      const result = await usersCollection.add(newUser);

      return NextResponse.json({
        success: true,
        user: {
          id: result.id,
          email,
          name: fullName,
        },
        message: "Registration successful. You can now log in.",
        region: "CN",
      });
    } else {
      // 国际区域：使用 Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        },
      });

      if (error) {
        // Log detailed error information for debugging
        console.error("[Register] Supabase signup error:", {
          message: error.message,
          status: error.status,
          code: error.code,
          timestamp: new Date().toISOString(),
        });

        // Check for specific error types
        if (error.message.includes("already registered") || error.message.includes("already exists")) {
          return NextResponse.json(
            {
              error: "Email already registered",
              code: "EMAIL_EXISTS",
            },
            { status: 409 }
          );
        }

        if (error.message.includes("Invalid redirect") || error.message.includes("redirect")) {
          return NextResponse.json(
            {
              error: "Invalid redirect configuration. Please ensure your domain is added to Supabase redirect URLs.",
              code: "INVALID_REDIRECT",
              details: "Contact admin to verify Supabase Auth settings",
            },
            { status: 400 }
          );
        }

        if (error.message.includes("SMTP") || error.message.includes("email")) {
          return NextResponse.json(
            {
              error: "Email service is temporarily unavailable. Please try again later.",
              code: "EMAIL_SERVICE_ERROR",
            },
            { status: 503 }
          );
        }

        return NextResponse.json(
          {
            error: "Registration failed",
            code: "REGISTRATION_ERROR",
            details: error.message,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        user: {
          id: data.user?.id,
          email: data.user?.email,
          name: fullName,
        },
        message: "Registration successful. Check your email to confirm your account.",
        region: "INTL",
      });
    }
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
