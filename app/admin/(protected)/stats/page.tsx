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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

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
  errors?: Array<{ source: "CN" | "INTL"; message: string }>;
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

export default function AdminStatsPage() {
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<StatsData>(emptyStats);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as StatsData;
        if (!cancelled) setStats(json || emptyStats);
      } catch (e: any) {
        if (!cancelled) {
          setStats({
            ...emptyStats,
            errors: [
              {
                source: "CN",
                message: e?.message ? String(e.message) : "加载统计失败",
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

  const formatCurrency = (amount: number, currency: "CNY" | "USD") => {
    const locale = currency === "CNY" ? "zh-CN" : "en-US";
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const ensureSevenDaysGrowth = (data: GrowthPoint[]): GrowthPoint[] => {
    const map = new Map<string, GrowthPoint>();
    for (const p of data || []) map.set(p.date, p);
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates.map((date) => map.get(date) || { date, cn: 0, intl: 0, total: 0 });
  };

  const ensureSevenDaysRevenue = (data: RevenuePoint[]): RevenuePoint[] => {
    const map = new Map<string, RevenuePoint>();
    for (const p of data || []) map.set(p.date, p);
    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates.map((date) => map.get(date) || { date, cn: 0, intl: 0 });
  };

  const userGrowth = ensureSevenDaysGrowth(stats.userGrowth);
  const revenueGrowth = ensureSevenDaysRevenue(stats.revenueGrowth);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">数据统计</h1>
        <p className="text-muted-foreground mt-1">查看平台运营数据（CN + INTL）</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总用户数
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : stats.total.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              +{loading ? "-" : stats.total.todayUsers} 今日
            </p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                CN: {loading ? "-" : stats.cn.totalUsers}
              </Badge>
              <Badge variant="outline" className="text-xs">
                INTL: {loading ? "-" : stats.intl.totalUsers}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总订单数
            </CardTitle>
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <ShoppingCart className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : stats.total.totalOrders}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              +{loading ? "-" : stats.total.todayOrders} 今日
            </p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                CN: {loading ? "-" : stats.cn.totalOrders}
              </Badge>
              <Badge variant="outline" className="text-xs">
                INTL: {loading ? "-" : stats.intl.totalOrders}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总收入
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex flex-col">
              <span>
                {loading ? "-" : formatCurrency(stats.cn.totalRevenueCny, "CNY")}
              </span>
              <span>
                {loading
                  ? "-"
                  : formatCurrency(stats.intl.totalRevenueUsd, "USD")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              +{loading ? "-" : formatCurrency(stats.cn.todayRevenueCny, "CNY")} / +
              {loading
                ? "-"
                : formatCurrency(stats.intl.todayRevenueUsd, "USD")}{" "}
              今日
            </p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                CN: {loading ? "-" : formatCurrency(stats.cn.totalRevenueCny, "CNY")}
              </Badge>
              <Badge variant="outline" className="text-xs">
                INTL:{" "}
                {loading
                  ? "-"
                  : formatCurrency(stats.intl.totalRevenueUsd, "USD")}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              用户增长
            </CardTitle>
            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "-" : stats.total.todayUsers}
            </div>
            <p className="text-xs text-muted-foreground mt-1">今日新增</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                CN: {loading ? "-" : stats.cn.todayUsers}
              </Badge>
              <Badge variant="outline" className="text-xs">
                INTL: {loading ? "-" : stats.intl.todayUsers}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户增长趋势（最近7天）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => {
                    const date = new Date(value as string);
                    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="cn" stroke="#ef4444" strokeWidth={2} name="CN 用户" />
                <Line type="monotone" dataKey="intl" stroke="#3b82f6" strokeWidth={2} name="INTL 用户" />
                <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} name="总计" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>收入增长趋势（最近7天）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(value) => `￥${Number(value || 0).toFixed(0)}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) => `$${Number(value || 0).toFixed(0)}`}
                />
                <Tooltip
                  labelFormatter={(value) => {
                    const date = new Date(value as string);
                    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                  formatter={(value: any, name: any, props: any) => {
                    const dataKey = props?.dataKey as string | undefined;
                    if (dataKey === "cn")
                      return [formatCurrency(Number(value || 0), "CNY"), name];
                    if (dataKey === "intl")
                      return [formatCurrency(Number(value || 0), "USD"), name];
                    return [String(value ?? ""), name];
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cn"
                  stroke="#ef4444"
                  strokeWidth={2}
                  yAxisId="left"
                  name="CN 收入 (￥)"
                />
                <Line
                  type="monotone"
                  dataKey="intl"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  yAxisId="right"
                  name="INTL 收入 ($)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {!loading && stats.errors && stats.errors.length ? (
        <Card>
          <CardHeader>
            <CardTitle>数据源错误</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {stats.errors.map((e, idx) => (
              <div key={idx}>
                [{e.source}] {e.message}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

