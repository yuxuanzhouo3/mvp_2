import { NextRequest, NextResponse } from "next/server";
import { getCloudBaseDatabase, getDbCommand } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  getAdminSessionToken,
  hasCnDbConfig,
  hasIntlDbConfig,
  isAdminAuthorized,
  isInternalAdminProxyRequest,
  proxyAdminJsonFetch,
  type AdminDataSource,
} from "@/lib/admin/proxy";

export const dynamic = "force-dynamic";

type DeviceStatsSource = "ALL" | AdminDataSource;
type SourceMode = "direct" | "proxy" | "missing";

type SourceInfo = {
  source: AdminDataSource;
  ok: boolean;
  mode: SourceMode;
  message?: string;
};

type TrendPoint = {
  date: string;
  events: number;
  uniqueUsers: number;
  uniqueSessions: number;
};

type DistributionItem = {
  key: string;
  label: string;
  count: number;
  ratio: number;
};

type TopCountItem = {
  key: string;
  count: number;
};

type SideTotals = {
  totalEvents: number;
  uniqueUsers: number;
  uniqueSessions: number;
  mobileEvents: number;
  desktopEvents: number;
  tabletEvents: number;
  otherDeviceEvents: number;
};

type SideDeviceStats = {
  source: AdminDataSource;
  totals: SideTotals;
  trend: TrendPoint[];
  devices: DistributionItem[];
  os: DistributionItem[];
  browsers: DistributionItem[];
  topPaths: TopCountItem[];
  topEvents: TopCountItem[];
};

type CombinedTrendPoint = {
  date: string;
  cn: number;
  intl: number;
  total: number;
};

type DeviceStatsResponse = {
  source: DeviceStatsSource;
  days: number;
  sources: SourceInfo[];
  sides: SideDeviceStats[];
  summary: SideTotals;
  trend: CombinedTrendPoint[];
  generatedAt: string;
};

type RawEvent = {
  id: string | null;
  eventType: string;
  userId: string | null;
  sessionId: string | null;
  path: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  createdAt: string;
};

const DEVICE_ORDER = ["mobile", "desktop", "tablet", "other"] as const;
type CanonicalDevice = (typeof DEVICE_ORDER)[number];

const DEVICE_LABELS: Record<CanonicalDevice, string> = {
  mobile: "Mobile",
  desktop: "Desktop",
  tablet: "Tablet",
  other: "Other",
};

const OS_LABELS: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  ios: "iOS",
  android: "Android",
  linux: "Linux",
  harmonyos: "HarmonyOS",
  chromeos: "ChromeOS",
  unknown: "Unknown",
};

const BROWSER_LABELS: Record<string, string> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  wechat: "WeChat",
  qqbrowser: "QQ Browser",
  opera: "Opera",
  unknown: "Unknown",
};

function parseSource(value: string | null): DeviceStatsSource {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "CN" || normalized === "INTL") return normalized;
  return "ALL";
}

function parseDays(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(180, Math.max(1, Math.floor(parsed)));
}

function startIsoUtcDays(days: number): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return start.toISOString();
}

