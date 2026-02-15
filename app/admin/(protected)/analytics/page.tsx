"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDeploymentAdminSource } from "@/lib/admin/deployment-source";

type AdminDataSource = "CN" | "INTL";
type AnalyticsSource = AdminDataSource;

const DEPLOYMENT_SOURCE: AnalyticsSource = getDeploymentAdminSource();
const DEPLOYMENT_PROVIDER_LABEL =
  DEPLOYMENT_SOURCE === "CN"
    ? "腾讯云 CloudBase 文档型数据库"
    : "Supabase";

type SourceInfo = {
  source: AdminDataSource;
  ok: boolean;
  mode: "direct" | "proxy" | "missing";
  message?: string;
};

type SideAnalytics = {
  source: AdminDataSource;
  onboarding: {
    overview: { started: number; completed: number; completionRate: number };
    exitSteps: Array<{ step: string; count: number; permanentCount: number }>;
  };
  events: {
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
  aiUsage: {
    totalRequests: number;
    activeUsers: number;
    topUsers: Array<{ userId: string; requests: number }>;
  };
};

type AnalyticsResponse = {
  source: AnalyticsSource;
  days: number;
  permanentDays: number;
  sources: SourceInfo[];
  sides: SideAnalytics[];
};

const emptyData: AnalyticsResponse = {
  source: DEPLOYMENT_SOURCE,
  days: 7,
  permanentDays: 7,
  sources: [],
  sides: [],
};

function formatPct(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return `${(v * 100).toFixed(1)}%`;
}

function badgeClasses(source: AdminDataSource): string {
  return source === "CN"
    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900/40"
    : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-900/40";
}

function sourceModeLabel(mode: SourceInfo["mode"], source: AdminDataSource): string {
  if (source === "CN") {
    if (mode === "direct") return "直连";
    if (mode === "proxy") return "代理";
    return "未配置";
  }
  if (mode === "direct") return "Direct";
  if (mode === "proxy") return "Proxy";
  return "Missing";
}

export default function AdminAnalyticsPage() {
  const source = DEPLOYMENT_SOURCE;
  const isCn = source === "CN";
  const sourceDisplayLabel = isCn
    ? "CN · 腾讯云 CloudBase 文档型数据库"
    : "INTL · Supabase";
  const [days, setDays] = React.useState<number>(7);
  const [permanentDays, setPermanentDays] = React.useState<number>(7);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [data, setData] = React.useState<AnalyticsResponse>(emptyData);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const q = new URLSearchParams();
        q.set("source", source);
        q.set("days", String(days));
        q.set("permanentDays", String(permanentDays));
        const res = await fetch(`/api/admin/analytics?${q.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AnalyticsResponse;
        if (!cancelled) setData(json || emptyData);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ? String(e.message) : "加载失败");
          setData(emptyData);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, days, permanentDays]);

  const side = data.sides.find((item) => item.source === source);
  const trend = side?.events.days || [];
  const exitSteps = (side?.onboarding.exitSteps || [])
    .map((item) => ({ ...item, source }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{isCn ? "用户行为分析" : "User Analytics"}</h1>
            <p className="text-muted-foreground mt-1">
              {isCn
                ? `当前为 CN 环境，仅展示${DEPLOYMENT_PROVIDER_LABEL}中的行为数据。`
                : `Current environment: INTL. Showing analytics from ${DEPLOYMENT_PROVIDER_LABEL} only.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className={badgeClasses(source)}>
              {sourceDisplayLabel}
            </Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isCn ? "筛选" : "Filters"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">{isCn ? "数据源" : "Source"}</div>
            <div className="h-9 min-w-28 rounded-md border bg-background px-3 text-sm inline-flex items-center">
              {sourceDisplayLabel}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">
              {isCn ? "时间窗（天）" : "Window (days)"}
            </div>
            <div className="flex gap-2">
              <Button variant={days === 7 ? "default" : "outline"} size="sm" onClick={() => setDays(7)}>7</Button>
              <Button variant={days === 30 ? "default" : "outline"} size="sm" onClick={() => setDays(30)}>30</Button>
              <Button variant={days === 90 ? "default" : "outline"} size="sm" onClick={() => setDays(90)}>90</Button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">
              {isCn ? "永久退出阈值（天）" : "Permanent drop-off threshold (days)"}
            </div>
            <input
              value={String(permanentDays)}
              onChange={(e) => setPermanentDays(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
              className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
              inputMode="numeric"
            />
          </div>

          <div className="text-sm text-muted-foreground ml-auto">
            {loading
              ? isCn
                ? "加载中…"
                : "Loading..."
              : error
                ? isCn
                  ? `加载失败：${error}`
                  : `Failed to load: ${error}`
                : isCn
                  ? "已更新"
                  : "Updated"}
          </div>
        </CardContent>
      </Card>

      {data.sources.some((s) => !s.ok) ? (
        <Card>
          <CardHeader>
            <CardTitle>{isCn ? "CloudBase 数据源状态" : "Supabase Data Source Status"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.sources.map((s) => (
              <div key={s.source} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={badgeClasses(s.source)}>{s.source}</Badge>
                  <span className="text-muted-foreground">{sourceModeLabel(s.mode, source)}</span>
                </div>
                <div className={s.ok ? "text-green-600" : "text-red-600"}>
                  {s.ok ? "OK" : s.message || (isCn ? "失败" : "Failed")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="traffic">
        <TabsList>
          <TabsTrigger value="traffic">{isCn ? "访问" : "Traffic"}</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="ai">{isCn ? "AI用量" : "AI Usage"}</TabsTrigger>
        </TabsList>

        <TabsContent value="traffic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{isCn ? "活跃会话（按天）" : "Active Sessions (Daily)"}</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="activeSessions"
                      name={isCn ? "活跃会话" : "Active Sessions"}
                      stroke={source === "CN" ? "#2563eb" : "#7c3aed"}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isCn ? "页面浏览（按天）" : "Page Views (Daily)"}</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="pageViews"
                      name={isCn ? "页面浏览" : "Page Views"}
                      fill={source === "CN" ? "#60a5fa" : "#c4b5fd"}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{isCn ? "热门页面" : "Top Pages"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isCn ? "来源" : "Source"}</TableHead>
                      <TableHead>{isCn ? "路径" : "Path"}</TableHead>
                      <TableHead className="text-right">PV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(side?.events.topPages || []).slice(0, 10).map((p) => (
                      <TableRow key={`${source}-${p.path}`}>
                        <TableCell>
                          <Badge variant="outline" className={badgeClasses(source)}>{source}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.path}</TableCell>
                        <TableCell className="text-right">{p.pageViews}</TableCell>
                      </TableRow>
                    ))}
                    {!data.sides.length ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          {loading ? (isCn ? "加载中…" : "Loading...") : isCn ? "暂无数据" : "No data"}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{isCn ? "永久退出（最近一步）" : "Permanent Drop-off (Last Step)"}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isCn ? "来源" : "Source"}</TableHead>
                      <TableHead>{isCn ? "最近一步" : "Last Step"}</TableHead>
                      <TableHead className="text-right">{isCn ? "会话数" : "Sessions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(side?.events.permanentDropoff || []).slice(0, 10).map((p) => (
                      <TableRow key={`${source}-${p.lastStep}`}>
                        <TableCell>
                          <Badge variant="outline" className={badgeClasses(source)}>{source}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.lastStep}</TableCell>
                        <TableCell className="text-right">{p.sessions}</TableCell>
                      </TableRow>
                    ))}
                    {!data.sides.length ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          {loading ? (isCn ? "加载中…" : "Loading...") : isCn ? "暂无数据" : "No data"}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[source].map((src) => {
              const side = data.sides.find((s) => s.source === src);
              const o = side?.onboarding.overview;
              return (
                <Card key={src}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">{isCn ? "完成率" : "Completion Rate"}</CardTitle>
                    <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {loading ? "-" : o ? formatPct(o.completionRate) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {isCn
                        ? `完成 ${o?.completed || 0}/${o?.started || 0}`
                        : `Completed ${o?.completed || 0}/${o?.started || 0}`}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isCn ? "退出步骤分布" : "Exit Step Distribution"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isCn ? "来源" : "Source"}</TableHead>
                    <TableHead>{isCn ? "步骤" : "Step"}</TableHead>
                    <TableHead className="text-right">{isCn ? "退出人数" : "Drop-offs"}</TableHead>
                    <TableHead className="text-right">{isCn ? "永久退出" : "Permanent"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exitSteps.slice(0, 50).map((s) => (
                    <TableRow key={`${s.source}-${s.step}`}>
                      <TableCell>
                        <Badge variant="outline" className={badgeClasses(s.source)}>{s.source}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.step}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className={`text-right ${s.permanentCount ? "text-red-600" : ""}`}>
                        {s.permanentCount}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!exitSteps.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                        {loading ? (isCn ? "加载中…" : "Loading...") : isCn ? "暂无数据" : "No data"}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[source].map((src) => {
              const side = data.sides.find((s) => s.source === src);
              const f = side?.events.funnels.onboarding;
              return (
                <Card key={src}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">
                      {isCn ? "漏斗（基于会话）" : "Funnel (Session-based)"}
                    </CardTitle>
                    <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <div>{isCn ? "看过步骤" : "Step Viewed"}</div>
                      <div>{loading ? "-" : f?.stepViewedSessions || 0}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>{isCn ? "完成" : "Completed"}</div>
                      <div>{loading ? "-" : f?.completedSessions || 0}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>{isCn ? "完成率" : "Completion Rate"}</div>
                      <div>{loading ? "-" : f ? formatPct(f.completionRate) : "-"}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[source].map((src) => {
              const side = data.sides.find((s) => s.source === src);
              const u = side?.aiUsage;
              const f = side?.events.funnels.recommendation;
              return (
                <Card key={src}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">{isCn ? "AI预算/用量" : "AI Usage"}</CardTitle>
                    <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {isCn ? `调用次数（${days}天）` : `Requests (${days} days)`}
                        </div>
                        <div className="text-2xl font-bold">{loading ? "-" : u?.totalRequests || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{isCn ? "活跃用户" : "Active Users"}</div>
                        <div className="text-2xl font-bold">{loading ? "-" : u?.activeUsers || 0}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <div>{isCn ? "请求会话" : "Request Sessions"}</div>
                        <div>{loading ? "-" : f?.requestedSessions || 0}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>{isCn ? "成功率" : "Success Rate"}</div>
                        <div>{loading ? "-" : f ? formatPct(f.requestToSuccessRate) : "-"}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>{isCn ? "查看率" : "View Rate"}</div>
                        <div>{loading ? "-" : f ? formatPct(f.successToViewRate) : "-"}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>{isCn ? "点击率" : "Click Rate"}</div>
                        <div>{loading ? "-" : f ? formatPct(f.viewToClickRate) : "-"}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{isCn ? "Top Users（按调用次数）" : "Top Users (By Requests)"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isCn ? "来源" : "Source"}</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead className="text-right">{isCn ? "调用次数" : "Requests"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[source].flatMap((src) => {
                    const side = data.sides.find((s) => s.source === src);
                    return (side?.aiUsage.topUsers || []).slice(0, 10).map((u) => (
                      <TableRow key={`${src}-${u.userId}`}>
                        <TableCell>
                          <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{u.userId}</TableCell>
                        <TableCell className="text-right">{u.requests}</TableCell>
                      </TableRow>
                    ));
                  })}
                  {!data.sides.length ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                        {loading ? (isCn ? "加载中…" : "Loading...") : isCn ? "暂无数据" : "No data"}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
