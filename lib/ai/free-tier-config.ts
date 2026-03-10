import { isChinaDeployment } from "@/lib/config/deployment.config";
import {
  DEFAULT_CN_ASSISTANT_MODEL,
  DEFAULT_CN_RECOMMENDATION_MODEL,
  isCnRuntimeModel,
  type CnRuntimeModel,
} from "@/lib/ai/runtime-models";

const CONFIG_COLLECTION = "ai_free_tier_config";
const CONFIG_ID = "global";

export const DEFAULT_FREE_TIER_TOKEN_LIMIT = 100000;

export type CnAiFreeTierConfig = {
  assistantModel: CnRuntimeModel;
  assistantTokenLimit: number;
  recommendationModel: CnRuntimeModel;
  recommendationTokenLimit: number;
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

function toNonNegativeInt(value: unknown, fallback: number): number {
  const raw = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0) {
    return fallback;
  }

  return raw;
}

function buildDefaultConfig(): CnAiFreeTierConfig {
  return {
    assistantModel: DEFAULT_CN_ASSISTANT_MODEL,
    assistantTokenLimit: DEFAULT_FREE_TIER_TOKEN_LIMIT,
    recommendationModel: DEFAULT_CN_RECOMMENDATION_MODEL,
    recommendationTokenLimit: DEFAULT_FREE_TIER_TOKEN_LIMIT,
    updatedAt: null,
    source: "default",
  };
}

function normalizeRecord(
  row: Record<string, unknown> | null | undefined,
  fallback: CnAiFreeTierConfig
): CnAiFreeTierConfig {
  if (!row) {
    return fallback;
  }

  const assistantModel = row.assistant_model ?? row.assistantModel;
  const recommendationModel = row.recommendation_model ?? row.recommendationModel;

  return {
    assistantModel: isCnRuntimeModel(assistantModel) ? assistantModel : fallback.assistantModel,
    assistantTokenLimit: toNonNegativeInt(
      row.assistant_token_limit ?? row.assistantTokenLimit,
      fallback.assistantTokenLimit
    ),
    recommendationModel: isCnRuntimeModel(recommendationModel)
      ? recommendationModel
      : fallback.recommendationModel,
    recommendationTokenLimit: toNonNegativeInt(
      row.recommendation_token_limit ?? row.recommendationTokenLimit,
      fallback.recommendationTokenLimit
    ),
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

async function getConfigRecord(collection: any): Promise<Record<string, unknown> | null> {
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
    // Ignore and use default config.
  }

  return null;
}

export async function getCnAiFreeTierConfig(): Promise<CnAiFreeTierConfig> {
  const fallback = buildDefaultConfig();

  if (!isChinaDeployment() || !hasCloudBaseCredentials()) {
    return fallback;
  }

  try {
    const db = await getCloudBaseDb();
    const collection = db.collection(CONFIG_COLLECTION);
    const row = await getConfigRecord(collection);
    return normalizeRecord(row, fallback);
  } catch (error) {
    console.warn("[AiFreeTierConfig] CloudBase read failed, using default config:", error);
    return fallback;
  }
}

export async function updateCnAiFreeTierConfig(payload: {
  assistantModel: CnRuntimeModel;
  assistantTokenLimit: number;
  recommendationModel: CnRuntimeModel;
  recommendationTokenLimit: number;
}): Promise<CnAiFreeTierConfig> {
  if (!isChinaDeployment()) {
    return buildDefaultConfig();
  }

  if (!hasCloudBaseCredentials()) {
    throw new Error("CloudBase credentials are not configured");
  }

  const fallback = buildDefaultConfig();
  const safePayload = {
    id: CONFIG_ID,
    assistant_model: payload.assistantModel,
    assistant_token_limit: toNonNegativeInt(payload.assistantTokenLimit, fallback.assistantTokenLimit),
    recommendation_model: payload.recommendationModel,
    recommendation_token_limit: toNonNegativeInt(
      payload.recommendationTokenLimit,
      fallback.recommendationTokenLimit
    ),
    updated_at: new Date().toISOString(),
  };

  const db = await getCloudBaseDb();
  const collection = db.collection(CONFIG_COLLECTION);
  const existing = await getConfigRecord(collection);

  if (existing) {
    const docId = typeof existing._id === "string" ? existing._id : null;
    if (docId) {
      await collection.doc(docId).update(safePayload);
    } else {
      await collection.where({ id: CONFIG_ID }).update(safePayload);
    }
  } else {
    await collection.add({
      ...safePayload,
      created_at: safePayload.updated_at,
    });
  }

  return normalizeRecord(safePayload, fallback);
}

