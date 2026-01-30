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

type AdminDataSource = "CN" | "INTL";
type AnalyticsSource = "ALL" | AdminDataSource;

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
  source: "ALL",
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

function mergeByDate(cn: SideAnalytics | undefined, intl: SideAnalytics | undefined) {
  const map = new Map<string, any>();
  for (const d of cn?.events.days || []) {
    map.set(d.date, { date: d.date, cnActive: d.activeSessions, cnPV: d.pageViews });
  }
  for (const d of intl?.events.days || []) {
    const prev = map.get(d.date) || { date: d.date, cnActive: 0, cnPV: 0 };
    map.set(d.date, { ...prev, intlActive: d.activeSessions, intlPV: d.pageViews });
  }
  const out = Array.from(map.values());
  out.sort((a, b) => (a.date > b.date ? 1 : -1));
  for (const r of out) {
    r.cnActive = Number(r.cnActive) || 0;
    r.intlActive = Number(r.intlActive) || 0;
    r.cnPV = Number(r.cnPV) || 0;
    r.intlPV = Number(r.intlPV) || 0;
    r.totalActive = r.cnActive + r.intlActive;
    r.totalPV = r.cnPV + r.intlPV;
  }
  return out;
}

export default function AdminAnalyticsPage() {
  const [source, setSource] = React.useState<AnalyticsSource>("ALL");
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

  const cn = data.sides.find((s) => s.source === "CN");
  const intl = data.sides.find((s) => s.source === "INTL");
  const trend = mergeByDate(cn, intl);
  const exitSteps = [...(cn?.onboarding.exitSteps || []).map((s) => ({ ...s, source: "CN" as const })), ...(intl?.onboarding.exitSteps || []).map((s) => ({ ...s, source: "INTL" as const }))].sort(
    (a, b) => b.count - a.count
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">用户行为分析</h1>
            <p className="text-muted-foreground mt-1">CN（CloudBase）+ INTL（Supabase）用户行为与 AI 预算</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className={badgeClasses("CN")}>CN</Badge>
            <Badge variant="outline" className={badgeClasses("INTL")}>INTL</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>筛选</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">数据源</div>
            <div className="flex gap-2">
              <Button variant={source === "ALL" ? "default" : "outline"} size="sm" onClick={() => setSource("ALL")}>ALL</Button>
              <Button variant={source === "CN" ? "default" : "outline"} size="sm" onClick={() => setSource("CN")}>CN</Button>
              <Button variant={source === "INTL" ? "default" : "outline"} size="sm" onClick={() => setSource("INTL")}>INTL</Button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">时间窗（天）</div>
            <div className="flex gap-2">
              <Button variant={days === 7 ? "default" : "outline"} size="sm" onClick={() => setDays(7)}>7</Button>
              <Button variant={days === 30 ? "default" : "outline"} size="sm" onClick={() => setDays(30)}>30</Button>
              <Button variant={days === 90 ? "default" : "outline"} size="sm" onClick={() => setDays(90)}>90</Button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">永久退出阈值（天）</div>
            <input
              value={String(permanentDays)}
              onChange={(e) => setPermanentDays(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
              className="h-9 w-28 rounded-md border bg-background px-3 text-sm"
              inputMode="numeric"
            />
          </div>

          <div className="text-sm text-muted-foreground ml-auto">
            {loading ? "加载中…" : error ? `加载失败：${error}` : "已更新"}
          </div>
        </CardContent>
      </Card>

      {data.sources.some((s) => !s.ok) ? (
        <Card>
          <CardHeader>
            <CardTitle>数据源状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.sources.map((s) => (
              <div key={s.source} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={badgeClasses(s.source)}>{s.source}</Badge>
                  <span className="text-muted-foreground">{s.mode}</span>
                </div>
                <div className={s.ok ? "text-green-600" : "text-red-600"}>
                  {s.ok ? "OK" : s.message || "失败"}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="traffic">
        <TabsList>
          <TabsTrigger value="traffic">访问</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="ai">AI预算</TabsTrigger>
        </TabsList>

        <TabsContent value="traffic" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>活跃会话（按天）</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cnActive" name="CN" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="intlActive" name="INTL" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="totalActive" name="Total" stroke="#111827" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>页面浏览（按天）</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="cnPV" name="CN" fill="#60a5fa" />
                    <Bar dataKey="intlPV" name="INTL" fill="#c4b5fd" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>来源</TableHead>
                      <TableHead>路径</TableHead>
                      <TableHead className="text-right">PV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["CN", "INTL"] as const).flatMap((src) => {
                      const side = data.sides.find((s) => s.source === src);
                      return (side?.events.topPages || []).slice(0, 10).map((p) => (
                        <TableRow key={`${src}-${p.path}`}>
                          <TableCell>
                            <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.path}</TableCell>
                          <TableCell className="text-right">{p.pageViews}</TableCell>
                        </TableRow>
                      ));
                    })}
                    {!data.sides.length ? (
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
                <CardTitle>永久退出（最近一步）</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>来源</TableHead>
                      <TableHead>最近一步</TableHead>
                      <TableHead className="text-right">会话数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["CN", "INTL"] as const).flatMap((src) => {
                      const side = data.sides.find((s) => s.source === src);
                      return (side?.events.permanentDropoff || []).slice(0, 10).map((p) => (
                        <TableRow key={`${src}-${p.lastStep}`}>
                          <TableCell>
                            <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.lastStep}</TableCell>
                          <TableCell className="text-right">{p.sessions}</TableCell>
                        </TableRow>
                      ));
                    })}
                    {!data.sides.length ? (
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
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["CN", "INTL"] as const).map((src) => {
              const side = data.sides.find((s) => s.source === src);
              const o = side?.onboarding.overview;
              return (
                <Card key={src}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">完成率</CardTitle>
                    <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {loading ? "-" : o ? formatPct(o.completionRate) : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      完成 {o?.completed || 0}/{o?.started || 0}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>退出步骤分布</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>来源</TableHead>
                    <TableHead>步骤</TableHead>
                    <TableHead className="text-right">退出人数</TableHead>
                    <TableHead className="text-right">永久退出</TableHead>
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
                        {loading ? "加载中…" : "暂无数据"}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(["CN", "INTL"] as const).map((src) => {
              const side = data.sides.find((s) => s.source === src);
              const f = side?.events.funnels.onboarding;
              return (
                <Card key={src}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">漏斗（基于会话）</CardTitle>
                    <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <div>看过步骤</div>
                      <div>{loading ? "-" : f?.stepViewedSessions || 0}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>完成</div>
                      <div>{loading ? "-" : f?.completedSessions || 0}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>完成率</div>
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
            {(["CN", "INTL"] as const).map((src) => {
              const side = data.sides.find((s) => s.source === src);
              const u = side?.aiUsage;
              const f = side?.events.funnels.recommendation;
              return (
                <Card key={src}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">AI预算/用量</CardTitle>
                    <Badge variant="outline" className={badgeClasses(src)}>{src}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">调用次数（{days}天）</div>
                        <div className="text-2xl font-bold">{loading ? "-" : u?.totalRequests || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">活跃用户</div>
                        <div className="text-2xl font-bold">{loading ? "-" : u?.activeUsers || 0}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <div>请求会话</div>
                        <div>{loading ? "-" : f?.requestedSessions || 0}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>成功率</div>
                        <div>{loading ? "-" : f ? formatPct(f.requestToSuccessRate) : "-"}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>查看率</div>
                        <div>{loading ? "-" : f ? formatPct(f.successToViewRate) : "-"}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>点击率</div>
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
              <CardTitle>Top Users（按调用次数）</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>来源</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead className="text-right">调用次数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(["CN", "INTL"] as const).flatMap((src) => {
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
                        {loading ? "加载中…" : "暂无数据"}
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
