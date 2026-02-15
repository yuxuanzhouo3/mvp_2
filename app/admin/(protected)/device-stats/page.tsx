"use client";

import * as React from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SourceBadge, type AdminDataSource } from "@/components/admin/source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDeploymentAdminSource } from "@/lib/admin/deployment-source";

type SourceMode = "direct" | "proxy" | "missing";

type SourceInfo = {
  source: AdminDataSource;
  ok: boolean;
  mode: SourceMode;
  message?: string;
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

type DeviceStatsResponse = {
  source: AdminDataSource;
  days: number;
  sources: SourceInfo[];
  sides: SideDeviceStats[];
  summary: SideTotals;
  trend: Array<{ date: string; cn: number; intl: number; total: number }>;
  generatedAt: string;
};

const DEPLOYMENT_SOURCE: AdminDataSource = getDeploymentAdminSource();
const NUMBER_LOCALE = DEPLOYMENT_SOURCE === "CN" ? "zh-CN" : "en-US";

type UiText = {
  title: string;
  subtitle: string;
  filterTitle: string;
  rangeLabel: (days: number) => string;
  sourcePrefix: string;
  sourceWarningTitle: string;
  loadFailedTitle: string;
  statusOk: (mode: SourceMode) => string;
  statusUnavailable: (mode: SourceMode) => string;
  totalEvents: string;
  uniqueUsers: string;
  uniqueSessions: string;
  mobileRatio: string;
  mobileBreakdown: (mobile: string, total: string) => string;
  chartTitle: (days: number) => string;
  chartSeries: string;
  sourceStatsTitle: string;
  eventCount: string;
  dedupUsers: string;
  dedupSessions: string;
  deviceDistribution: string;
  topOs: string;
  topBrowser: string;
  topPaths: string;
  topEvents: string;
  pathHeader: string;
  eventHeader: string;
  countHeader: string;
  loading: string;
  empty: string;
  missingStatus: string;
  providerLong: string;
  providerShort: string;
  fallbackError: string;
};

const UI_TEXT: Record<AdminDataSource, UiText> = {
  CN: {
    title: "设备统计",
    subtitle: "仅展示腾讯云 CloudBase 文档型数据库中的设备分析数据",
    filterTitle: "筛选条件",
    rangeLabel: (days) => `最近 ${days} 天`,
    sourcePrefix: "数据源：",
    sourceWarningTitle: "数据源状态告警",
    loadFailedTitle: "加载失败",
    statusOk: (mode) => `可用 (${mode})`,
    statusUnavailable: (mode) => `不可用 (${mode})`,
    totalEvents: "总事件数",
    uniqueUsers: "去重用户数",
    uniqueSessions: "去重会话数",
    mobileRatio: "移动端占比",
    mobileBreakdown: (mobile, total) => `移动端 ${mobile} / 总计 ${total}`,
    chartTitle: (days) => `设备事件趋势（最近 ${days} 天）`,
    chartSeries: "事件数",
    sourceStatsTitle: "当前环境数据源统计",
    eventCount: "事件数",
    dedupUsers: "去重用户",
    dedupSessions: "去重会话",
    deviceDistribution: "设备分布",
    topOs: "Top OS",
    topBrowser: "Top Browser",
    topPaths: "Top Path",
    topEvents: "Top Event",
    pathHeader: "Path",
    eventHeader: "Event",
    countHeader: "事件数",
    loading: "加载中...",
    empty: "暂无数据",
    missingStatus: "接口未返回当前环境的数据源状态",
    providerLong: "腾讯云 CloudBase 文档型数据库",
    providerShort: "CloudBase",
    fallbackError: "加载设备统计失败",
  },
  INTL: {
    title: "Device Stats",
    subtitle: "Showing device analytics from Supabase only",
    filterTitle: "Filters",
    rangeLabel: (days) => `Last ${days} days`,
    sourcePrefix: "Source: ",
    sourceWarningTitle: "Data Source Warnings",
    loadFailedTitle: "Failed to Load",
    statusOk: (mode) => `OK (${mode})`,
    statusUnavailable: (mode) => `Unavailable (${mode})`,
    totalEvents: "Total Events",
    uniqueUsers: "Unique Users",
    uniqueSessions: "Unique Sessions",
    mobileRatio: "Mobile Share",
    mobileBreakdown: (mobile, total) => `Mobile ${mobile} / Total ${total}`,
    chartTitle: (days) => `Device Event Trend (Last ${days} Days)`,
    chartSeries: "Events",
    sourceStatsTitle: "Current Deployment Source Stats",
    eventCount: "Events",
    dedupUsers: "Unique Users",
    dedupSessions: "Unique Sessions",
    deviceDistribution: "Device Distribution",
    topOs: "Top OS",
    topBrowser: "Top Browser",
    topPaths: "Top Paths",
    topEvents: "Top Events",
    pathHeader: "Path",
    eventHeader: "Event",
    countHeader: "Count",
    loading: "Loading...",
    empty: "No data",
    missingStatus: "Missing source status for current deployment",
    providerLong: "Supabase",
    providerShort: "Supabase",
    fallbackError: "Failed to load device stats",
  },
};

const EMPTY_TOTALS: SideTotals = {
  totalEvents: 0,
  uniqueUsers: 0,
  uniqueSessions: 0,
  mobileEvents: 0,
  desktopEvents: 0,
  tabletEvents: 0,
  otherDeviceEvents: 0,
};

const EMPTY_RESPONSE: DeviceStatsResponse = {
  source: DEPLOYMENT_SOURCE,
  days: 30,
  sources: [],
  sides: [],
  summary: EMPTY_TOTALS,
  trend: [],
  generatedAt: "",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE).format(Number(value || 0));
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

function compactDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function buildEmptySide(source: AdminDataSource, days: number): SideDeviceStats {
  const trend: TrendPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - index);
    trend.push({
      date: date.toISOString().slice(0, 10),
      events: 0,
      uniqueUsers: 0,
      uniqueSessions: 0,
    });
  }

  return {
    source,
    totals: EMPTY_TOTALS,
    trend,
    devices: [
      { key: "mobile", label: "Mobile", count: 0, ratio: 0 },
      { key: "desktop", label: "Desktop", count: 0, ratio: 0 },
      { key: "tablet", label: "Tablet", count: 0, ratio: 0 },
      { key: "other", label: "Other", count: 0, ratio: 0 },
    ],
    os: [{ key: "unknown", label: "Unknown", count: 0, ratio: 0 }],
    browsers: [{ key: "unknown", label: "Unknown", count: 0, ratio: 0 }],
    topPaths: [],
    topEvents: [],
  };
}

