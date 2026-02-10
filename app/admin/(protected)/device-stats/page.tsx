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
  source: "ALL" | AdminDataSource;
  days: number;
  sources: SourceInfo[];
  sides: SideDeviceStats[];
  summary: SideTotals;
  trend: Array<{ date: string; cn: number; intl: number; total: number }>;
  generatedAt: string;
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
  source: "ALL",
  days: 30,
  sources: [],
  sides: [],
  summary: EMPTY_TOTALS,
  trend: [],
  generatedAt: "",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Number(value || 0));
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

function mergeTopRows(sides: SideDeviceStats[], field: "topPaths" | "topEvents") {
  return sides.flatMap((side) =>
    side[field].map((item) => ({
      source: side.source,
      key: item.key,
      count: item.count,
    }))
  );
}

function sourceStatusLabel(source: SourceInfo): string {
  if (source.ok) return `OK (${source.mode})`;
  return `Unavailable (${source.mode})`;
}

export default function AdminDeviceStatsPage() {
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
        query.set("source", "ALL");
        query.set("days", String(days));
        const response = await fetch(`/api/admin/device-stats?${query.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as DeviceStatsResponse;
        if (!cancelled) setData(json || EMPTY_RESPONSE);
      } catch (requestError: any) {
        if (!cancelled) {
          setError(requestError?.message ? String(requestError.message) : "加载设备统计失败");
          setData(EMPTY_RESPONSE);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const cnSide = data.sides.find((side) => side.source === "CN") || buildEmptySide("CN", days);
  const intlSide =
    data.sides.find((side) => side.source === "INTL") || buildEmptySide("INTL", days);

  const sourceMap = new Map<AdminDataSource, SourceInfo>(
    data.sources.map((sourceInfo) => [sourceInfo.source, sourceInfo])
  );
  const sourceWarnings = data.sources.filter((sourceInfo) => !sourceInfo.ok);

  const topPathRows = mergeTopRows([cnSide, intlSide], "topPaths")
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.key.localeCompare(right.key);
    })
    .slice(0, 20);

  const topEventRows = mergeTopRows([cnSide, intlSide], "topEvents")
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.key.localeCompare(right.key);
    })
    .slice(0, 20);

  const mobileRatio =
    data.summary.totalEvents > 0 ? data.summary.mobileEvents / data.summary.totalEvents : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">设备统计</h1>
        <p className="text-muted-foreground mt-1">
          可视化展示 CN（CloudBase）和 INTL（Supabase）的设备访问统计
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选条件</CardTitle>
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
              最近 {value} 天
            </Button>
          ))}
          <Badge variant="outline" className="ml-auto">
            固定展示：CN + INTL
          </Badge>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-base text-red-700 dark:text-red-300">加载失败</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-700 dark:text-red-300">{error}</CardContent>
        </Card>
      ) : null}

      {sourceWarnings.length ? (
        <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base">数据源状态告警</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {sourceWarnings.map((sourceInfo) => (
              <div key={sourceInfo.source}>
                [{sourceInfo.source}] {sourceStatusLabel(sourceInfo)}
                {sourceInfo.message ? `：${sourceInfo.message}` : ""}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">总事件数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : formatNumber(data.summary.totalEvents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">去重用户数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : formatNumber(data.summary.uniqueUsers)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">去重会话数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : formatNumber(data.summary.uniqueSessions)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">移动端占比</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : formatPercent(mobileRatio)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Mobile {loading ? "-" : formatNumber(data.summary.mobileEvents)} / Total
              {loading ? "-" : ` ${formatNumber(data.summary.totalEvents)}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>设备事件趋势（最近 {days} 天）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
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
                <Line type="monotone" dataKey="cn" name="CN" stroke="#3b82f6" strokeWidth={2} />
                <Line
                  type="monotone"
                  dataKey="intl"
                  name="INTL"
                  stroke="#a855f7"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[cnSide, intlSide].map((side) => {
          const sourceInfo = sourceMap.get(side.source) || {
            source: side.source,
            ok: false,
            mode: "missing",
            message: "未返回该来源状态",
          };

          return (
            <Card key={side.source}>
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">来源设备统计</CardTitle>
                  <SourceBadge source={side.source} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {sourceStatusLabel(sourceInfo)}
                  {sourceInfo.message ? `：${sourceInfo.message}` : ""}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">事件数</div>
                    <div className="text-xl font-semibold">{formatNumber(side.totals.totalEvents)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">去重用户</div>
                    <div className="text-xl font-semibold">{formatNumber(side.totals.uniqueUsers)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">去重会话</div>
                    <div className="text-xl font-semibold">{formatNumber(side.totals.uniqueSessions)}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">移动端占比</div>
                    <div className="text-xl font-semibold">
                      {formatPercent(
                        side.totals.totalEvents
                          ? side.totals.mobileEvents / side.totals.totalEvents
                          : 0
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">设备分布</div>
                  {side.devices.map((item) => (
                    <div key={`${side.source}-device-${item.key}`} className="space-y-1">
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
                    <div className="text-sm font-medium mb-2">Top OS</div>
                    <div className="space-y-1 text-sm">
                      {side.os.slice(0, 6).map((item) => (
                        <div key={`${side.source}-os-${item.key}`} className="flex justify-between">
                          <span>{item.label}</span>
                          <span>{formatNumber(item.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">Top Browser</div>
                    <div className="space-y-1 text-sm">
                      {side.browsers.slice(0, 6).map((item) => (
                        <div key={`${side.source}-browser-${item.key}`} className="flex justify-between">
                          <span>{item.label}</span>
                          <span>{formatNumber(item.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Paths（CN + INTL）</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>来源</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead className="text-right">事件数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPathRows.map((row) => (
                  <TableRow key={`path-${row.source}-${row.key}`}>
                    <TableCell>
                      <SourceBadge source={row.source} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.key}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.count)}</TableCell>
                  </TableRow>
                ))}

                {!topPathRows.length ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      {loading ? "加载中…" : "暂无数据"}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Events（CN + INTL）</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>来源</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="text-right">次数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEventRows.map((row) => (
                  <TableRow key={`event-${row.source}-${row.key}`}>
                    <TableCell>
                      <SourceBadge source={row.source} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.key}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.count)}</TableCell>
                  </TableRow>
                ))}

                {!topEventRows.length ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      {loading ? "加载中…" : "暂无数据"}
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