function lastUtcDates(days: number): string[] {
  const dates: string[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - index);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function normalizeText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 10 ** 12 ? value : value > 10 ** 10 ? value * 1000 : value;
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const text = normalizeText(value);
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    return toIsoString(Number(text));
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeEventType(value: unknown): string {
  return normalizeText(value)?.toLowerCase() || "unknown";
}

function normalizePath(value: unknown): string | null {
  const path = normalizeText(value);
  if (!path) return null;
  return path.length > 200 ? path.slice(0, 200) : path;
}

function canonicalDevice(value: unknown): CanonicalDevice {
  const normalized = normalizeText(value)?.toLowerCase() || "";
  if (!normalized) return "other";

  if (
    normalized.includes("tablet") ||
    normalized.includes("ipad") ||
    normalized.includes("pad")
  ) {
    return "tablet";
  }

  if (
    normalized.includes("mobile") ||
    normalized.includes("phone") ||
    normalized.includes("iphone") ||
    normalized.includes("android") ||
    normalized.includes("ios")
  ) {
    return "mobile";
  }

  if (
    normalized.includes("desktop") ||
    normalized.includes("windows") ||
    normalized.includes("mac") ||
    normalized.includes("linux") ||
    normalized.includes("pc")
  ) {
    return "desktop";
  }

  return "other";
}

function canonicalOs(value: unknown): string {
  const normalized = normalizeText(value)?.toLowerCase() || "";
  if (!normalized) return "unknown";
  if (normalized.includes("windows")) return "windows";
  if (normalized.includes("mac")) return "macos";
  if (normalized.includes("ios") || normalized.includes("iphone") || normalized.includes("ipad")) return "ios";
  if (normalized.includes("android")) return "android";
  if (normalized.includes("linux")) return "linux";
  if (normalized.includes("harmony") || normalized.includes("hongmeng")) return "harmonyos";
  if (normalized.includes("chrome os") || normalized.includes("chromeos")) return "chromeos";
  return normalized;
}

function canonicalBrowser(value: unknown): string {
  const normalized = normalizeText(value)?.toLowerCase() || "";
  if (!normalized) return "unknown";
  if (normalized.includes("edge") || normalized.includes("edg")) return "edge";
  if (normalized.includes("qqbrowser") || normalized.includes("qq browser")) return "qqbrowser";
  if (normalized.includes("wechat") || normalized.includes("micromessenger")) return "wechat";
  if (normalized.includes("chrome")) return "chrome";
  if (normalized.includes("safari")) return "safari";
  if (normalized.includes("firefox")) return "firefox";
  if (normalized.includes("opera")) return "opera";
  return normalized;
}

function titleFromKey(key: string): string {
  if (!key) return "Unknown";
  return key
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function incrementCount(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) || 0) + amount);
}

function buildFixedDeviceDistribution(counts: Map<string, number>, total: number): DistributionItem[] {
  return DEVICE_ORDER.map((key) => {
    const count = counts.get(key) || 0;
    return {
      key,
      label: DEVICE_LABELS[key],
      count,
      ratio: total > 0 ? count / total : 0,
    };
  });
}

function buildTopDistribution(params: {
  counts: Map<string, number>;
  labels: Record<string, string>;
  total: number;
  limit: number;
}): DistributionItem[] {
  const entries = Array.from(params.counts.entries())
    .filter(([, count]) => count > 0)
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, params.limit);

  if (!entries.length) {
    return [
      {
        key: "unknown",
        label: params.labels.unknown || "Unknown",
        count: 0,
        ratio: 0,
      },
    ];
  }

  return entries.map(([key, count]) => ({
    key,
    label: params.labels[key] || titleFromKey(key),
    count,
    ratio: params.total > 0 ? count / params.total : 0,
  }));
}

function mapToTopItems(map: Map<string, number>, limit: number): TopCountItem[] {
  return Array.from(map.entries())
    .filter(([, count]) => count > 0)
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function emptyTotals(): SideTotals {
  return {
    totalEvents: 0,
    uniqueUsers: 0,
    uniqueSessions: 0,
    mobileEvents: 0,
    desktopEvents: 0,
    tabletEvents: 0,
    otherDeviceEvents: 0,
  };
}

function emptyTrend(days: number): TrendPoint[] {
  return lastUtcDates(days).map((date) => ({
    date,
    events: 0,
    uniqueUsers: 0,
    uniqueSessions: 0,
  }));
}

function createEmptySide(source: AdminDataSource, days: number): SideDeviceStats {
  return {
    source,
    totals: emptyTotals(),
    trend: emptyTrend(days),
    devices: buildFixedDeviceDistribution(new Map<string, number>(), 0),
    os: [
      {
        key: "unknown",
        label: OS_LABELS.unknown,
        count: 0,
        ratio: 0,
      },
    ],
    browsers: [
      {
        key: "unknown",
        label: BROWSER_LABELS.unknown,
        count: 0,
        ratio: 0,
      },
    ],
    topPaths: [],
    topEvents: [],
  };
}

function normalizeDistributionItems(items: unknown, fallback: DistributionItem[]): DistributionItem[] {
  if (!Array.isArray(items)) return fallback;

  const mapped = items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const key = normalizeText(record.key) || "unknown";
      const label = normalizeText(record.label) || titleFromKey(key);
      const count = normalizeNumber(record.count);
      const ratio = Number(record.ratio);
      return {
        key,
        label,
        count,
        ratio: Number.isFinite(ratio) && ratio >= 0 ? ratio : 0,
      } satisfies DistributionItem;
    })
    .filter((item): item is DistributionItem => !!item);

  return mapped.length ? mapped : fallback;
}