function sourceStatusLabel(source: SourceInfo, text: UiText): string {
  if (source.ok) return text.statusOk(source.mode);
  return text.statusUnavailable(source.mode);
}

export default function AdminDeviceStatsPage() {
  const text = UI_TEXT[DEPLOYMENT_SOURCE];
  const [days, setDays] = React.useState<number>(30);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [data, setData] = React.useState<DeviceStatsResponse>(EMPTY_RESPONSE);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const query = new URLSearchParams();
        query.set("source", DEPLOYMENT_SOURCE);
        query.set("days", String(days));
        const response = await fetch(`/api/admin/device-stats?${query.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as DeviceStatsResponse;
        if (!cancelled) setData(json || EMPTY_RESPONSE);
      } catch (requestError: any) {
        if (!cancelled) {
          setError(requestError?.message ? String(requestError.message) : text.fallbackError);
          setData(EMPTY_RESPONSE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [days, text.fallbackError]);

  const currentSide =
    data.sides.find((side) => side.source === DEPLOYMENT_SOURCE) ||
    buildEmptySide(DEPLOYMENT_SOURCE, days);

  const sourceInfo =
    data.sources.find((item) => item.source === DEPLOYMENT_SOURCE) || {
      source: DEPLOYMENT_SOURCE,
      ok: false,
      mode: "missing" as SourceMode,
      message: text.missingStatus,
    };

  const sourceWarnings = data.sources.filter((sourceItem) => !sourceItem.ok);

  const topPathRows = [...currentSide.topPaths]
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.key.localeCompare(right.key);
    })
    .slice(0, 20);

  const topEventRows = [...currentSide.topEvents]
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.key.localeCompare(right.key);
    })
    .slice(0, 20);

  const mobileRatio =
    currentSide.totals.totalEvents > 0
      ? currentSide.totals.mobileEvents / currentSide.totals.totalEvents
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{text.title}</h1>
        <p className="text-muted-foreground mt-1">{text.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{text.filterTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {[7, 30, 90].map((value) => (
            <Button
              key={value}
              type="button"
              variant={days === value ? "default" : "outline"}
              size="sm"
              onClick={() => setDays(value)}
            >
              {text.rangeLabel(value)}
            </Button>
          ))}
          <Badge variant="outline" className="ml-auto">{`${text.sourcePrefix}${text.providerLong}`}</Badge>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-base text-red-700 dark:text-red-300">{text.loadFailedTitle}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-700 dark:text-red-300">{error}</CardContent>
        </Card>
      ) : null}

      {sourceWarnings.length ? (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base">{text.sourceWarningTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {sourceWarnings.map((sourceItem) => (
              <div key={sourceItem.source}>
                [{sourceItem.source}] {sourceStatusLabel(sourceItem, text)}
                {sourceItem.message ? `: ${sourceItem.message}` : ""}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{text.totalEvents}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : formatNumber(currentSide.totals.totalEvents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{text.uniqueUsers}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : formatNumber(currentSide.totals.uniqueUsers)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{text.uniqueSessions}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : formatNumber(currentSide.totals.uniqueSessions)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{text.mobileRatio}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : formatPercent(mobileRatio)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {text.mobileBreakdown(
                loading ? "-" : formatNumber(currentSide.totals.mobileEvents),
                loading ? "-" : formatNumber(currentSide.totals.totalEvents)
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{text.chartTitle(days)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentSide.trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(value) => compactDate(String(value || ""))} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(value) => {
                    const date = new Date(String(value));
                    if (Number.isNaN(date.getTime())) return String(value);
                    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="events"
                  name={text.chartSeries}
                  stroke={DEPLOYMENT_SOURCE === "CN" ? "#3b82f6" : "#a855f7"}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg">{text.sourceStatsTitle}</CardTitle>
            <SourceBadge source={DEPLOYMENT_SOURCE}>
              {DEPLOYMENT_SOURCE} · {text.providerShort}
            </SourceBadge>
          </div>
          <div className="text-xs text-muted-foreground">
            {sourceStatusLabel(sourceInfo, text)}
            {sourceInfo.message ? `: ${sourceInfo.message}` : ""}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{text.eventCount}</div>
              <div className="text-xl font-semibold">{formatNumber(currentSide.totals.totalEvents)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{text.dedupUsers}</div>
              <div className="text-xl font-semibold">{formatNumber(currentSide.totals.uniqueUsers)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{text.dedupSessions}</div>
              <div className="text-xl font-semibold">{formatNumber(currentSide.totals.uniqueSessions)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{text.mobileRatio}</div>
              <div className="text-xl font-semibold">{formatPercent(mobileRatio)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{text.deviceDistribution}</div>
            {currentSide.devices.map((item) => (
              <div key={`${DEPLOYMENT_SOURCE}-device-${item.key}`} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{item.label}</span>
                  <span>
                    {formatNumber(item.count)} ({formatPercent(item.ratio)})
                  </span>
                </div>
                <div className="h-2 rounded bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, item.ratio * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-2">{text.topOs}</div>
              <div className="space-y-1 text-sm">
                {currentSide.os.slice(0, 6).map((item) => (
                  <div key={`${DEPLOYMENT_SOURCE}-os-${item.key}`} className="flex justify-between">
                    <span>{item.label}</span>
                    <span>{formatNumber(item.count)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">{text.topBrowser}</div>
              <div className="space-y-1 text-sm">
                {currentSide.browsers.slice(0, 6).map((item) => (
                  <div key={`${DEPLOYMENT_SOURCE}-browser-${item.key}`} className="flex justify-between">
                    <span>{item.label}</span>
                    <span>{formatNumber(item.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{`${text.topPaths} (${text.providerShort})`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.pathHeader}</TableHead>
                  <TableHead className="text-right">{text.countHeader}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPathRows.map((row) => (
                  <TableRow key={`path-${row.key}`}>
                    <TableCell className="font-mono text-xs">{row.key}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.count)}</TableCell>
                  </TableRow>
                ))}

                {!topPathRows.length ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                      {loading ? text.loading : text.empty}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{`${text.topEvents} (${text.providerShort})`}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.eventHeader}</TableHead>
                  <TableHead className="text-right">{text.countHeader}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEventRows.map((row) => (
                  <TableRow key={`event-${row.key}`}>
                    <TableCell className="font-mono text-xs">{row.key}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.count)}</TableCell>
                  </TableRow>
                ))}

                {!topEventRows.length ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-sm text-muted-foreground">
                      {loading ? text.loading : text.empty}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
