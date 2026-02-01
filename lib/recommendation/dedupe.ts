export type DedupeUserHistoryItem = {
  title?: string;
  metadata?: { searchQuery?: string } | null;
};

export type DedupeRecommendationItem = {
  title?: string;
  searchQuery?: string;
  entertainmentType?: string;
  fitnessType?: string;
};

function normalizeTextKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[·•。！!？?，,、；;：:"'（）()【】\\[\\]{}<>《》]/g, "");
}

export function dedupeRecommendations<T extends DedupeRecommendationItem>(
  recommendations: T[],
  options: {
    count: number;
    userHistory?: DedupeUserHistoryItem[] | null;
    excludeTitles?: string[] | null;
    mode?: "strict" | "fill";
  }
): T[] {
  const { count } = options;
  const userHistory = options.userHistory || [];
  const excludeTitles = options.excludeTitles || [];
  const mode = options.mode ?? "strict";

  const excludeTitleKeysAlways = new Set(
    excludeTitles
      .map((t) => (typeof t === "string" ? normalizeTextKey(t) : ""))
      .filter((t) => t.length > 0)
      .slice(0, 80)
  );

  const historyTitleKeys = new Set(
    userHistory
      .map((h) => (typeof h?.title === "string" ? normalizeTextKey(h.title) : ""))
      .filter((t) => t.length > 0)
      .slice(0, 80)
  );

  const historyQueryKeys = new Set(
    userHistory
      .map((h) =>
        typeof h?.metadata?.searchQuery === "string"
          ? normalizeTextKey(h.metadata.searchQuery)
          : ""
      )
      .filter((t) => t.length > 0)
      .slice(0, 80)
  );

  const seenCompositeKeys = new Set<string>();
  const output: T[] = [];

  const getCompositeKey = (rec: T) => {
    const titleKey = normalizeTextKey(rec?.title || "");
    if (!titleKey) return null;
    const queryKey = normalizeTextKey(rec?.searchQuery || "");
    const kind = rec?.entertainmentType || rec?.fitnessType || "";
    return `${titleKey}|${queryKey}|${kind}`;
  };

  const tryAdd = (rec: T, allowHistoryOverlap: boolean) => {
    const titleKey = normalizeTextKey(rec?.title || "");
    if (!titleKey) return;

    const queryKey = normalizeTextKey(rec?.searchQuery || "");
    const compositeKey = getCompositeKey(rec);
    if (!compositeKey) return;

    if (seenCompositeKeys.has(compositeKey)) return;
    if (excludeTitleKeysAlways.has(titleKey)) return;

    if (mode === "strict") {
      if (historyTitleKeys.has(titleKey)) return;
      if (queryKey && historyQueryKeys.has(queryKey)) return;
    } else if (!allowHistoryOverlap) {
      if (historyTitleKeys.has(titleKey)) return;
      if (queryKey && historyQueryKeys.has(queryKey)) return;
    }

    seenCompositeKeys.add(compositeKey);
    output.push(rec);
  };

  for (const rec of recommendations) {
    tryAdd(rec, false);
    if (output.length >= count) return output;
  }

  if (mode === "strict") {
    return output;
  }

  for (const rec of recommendations) {
    tryAdd(rec, true);
    if (output.length >= count) return output;
  }

  return output;
}
