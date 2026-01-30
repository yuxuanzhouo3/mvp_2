import { NextRequest, NextResponse } from "next/server";
import { getCloudBaseDatabase, getDbCommand } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  getAdminSessionToken,
  hasCnDbConfig,
  hasIntlDbConfig,
  isAdminAuthorized,
  proxyAdminJsonFetch,
  type AdminDataSource,
} from "@/lib/admin/proxy";

export const dynamic = "force-dynamic";

type AnalyticsSource = "ALL" | AdminDataSource;
type SourceMode = "direct" | "proxy" | "missing";

type SourceInfo = {
  source: AdminDataSource;
  ok: boolean;
  mode: SourceMode;
  message?: string;
};

type OnboardingOverview = {
  started: number;
  completed: number;
  completionRate: number;
};

type OnboardingExitStep = {
  step: string;
  count: number;
  permanentCount: number;
};

type EventsStats = {
  days: Array<{
    date: string;
    activeSessions: number;
    pageViews: number;
    sessionsStarted: number;
  }>;
  topPages: Array<{ path: string; pageViews: number }>;
  topEvents: Array<{ eventType: string; count: number }>;
  funnels: {
    onboarding: {
      stepViewedSessions: number;
      completedSessions: number;
      completionRate: number;
    };
    recommendation: {
      requestedSessions: number;
      successSessions: number;
      resultViewedSessions: number;
      clickedSessions: number;
      requestToSuccessRate: number;
      successToViewRate: number;
      viewToClickRate: number;
    };
  };
  permanentDropoff: Array<{ lastStep: string; sessions: number }>;
};

type AiUsageStats = {
  totalRequests: number;
  activeUsers: number;
  topUsers: Array<{ userId: string; requests: number }>;
};

type SideAnalytics = {
  source: AdminDataSource;
  onboarding: {
    overview: OnboardingOverview;
    exitSteps: OnboardingExitStep[];
  };
  events: EventsStats;
  aiUsage: AiUsageStats;
};

type AnalyticsResponse = {
  source: AnalyticsSource;
  days: number;
  permanentDays: number;
  sources: SourceInfo[];
  sides: SideAnalytics[];
};

type NormalizedEvent = {
  eventType: string;
  userId: string | null;
  sessionId: string | null;
  path: string | null;
  step: string | null;
  createdAt: string;
};

function parseSource(value: string | null): AnalyticsSource {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "CN" || normalized === "INTL") return normalized;
  return "ALL";
}

function parseDays(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 7;
  return Math.min(90, Math.max(1, Math.floor(n)));
}

function parsePermanentDays(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 7;
  return Math.min(180, Math.max(1, Math.floor(n)));
}

function startIsoUtcDays(days: number): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return start.toISOString();
}

function lastUtcDates(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function pickTop<T>(items: Array<[string, number]>, limit: number, map: (k: string, v: number) => T): T[] {
  return items
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k, v]) => map(k, v));
}

function computeOnboardingStats(params: {
  rows: any[];
  permanentIso: string;
}): { overview: OnboardingOverview; exitSteps: OnboardingExitStep[] } {
  const started = params.rows.length;
  const completed = params.rows.filter((r) => Boolean(r.is_completed)).length;
  const exitMap = new Map<string, { count: number; permanentCount: number }>();

  for (const r of params.rows) {
    if (r.is_completed) continue;
    const step = `${r.current_category_index ?? 0}.${r.current_question_index ?? 0}`;
    const updatedAt = String(r.updated_at || r.updatedAt || "");
    const permanent = updatedAt && updatedAt < params.permanentIso;
    const item = exitMap.get(step) || { count: 0, permanentCount: 0 };
    item.count += 1;
    if (permanent) item.permanentCount += 1;
    exitMap.set(step, item);
  }

  const exitSteps = Array.from(exitMap.entries()).map(([step, v]) => ({ step, ...v }));
  exitSteps.sort((a, b) => b.count - a.count);

  return {
    overview: {
      started,
      completed,
      completionRate: started ? completed / started : 0,
    },
    exitSteps,
  };
}

