import { isChinaDeployment } from "@/lib/config/deployment.config";
import {
  DEFAULT_CN_ASSISTANT_MODEL,
  DEFAULT_CN_RECOMMENDATION_MODEL,
  isCnRuntimeModel,
  type CnRuntimeModel,
} from "@/lib/ai/runtime-models";

const CONFIG_COLLECTION = "ai_runtime_model_config";
const CONFIG_ID = "global";

export type CnAiRuntimeModelConfig = {
  assistantModel: CnRuntimeModel;
  recommendationModel: CnRuntimeModel;
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

function getEnvAssistantFallback(): CnRuntimeModel {
  const raw = process.env.ASSISTANT_CN_QWEN_MODELS;
  if (!raw) {
    return DEFAULT_CN_ASSISTANT_MODEL;
  }

  for (const token of raw.split(/[\s,]+/)) {
    const normalized = token.trim().toLowerCase();
    if (isCnRuntimeModel(normalized)) {
      return normalized;
    }
  }

  return DEFAULT_CN_ASSISTANT_MODEL;
}

function getEnvRecommendationFallback(): CnRuntimeModel {
  const candidates = [
    process.env.RECOMMENDATION_CN_QWEN_MODEL,
    process.env.RECOMMENDATION_CN_MODEL,
  ];

  for (const candidate of candidates) {
    const normalized = candidate?.trim().toLowerCase();
    if (normalized && isCnRuntimeModel(normalized)) {
      return normalized;
    }
  }

  return DEFAULT_CN_RECOMMENDATION_MODEL;
}

function buildDefaultConfig(): CnAiRuntimeModelConfig {
  return {
    assistantModel: getEnvAssistantFallback(),
    recommendationModel: getEnvRecommendationFallback(),
    updatedAt: null,
    source: "default",
  };
}

function normalizeRecord(
  row: Record<string, unknown> | null | undefined,
  fallback: CnAiRuntimeModelConfig
): CnAiRuntimeModelConfig {
  if (!row) {
    return fallback;
  }

  const assistantModel = row.assistant_model ?? row.assistantModel;
  const recommendationModel = row.recommendation_model ?? row.recommendationModel;

  return {
    assistantModel: isCnRuntimeModel(assistantModel) ? assistantModel : fallback.assistantModel,
    recommendationModel: isCnRuntimeModel(recommendationModel)
      ? recommendationModel
      : fallback.recommendationModel,
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
    // Ignore and use default config.
  }

  return null;
}

export async function getCnAiRuntimeModelConfig(): Promise<CnAiRuntimeModelConfig> {
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
    console.warn("[AiRuntimeModelConfig] CloudBase read failed, using default config:", error);
    return fallback;
  }
}

export async function updateCnAiRuntimeModelConfig(payload: {
  assistantModel: CnRuntimeModel;
  recommendationModel: CnRuntimeModel;
}): Promise<CnAiRuntimeModelConfig> {
  if (!isChinaDeployment()) {
    return buildDefaultConfig();
  }

  if (!hasCloudBaseCredentials()) {
    throw new Error("CloudBase credentials are not configured");
  }

  const db = await getCloudBaseDb();
  const collection = db.collection(CONFIG_COLLECTION);
  const nowIso = new Date().toISOString();
  const safePayload = {
    id: CONFIG_ID,
    assistant_model: payload.assistantModel,
    recommendation_model: payload.recommendationModel,
    updated_at: nowIso,
  };

  const existing = await getCnConfigRecord(collection);
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
      created_at: nowIso,
    });
  }

  return normalizeRecord(safePayload, buildDefaultConfig());
}

