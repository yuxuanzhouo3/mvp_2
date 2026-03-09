import { isChinaDeployment } from "@/lib/config/deployment.config";
import { PLAN_FEATURES } from "@/lib/subscription/features";
import type { PlanType } from "@/lib/payment/payment-config";

const CONFIG_COLLECTION = "recommendation_usage_config";
const CONFIG_ID = "global";

export type RecommendationUsageLimitConfig = {
  freeMonthlyLimit: number;
  vipDailyLimit: number;
  enterpriseDailyLimit: number;
  updatedAt: string | null;
  source: "default" | "storage";
};

function hasCloudBaseCredentials(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID &&
      process.env.CLOUDBASE_SECRET_ID &&
      process.env.CLOUDBASE_SECRET_KEY
  );
}

function buildDefaultConfig(): RecommendationUsageLimitConfig {
  return {
    freeMonthlyLimit: PLAN_FEATURES.free.recommendationLimit,
    vipDailyLimit: PLAN_FEATURES.pro.recommendationLimit,
    enterpriseDailyLimit: PLAN_FEATURES.enterprise.recommendationLimit,
    updatedAt: null,
    source: "default",
  };
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

function toIsoString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return null;
}

function normalizeRecord(
  row: Record<string, unknown> | null | undefined,
  fallback: RecommendationUsageLimitConfig
): RecommendationUsageLimitConfig {
  if (!row) {
    return fallback;
  }

  return {
    freeMonthlyLimit: toNonNegativeInt(
      row.free_monthly_limit ?? row.freeMonthlyLimit,
      fallback.freeMonthlyLimit
    ),
    vipDailyLimit: toNonNegativeInt(row.vip_daily_limit ?? row.vipDailyLimit, fallback.vipDailyLimit),
    enterpriseDailyLimit: fallback.enterpriseDailyLimit,
    updatedAt: toIsoString(row.updated_at ?? row.updatedAt),
    source: "storage",
  };
}

async function getCloudBaseDb() {
  const cloudbase = (await import("@cloudbase/node-sdk")).default;
  const app = cloudbase.init({
    env: process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID,
    secretId: process.env.CLOUDBASE_SECRET_ID,
    secretKey: process.env.CLOUDBASE_SECRET_KEY,
  });

  return app.database();
}

async function getCnConfigRecord(collection: any): Promise<Record<string, unknown> | null> {
  try {
    const docRes = await collection.doc(CONFIG_ID).get();
    const doc = Array.isArray(docRes?.data) ? docRes.data[0] : docRes?.data;
    if (doc && typeof doc === "object") {
      return doc as Record<string, unknown>;
    }
  } catch {
    // Fallback to query by id.
  }

  try {
    const queryRes = await collection.where({ id: CONFIG_ID }).limit(1).get();
    const row = queryRes?.data?.[0];
    if (row && typeof row === "object") {
      return row as Record<string, unknown>;
    }
  } catch {
    // Ignore and use defaults.
  }

  return null;
}

export async function getRecommendationUsageLimitConfig(): Promise<RecommendationUsageLimitConfig> {
  const fallback = buildDefaultConfig();

  if (!isChinaDeployment() || !hasCloudBaseCredentials()) {
    return fallback;
  }

  try {
    const db = await getCloudBaseDb();
    const collection = db.collection(CONFIG_COLLECTION);
    const row = await getCnConfigRecord(collection);
    return normalizeRecord(row, fallback);
  } catch (error) {
    console.warn("[RecommendationUsageConfig] CloudBase read failed, using default config:", error);
    return fallback;
  }
}

export async function updateRecommendationUsageLimitConfig(payload: {
  freeMonthlyLimit: number;
  vipDailyLimit: number;
}): Promise<RecommendationUsageLimitConfig> {
  if (!isChinaDeployment()) {
    return buildDefaultConfig();
  }

  if (!hasCloudBaseCredentials()) {
    throw new Error("CloudBase credentials are not configured");
  }

  const fallback = buildDefaultConfig();
  const safePayload = {
    freeMonthlyLimit: toNonNegativeInt(payload.freeMonthlyLimit, fallback.freeMonthlyLimit),
    vipDailyLimit: toNonNegativeInt(payload.vipDailyLimit, fallback.vipDailyLimit),
  };

  const db = await getCloudBaseDb();
  const collection = db.collection(CONFIG_COLLECTION);
  const nowIso = new Date().toISOString();
  const updatePayload = {
    id: CONFIG_ID,
    free_monthly_limit: safePayload.freeMonthlyLimit,
    vip_daily_limit: safePayload.vipDailyLimit,
    updated_at: nowIso,
  };

  const existing = await getCnConfigRecord(collection);
  if (existing) {
    const docId = typeof existing._id === "string" ? existing._id : null;
    if (docId) {
      await collection.doc(docId).update(updatePayload);
    } else {
      await collection.where({ id: CONFIG_ID }).update(updatePayload);
    }
  } else {
    await collection.add({
      ...updatePayload,
      created_at: nowIso,
    });
  }

  return normalizeRecord(updatePayload, fallback);
}

export function resolveRecommendationLimitForPlan(
  planType: PlanType,
  config: RecommendationUsageLimitConfig
): { periodType: "daily" | "monthly"; periodLimit: number; isUnlimited: boolean } {
  switch (planType) {
    case "free":
      return {
        periodType: PLAN_FEATURES.free.recommendationPeriod,
        periodLimit: config.freeMonthlyLimit,
        isUnlimited: false,
      };
    case "pro":
      return {
        periodType: PLAN_FEATURES.pro.recommendationPeriod,
        periodLimit: config.vipDailyLimit,
        isUnlimited: false,
      };
    case "enterprise":
      return {
        periodType: PLAN_FEATURES.enterprise.recommendationPeriod,
        periodLimit: config.enterpriseDailyLimit,
        isUnlimited: config.enterpriseDailyLimit === -1,
      };
  }
}

