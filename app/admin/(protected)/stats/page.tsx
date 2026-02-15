"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Database, DollarSign, ShoppingCart, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDeploymentAdminProviderName,
  getDeploymentAdminSource,
} from "@/lib/admin/deployment-source";

type DataSource = "CN" | "INTL";
type GrowthPoint = { date: string; cn: number; intl: number; total: number };
type RevenuePoint = { date: string; cn: number; intl: number };

type SideTotals = {
  totalUsers: number;
  todayUsers: number;
  totalOrders: number;
  todayOrders: number;
  totalRevenueCny: number;
  todayRevenueCny: number;
  totalRevenueUsd: number;
  todayRevenueUsd: number;
};

type StatsData = {
  cn: SideTotals;
  intl: SideTotals;
  total: {
    totalUsers: number;
    todayUsers: number;
    totalOrders: number;
    todayOrders: number;
  };
  userGrowth: GrowthPoint[];
  revenueGrowth: RevenuePoint[];
  errors?: Array<{ source: DataSource; message: string }>;
};

const DEPLOYMENT_SOURCE = getDeploymentAdminSource();
const DEPLOYMENT_PROVIDER = getDeploymentAdminProviderName(DEPLOYMENT_SOURCE);

const DEPLOYMENT_PROVIDER_LABEL =
  DEPLOYMENT_SOURCE === "CN"
    ? "腾讯云 CloudBase 文档型数据库"
    : "Supabase 数据库";

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

function formatCurrency(amount: number, currency: "CNY" | "USD") {
  const locale = currency === "CNY" ? "zh-CN" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function last7DaysIso() {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function ensureSevenDaysGrowth(data: GrowthPoint[]) {
  const map = new Map<string, GrowthPoint>();
  for (const p of data || []) map.set(p.date, p);
  return last7DaysIso().map(
    (date) => map.get(date) || { date, cn: 0, intl: 0, total: 0 }
  );
}

function ensureSevenDaysRevenue(data: RevenuePoint[]) {
  const map = new Map<string, RevenuePoint>();
  for (const p of data || []) map.set(p.date, p);
  return last7DaysIso().map((date) => map.get(date) || { date, cn: 0, intl: 0 });
}

function formatShortDate(dateValue: string) {
  const date = new Date(dateValue);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatFullDate(dateValue: string) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export default function AdminStatsPage() {
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<StatsData>(emptyStats);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/stats?source=${DEPLOYMENT_SOURCE}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StatsData;
        if (!cancelled) setStats(json || emptyStats);
      } catch (error: any) {
        if (!cancelled) {
          setStats({
            ...emptyStats,
            errors: [
              {
                source: DEPLOYMENT_SOURCE,
                message: error?.message ? String(error.message) : "加载统计失败",
              },
            ],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isCn = DEPLOYMENT_SOURCE === "CN";
  const activeStats = isCn ? stats.cn : stats.intl;
  const activeCurrency: "CNY" | "USD" = isCn ? "CNY" : "USD";
  const activeRevenueTotal = isCn
    ? activeStats.totalRevenueCny
    : activeStats.totalRevenueUsd;
  const activeRevenueToday = isCn
    ? activeStats.todayRevenueCny
    : activeStats.todayRevenueUsd;
  const activeUserGrowthKey = isCn ? "cn" : "intl";
  const activeRevenueGrowthKey = isCn ? "cn" : "intl";
  const activeErrors = (stats.errors || []).filter(
    (error) => error.source === DEPLOYMENT_SOURCE
  );

  const userGrowth = ensureSevenDaysGrowth(stats.userGrowth);
  const revenueGrowth = ensureSevenDaysRevenue(stats.revenueGrowth);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">数据统计</h1>
        <p className="mt-1 text-muted-foreground">
          {`当前环境：${DEPLOYMENT_SOURCE} · ${DEPLOYMENT_PROVIDER_LABEL}`}
        </p>
        <p className="text-sm text-muted-foreground">
          仅展示当前部署环境的数据，不混合另一环境数据。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总用户数
            </CardTitle>
            <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-900/20">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : activeStats.totalUsers}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              今日新增 {loading ? "-" : activeStats.todayUsers}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总订单数
            </CardTitle>
            <div className="rounded-lg bg-green-50 p-2 dark:bg-green-900/20">
              <ShoppingCart className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : activeStats.totalOrders}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              今日新增 {loading ? "-" : activeStats.todayOrders}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总收入
            </CardTitle>
            <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-900/20">
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : formatCurrency(activeRevenueTotal, activeCurrency)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              今日收入{" "}
              {loading ? "-" : formatCurrency(activeRevenueToday, activeCurrency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              数据来源
            </CardTitle>
            <div className="rounded-lg bg-orange-50 p-2 dark:bg-orange-900/20">
              <Database className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {DEPLOYMENT_SOURCE} · {DEPLOYMENT_PROVIDER}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {DEPLOYMENT_PROVIDER_LABEL}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{`最近 7 天用户增长（${DEPLOYMENT_SOURCE}）`}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(value) => formatFullDate(String(value))}
                  formatter={(value) => [Number(value || 0), `${DEPLOYMENT_SOURCE} 用户`]}
                />
                <Line
                  type="monotone"
                  dataKey={activeUserGrowthKey}
                  stroke={isCn ? "#ef4444" : "#3b82f6"}
                  strokeWidth={2}
                  dot={false}
                  name={`${DEPLOYMENT_SOURCE} 用户`}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{`最近 7 天收入趋势（${DEPLOYMENT_SOURCE} · ${activeCurrency}）`}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} />
                <YAxis
                  tickFormatter={(value) =>
                    activeCurrency === "CNY"
                      ? `¥${Number(value || 0).toFixed(0)}`
                      : `$${Number(value || 0).toFixed(0)}`
                  }
                />
                <Tooltip
                  labelFormatter={(value) => formatFullDate(String(value))}
                  formatter={(value) => [
                    formatCurrency(Number(value || 0), activeCurrency),
                    `${DEPLOYMENT_SOURCE} 收入`,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey={activeRevenueGrowthKey}
                  stroke={isCn ? "#ef4444" : "#3b82f6"}
                  strokeWidth={2}
                  dot={false}
                  name={`${DEPLOYMENT_SOURCE} 收入`}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {!loading && activeErrors.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{`数据源异常（${DEPLOYMENT_SOURCE}）`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {activeErrors.map((error, idx) => (
              <div key={`${error.source}-${idx}`}>
                [{error.source}] {error.message}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