function normalizeTopItems(items: unknown): TopCountItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const key = normalizeText(record.key);
      if (!key) return null;
      const count = normalizeNumber(record.count);
      return { key, count } satisfies TopCountItem;
    })
    .filter((item): item is TopCountItem => !!item)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.key.localeCompare(right.key);
    });
}

function normalizeTrendPoints(items: unknown, days: number): TrendPoint[] {
  const dayKeys = lastUtcDates(days);
  const map = new Map<string, TrendPoint>();
  for (const day of dayKeys) {
    map.set(day, { date: day, events: 0, uniqueUsers: 0, uniqueSessions: 0 });
  }

  if (Array.isArray(items)) {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const date = normalizeText(record.date);
      if (!date || !map.has(date)) continue;
      map.set(date, {
        date,
        events: normalizeNumber(record.events),
        uniqueUsers: normalizeNumber(record.uniqueUsers),
        uniqueSessions: normalizeNumber(record.uniqueSessions),
      });
    }
  }

  return dayKeys.map((day) => map.get(day) || { date: day, events: 0, uniqueUsers: 0, uniqueSessions: 0 });
}

function normalizeSide(input: unknown, source: AdminDataSource, days: number): SideDeviceStats {
  if (!input || typeof input !== "object") return createEmptySide(source, days);

  const record = input as Record<string, unknown>;
  const fallback = createEmptySide(source, days);
  const totalsRecord =
    record.totals && typeof record.totals === "object"
      ? (record.totals as Record<string, unknown>)
      : null;

  return {
    source,
    totals: {
      totalEvents: totalsRecord ? normalizeNumber(totalsRecord.totalEvents) : 0,
      uniqueUsers: totalsRecord ? normalizeNumber(totalsRecord.uniqueUsers) : 0,
      uniqueSessions: totalsRecord ? normalizeNumber(totalsRecord.uniqueSessions) : 0,
      mobileEvents: totalsRecord ? normalizeNumber(totalsRecord.mobileEvents) : 0,
      desktopEvents: totalsRecord ? normalizeNumber(totalsRecord.desktopEvents) : 0,
      tabletEvents: totalsRecord ? normalizeNumber(totalsRecord.tabletEvents) : 0,
      otherDeviceEvents: totalsRecord ? normalizeNumber(totalsRecord.otherDeviceEvents) : 0,
    },
    trend: normalizeTrendPoints(record.trend, days),
    devices: normalizeDistributionItems(record.devices, fallback.devices),
    os: normalizeDistributionItems(record.os, fallback.os),
    browsers: normalizeDistributionItems(record.browsers, fallback.browsers),
    topPaths: normalizeTopItems(record.topPaths),
    topEvents: normalizeTopItems(record.topEvents),
  };
}

function normalizeRawEvent(input: unknown): RawEvent | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;

  const createdAt = toIsoString(record.created_at ?? record.createdAt);
  if (!createdAt) return null;

  return {
    id: normalizeText(record.id ?? record._id),
    eventType: normalizeEventType(record.event_type ?? record.eventType),
    userId: normalizeText(record.user_id ?? record.userId),
    sessionId: normalizeText(record.session_id ?? record.sessionId),
    path: normalizePath(record.path),
    device: normalizeText(record.device),
    os: normalizeText(record.os),
    browser: normalizeText(record.browser),
    createdAt,
  };
}

