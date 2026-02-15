"use client";

import Link from "next/link";
import * as React from "react";
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
import {
  Activity,
  BarChart3,
  CreditCard,
  MonitorSmartphone,
  ShoppingCart,
  Users,
} from "lucide-react";
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
import { DashboardModuleTile } from "@/components/admin/dashboard-module-tile";
import { SourceBadge, type AdminDataSource } from "@/components/admin/source-badge";
import { isInternationalDeployment } from "@/lib/config/deployment.config";
import {
  getDeploymentAdminProviderName,
  getDeploymentAdminSource,
} from "@/lib/admin/deployment-source";

type DataSource = AdminDataSource;

type StatsData = {
  cn: {
    totalUsers: number;
    todayUsers: number;
    totalOrders: number;
    todayOrders: number;
    totalRevenueCny: number;
    todayRevenueCny: number;
    totalRevenueUsd: number;
    todayRevenueUsd: number;
  };
  intl: {
    totalUsers: number;
    todayUsers: number;
    totalOrders: number;
    todayOrders: number;
    totalRevenueCny: number;
    todayRevenueCny: number;
    totalRevenueUsd: number;
    todayRevenueUsd: number;
  };
  total: {
    totalUsers: number;
    todayUsers: number;
    totalOrders: number;
    todayOrders: number;
  };
  userGrowth: Array<{ date: string; cn: number; intl: number; total: number }>;
  revenueGrowth: Array<{ date: string; cn: number; intl: number }>;
  errors?: Array<{ source: DataSource; message: string }>;
};

type PaymentsResponse = {
  items: Array<{
    id: string;
    userId: string | null;
    amount: number | null;
    currency: string | null;
    status: string | null;
    paymentMethod: string | null;
    transactionId: string | null;
    createdAt: string | null;
    completedAt: string | null;
    source: DataSource;
  }>;
  stats: {
    totalAll: number;
    byStatus: {
      pending: number;
      completed: number;
      failed: number;
      refunded: number;
      other: number;
    };
    revenue30dCny: number;
    revenue30dUsd: number;
  };
  sources: Array<{ source: DataSource; ok: boolean; mode: string; message?: string }>;
};

type AnalyticsResponse = {
  sources: Array<{ source: DataSource; ok: boolean; mode: string; message?: string }>;
  sides: Array<{
    source: DataSource;
    aiUsage: {
      totalRequests: number;
      activeUsers: number;
      topUsers: Array<{ userId: string; requests: number }>;
    };
    onboarding: { overview: { started: number; completed: number; completionRate: number } | null };
    events: {
      funnels: {
        recommendation: {
          requestedSessions: number;
          requestToSuccessRate: number;
          successToViewRate: number;
          viewToClickRate: number;
        } | null;
      };
    };
  }>;
};

const emptyStats: StatsData = {
  cn: {
    totalUsers: 0,
    todayUsers: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalRevenueCny: 0,
    todayRevenueCny: 0,
    totalRevenueUsd: 0,
    todayRevenueUsd: 0,
  },
  intl: {
    totalUsers: 0,
    todayUsers: 0,
    totalOrders: 0,
    todayOrders: 0,
    totalRevenueCny: 0,
    todayRevenueCny: 0,
    totalRevenueUsd: 0,
    todayRevenueUsd: 0,
  },
  total: { totalUsers: 0, todayUsers: 0, totalOrders: 0, todayOrders: 0 },
  userGrowth: [],
  revenueGrowth: [],
  errors: [],
};

const emptyAnalytics: AnalyticsResponse = {
  sources: [],
  sides: [],
};

function formatPct(n: number) {
  return `${(Number(n || 0) * 100).toFixed(1)}%`;
}