async function fetchCloudBaseEvents(startIso: string): Promise<NormalizedEvent[]> {
  const db = getCloudBaseDatabase();
  const cmd = getDbCommand();
  const collection = db.collection("analytics_events");

  const rows: NormalizedEvent[] = [];
  const pageSize = 200;
  let offset = 0;
  for (let i = 0; i < 200; i++) {
    const res = await collection
      .where({ created_at: cmd.gte(startIso) })
      .field({
        event_type: true,
        user_id: true,
        session_id: true,
        path: true,
        step: true,
        created_at: true,
      })
      .orderBy("created_at", "desc")
      .skip(offset)
      .limit(pageSize)
      .get();

    const data = res.data || [];
    for (const r of data) {
      const createdAt = typeof r.created_at === "string" ? r.created_at : new Date(String(r.created_at || "")).toISOString();
      rows.push({
        eventType: String(r.event_type || ""),
        userId: r.user_id ? String(r.user_id) : null,
        sessionId: r.session_id ? String(r.session_id) : null,
        path: r.path ? String(r.path) : null,
        step: r.step ? String(r.step) : null,
        createdAt,
      });
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function fetchSupabaseEvents(startIso: string): Promise<NormalizedEvent[]> {
  const supabase = getSupabaseAdmin();
  const rows: NormalizedEvent[] = [];
  const pageSize = 1000;
  let offset = 0;
  for (let i = 0; i < 200; i++) {
    const { data, error } = await supabase
      .from("analytics_events")
      .select("event_type,user_id,session_id,path,step,created_at")
      .gte("created_at", startIso)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const chunk = data || [];
    for (const r of chunk) {
      const createdAt = typeof r.created_at === "string" ? r.created_at : new Date(String(r.created_at || "")).toISOString();
      rows.push({
        eventType: String(r.event_type || ""),
        userId: r.user_id ? String(r.user_id) : null,
        sessionId: r.session_id ? String(r.session_id) : null,
        path: r.path ? String(r.path) : null,
        step: r.step ? String(r.step) : null,
        createdAt,
      });
    }
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function fetchCloudBaseUsage(startIso: string): Promise<Array<{ userId: string | null }>> {
  const db = getCloudBaseDatabase();
  const cmd = getDbCommand();
  const collection = db.collection("recommendation_usage");
  const rows: Array<{ userId: string | null }> = [];
  const pageSize = 200;
  let offset = 0;
  for (let i = 0; i < 200; i++) {
    const res = await collection
      .where({ created_at: cmd.gte(startIso) })
      .field({ user_id: true })
      .orderBy("created_at", "desc")
      .skip(offset)
      .limit(pageSize)
      .get();
    const data = res.data || [];
    for (const r of data) rows.push({ userId: r.user_id ? String(r.user_id) : null });
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function fetchSupabaseUsage(startIso: string): Promise<Array<{ userId: string | null }>> {
  const supabase = getSupabaseAdmin();
  const rows: Array<{ userId: string | null }> = [];
  const pageSize = 1000;
  let offset = 0;
  for (let i = 0; i < 200; i++) {
    const { data, error } = await supabase
      .from("recommendation_usage")
      .select("user_id,created_at")
      .gte("created_at", startIso)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const chunk = data || [];
    for (const r of chunk) rows.push({ userId: r.user_id ? String(r.user_id) : null });
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

function computeEventsStats(params: { events: NormalizedEvent[]; days: number; permanentIso: string }): EventsStats {
  const dayKeys = lastUtcDates(params.days);
  const dayMap = new Map<string, { sessions: Set<string>; pageViews: number; sessionsStarted: number }>();
  for (const d of dayKeys) {
    dayMap.set(d, { sessions: new Set(), pageViews: 0, sessionsStarted: 0 });
  }

  const pageTotals = new Map<string, number>();
  const eventTotals = new Map<string, number>();

  const onboardingSessions = new Set<string>();
  const onboardingCompletedSessions = new Set<string>();

  const recRequested = new Set<string>();
  const recSuccess = new Set<string>();
  const recViewed = new Set<string>();
  const recClicked = new Set<string>();

  const sessionLast = new Map<string, { at: string; lastStep: string }>();

  for (const e of params.events) {
    const day = e.createdAt.slice(0, 10);
    const bucket = dayMap.get(day);
    if (bucket && e.sessionId) bucket.sessions.add(e.sessionId);
    if (bucket && e.eventType === "page_view") bucket.pageViews += 1;
    if (bucket && e.eventType === "session_start") bucket.sessionsStarted += 1;

    eventTotals.set(e.eventType, (eventTotals.get(e.eventType) || 0) + 1);
    if (e.eventType === "page_view" && e.path) {
      pageTotals.set(e.path, (pageTotals.get(e.path) || 0) + 1);
    }

    if (e.sessionId) {
      if (e.eventType === "onboarding_step_view") onboardingSessions.add(e.sessionId);
      if (e.eventType === "onboarding_complete") onboardingCompletedSessions.add(e.sessionId);
      if (e.eventType === "recommend_request") recRequested.add(e.sessionId);
      if (e.eventType === "recommend_success") recSuccess.add(e.sessionId);
      if (e.eventType === "recommend_result_view") recViewed.add(e.sessionId);
      if (e.eventType === "recommend_click") recClicked.add(e.sessionId);

      const prev = sessionLast.get(e.sessionId);
      if (!prev || e.createdAt > prev.at) {
        const lastStep =
          e.eventType === "onboarding_step_view"
            ? `onboarding:${e.step || "unknown"}`
            : e.eventType.startsWith("recommend_")
              ? e.eventType
              : e.eventType;
        sessionLast.set(e.sessionId, { at: e.createdAt, lastStep });
      }
    }
  }

  const days = dayKeys.map((date) => {
    const b = dayMap.get(date)!;
    return {
      date,
      activeSessions: b.sessions.size,
      pageViews: b.pageViews,
      sessionsStarted: b.sessionsStarted,
    };
  });

  const topPages = pickTop(
    Array.from(pageTotals.entries()),
    20,
    (path, pageViews) => ({ path, pageViews })
  );
  const topEvents = pickTop(
    Array.from(eventTotals.entries()),
    20,
    (eventType, count) => ({ eventType, count })
  );

  const onboardingStepViewedSessions = onboardingSessions.size;
  const onboardingCompleted = onboardingCompletedSessions.size;
  const onboardingCompletionRate = onboardingStepViewedSessions
    ? onboardingCompleted / onboardingStepViewedSessions
    : 0;

  const requested = recRequested.size;
  const success = recSuccess.size;
  const viewed = recViewed.size;
  const clicked = recClicked.size;

  const permanentMap = new Map<string, number>();
  for (const { at, lastStep } of sessionLast.values()) {
    if (at < params.permanentIso) {
      permanentMap.set(lastStep, (permanentMap.get(lastStep) || 0) + 1);
    }
  }

  return {
    days,
    topPages,
    topEvents,
    funnels: {
      onboarding: {
        stepViewedSessions: onboardingStepViewedSessions,
        completedSessions: onboardingCompleted,
        completionRate: onboardingCompletionRate,
      },
      recommendation: {
        requestedSessions: requested,
        successSessions: success,
        resultViewedSessions: viewed,
        clickedSessions: clicked,
        requestToSuccessRate: requested ? success / requested : 0,
        successToViewRate: success ? viewed / success : 0,
        viewToClickRate: viewed ? clicked / viewed : 0,
      },
    },
    permanentDropoff: pickTop(
      Array.from(permanentMap.entries()),
      20,
      (lastStep, sessions) => ({ lastStep, sessions })
    ),
  };
}

function computeAiUsageStats(rows: Array<{ userId: string | null }>): AiUsageStats {
  const totalRequests = rows.length;
  const userCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.userId) continue;
    userCounts.set(r.userId, (userCounts.get(r.userId) || 0) + 1);
  }
  const topUsers = pickTop(
    Array.from(userCounts.entries()),
    20,
    (userId, requests) => ({ userId, requests })
  );
  return { totalRequests, activeUsers: userCounts.size, topUsers };
}

async function computeCnSide(params: { days: number; permanentDays: number }): Promise<SideAnalytics> {
  const permanentThreshold = new Date();
  permanentThreshold.setUTCDate(permanentThreshold.getUTCDate() - params.permanentDays);
  const permanentIso = permanentThreshold.toISOString();

  const db = getCloudBaseDatabase();
  const onboardingRes = await db.collection("onboarding_progress").limit(5000).get();
  const onboarding = computeOnboardingStats({
    rows: onboardingRes.data || [],
    permanentIso,
  });

  const startIso = startIsoUtcDays(params.days);
  const events = await fetchCloudBaseEvents(startIso);
  const usageRows = await fetchCloudBaseUsage(startIso);

  return {
    source: "CN",
    onboarding,
    events: computeEventsStats({ events, days: params.days, permanentIso }),
    aiUsage: computeAiUsageStats(usageRows),
  };
}

async function computeIntlSide(params: { days: number; permanentDays: number }): Promise<SideAnalytics> {
  const permanentThreshold = new Date();
  permanentThreshold.setUTCDate(permanentThreshold.getUTCDate() - params.permanentDays);
  const permanentIso = permanentThreshold.toISOString();

  const supabase = getSupabaseAdmin();
  const { data: onboardingRows, error: onboardingError } = await supabase
    .from("onboarding_progress")
    .select("is_completed,current_category_index,current_question_index,updated_at");
  if (onboardingError) throw onboardingError;
  const onboarding = computeOnboardingStats({
    rows: onboardingRows || [],
    permanentIso,
  });

  const startIso = startIsoUtcDays(params.days);
  const events = await fetchSupabaseEvents(startIso);
  const usageRows = await fetchSupabaseUsage(startIso);

  return {
    source: "INTL",
    onboarding,
    events: computeEventsStats({ events, days: params.days, permanentIso }),
    aiUsage: computeAiUsageStats(usageRows),
  };
}

function buildAnalyticsPath(source: AdminDataSource, params: { days: number; permanentDays: number }): string {
  const q = new URLSearchParams();
  q.set("source", source);
  q.set("days", String(params.days));
  q.set("permanentDays", String(params.permanentDays));
  return `/api/admin/analytics?${q.toString()}`;
}

async function fetchSideViaProxy(params: {
  request: NextRequest;
  origin: string;
  source: AdminDataSource;
  days: number;
  permanentDays: number;
}): Promise<SideAnalytics> {
  const token = getAdminSessionToken(params.request);
  const remote = await proxyAdminJsonFetch<AnalyticsResponse>({
    origin: params.origin,
    pathWithQuery: buildAnalyticsPath(params.source, { days: params.days, permanentDays: params.permanentDays }),
    token,
  });
  const side = remote.sides.find((s) => s.source === params.source);
  if (!side) throw new Error("Proxy response missing side data");
  return side;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = parseSource(request.nextUrl.searchParams.get("source"));
  const days = parseDays(request.nextUrl.searchParams.get("days"));
  const permanentDays = parsePermanentDays(request.nextUrl.searchParams.get("permanentDays"));

  const needCN = source === "ALL" || source === "CN";
  const needINTL = source === "ALL" || source === "INTL";

  const cnOrigin = process.env.CN_APP_ORIGIN || "";
  const intlOrigin = process.env.INTL_APP_ORIGIN || "";

  const sources: SourceInfo[] = [];
  const sides: SideAnalytics[] = [];

  if (needCN) {
    if (hasCnDbConfig()) {
      try {
        sides.push(await computeCnSide({ days, permanentDays }));
        sources.push({ source: "CN", ok: true, mode: "direct" });
      } catch (e: any) {
        sources.push({ source: "CN", ok: false, mode: "direct", message: e?.message ? String(e.message) : "CloudBase 查询失败" });
      }
    } else if (cnOrigin) {
      try {
        sides.push(
          await fetchSideViaProxy({
            request,
            origin: cnOrigin,
            source: "CN",
            days,
            permanentDays,
          })
        );
        sources.push({ source: "CN", ok: true, mode: "proxy" });
      } catch (e: any) {
        sources.push({ source: "CN", ok: false, mode: "proxy", message: e?.message ? String(e.message) : "CN 代理查询失败" });
      }
    } else {
      sources.push({ source: "CN", ok: false, mode: "missing", message: "未配置 CloudBase 或 CN_APP_ORIGIN" });
    }
  }

  if (needINTL) {
    if (hasIntlDbConfig()) {
      try {
        sides.push(await computeIntlSide({ days, permanentDays }));
        sources.push({ source: "INTL", ok: true, mode: "direct" });
      } catch (e: any) {
        sources.push({ source: "INTL", ok: false, mode: "direct", message: e?.message ? String(e.message) : "Supabase 查询失败" });
      }
    } else if (intlOrigin) {
      try {
        sides.push(
          await fetchSideViaProxy({
            request,
            origin: intlOrigin,
            source: "INTL",
            days,
            permanentDays,
          })
        );
        sources.push({ source: "INTL", ok: true, mode: "proxy" });
      } catch (e: any) {
        sources.push({ source: "INTL", ok: false, mode: "proxy", message: e?.message ? String(e.message) : "INTL 代理查询失败" });
      }
    } else {
      sources.push({ source: "INTL", ok: false, mode: "missing", message: "未配置 Supabase 或 INTL_APP_ORIGIN" });
    }
  }

  sides.sort((a, b) => (a.source > b.source ? 1 : -1));
  return NextResponse.json<AnalyticsResponse>({
    source,
    days,
    permanentDays,
    sources,
    sides,
  });
}