function computeSideFromEvents(source: AdminDataSource, events: RawEvent[], days: number): SideDeviceStats {
  const dayKeys = lastUtcDates(days);
  const dayMap = new Map<
    string,
    { events: number; uniqueUsers: Set<string>; uniqueSessions: Set<string> }
  >();
  for (const day of dayKeys) {
    dayMap.set(day, { events: 0, uniqueUsers: new Set<string>(), uniqueSessions: new Set<string>() });
  }

  const uniqueUsers = new Set<string>();
  const uniqueSessions = new Set<string>();

  const deviceCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  const pathCounts = new Map<string, number>();
  const eventCounts = new Map<string, number>();

  for (const event of events) {
    const day = event.createdAt.slice(0, 10);
    const dayBucket = dayMap.get(day);
    if (dayBucket) {
      dayBucket.events += 1;
      if (event.userId) dayBucket.uniqueUsers.add(event.userId);
      if (event.sessionId) dayBucket.uniqueSessions.add(event.sessionId);
    }

    if (event.userId) uniqueUsers.add(event.userId);
    if (event.sessionId) uniqueSessions.add(event.sessionId);

    incrementCount(deviceCounts, canonicalDevice(event.device));
    incrementCount(osCounts, canonicalOs(event.os));
    incrementCount(browserCounts, canonicalBrowser(event.browser));
    incrementCount(pathCounts, event.path || "(no_path)");
    incrementCount(eventCounts, event.eventType || "unknown");
  }

  const totalEvents = events.length;
  const mobileEvents = deviceCounts.get("mobile") || 0;
  const desktopEvents = deviceCounts.get("desktop") || 0;
  const tabletEvents = deviceCounts.get("tablet") || 0;
  const otherDeviceEvents = deviceCounts.get("other") || 0;

  const trend: TrendPoint[] = dayKeys.map((day) => {
    const bucket = dayMap.get(day);
    return {
      date: day,
      events: bucket?.events || 0,
      uniqueUsers: bucket?.uniqueUsers.size || 0,
      uniqueSessions: bucket?.uniqueSessions.size || 0,
    };
  });

  return {
    source,
    totals: {
      totalEvents,
      uniqueUsers: uniqueUsers.size,
      uniqueSessions: uniqueSessions.size,
      mobileEvents,
      desktopEvents,
      tabletEvents,
      otherDeviceEvents,
    },
    trend,
    devices: buildFixedDeviceDistribution(deviceCounts, totalEvents),
    os: buildTopDistribution({ counts: osCounts, labels: OS_LABELS, total: totalEvents, limit: 8 }),
    browsers: buildTopDistribution({
      counts: browserCounts,
      labels: BROWSER_LABELS,
      total: totalEvents,
      limit: 8,
    }),
    topPaths: mapToTopItems(pathCounts, 10),
    topEvents: mapToTopItems(eventCounts, 10),
  };
}

