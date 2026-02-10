import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isChinaRegion } from "@/lib/config/region";
import { getCloudBaseDatabase } from "@/lib/database/cloudbase-client";
import {
  EmailVerificationPurpose,
  sendEmailVerificationCode,
} from "@/lib/auth/email-verification";

const sendEmailCodeSchema = z.object({
  email: z.string().email("Invalid email format"),
  purpose: z.enum(["register", "reset_password"]),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function isUserExists(email: string): Promise<boolean> {
  const db = getCloudBaseDatabase();
  const result = await db.collection("users").where({ email }).limit(1).get();
  return Boolean(result?.data?.length);
}

function resolvePurposeLabel(purpose: EmailVerificationPurpose): string {
  return purpose === "register" ? "registration" : "password reset";
}

export async function POST(request: NextRequest) {
  try {
    if (!isChinaRegion()) {
      return NextResponse.json(
        {
          error: "Email code endpoint is only available in CN deployment",
          code: "REGION_NOT_SUPPORTED",
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = sendEmailCodeSchema.safeParse(body);

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
    const purpose = validation.data.purpose;
    const userExists = await isUserExists(email);

    if (purpose === "register" && userExists) {
      return NextResponse.json(
        {
          error: "Email already registered",
          code: "EMAIL_EXISTS",
        },
        { status: 409 }
      );
    }

    if (purpose === "reset_password" && !userExists) {
      return NextResponse.json(
        {
          error: "Email is not registered",
          code: "USER_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const sendResult = await sendEmailVerificationCode({
      email,
      purpose,
    });

    if (!sendResult.success) {
      if (sendResult.code === "SEND_TOO_FREQUENT") {
        return NextResponse.json(
          {
            error: sendResult.message,
            code: sendResult.code,
            retryAfterSeconds: sendResult.retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      const statusCode =
        sendResult.code === "EMAIL_SERVICE_NOT_CONFIGURED" ? 500 : 503;

      return NextResponse.json(
        {
          error: sendResult.message,
          code: sendResult.code,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      purpose,
      expiresInSeconds: sendResult.expiresInSeconds,
      message: `Verification code sent for ${resolvePurposeLabel(purpose)}`,
    });
  } catch (error) {
    console.error("[/api/auth/email-code] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

