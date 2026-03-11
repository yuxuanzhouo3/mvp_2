export const CN_RUNTIME_MODEL_VALUES = [
  "qwen3.5-plus",
  "qwen3.5-flash",
  "qwen3.5-flash-2026-02-23",
  "qwen3.5-35b-a3b",
] as const;

export type CnRuntimeModel = string;

export const DEFAULT_CN_ASSISTANT_MODEL: CnRuntimeModel = "qwen3.5-plus";
export const DEFAULT_CN_RECOMMENDATION_MODEL: CnRuntimeModel = "qwen3.5-plus";

export const CN_RUNTIME_MODEL_OPTIONS: ReadonlyArray<{
  value: CnRuntimeModel;
  label: string;
}> = [
  { value: "qwen3.5-plus", label: "Qwen 3.5 Plus" },
  { value: "qwen3.5-flash", label: "Qwen 3.5 Flash" },
  { value: "qwen3.5-flash-2026-02-23", label: "Qwen 3.5 Flash (2026-02-23)" },
  { value: "qwen3.5-35b-a3b", label: "Qwen 3.5 35B A3B" },
  { value: "glm-4.7", label: "GLM 4.7" },
];

export function isCnRuntimeModel(value: unknown): value is CnRuntimeModel {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    CN_RUNTIME_MODEL_VALUES.includes(normalized as (typeof CN_RUNTIME_MODEL_VALUES)[number]) ||
    /^qwen[\w.-]*$/i.test(normalized) ||
    /^qwq[\w.-]*$/i.test(normalized) ||
    /^glm[\w.-]*$/i.test(normalized)
  );
}