async function fetchCloudBaseEventsByWhere(params: {
  where: Record<string, unknown>;
  orderField: "created_at" | "createdAt";
}): Promise<RawEvent[]> {
  const database = getCloudBaseDatabase();
  const collection = database.collection("analytics_events");
  const rows: RawEvent[] = [];

  const pageSize = 200;
  let offset = 0;
  for (let loop = 0; loop < 400; loop += 1) {
    const query = collection.where(params.where).field({
      _id: true,
      id: true,
      event_type: true,
      eventType: true,
      user_id: true,
      userId: true,
      session_id: true,
      sessionId: true,
      path: true,
      device: true,
      os: true,
      browser: true,
      created_at: true,
      createdAt: true,
    });

    let result: any;
    try {
      result = await query.orderBy(params.orderField, "desc").skip(offset).limit(pageSize).get();
    } catch {
      result = await query.skip(offset).limit(pageSize).get();
    }

    const data = Array.isArray(result?.data) ? result.data : [];
    for (const item of data) {
      const normalized = normalizeRawEvent(item);
      if (normalized) rows.push(normalized);
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function fetchCloudBaseEvents(startIso: string): Promise<RawEvent[]> {
  const command = getDbCommand();
  const startDate = new Date(startIso);
  const startMillis = startDate.getTime();

  const attempts = await Promise.allSettled([
    fetchCloudBaseEventsByWhere({
      where: { created_at: command.gte(startIso) },
      orderField: "created_at",
    }),
    fetchCloudBaseEventsByWhere({
      where: { createdAt: command.gte(startIso) },
      orderField: "createdAt",
    }),
    fetchCloudBaseEventsByWhere({
      where: { createdAt: command.gte(startMillis) },
      orderField: "createdAt",
    }),
  ]);

  const succeeded = attempts.filter(
    (attempt): attempt is PromiseFulfilledResult<RawEvent[]> => attempt.status === "fulfilled"
  );

  if (!succeeded.length) {
    const firstError = attempts.find(
      (attempt): attempt is PromiseRejectedResult => attempt.status === "rejected"
    );
    const message = firstError?.reason?.message || "CloudBase analytics_events query failed";
    throw new Error(String(message));
  }

  const merged = new Map<string, RawEvent>();
  for (const result of succeeded) {
    for (const item of result.value) {
      const key =
        item.id ||
        `${item.createdAt}|${item.sessionId || ""}|${item.eventType}|${item.path || ""}`;
      if (!merged.has(key)) merged.set(key, item);
    }
  }

  return Array.from(merged.values());
}

async function fetchSupabaseEvents(startIso: string): Promise<RawEvent[]> {
  const supabase = getSupabaseAdmin();
  const rows: RawEvent[] = [];

  const pageSize = 1000;
  let offset = 0;
  for (let loop = 0; loop < 400; loop += 1) {
    const { data, error } = await supabase
      .from("analytics_events")
      .select("id,event_type,user_id,session_id,path,device,os,browser,created_at")
      .gte("created_at", startIso)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const chunk = Array.isArray(data) ? data : [];

    for (const item of chunk) {
      const normalized = normalizeRawEvent(item);
      if (normalized) rows.push(normalized);
    }

    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function computeCnSide(days: number): Promise<SideDeviceStats> {
  const events = await fetchCloudBaseEvents(startIsoUtcDays(days));
  return computeSideFromEvents("CN", events, days);
}

async function computeIntlSide(days: number): Promise<SideDeviceStats> {
  const events = await fetchSupabaseEvents(startIsoUtcDays(days));
  return computeSideFromEvents("INTL", events, days);
}

function buildProxyPath(source: AdminDataSource, days: number): string {
  const query = new URLSearchParams();
  query.set("source", source);
  query.set("days", String(days));
  return `/api/admin/device-stats?${query.toString()}`;
}

async function fetchSideViaProxy(params: {
  request: NextRequest;
  origin: string;
  source: AdminDataSource;
  days: number;
}): Promise<SideDeviceStats> {
  const token = getAdminSessionToken(params.request);
  const remote = await proxyAdminJsonFetch<DeviceStatsResponse>({
    origin: params.origin,
    pathWithQuery: buildProxyPath(params.source, params.days),
    token,
  });

  const target = Array.isArray(remote.sides)
    ? remote.sides.find((side) => side.source === params.source)
    : null;

  if (!target) {
    throw new Error(`Proxy response missing ${params.source} side`);
  }

  return normalizeSide(target, params.source, params.days);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function resolveSummary(sides: SideDeviceStats[]): SideTotals {
  return sides.reduce<SideTotals>(
    (summary, side) => ({
      totalEvents: summary.totalEvents + side.totals.totalEvents,
      uniqueUsers: summary.uniqueUsers + side.totals.uniqueUsers,
      uniqueSessions: summary.uniqueSessions + side.totals.uniqueSessions,
      mobileEvents: summary.mobileEvents + side.totals.mobileEvents,
      desktopEvents: summary.desktopEvents + side.totals.desktopEvents,
      tabletEvents: summary.tabletEvents + side.totals.tabletEvents,
      otherDeviceEvents: summary.otherDeviceEvents + side.totals.otherDeviceEvents,
    }),
    emptyTotals()
  );
}

function resolveCombinedTrend(sides: SideDeviceStats[], days: number): CombinedTrendPoint[] {
  const cnSide = sides.find((side) => side.source === "CN") || createEmptySide("CN", days);
  const intlSide = sides.find((side) => side.source === "INTL") || createEmptySide("INTL", days);

  const cnMap = new Map<string, number>(cnSide.trend.map((point) => [point.date, point.events]));
  const intlMap = new Map<string, number>(intlSide.trend.map((point) => [point.date, point.events]));

  return lastUtcDates(days).map((date) => {
    const cn = cnMap.get(date) || 0;
    const intl = intlMap.get(date) || 0;
    return {
      date,
      cn,
      intl,
      total: cn + intl,
    };
  });
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = parseSource(request.nextUrl.searchParams.get("source"));
  const days = parseDays(request.nextUrl.searchParams.get("days"));

  const requiredSources: AdminDataSource[] = source === "ALL" ? ["CN", "INTL"] : [source];

  const cnOrigin = process.env.CN_APP_ORIGIN || "";
  const intlOrigin = process.env.INTL_APP_ORIGIN || "";
  const internalProxy = isInternalAdminProxyRequest(request);

  const sources: SourceInfo[] = [];
  const sideMap = new Map<AdminDataSource, SideDeviceStats>();

  const resolveSide = async (targetSource: AdminDataSource): Promise<void> => {
    const hasDirectConfig = targetSource === "CN" ? hasCnDbConfig() : hasIntlDbConfig();
    const origin = targetSource === "CN" ? cnOrigin : intlOrigin;
    const canProxy = !internalProxy && Boolean(origin);

    if (hasDirectConfig) {
      try {
        const side =
          targetSource === "CN" ? await computeCnSide(days) : await computeIntlSide(days);
        sideMap.set(targetSource, normalizeSide(side, targetSource, days));
        sources.push({ source: targetSource, ok: true, mode: "direct" });
        return;
      } catch (directError) {
        if (canProxy) {
          try {
            const side = await fetchSideViaProxy({
              request,
              origin,
              source: targetSource,
              days,
            });
            sideMap.set(targetSource, side);
            sources.push({
              source: targetSource,
              ok: true,
              mode: "proxy",
              message: `Direct query failed, fallback to proxy: ${getErrorMessage(
                directError,
                "Unknown direct query error"
              )}`,
            });
            return;
          } catch (proxyError) {
            sources.push({
              source: targetSource,
              ok: false,
              mode: "proxy",
              message: getErrorMessage(proxyError, "Proxy query failed"),
            });
            return;
          }
        }

        sources.push({
          source: targetSource,
          ok: false,
          mode: "direct",
          message: getErrorMessage(directError, "Direct query failed"),
        });
        return;
      }
    }

    if (canProxy) {
      try {
        const side = await fetchSideViaProxy({
          request,
          origin,
          source: targetSource,
          days,
        });
        sideMap.set(targetSource, side);
        sources.push({ source: targetSource, ok: true, mode: "proxy" });
      } catch (proxyError) {
        sources.push({
          source: targetSource,
          ok: false,
          mode: "proxy",
          message: getErrorMessage(proxyError, "Proxy query failed"),
        });
      }
      return;
    }

    const missingDetails: string[] = [];
    if (internalProxy) missingDetails.push("internal proxy request cannot re-proxy");
    if (!origin) {
      missingDetails.push(targetSource === "CN" ? "missing CN_APP_ORIGIN" : "missing INTL_APP_ORIGIN");
    }

    sources.push({
      source: targetSource,
      ok: false,
      mode: "missing",
      message: `No direct config and no proxy fallback${
        missingDetails.length ? ` (${missingDetails.join("; ")})` : ""
      }`,
    });
  };

  await Promise.all(requiredSources.map((targetSource) => resolveSide(targetSource)));

  const sides = requiredSources.map(
    (targetSource) => sideMap.get(targetSource) || createEmptySide(targetSource, days)
  );

  const response: DeviceStatsResponse = {
    source,
    days,
    sources,
    sides,
    summary: resolveSummary(sides),
    trend: resolveCombinedTrend(sides, days),
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}

