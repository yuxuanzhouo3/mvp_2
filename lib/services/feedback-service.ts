import { isChinaDeployment } from "@/lib/config/deployment.config";
import { getCloudBaseDatabase, CloudBaseCollections } from "@/lib/database/cloudbase-client";

export type UserFeedbackRecord = {
  id?: string;
  user_id: string;
  recommendation_id: string;
  feedback_type: "interest" | "purchase" | "rating" | "skip";
  is_interested: boolean | null;
  has_purchased: boolean | null;
  rating: number | null;
  comment: string | null;
  triggered_by: string | null;
  created_at: string;
};

export type NegativeFeedbackSample = {
  recommendationId: string;
  feedbackType: UserFeedbackRecord["feedback_type"];
  rating?: number | null;
  title: string;
  tags?: string[];
  searchQuery?: string;
};

export async function getUserFeedbackHistory(
  userId: string,
  limit: number = 20
): Promise<UserFeedbackRecord[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  if (isChinaDeployment()) {
    const db = getCloudBaseDatabase();
    const result = await db
      .collection(CloudBaseCollections.USER_FEEDBACKS)
      .where({ user_id: userId })
      .orderBy("created_at", "desc")
      .limit(safeLimit)
      .get();

    return (result.data || []).map((item: any) => ({
      id: item._id,
      user_id: item.user_id,
      recommendation_id: item.recommendation_id,
      feedback_type: item.feedback_type,
      is_interested: item.is_interested ?? null,
      has_purchased: item.has_purchased ?? null,
      rating: item.rating ?? null,
      comment: item.comment ?? null,
      triggered_by: item.triggered_by ?? null,
      created_at: item.created_at,
    }));
  }

  const { supabaseAdmin } = await import("@/lib/integrations/supabase-admin");
  const { data, error } = await supabaseAdmin
    .from("user_feedbacks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    recommendation_id: row.recommendation_id,
    feedback_type: row.feedback_type,
    is_interested: row.is_interested ?? null,
    has_purchased: row.has_purchased ?? null,
    rating: row.rating ?? null,
    comment: row.comment ?? null,
    triggered_by: row.triggered_by ?? null,
    created_at: row.created_at,
  }));
}

export function extractNegativeFeedbackSamples(params: {
  feedbacks: UserFeedbackRecord[];
  historyById: Map<
    string,
    {
      title: string;
      metadata?: Record<string, any> | null;
    }
  >;
  maxSamples?: number;
}): NegativeFeedbackSample[] {
  const maxSamples = Math.min(Math.max(params.maxSamples ?? 10, 1), 30);

  const negatives = params.feedbacks.filter((fb) => {
    if (fb.feedback_type === "skip") return true;
    if (fb.feedback_type === "interest" && fb.is_interested === false) return true;
    if (fb.feedback_type === "rating" && typeof fb.rating === "number" && fb.rating <= 2) return true;
    return false;
  });

  const output: NegativeFeedbackSample[] = [];
  const seen = new Set<string>();

  for (const fb of negatives) {
    const history = params.historyById.get(fb.recommendation_id);
    const title = history?.title;
    if (typeof title !== "string" || title.trim().length === 0) continue;
    const key = `${fb.feedback_type}:${fb.recommendation_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tagCandidate = history?.metadata?.tags;
    const tags = Array.isArray(tagCandidate)
      ? tagCandidate.filter((t) => typeof t === "string" && t.trim().length > 0)
      : undefined;

    const searchQueryCandidate = history?.metadata?.searchQuery;
    const searchQuery =
      typeof searchQueryCandidate === "string" && searchQueryCandidate.trim().length > 0
        ? searchQueryCandidate
        : undefined;

    output.push({
      recommendationId: fb.recommendation_id,
      feedbackType: fb.feedback_type,
      rating: fb.rating,
      title,
      ...(tags && tags.length > 0 ? { tags } : {}),
      ...(searchQuery ? { searchQuery } : {}),
    });

    if (output.length >= maxSamples) break;
  }

  return output;
}

