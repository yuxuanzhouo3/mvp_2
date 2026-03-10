export type AIQuotaType = "count" | "token";

export type AIUsageMetrics = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AIExecutionMetadata = {
  model: string;
  usage: AIUsageMetrics | null;
};