function formatMoney(amount: number, currency: "CNY" | "USD") {
  const locale = currency === "CNY" ? "zh-CN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function ensureSevenDays<T extends { date: string }>(
  data: T[],
  factory: (date: string) => T
): T[] {
  const map = new Map<string, T>();
  for (const p of data || []) map.set(p.date, p);
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates.map((date) => map.get(date) || factory(date));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? `: ${body}` : ""}`);
  }
  return (await res.json()) as T;
}

export function AdminDashboard() {
  const isIntlDeployment = isInternationalDeployment();
  const deploymentSource = getDeploymentAdminSource();
  const deploymentProvider = getDeploymentAdminProviderName(deploymentSource);
  const deploymentProviderLabel =
    deploymentSource === "CN"
      ? "腾讯云 CloudBase 文档型数据库"
      : "Supabase 数据库";
  const [days, setDays] = React.useState<number>(7);
  const [refreshKey, setRefreshKey] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<StatsData>(emptyStats);
  const [payments, setPayments] = React.useState<PaymentsResponse | null>(null);
  const [analytics, setAnalytics] = React.useState<AnalyticsResponse>(emptyAnalytics);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotice(null);
    setPayments(null);
    (async () => {
      const problems: string[] = [];
      const results = await Promise.allSettled([
        fetchJson<StatsData>(`/api/admin/stats?source=${deploymentSource}`),
        fetchJson<PaymentsResponse>(`/api/admin/payments?source=${deploymentSource}&status=all&page=1&pageSize=5`),
        fetchJson<AnalyticsResponse>(`/api/admin/analytics?source=${deploymentSource}&days=${days}&permanentDays=7`),
      ]);

      const statsRes = results[0];
      if (statsRes.status === "fulfilled") setStats(statsRes.value || emptyStats);
      else problems.push(`数据统计加载失败：${statsRes.reason?.message || "未知错误"}`);

      const paymentsRes = results[1];
      if (paymentsRes.status === "fulfilled") setPayments(paymentsRes.value);
      else problems.push(`支付分析加载失败：${paymentsRes.reason?.message || "未知错误"}`);

      const analyticsRes = results[2];
      if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value || emptyAnalytics);
      else problems.push(`行为分析加载失败：${analyticsRes.reason?.message || "未知错误"}`);

      if (!cancelled) {
        setNotice(problems.length ? problems.join("；") : null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [days, refreshKey, deploymentSource]);

  const userGrowth = ensureSevenDays(stats.userGrowth || [], (date) => ({
    date,
    cn: 0,
    intl: 0,
    total: 0,
  }));
  const revenueGrowth = ensureSevenDays(stats.revenueGrowth || [], (date) => ({
    date,
    cn: 0,
    intl: 0,
  }));
  const activeUserGrowthKey = deploymentSource === "CN" ? "cn" : "intl";
  const activeRevenueGrowthKey = deploymentSource === "CN" ? "cn" : "intl";

  const cnSide = analytics.sides.find((s) => s.source === "CN");
  const intlSide = analytics.sides.find((s) => s.source === "INTL");
  const activeStats = deploymentSource === "CN" ? stats.cn : stats.intl;
  const activeAiSide = deploymentSource === "CN" ? cnSide : intlSide;
  const activeRevenue30d =
    deploymentSource === "CN"
      ? payments?.stats.revenue30dCny || 0
      : payments?.stats.revenue30dUsd || 0;
  const activeRevenueCurrency: "CNY" | "USD" =
    deploymentSource === "CN" ? "CNY" : "USD";
  const activeAiCalls = activeAiSide?.aiUsage.totalRequests || 0;
  const activeAiUsers = activeAiSide?.aiUsage.activeUsers || 0;
  const activeOnboardingRate =
    activeAiSide?.onboarding.overview?.completionRate || 0;

  const moduleItems = [
    {
      href: "/admin/stats",
      label: "数据统计",
      desc: "用户、订单、收入趋势",
      icon: BarChart3,
      lines: [
        `总用户：${loading ? "-" : activeStats.totalUsers}`,
        `今日新增：+${loading ? "-" : activeStats.todayUsers}`,
      ],
    },
    {
      href: "/admin/orders",
      label: "交易订单",
      desc: "订单列表与状态汇总",
      icon: ShoppingCart,
      lines: [
        `总订单：${loading ? "-" : activeStats.totalOrders}`,
        `今日新增：+${loading ? "-" : activeStats.todayOrders}`,
      ],
    },
    {
      href: "/admin/users",
      label: "用户管理",
      desc: "用户列表与搜索",
      icon: Users,
      lines: [
        `${deploymentSource} 用户：${loading ? "-" : activeStats.totalUsers}`,
        `今日新增：+${loading ? "-" : activeStats.todayUsers}`,
      ],
    },
    {
      href: "/admin/payments",
      label: "支付分析",
      desc: "支付记录、收入与渠道",
      icon: CreditCard,
      lines: [
        `${deploymentSource} 30天收入：${
          loading ? "-" : formatMoney(activeRevenue30d, activeRevenueCurrency)
        }`,
        `${deploymentProvider} 已完成：${
          loading ? "-" : payments?.stats.byStatus.completed || 0
        }`,
      ],
    },
    {
      href: "/admin/analytics",
      label: "行为分析",
      desc: "Onboarding、AI预算与漏斗",
      icon: Activity,
      lines: [
        `AI调用：${loading ? "-" : activeAiCalls}（活跃用户 ${
          loading ? "-" : activeAiUsers
        }）`,
        `Onboarding 完成率：${
          loading ? "-" : formatPct(activeOnboardingRate)
        }`,
      ],
    },
    {
      href: "/admin/device-stats",
      label: "设备统计",
      desc: "设备、操作系统与浏览器趋势",
      icon: MonitorSmartphone,
      lines: [`查看 ${deploymentSource} 设备可视化`, `支持最近 ${days} 天趋势与 Top 分布`],
    },
  ] as const;

  const topUsers = ([deploymentSource] as const)
    .flatMap((src) => {
      const side = analytics.sides.find((s) => s.source === src);
      return (side?.aiUsage.topUsers || []).map((u) => ({ ...u, source: src }));
    })
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">{`当前数据源：${deploymentSource} · ${deploymentProviderLabel}`}</p>
          </div>
          <div className="flex gap-2">
            <SourceBadge source={deploymentSource}>
              {deploymentSource} · {deploymentProvider}
            </SourceBadge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>视图</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">AI 时间窗（天）</div>
            <div className="flex gap-2">
              <Button
                variant={days === 7 ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(7)}
              >
                7
              </Button>
              <Button
                variant={days === 30 ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(30)}
              >
                30
              </Button>
              <Button
                variant={days === 90 ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(90)}
              >
                90
              </Button>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              {loading ? "加载中…" : notice ? notice : "已更新"}
            </div>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((v) => v + 1)}>
              刷新
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>数据源状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {analytics.sources.map((s) => (
            <div key={s.source} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SourceBadge source={s.source} />
                <span className="text-muted-foreground">{s.mode}</span>
              </div>
              <div className={s.ok ? "text-green-600" : "text-red-600"}>
                {s.ok ? "OK" : s.message || "失败"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : activeStats.totalUsers}</div>
            <div className="flex gap-2 mt-2">
              <SourceBadge source={deploymentSource} className="text-xs">
                {deploymentSource} {loading ? "-" : activeStats.totalUsers}
              </SourceBadge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日新增</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : activeStats.todayUsers}</div>
            <div className="flex gap-2 mt-2">
              <SourceBadge source={deploymentSource} className="text-xs">
                {deploymentSource} +{loading ? "-" : activeStats.todayUsers}
              </SourceBadge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">总订单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : activeStats.totalOrders}</div>
            <div className="flex gap-2 mt-2">
              <SourceBadge source={deploymentSource} className="text-xs">
                {deploymentSource} {loading ? "-" : activeStats.totalOrders}
              </SourceBadge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">今日订单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : activeStats.todayOrders}</div>
            <div className="flex gap-2 mt-2">
              <SourceBadge source={deploymentSource} className="text-xs">
                {deploymentSource} +{loading ? "-" : activeStats.todayOrders}
              </SourceBadge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">30天收入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-lg font-semibold">
              {loading
                ? "-"
                : formatMoney(activeRevenue30d, activeRevenueCurrency)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI调用（{days}天）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "-" : activeAiCalls}</div>
            <div className="flex gap-2 mt-2">
              <SourceBadge source={deploymentSource} className="text-xs">
                {deploymentSource} {loading ? "-" : activeAiSide?.aiUsage.totalRequests || 0}
              </SourceBadge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>快捷入口</CardTitle>
            <Badge variant="outline" className="text-xs text-muted-foreground">
              主要模块
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {moduleItems.map((m) => (
                <DashboardModuleTile
                  key={m.href}
                  href={m.href}
                  label={m.label}
                  description={m.desc}
                  icon={m.icon}
                  lines={[...m.lines]}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>AI预算/用量</CardTitle>
            <Link href="/admin/analytics" className="text-sm text-primary hover:underline">
              查看更多
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {[deploymentSource].map((src) => {
                const side = analytics.sides.find((s) => s.source === src);
                const u = side?.aiUsage;
                const f = side?.events.funnels.recommendation;
                return (
                  <div key={src} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">AI预算/用量</div>
                      <SourceBadge source={src} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <div className="text-xs text-muted-foreground">调用次数（{days}天）</div>
                        <div className="text-xl font-bold">{loading ? "-" : u?.totalRequests || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">活跃用户</div>
                        <div className="text-xl font-bold">{loading ? "-" : u?.activeUsers || 0}</div>
                      </div>
                    </div>
                    <div className="pt-2 mt-2 border-t text-sm space-y-1">
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
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border">
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="text-sm font-medium">Top Users</div>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  调用次数
                </Badge>
              </div>
              <div className="p-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>来源</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead className="text-right">次数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topUsers.map((u) => (
                      <TableRow key={`${u.source}-${u.userId}`}>
                        <TableCell>
                          <SourceBadge source={u.source} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{u.userId}</TableCell>
                        <TableCell className="text-right">{u.requests}</TableCell>
                      </TableRow>
                    ))}
                    {!topUsers.length ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                          {loading ? "加载中…" : "暂无数据"}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>近 7 天用户增长</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey={activeUserGrowthKey}
                  name={deploymentSource}
                  stroke={deploymentSource === "CN" ? "#2563eb" : "#7c3aed"}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>近 7 天收入</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey={activeRevenueGrowthKey}
                  name={deploymentSource === "CN" ? "CNY" : "USD"}
                  fill={deploymentSource === "CN" ? "#60a5fa" : "#c4b5fd"}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>最近 5 笔支付</CardTitle>
            <Link href="/admin/payments" className="text-sm text-primary hover:underline">
              打开支付分析
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>来源</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments?.items || []).slice(0, 5).map((p) => (
                  <TableRow key={`${p.source}-${p.id}`}>
                    <TableCell>
                      <SourceBadge source={p.source} />
                    </TableCell>
                    <TableCell>{p.amount ?? "-"}</TableCell>
                    <TableCell>{p.currency ?? "-"}</TableCell>
                    <TableCell>{p.status ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {(p.createdAt || "").slice(0, 19).replace("T", " ")}
                    </TableCell>
                  </TableRow>
                ))}
                {!payments?.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      {loading ? "加载中…" : "暂无数据"}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card
          className={
            isIntlDeployment
              ? "border-slate-200/80 bg-slate-50/80 dark:border-slate-700/80 dark:bg-slate-800/40"
              : undefined
          }
        >
          <CardHeader>
            <CardTitle>{`支付状态汇总（${deploymentSource}）`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isIntlDeployment ? (
                  <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                ) : null}
                <div>Pending</div>
              </div>
              <div>{loading ? "-" : payments?.stats.byStatus.pending || 0}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isIntlDeployment ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                ) : null}
                <div>Completed</div>
              </div>
              <div>{loading ? "-" : payments?.stats.byStatus.completed || 0}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isIntlDeployment ? <span className="h-2 w-2 rounded-full bg-rose-500/80" /> : null}
                <div>Failed</div>
              </div>
              <div>{loading ? "-" : payments?.stats.byStatus.failed || 0}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isIntlDeployment ? <span className="h-2 w-2 rounded-full bg-sky-500/80" /> : null}
                <div>Refunded</div>
              </div>
              <div>{loading ? "-" : payments?.stats.byStatus.refunded || 0}</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isIntlDeployment ? (
                  <span className="h-2 w-2 rounded-full bg-slate-400/80" />
                ) : null}
                <div>Other</div>
              </div>
              <div>{loading ? "-" : payments?.stats.byStatus.other || 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
