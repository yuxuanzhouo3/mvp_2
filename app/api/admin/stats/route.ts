import { NextRequest, NextResponse } from "next/server";
import { getCloudBaseDatabase, getDbCommand } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  getAdminSessionToken,
  hasCnDbConfig,
  hasIntlDbConfig,
  isAdminAuthorized,
  proxyAdminJsonFetch,
} from "@/lib/admin/proxy";

export const dynamic = "force-dynamic";

type StatsSource = "ALL" | "CN" | "INTL";

type SourceError = { source: "CN" | "INTL"; message: string };

type GrowthPoint = { date: string; cn: number; intl: number; total: number };
type RevenuePoint = { date: string; cn: number; intl: number };

type SideStats = {
  users: number;
  todayUsers: number;
  orders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  userGrowth: Array<{ date: string; count: number }>;
  revenueGrowth: Array<{ date: string; amount: number }>;
};

function parseSource(value: string | null): StatsSource {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "CN" || normalized === "INTL") return normalized;
  return "ALL";
}

function lastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDayExclusive(d: Date): Date {
  const x = startOfLocalDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

async function proxyFetch(origin: string, source: "CN" | "INTL", token?: string | null) {
  return await proxyAdminJsonFetch<any>({
    origin,
    pathWithQuery: `/api/admin/stats?source=${source}`,
    token,
  });
}

async function computeCnStats(startOfToday: Date): Promise<SideStats> {
  const db = getCloudBaseDatabase();
  const cmd = getDbCommand();

  const countByIsoDay = async (collection: string, field: string, date: Date) => {
    const start = startOfLocalDay(date).toISOString();
    const end = endOfLocalDayExclusive(date).toISOString();
    const res = await db
      .collection(collection)
      .where({ [field]: cmd.gte(start).and(cmd.lt(end)) })
      .count();
    return res.total || 0;
  };

  const countByNumericDay = async (collection: string, field: string, date: Date) => {
    const start = startOfLocalDay(date).getTime();
    const end = endOfLocalDayExclusive(date).getTime();
    const res = await db
      .collection(collection)
      .where({ [field]: cmd.gte(start).and(cmd.lt(end)) })
      .count();
    return res.total || 0;
  };

  const bestDayCount = async (collection: string, date: Date) => {
    const attempts = await Promise.allSettled([
      countByIsoDay(collection, "created_at", date),
      countByIsoDay(collection, "createdAt", date),
      countByNumericDay(collection, "createdAt", date),
    ]);
    const values = attempts
      .map((r) => (r.status === "fulfilled" ? r.value : 0))
      .filter((n) => Number.isFinite(n));
    return values.length ? Math.max(...values) : 0;
  };

  const sumPaymentsByDay = async (date: Date) => {
    const start = startOfLocalDay(date).toISOString();
    const end = endOfLocalDayExclusive(date).toISOString();
    const statuses = cmd.in(["completed", "success"]);

    const sumFromQuery = async (field: string) => {
      const pageSize = 200;
      let offset = 0;
      let sum = 0;
      for (let i = 0; i < 200; i++) {
        const res = await db
          .collection("payments")
          .where({
            status: statuses,
            [field]: cmd.gte(start).and(cmd.lt(end)),
          })
          .field({ amount: true })
          .skip(offset)
          .limit(pageSize)
          .get();
        const rows = res.data || [];
        for (const r of rows) sum += Number(r?.amount) || 0;
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
      return sum;
    };

    const results = await Promise.allSettled([
      sumFromQuery("created_at"),
      sumFromQuery("createdAt"),
    ]);
    const values = results
      .map((r) => (r.status === "fulfilled" ? r.value : 0))
      .filter((n) => Number.isFinite(n));
    return values.length ? Math.max(...values) : 0;
  };

  const sumPaymentsAllTime = async () => {
    const statuses = cmd.in(["completed", "success"]);
    const pageSize = 200;
    let offset = 0;
    let sum = 0;
    for (let i = 0; i < 500; i++) {
      const res = await db
        .collection("payments")
        .where({ status: statuses })
        .field({ amount: true })
        .skip(offset)
        .limit(pageSize)
        .get();
      const rows = res.data || [];
      for (const r of rows) sum += Number(r?.amount) || 0;
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return sum;
  };

  const users = (await db.collection("users").count()).total || 0;
  const orders = (await db.collection("payments").count()).total || 0;

  const todayUsers = await bestDayCount("users", startOfToday);
  const todayOrders = await bestDayCount("payments", startOfToday);

  const totalRevenue = await sumPaymentsAllTime();
  const todayRevenue = await sumPaymentsByDay(startOfToday);

  const userGrowth: Array<{ date: string; count: number }> = [];
  const revenueGrowth: Array<{ date: string; amount: number }> = [];
  for (const dateStr of lastNDates(7)) {
    const d = new Date(dateStr);
    userGrowth.push({ date: dateStr, count: await bestDayCount("users", d) });
    revenueGrowth.push({ date: dateStr, amount: await sumPaymentsByDay(d) });
  }

  return {
    users,
    todayUsers,
    orders,
    todayOrders,
    totalRevenue,
    todayRevenue,
    userGrowth,
    revenueGrowth,
  };
}

async function computeIntlStats(startOfToday: Date): Promise<SideStats> {
  const supabase = getSupabaseAdmin();

  const countForDay = async (table: string, date: Date) => {
    const start = startOfLocalDay(date).toISOString();
    const end = endOfLocalDayExclusive(date).toISOString();
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end);
    if (error) throw error;
    return count || 0;
  };

  const sumPaymentsForDay = async (date: Date) => {
    const start = startOfLocalDay(date).toISOString();
    const end = endOfLocalDayExclusive(date).toISOString();
    const pageSize = 1000;
    let offset = 0;
    let sum = 0;
    for (let i = 0; i < 200; i++) {
      const { data, error } = await supabase
        .from("payments")
        .select("amount,status,created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .in("status", ["completed", "success"])
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const r of rows) sum += Number((r as any)?.amount) || 0;
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return sum;
  };

  const sumPaymentsAllTime = async () => {
    const pageSize = 1000;
    let offset = 0;
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const { data, error } = await supabase
        .from("payments")
        .select("amount,status")
        .in("status", ["completed", "success"])
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      const rows = data || [];
      for (const r of rows) sum += Number((r as any)?.amount) || 0;
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return sum;
  };

  const { count: usersCount, error: usersError } = await supabase
    .from("user_profiles")
    .select("id", { count: "exact", head: true });
  if (usersError) throw usersError;

  const { count: ordersCount, error: ordersError } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true });
  if (ordersError) throw ordersError;

  const users = usersCount || 0;
  const orders = ordersCount || 0;

  const todayUsers = await countForDay("user_profiles", startOfToday);
  const todayOrders = await countForDay("payments", startOfToday);

  const totalRevenue = await sumPaymentsAllTime();
  const todayRevenue = await sumPaymentsForDay(startOfToday);

  const userGrowth: Array<{ date: string; count: number }> = [];
  const revenueGrowth: Array<{ date: string; amount: number }> = [];
  for (const dateStr of lastNDates(7)) {
    const d = new Date(dateStr);
    userGrowth.push({ date: dateStr, count: await countForDay("user_profiles", d) });
    revenueGrowth.push({ date: dateStr, amount: await sumPaymentsForDay(d) });
  }

  return {
    users,
    todayUsers,
    orders,
    todayOrders,
    totalRevenue,
    todayRevenue,
    userGrowth,
    revenueGrowth,
  };
}

function normalizeSide(side: Partial<SideStats> | null | undefined): SideStats {
  return {
    users: side?.users || 0,
    todayUsers: side?.todayUsers || 0,
    orders: side?.orders || 0,
    todayOrders: side?.todayOrders || 0,
    totalRevenue: side?.totalRevenue || 0,
    todayRevenue: side?.todayRevenue || 0,
    userGrowth: side?.userGrowth || lastNDates(7).map((d) => ({ date: d, count: 0 })),
    revenueGrowth: side?.revenueGrowth || lastNDates(7).map((d) => ({ date: d, amount: 0 })),
  };
}

function sideFromRemote(remote: any, which: "CN" | "INTL"): SideStats {
  const dates = lastNDates(7);
  const growthList: any[] = Array.isArray(remote?.userGrowth) ? remote.userGrowth : [];
  const revenueList: any[] = Array.isArray(remote?.revenueGrowth) ? remote.revenueGrowth : [];
  const sideTotals = which === "CN" ? remote?.cn : remote?.intl;

  const userGrowth = dates.map((date) => {
    const p = growthList.find((x) => x?.date === date) || null;
    const count = which === "CN" ? Number(p?.cn) || 0 : Number(p?.intl) || 0;
    return { date, count };
  });

  const revenueGrowth = dates.map((date) => {
    const p = revenueList.find((x) => x?.date === date) || null;
    const amount = which === "CN" ? Number(p?.cn) || 0 : Number(p?.intl) || 0;
    return { date, amount };
  });

  const users = Number(sideTotals?.totalUsers) || 0;
  const todayUsers = Number(sideTotals?.todayUsers) || 0;
  const orders = Number(sideTotals?.totalOrders) || 0;
  const todayOrders = Number(sideTotals?.todayOrders) || 0;
  const totalRevenue =
    which === "CN"
      ? Number(sideTotals?.totalRevenueCny) || 0
      : Number(sideTotals?.totalRevenueUsd) || 0;
  const todayRevenue =
    which === "CN"
      ? Number(sideTotals?.todayRevenueCny) || 0
      : Number(sideTotals?.todayRevenueUsd) || 0;

  return {
    users,
    todayUsers,
    orders,
    todayOrders,
    totalRevenue,
    todayRevenue,
    userGrowth,
    revenueGrowth,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = parseSource(request.nextUrl.searchParams.get("source"));
  const needCN = source === "ALL" || source === "CN";
  const needINTL = source === "ALL" || source === "INTL";

  const startToday = startOfLocalDay(new Date());
  const errors: SourceError[] = [];
  const cookieToken = getAdminSessionToken(request);

  const cnOrigin = process.env.CN_APP_ORIGIN || "";
  const intlOrigin = process.env.INTL_APP_ORIGIN || "";

  let cnSide: SideStats | null = null;
  let intlSide: SideStats | null = null;

  if (needCN) {
    if (hasCnDbConfig()) {
      try {
        cnSide = await computeCnStats(startToday);
      } catch (e: any) {
        errors.push({ source: "CN", message: e?.message ? String(e.message) : "CloudBase 统计失败" });
      }
    } else if (cnOrigin) {
      try {
        const remote = await proxyFetch(cnOrigin, "CN", cookieToken);
        cnSide = sideFromRemote(remote, "CN");
      } catch (e: any) {
        errors.push({ source: "CN", message: e?.message ? String(e.message) : "CN 代理统计失败" });
      }
    } else {
      errors.push({ source: "CN", message: "未配置 CloudBase 或 CN_APP_ORIGIN" });
    }
  }

  if (needINTL) {
    if (hasIntlDbConfig()) {
      try {
        intlSide = await computeIntlStats(startToday);
      } catch (e: any) {
        errors.push({ source: "INTL", message: e?.message ? String(e.message) : "Supabase 统计失败" });
      }
    } else if (intlOrigin) {
      try {
        const remote = await proxyFetch(intlOrigin, "INTL", cookieToken);
        intlSide = sideFromRemote(remote, "INTL");
      } catch (e: any) {
        errors.push({ source: "INTL", message: e?.message ? String(e.message) : "INTL 代理统计失败" });
      }
    } else {
      errors.push({ source: "INTL", message: "未配置 Supabase 或 INTL_APP_ORIGIN" });
    }
  }

  const cn = normalizeSide(cnSide);
  const intl = normalizeSide(intlSide);

  const cnTotals = {
    totalUsers: cn.users,
    todayUsers: cn.todayUsers,
    totalOrders: cn.orders,
    todayOrders: cn.todayOrders,
    totalRevenueCny: cn.totalRevenue,
    todayRevenueCny: cn.todayRevenue,
    totalRevenueUsd: 0,
    todayRevenueUsd: 0,
  };

  const intlTotals = {
    totalUsers: intl.users,
    todayUsers: intl.todayUsers,
    totalOrders: intl.orders,
    todayOrders: intl.todayOrders,
    totalRevenueCny: 0,
    todayRevenueCny: 0,
    totalRevenueUsd: intl.totalRevenue,
    todayRevenueUsd: intl.todayRevenue,
  };

  const total = {
    totalUsers: cn.users + intl.users,
    todayUsers: cn.todayUsers + intl.todayUsers,
    totalOrders: cn.orders + intl.orders,
    todayOrders: cn.todayOrders + intl.todayOrders,
  };

  const byDateUser = new Map<string, GrowthPoint>();
  for (const d of lastNDates(7)) byDateUser.set(d, { date: d, cn: 0, intl: 0, total: 0 });
  for (const p of cn.userGrowth) {
    const item = byDateUser.get(p.date) || { date: p.date, cn: 0, intl: 0, total: 0 };
    item.cn = p.count || 0;
    byDateUser.set(p.date, item);
  }
  for (const p of intl.userGrowth) {
    const item = byDateUser.get(p.date) || { date: p.date, cn: 0, intl: 0, total: 0 };
    item.intl = p.count || 0;
    byDateUser.set(p.date, item);
  }
  for (const item of byDateUser.values()) item.total = item.cn + item.intl;
  const userGrowth = Array.from(byDateUser.values()).sort((a, b) => a.date.localeCompare(b.date));

  const byDateRevenue = new Map<string, RevenuePoint>();
  for (const d of lastNDates(7)) byDateRevenue.set(d, { date: d, cn: 0, intl: 0 });
  for (const p of cn.revenueGrowth) {
    const item = byDateRevenue.get(p.date) || { date: p.date, cn: 0, intl: 0 };
    item.cn = p.amount || 0;
    byDateRevenue.set(p.date, item);
  }
  for (const p of intl.revenueGrowth) {
    const item = byDateRevenue.get(p.date) || { date: p.date, cn: 0, intl: 0 };
    item.intl = p.amount || 0;
    byDateRevenue.set(p.date, item);
  }
  const revenueGrowth = Array.from(byDateRevenue.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return NextResponse.json(
    {
      cn: cnTotals,
      intl: intlTotals,
      total,
      userGrowth,
      revenueGrowth,
      errors,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
