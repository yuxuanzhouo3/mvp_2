import { isChinaDeployment } from "@/lib/config/deployment.config";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { ASSISTANT_USAGE_LIMITS } from "./types";

const CONFIG_TABLE = "assistant_usage_config";
const CONFIG_ID = "global";
const CACHE_TTL_MS = 30_000;

export type AssistantUsageLimitConfig = {
  freeDailyLimit: number;
  freeMonthlyLimit: number;
  vipDailyLimit: number;
  enterpriseDailyLimit: number;
  updatedAt: string | null;
  source: "default" | "storage";
};

let cachedConfig: AssistantUsageLimitConfig | null = null;
let cachedUntilMs = 0;

function buildDefaultConfig(): AssistantUsageLimitConfig {
  return {
    freeDailyLimit: ASSISTANT_USAGE_LIMITS.freeDailyLimit,
    freeMonthlyLimit: ASSISTANT_USAGE_LIMITS.freeMonthlyLimit,
    vipDailyLimit: ASSISTANT_USAGE_LIMITS.proDailyLimit,
    enterpriseDailyLimit: ASSISTANT_USAGE_LIMITS.enterpriseDailyLimit,
    updatedAt: null,
    source: "default",
  };
}

function toNonNegativeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function toIsoString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return null;
}

function normalizeRecord(
  row: Record<string, unknown> | null | undefined,
  fallback: AssistantUsageLimitConfig
): AssistantUsageLimitConfig {
  if (!row) return fallback;

  return {
    freeDailyLimit: toNonNegativeInt(
      row.free_daily_limit ?? row.freeDailyLimit,
      fallback.freeDailyLimit
    ),
    freeMonthlyLimit: toNonNegativeInt(
      row.free_monthly_limit ?? row.freeMonthlyLimit,
      fallback.freeMonthlyLimit
    ),
    vipDailyLimit: toNonNegativeInt(
      row.vip_daily_limit ?? row.vipDailyLimit ?? row.pro_daily_limit ?? row.proDailyLimit,
      fallback.vipDailyLimit
    ),
    enterpriseDailyLimit: fallback.enterpriseDailyLimit,
    updatedAt: toIsoString(row.updated_at ?? row.updatedAt),
    source: "storage",
  };
}

function setCache(config: AssistantUsageLimitConfig) {
  cachedConfig = config;
  cachedUntilMs = Date.now() + CACHE_TTL_MS;
}

export function clearAssistantUsageLimitConfigCache() {
  cachedConfig = null;
  cachedUntilMs = 0;
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

async function getConfigFromSupabase(): Promise<AssistantUsageLimitConfig> {
  const fallback = buildDefaultConfig();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(CONFIG_TABLE)
      .select("free_daily_limit,free_monthly_limit,free_total,vip_daily_limit,updated_at")
      .eq("id", CONFIG_ID)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.warn("[AssistantUsageConfig] Supabase read fallback:", error.message);
      }
      return fallback;
    }

    return normalizeRecord(data as Record<string, unknown>, fallback);
  } catch (error) {
    console.warn("[AssistantUsageConfig] Supabase read failed, using default config:", error);
    return fallback;
  }
}

async function getCnConfigRecord(
  collection: any
): Promise<Record<string, unknown> | null> {
  try {
    const docRes = await collection.doc(CONFIG_ID).get();
    const doc = Array.isArray(docRes?.data) ? docRes.data[0] : docRes?.data;
    if (doc && typeof doc === "object") {
      return doc as Record<string, unknown>;
    }
  } catch {
    // Fallback to query by id field.
  }

  try {
    const queryRes = await collection.where({ id: CONFIG_ID }).limit(1).get();
    const row = queryRes?.data?.[0];
    if (row && typeof row === "object") {
      return row as Record<string, unknown>;
    }
  } catch {
    // Ignore and fallback to defaults.
  }

  return null;
}

async function getConfigFromCloudbase(): Promise<AssistantUsageLimitConfig> {
  const fallback = buildDefaultConfig();

  try {
    const db = await getCloudBaseDb();
    const collection = db.collection(CONFIG_TABLE);
    const row = await getCnConfigRecord(collection);
    return normalizeRecord(row, fallback);
  } catch (error) {
    console.warn("[AssistantUsageConfig] CloudBase read failed, using default config:", error);
    return fallback;
  }
}

export async function getAssistantUsageLimitConfig(): Promise<AssistantUsageLimitConfig> {
  if (cachedConfig && Date.now() < cachedUntilMs) {
    return cachedConfig;
  }

  const config = isChinaDeployment()
    ? await getConfigFromCloudbase()
    : await getConfigFromSupabase();

  setCache(config);
  return config;
}

async function updateConfigInSupabase(payload: {
  freeDailyLimit: number;
  freeMonthlyLimit: number;
  vipDailyLimit: number;
}): Promise<AssistantUsageLimitConfig> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from(CONFIG_TABLE)
    .upsert(
      {
        id: CONFIG_ID,
        free_daily_limit: payload.freeDailyLimit,
        free_monthly_limit: payload.freeMonthlyLimit,
        free_total: payload.freeMonthlyLimit,
        vip_daily_limit: payload.vipDailyLimit,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    )
    .select("free_daily_limit,free_monthly_limit,free_total,vip_daily_limit,updated_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeRecord(
    (data as Record<string, unknown> | null) || {
      free_daily_limit: payload.freeDailyLimit,
      free_monthly_limit: payload.freeMonthlyLimit,
      free_total: payload.freeMonthlyLimit,
      vip_daily_limit: payload.vipDailyLimit,
      updated_at: nowIso,
    },
    buildDefaultConfig()
  );
}

async function updateConfigInCloudbase(payload: {
  freeDailyLimit: number;
  freeMonthlyLimit: number;
  vipDailyLimit: number;
}): Promise<AssistantUsageLimitConfig> {
  const db = await getCloudBaseDb();
  const collection = db.collection(CONFIG_TABLE);
  const nowIso = new Date().toISOString();
  const updatePayload = {
    id: CONFIG_ID,
    free_daily_limit: payload.freeDailyLimit,
    free_monthly_limit: payload.freeMonthlyLimit,
    free_total: payload.freeMonthlyLimit,
    vip_daily_limit: payload.vipDailyLimit,
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

  return normalizeRecord(updatePayload, buildDefaultConfig());
}

export async function updateAssistantUsageLimitConfig(payload: {
  freeDailyLimit: number;
  freeMonthlyLimit: number;
  vipDailyLimit: number;
}): Promise<AssistantUsageLimitConfig> {
  const safePayload = {
    freeDailyLimit: toNonNegativeInt(
      payload.freeDailyLimit,
      ASSISTANT_USAGE_LIMITS.freeDailyLimit
    ),
    freeMonthlyLimit: toNonNegativeInt(
      payload.freeMonthlyLimit,
      ASSISTANT_USAGE_LIMITS.freeMonthlyLimit
    ),
    vipDailyLimit: toNonNegativeInt(payload.vipDailyLimit, ASSISTANT_USAGE_LIMITS.proDailyLimit),
  };

  const updated = isChinaDeployment()
    ? await updateConfigInCloudbase(safePayload)
    : await updateConfigInSupabase(safePayload);

  setCache(updated);
  return updated;
}
