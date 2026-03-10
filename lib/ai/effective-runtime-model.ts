import { isChinaDeployment } from "@/lib/config/deployment.config";
import { getCnAiFreeTierConfig } from "@/lib/ai/free-tier-config";
import { getCnAiRuntimeModelConfig } from "@/lib/ai/runtime-model-config";

type PlanTypeLike = "free" | "pro" | "enterprise";

export async function getEffectiveAssistantRuntimeModel(
  planType: PlanTypeLike
): Promise<string | null> {
  if (!isChinaDeployment()) {
    return null;
  }

  if (planType === "free") {
    return (await getCnAiFreeTierConfig()).assistantModel;
  }

  return (await getCnAiRuntimeModelConfig()).assistantModel;
}

export async function getEffectiveRecommendationRuntimeModel(
  planType: PlanTypeLike
): Promise<string | null> {
  if (!isChinaDeployment()) {
    return null;
  }

  if (planType === "free") {
    return (await getCnAiFreeTierConfig()).recommendationModel;
  }

  return (await getCnAiRuntimeModelConfig()).recommendationModel;
}

