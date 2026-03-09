import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/proxy";
import { currentRegion } from "@/lib/config/deployment.config";
import {
  getAssistantUsageLimitConfig,
  updateAssistantUsageLimitConfig,
} from "@/lib/assistant/usage-limit-config";
import {
  getCnAiRuntimeModelConfig,
  updateCnAiRuntimeModelConfig,
} from "@/lib/ai/runtime-model-config";
import { isCnRuntimeModel } from "@/lib/ai/runtime-models";
import {
  getRecommendationUsageLimitConfig,
  updateRecommendationUsageLimitConfig,
} from "@/lib/subscription/recommendation-limit-config";

export const dynamic = "force-dynamic";

function parseLimit(value: unknown, label: string): { ok: true; value: number } | { ok: false; message: string } {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw)) {
    return { ok: false, message: `${label} must be a number` };
  }

  if (!Number.isInteger(raw)) {
    return { ok: false, message: `${label} must be an integer` };
  }

  if (raw < 0 || raw > 10000) {
    return { ok: false, message: `${label} must be between 0 and 10000` };
  }

  return { ok: true, value: raw };
}

function parseCnRuntimeModel(
  value: unknown,
  label: string
): { ok: true; value: Parameters<typeof updateCnAiRuntimeModelConfig>[0]["assistantModel"] } | { ok: false; message: string } {
  if (!isCnRuntimeModel(value)) {
    return { ok: false, message: `${label} must be a supported CN runtime model` };
  }

  return { ok: true, value };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const config = await getAssistantUsageLimitConfig();
  const cnRuntimeConfig = currentRegion === "CN" ? await getCnAiRuntimeModelConfig() : undefined;
  const recommendationUsageConfig = await getRecommendationUsageLimitConfig();

  return NextResponse.json({
    success: true,
    region: currentRegion,
    config,
    cnRuntimeConfig,
    recommendationUsageConfig,
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const freeDailyLimitResult = parseLimit(body?.freeDailyLimit, "freeDailyLimit");
    if (!freeDailyLimitResult.ok) {
      return NextResponse.json({ success: false, error: freeDailyLimitResult.message }, { status: 400 });
    }

    const freeMonthlyLimitResult = parseLimit(
      body?.freeMonthlyLimit ?? body?.freeTotal,
      "freeMonthlyLimit"
    );
    if (!freeMonthlyLimitResult.ok) {
      return NextResponse.json({ success: false, error: freeMonthlyLimitResult.message }, { status: 400 });
    }

    const vipDailyLimitResult = parseLimit(body?.vipDailyLimit, "vipDailyLimit");
    if (!vipDailyLimitResult.ok) {
      return NextResponse.json({ success: false, error: vipDailyLimitResult.message }, { status: 400 });
    }

    if (freeMonthlyLimitResult.value < freeDailyLimitResult.value) {
      return NextResponse.json(
        { success: false, error: "freeMonthlyLimit must be greater than or equal to freeDailyLimit" },
        { status: 400 }
      );
    }

    const config = await updateAssistantUsageLimitConfig({
      freeDailyLimit: freeDailyLimitResult.value,
      freeMonthlyLimit: freeMonthlyLimitResult.value,
      vipDailyLimit: vipDailyLimitResult.value,
    });

    let cnRuntimeConfig = currentRegion === "CN" ? await getCnAiRuntimeModelConfig() : undefined;
    let recommendationUsageConfig = await getRecommendationUsageLimitConfig();

    if (currentRegion === "CN") {
      const shakeFreeMonthlyLimitResult = parseLimit(
        body?.shakeFreeMonthlyLimit ?? recommendationUsageConfig.freeMonthlyLimit,
        "shakeFreeMonthlyLimit"
      );
      if (!shakeFreeMonthlyLimitResult.ok) {
        return NextResponse.json({ success: false, error: shakeFreeMonthlyLimitResult.message }, { status: 400 });
      }

      const shakeVipDailyLimitResult = parseLimit(
        body?.shakeVipDailyLimit ?? recommendationUsageConfig.vipDailyLimit,
        "shakeVipDailyLimit"
      );
      if (!shakeVipDailyLimitResult.ok) {
        return NextResponse.json({ success: false, error: shakeVipDailyLimitResult.message }, { status: 400 });
      }

      const assistantModelResult = parseCnRuntimeModel(
        body?.assistantCnModel ?? cnRuntimeConfig?.assistantModel,
        "assistantCnModel"
      );
      if (!assistantModelResult.ok) {
        return NextResponse.json({ success: false, error: assistantModelResult.message }, { status: 400 });
      }

      const recommendationModelResult = parseCnRuntimeModel(
        body?.recommendationCnModel ?? cnRuntimeConfig?.recommendationModel,
        "recommendationCnModel"
      );
      if (!recommendationModelResult.ok) {
        return NextResponse.json({ success: false, error: recommendationModelResult.message }, { status: 400 });
      }

      cnRuntimeConfig = await updateCnAiRuntimeModelConfig({
        assistantModel: assistantModelResult.value,
        recommendationModel: recommendationModelResult.value,
      });

      recommendationUsageConfig = await updateRecommendationUsageLimitConfig({
        freeMonthlyLimit: shakeFreeMonthlyLimitResult.value,
        vipDailyLimit: shakeVipDailyLimitResult.value,
      });
    }

    return NextResponse.json({
      success: true,
      region: currentRegion,
      config,
      cnRuntimeConfig,
      recommendationUsageConfig,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message ? String(error.message) : "Failed to update config",
      },
      { status: 500 }
    );
  }
}
