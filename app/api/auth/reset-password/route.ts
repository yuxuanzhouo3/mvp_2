import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { isChinaRegion } from "@/lib/config/region";
import { getCloudBaseDatabase, nowISO } from "@/lib/database/cloudbase-client";
import { consumeEmailVerificationCode } from "@/lib/auth/email-verification";

const resetPasswordSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    if (!isChinaRegion()) {
      return NextResponse.json(
        {
          error: "Reset password endpoint is only available in CN deployment",
          code: "REGION_NOT_SUPPORTED",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid input",
          code: "VALIDATION_ERROR",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const email = normalizeEmail(validation.data.email);
    const { code, password } = validation.data;
    const db = getCloudBaseDatabase();
    const usersCollection = db.collection("users");

    const userResult = await usersCollection.where({ email }).limit(1).get();
    const user = userResult?.data?.[0];

    if (!user?._id) {
      return NextResponse.json(
        {
          error: "Email is not registered",
          code: "USER_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const consumeResult = await consumeEmailVerificationCode({
      email,
      purpose: "reset_password",
      code,
    });

    if (!consumeResult.success) {
      const statusCode =
        consumeResult.code === "CODE_INVALID" ||
        consumeResult.code === "CODE_NOT_FOUND" ||
        consumeResult.code === "CODE_EXPIRED"
          ? 400
          : 500;

      return NextResponse.json(
        {
          error: consumeResult.message,
          code: consumeResult.code,
        },
        { status: statusCode }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await usersCollection.doc(user._id).update({
      password: hashedPassword,
      updatedAt: nowISO(),
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("[/api/auth/reset-password] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

