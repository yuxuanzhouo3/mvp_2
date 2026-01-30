import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  CloudBaseCollections,
  getCloudBaseDatabase,
} from "@/lib/database/cloudbase-client";
import type { AdminDataError, AdminSourceFilter } from "./types";

export type OnboardingExitStep = {
  step: string;
  count: number;
  permanentCount: number;
  source: "CN" | "INTL";
};

export type OnboardingOverview = {
  started: number;
  completed: number;
  completionRate: number;
  source: "CN" | "INTL";
};

export async function getOnboardingBehaviorStats(params: {
  source: AdminSourceFilter;
  permanentDays: number;
}): Promise<{
  overview: OnboardingOverview[];
  exitSteps: OnboardingExitStep[];
  errors: AdminDataError[];
}> {
  const errors: AdminDataError[] = [];
  const includeCN = params.source === "ALL" || params.source === "CN";
  const includeINTL = params.source === "ALL" || params.source === "INTL";

  const permanentThreshold = new Date();
  permanentThreshold.setUTCDate(
    permanentThreshold.getUTCDate() - Math.max(1, params.permanentDays)
  );
  const permanentIso = permanentThreshold.toISOString();

  const overview: OnboardingOverview[] = [];
  const exitSteps: OnboardingExitStep[] = [];

  const compute = (rows: any[], source: "CN" | "INTL") => {
    const started = rows.length;
    const completed = rows.filter((r) => Boolean(r.is_completed)).length;
    overview.push({
      started,
      completed,
      completionRate: started ? completed / started : 0,
      source,
    });

    const map = new Map<string, { count: number; permanentCount: number }>();
    for (const r of rows) {
      if (r.is_completed) continue;
      const step = `${r.current_category_index ?? 0}.${r.current_question_index ?? 0}`;
      const updatedAt = String(r.updated_at || r.updatedAt || "");
      const permanent = updatedAt && updatedAt < permanentIso;
      const item = map.get(step) || { count: 0, permanentCount: 0 };
      item.count += 1;
      if (permanent) item.permanentCount += 1;
      map.set(step, item);
    }
    for (const [step, item] of map.entries()) {
      exitSteps.push({ step, ...item, source });
    }
  };

  const tasks: Array<Promise<void>> = [];

  if (includeCN) {
    tasks.push(
      (async () => {
        try {
          const db = getCloudBaseDatabase();
          const collection = db.collection(CloudBaseCollections.ONBOARDING_PROGRESS);
          const res = await collection.limit(5000).get();
          compute(res.data || [], "CN");
        } catch (e: any) {
          errors.push({
            source: "CN",
            message: e?.message ? String(e.message) : "CloudBase 查询失败",
          });
        }
      })()
    );
  }

  if (includeINTL) {
    tasks.push(
      (async () => {
        try {
          const supabase = getSupabaseAdmin();
          const { data, error } = await supabase
            .from("onboarding_progress")
            .select("is_completed,current_category_index,current_question_index,updated_at");
          if (error) throw error;
          compute(data || [], "INTL");
        } catch (e: any) {
          errors.push({
            source: "INTL",
            message: e?.message ? String(e.message) : "Supabase 查询失败",
          });
        }
      })()
    );
  }

  await Promise.all(tasks);
  exitSteps.sort((a, b) => b.count - a.count);
  return { overview, exitSteps, errors };
}
