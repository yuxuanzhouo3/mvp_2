import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin/session";
import { proxyAdminJsonFetch } from "@/lib/admin/proxy";
import { getCloudBaseDatabase, getDbCommand } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { normalizeAdminSourceToDeployment } from "@/lib/admin/deployment-source";

export const dynamic = "force-dynamic";

type PaymentsSource = "ALL" | "CN" | "INTL";
type PaymentsStatus = "all" | "pending" | "completed" | "failed" | "refunded";

type DataSource = "CN" | "INTL";
type SourceMode = "direct" | "proxy" | "missing";

type SourceInfo = {
  source: DataSource;
  ok: boolean;
  mode: SourceMode;
  message?: string;
};

type PaymentRow = {
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
};

type PaymentStats = {
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

type DailyPoint = {
  date: string;
  revenue: number;
  paidCount: number;
};

type PaymentsResponse = {
  items: PaymentRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: PaymentStats;
  charts: Partial<Record<DataSource, DailyPoint[]>>;
  sources: SourceInfo[];
};

function normalizeSearchQuery(value: string | null): string | null {
  const v = String(value || "").trim();
  if (!v) return null;
  const normalized = v.replaceAll(",", " ").slice(0, 200);
  return normalized.trim() || null;
}

function parseSource(value: string | null): PaymentsSource {
  return normalizeAdminSourceToDeployment(value);
}

function parseStatus(value: string | null): PaymentsStatus {
  const normalized = String(value || "").toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "completed" ||
    normalized === "failed" ||
    normalized === "refunded"
  ) {
    return normalized;
  }
  return "all";
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function hasCnDbConfig(): boolean {
  return !!(
    process.env["NEXT_PUBLIC_WECHAT_CLOUDBASE_ID"] &&
    process.env["CLOUDBASE_SECRET_ID"] &&
    process.env["CLOUDBASE_SECRET_KEY"]
  );
}

function hasIntlDbConfig(): boolean {
  const url = process.env["SUPABASE_URL"] || process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  return Boolean(url && serviceRoleKey);
}

function getProxySecret(): string | null {
  return process.env["ADMIN_PROXY_SECRET"] || process.env["AI_STATS_PROXY_SECRET"] || null;
}

function isInternalProxyRequest(request: NextRequest): boolean {
  const hop = request.headers.get("x-admin-proxy-hop");
  const secret = request.headers.get("x-admin-proxy-secret");
  const expected = getProxySecret();
  return hop === "1" && !!expected && secret === expected;
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (isInternalProxyRequest(request)) return true;
  const token = request.cookies.get(getAdminSessionCookieName())?.value;
  const session = await verifyAdminSessionToken(token);
  return !!session;
}

function normalizeIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const s = typeof value === "string" ? value : value ? String(value) : "";
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return s.includes("T") ? s : null;
}

function normalizeStatus(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.toLowerCase() : raw ? String(raw).toLowerCase() : "";
  if (!s) return null;
  if (s === "success") return "completed";
  return s;
}

function matchesStatusFilter(filter: PaymentsStatus, status: string | null): boolean {
  if (filter === "all") return true;
  const s = normalizeStatus(status);
  if (filter === "completed") return s === "completed" || s === "success";
  return s === filter;
}

function isPaid(status: string | null): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "success";
}

function getStartIso(days: number): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - Math.max(1, days) + 1);
  return start.toISOString();
}

async function fetchCnPayments(params: {
  skip: number;
  limit: number;
  status: PaymentsStatus;
  method: string | null;
}): Promise<{ rows: PaymentRow[]; total: number }> {
  const db = getCloudBaseDatabase();
  const cmd = getDbCommand();
  const collection = db.collection("payments");

  let query: any = collection;
  if (params.status !== "all") {
    if (params.status === "completed") query = query.where({ status: cmd.in(["completed", "success"]) });
    else query = query.where({ status: params.status });
  }
  if (params.method) query = query.where({ payment_method: params.method });

  const countRes = await query.count();
  const total = Number(countRes.total) || 0;

  const rows: PaymentRow[] = [];
  const chunkSize = 100;
  let orderField: "created_at" | "createdAt" = "created_at";
  for (let fetched = 0; fetched < params.limit; fetched += chunkSize) {
    const take = Math.min(chunkSize, params.limit - fetched);
    let listRes: any;
    try {
      listRes = await query
        .orderBy(orderField, "desc")
        .skip(params.skip + fetched)
        .limit(take)
        .get();
    } catch (e) {
      if (orderField === "created_at") {
        orderField = "createdAt";
        listRes = await query
          .orderBy(orderField, "desc")
          .skip(params.skip + fetched)
          .limit(take)
          .get();
      } else {
        throw e;
      }
    }

    for (const p of listRes.data || []) {
      const amount = typeof p.amount === "number" ? p.amount : p.amount != null ? Number(p.amount) : null;
      rows.push({
        id: String(p._id ?? p.id ?? p.payment_id ?? p.paymentId ?? p.transaction_id ?? ""),
        userId: p.user_id ?? null,
        amount: Number.isFinite(amount as number) ? (amount as number) : null,
        currency: p.currency ?? "CNY",
        status: normalizeStatus(p.status ?? null),
        paymentMethod: p.payment_method ?? null,
        transactionId: p.transaction_id ?? null,
        createdAt: normalizeIso(p.created_at ?? p.createdAt ?? null),
        completedAt: normalizeIso(p.completed_at ?? p.completedAt ?? null),
        source: "CN",
      });
    }

    if (!listRes.data || listRes.data.length < take) break;
  }

  return { rows, total };
}

async function searchCnPayments(params: {
  q: string;
  status: PaymentsStatus;
  method: string | null;
  skip: number;
  limit: number;
}): Promise<{ rows: PaymentRow[]; total: number }> {
  const db = getCloudBaseDatabase();
  const cmd = getDbCommand();
  const collection = db.collection("payments");

  const byId = new Map<string, PaymentRow>();
  const addRaw = (p: any) => {
    const amount = typeof p.amount === "number" ? p.amount : p.amount != null ? Number(p.amount) : null;
    const row: PaymentRow = {
      id: String(p._id ?? p.id ?? p.payment_id ?? p.paymentId ?? p.transaction_id ?? ""),
      userId: p.user_id ?? null,
      amount: Number.isFinite(amount as number) ? (amount as number) : null,
      currency: p.currency ?? "CNY",
      status: normalizeStatus(p.status ?? null),
      paymentMethod: p.payment_method ?? null,
      transactionId: p.transaction_id ?? null,
      createdAt: normalizeIso(p.created_at ?? p.createdAt ?? null),
      completedAt: normalizeIso(p.completed_at ?? p.completedAt ?? null),
      source: "CN",
    };
    if (!row.id) return;
    if (!matchesStatusFilter(params.status, row.status)) return;
    if (params.method && row.paymentMethod !== params.method) return;
    const key = `CN:${row.id}`;
    byId.set(key, row);
  };

  try {
    const docRes: any = await (collection as any).doc(params.q).get();
    for (const p of docRes?.data || []) addRaw(p);
  } catch {}

  const buildBaseQuery = () => {
    let query: any = collection;
    if (params.status !== "all") {
      if (params.status === "completed") query = query.where({ status: cmd.in(["completed", "success"]) });
      else query = query.where({ status: params.status });
    }
    if (params.method) query = query.where({ payment_method: params.method });
    return query;
  };

  const base = buildBaseQuery();

  const tryWhere = async (where: Record<string, any>) => {
    try {
      const res: any = await base.where(where).limit(200).get();
      for (const p of res.data || []) addRaw(p);
    } catch {}
  };

  await Promise.all([
    tryWhere({ transaction_id: params.q }),
    tryWhere({ user_id: params.q }),
    tryWhere({ payment_id: params.q }),
  ]);

  const all = Array.from(byId.values());
  all.sort(sortByCreatedAtDesc);
  const sliced = all.slice(params.skip, params.skip + params.limit);
  return { rows: sliced, total: all.length };
}

async function fetchIntlPayments(params: {
  skip: number;
  limit: number;
  status: PaymentsStatus;
  method: string | null;
}): Promise<{ rows: PaymentRow[]; total: number }> {
  const supabase = getSupabaseAdmin();

  let countQuery = supabase.from("payments").select("id", { count: "exact", head: true });
  if (params.status !== "all") {
    if (params.status === "completed") countQuery = countQuery.in("status", ["completed", "success"]);
    else countQuery = countQuery.eq("status", params.status);
  }
  if (params.method) countQuery = countQuery.eq("payment_method", params.method);
  const { count: totalCount, error: countError } = await countQuery;
  if (countError) throw countError;
  const total = Number(totalCount) || 0;

  const rows: PaymentRow[] = [];
  const chunkSize = 500;
  for (let fetched = 0; fetched < params.limit; fetched += chunkSize) {
    const take = Math.min(chunkSize, params.limit - fetched);
    let listQuery = supabase
      .from("payments")
      .select("id,user_id,amount,currency,status,payment_method,transaction_id,created_at,completed_at")
      .order("created_at", { ascending: false })
      .range(params.skip + fetched, params.skip + fetched + take - 1);

    if (params.status !== "all") {
      if (params.status === "completed") listQuery = listQuery.in("status", ["completed", "success"]);
      else listQuery = listQuery.eq("status", params.status);
    }
    if (params.method) listQuery = listQuery.eq("payment_method", params.method);

    const { data, error } = await listQuery;
    if (error) throw error;
    const payments = (data || []) as any[];

    for (const p of payments) {
      const amount =
        typeof p.amount === "number" ? p.amount : p.amount != null ? Number(p.amount) : null;
      rows.push({
        id: String(p.id),
        userId: p.user_id ?? null,
        amount: Number.isFinite(amount as number) ? (amount as number) : null,
        currency: p.currency ?? "USD",
        status: normalizeStatus(p.status ?? null),
        paymentMethod: p.payment_method ?? null,
        transactionId: p.transaction_id ?? null,
        createdAt: normalizeIso(p.created_at ?? null),
        completedAt: normalizeIso(p.completed_at ?? null),
        source: "INTL",
      });
    }

    if (!payments || payments.length < take) break;
  }

  return { rows, total };
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, "\\$&");
}

async function searchIntlPayments(params: {
  q: string;
  status: PaymentsStatus;
  method: string | null;
  skip: number;
  limit: number;
}): Promise<{ rows: PaymentRow[]; total: number }> {
  const supabase = getSupabaseAdmin();
  const q = params.q.replaceAll(",", " ").trim();
  const qEsc = escapeIlike(q);

  const orParts = [
    `id.eq.${q}`,
    `transaction_id.eq.${q}`,
    `user_id.eq.${q}`,
  ];
  if (q.length >= 3) {
    orParts.push(`transaction_id.ilike.%${qEsc}%`);
    orParts.push(`user_id.ilike.%${qEsc}%`);
  }
  const orExpr = orParts.join(",");

  let countQuery = supabase.from("payments").select("id", { count: "exact", head: true }).or(orExpr);
  if (params.status !== "all") {
    if (params.status === "completed") countQuery = countQuery.in("status", ["completed", "success"]);
    else countQuery = countQuery.eq("status", params.status);
  }
  if (params.method) countQuery = countQuery.eq("payment_method", params.method);
  const { count: totalCount, error: countError } = await countQuery;
  if (countError) throw countError;
  const total = Number(totalCount) || 0;

  let listQuery = supabase
    .from("payments")
    .select("id,user_id,amount,currency,status,payment_method,transaction_id,created_at,completed_at")
    .or(orExpr)
    .order("created_at", { ascending: false })
    .range(params.skip, params.skip + params.limit - 1);

  if (params.status !== "all") {
    if (params.status === "completed") listQuery = listQuery.in("status", ["completed", "success"]);
    else listQuery = listQuery.eq("status", params.status);
  }
  if (params.method) listQuery = listQuery.eq("payment_method", params.method);

  const { data, error } = await listQuery;
  if (error) throw error;

  const rows: PaymentRow[] = [];
  for (const p of (data || []) as any[]) {
    const amount = typeof p.amount === "number" ? p.amount : p.amount != null ? Number(p.amount) : null;
    rows.push({
      id: String(p.id),
      userId: p.user_id ?? null,
      amount: Number.isFinite(amount as number) ? (amount as number) : null,
      currency: p.currency ?? "USD",
      status: normalizeStatus(p.status ?? null),
      paymentMethod: p.payment_method ?? null,
      transactionId: p.transaction_id ?? null,
      createdAt: normalizeIso(p.created_at ?? null),
      completedAt: normalizeIso(p.completed_at ?? null),
      source: "INTL",
    });
  }
  return { rows, total };
}

async function computePaymentStats(source: DataSource, days: number): Promise<PaymentStats> {
  const startIso = getStartIso(days);

  if (source === "CN") {
    const db = getCloudBaseDatabase();
    const cmd = getDbCommand();
    const collection = db.collection("payments");

    const [totalAll, pending, completed, failed, refunded] = await Promise.all([
      collection.count().then((r: any) => Number(r.total) || 0),
      collection.where({ status: "pending" }).count().then((r: any) => Number(r.total) || 0),
      collection
        .where({ status: cmd.in(["completed", "success"]) })
        .count()
        .then((r: any) => Number(r.total) || 0),
      collection.where({ status: "failed" }).count().then((r: any) => Number(r.total) || 0),
      collection.where({ status: "refunded" }).count().then((r: any) => Number(r.total) || 0),
    ]);

    const other = Math.max(0, totalAll - pending - completed - failed - refunded);

    const sumLastNDays = async (): Promise<number> => {
      const statuses = cmd.in(["completed", "success"]);
      const pageSize = 200;
      const sumFromQuery = async (where: Record<string, any>): Promise<number> => {
        let offset = 0;
        let sum = 0;
        for (let i = 0; i < 200; i++) {
          const res = await collection
            .where(where)
            .field({ amount: true })
            .skip(offset)
            .limit(pageSize)
            .get();
          for (const p of res.data || []) {
            const amt = typeof p.amount === "number" ? p.amount : Number(p.amount);
            sum += Number.isFinite(amt) ? amt : 0;
          }
          if (!res.data || res.data.length < pageSize) break;
          offset += pageSize;
        }
        return sum;
      };

      const startMs = new Date(startIso).getTime();
      try {
        return await sumFromQuery({ status: statuses, created_at: cmd.gte(startIso) });
      } catch {
        try {
          return await sumFromQuery({ status: statuses, createdAt: cmd.gte(startIso) });
        } catch {
          return await sumFromQuery({ status: statuses, createdAt: cmd.gte(startMs) });
        }
      }
    };

    const revenue30dCny = await sumLastNDays();
    return {
      totalAll,
      byStatus: { pending, completed, failed, refunded, other },
      revenue30dCny,
      revenue30dUsd: 0,
    };
  }

  const supabase = getSupabaseAdmin();

  const countOf = async (statuses: string[] | string): Promise<number> => {
    let q = supabase.from("payments").select("id", { count: "exact", head: true });
    if (Array.isArray(statuses)) q = q.in("status", statuses);
    else q = q.eq("status", statuses);
    const { count, error } = await q;
    if (error) throw error;
    return Number(count) || 0;
  };

  const { count: totalAllCount, error: totalError } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true });
  if (totalError) throw totalError;
  const totalAll = Number(totalAllCount) || 0;

  const [pending, completed, failed, refunded] = await Promise.all([
    countOf("pending"),
    countOf(["completed", "success"]),
    countOf("failed"),
    countOf("refunded"),
  ]);
  const other = Math.max(0, totalAll - pending - completed - failed - refunded);

  const sumLastNDays = async (): Promise<number> => {
    const { data, error } = await supabase
      .from("payments")
      .select("amount,status,created_at")
      .gte("created_at", startIso)
      .in("status", ["completed", "success"]);
    if (error) throw error;
    let sum = 0;
    for (const p of (data || []) as any[]) {
      const amt = typeof p.amount === "number" ? p.amount : Number(p.amount);
      sum += Number.isFinite(amt) ? amt : 0;
    }
    return sum;
  };

  const revenue30dUsd = await sumLastNDays();
  return {
    totalAll,
    byStatus: { pending, completed, failed, refunded, other },
    revenue30dCny: 0,
    revenue30dUsd,
  };
}

async function computeDailyChart(source: DataSource, days: number): Promise<DailyPoint[]> {
  const startIso = getStartIso(days);
  const start = new Date(startIso);
  const dayKey = (iso: string): string => iso.slice(0, 10);

  const map = new Map<string, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    map.set(key, { date: key, revenue: 0, paidCount: 0 });
  }

  if (source === "CN") {
    const db = getCloudBaseDatabase();
    const cmd = getDbCommand();
    const collection = db.collection("payments");

    const pageSize = 200;
    let offset = 0;
    for (let i = 0; i < 400; i++) {
      let res: any;
      try {
        res = await collection
          .where({ created_at: cmd.gte(startIso) })
          .field({ amount: true, created_at: true, createdAt: true, status: true })
          .skip(offset)
          .limit(pageSize)
          .get();
      } catch {
        res = await collection
          .where({ createdAt: cmd.gte(startIso) })
          .field({ amount: true, created_at: true, createdAt: true, status: true })
          .skip(offset)
          .limit(pageSize)
          .get();
      }

      for (const p of res.data || []) {
        const status = normalizeStatus(p.status ?? null);
        if (!isPaid(status)) continue;
        const created = normalizeIso(p.created_at ?? p.createdAt ?? null);
        const key = created ? dayKey(created) : "";
        const item = map.get(key);
        if (!item) continue;
        const amt = typeof p.amount === "number" ? p.amount : Number(p.amount);
        item.revenue += Number.isFinite(amt) ? amt : 0;
        item.paidCount += 1;
      }

      if (!res.data || res.data.length < pageSize) break;
      offset += pageSize;
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .select("amount,created_at,status")
    .gte("created_at", startIso);
  if (error) throw error;

  for (const p of (data || []) as any[]) {
    const status = normalizeStatus(p.status ?? null);
    if (!isPaid(status)) continue;
    const created = normalizeIso(p.created_at ?? null);
    const key = created ? dayKey(created) : "";
    const item = map.get(key);
    if (!item) continue;
    const amt = typeof p.amount === "number" ? p.amount : Number(p.amount);
    item.revenue += Number.isFinite(amt) ? amt : 0;
    item.paidCount += 1;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function proxyFetch(
  origin: string,
  source: DataSource,
  query: { status: PaymentsStatus; page: number; pageSize: number; method?: string | null; q?: string | null },
  token?: string | null
): Promise<PaymentsResponse> {
  const secret = getProxySecret();
  if (!secret) throw new Error("未配置 ADMIN_PROXY_SECRET，无法跨环境代理查询");
  const search = new URLSearchParams();
  search.set("source", source);
  search.set("status", query.status);
  search.set("page", String(query.page));
  search.set("pageSize", String(query.pageSize));
  if (query.method) search.set("method", query.method);
  if (query.q) search.set("q", query.q);
  return await proxyAdminJsonFetch<PaymentsResponse>({
    origin,
    pathWithQuery: `/api/admin/payments?${search.toString()}`,
    token,
  });
}

function mergeStats(a: PaymentStats | null, b: PaymentStats | null): PaymentStats {
  const left = a || {
    totalAll: 0,
    byStatus: { pending: 0, completed: 0, failed: 0, refunded: 0, other: 0 },
    revenue30dCny: 0,
    revenue30dUsd: 0,
  };
  const right = b || {
    totalAll: 0,
    byStatus: { pending: 0, completed: 0, failed: 0, refunded: 0, other: 0 },
    revenue30dCny: 0,
    revenue30dUsd: 0,
  };

  return {
    totalAll: left.totalAll + right.totalAll,
    byStatus: {
      pending: left.byStatus.pending + right.byStatus.pending,
      completed: left.byStatus.completed + right.byStatus.completed,
      failed: left.byStatus.failed + right.byStatus.failed,
      refunded: left.byStatus.refunded + right.byStatus.refunded,
      other: left.byStatus.other + right.byStatus.other,
    },
    revenue30dCny: left.revenue30dCny + right.revenue30dCny,
    revenue30dUsd: left.revenue30dUsd + right.revenue30dUsd,
  };
}

function sortByCreatedAtDesc(a: PaymentRow, b: PaymentRow): number {
  const av = a.createdAt || "";
  const bv = b.createdAt || "";
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return bv.localeCompare(av);
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = parseSource(request.nextUrl.searchParams.get("source"));
  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const method = (request.nextUrl.searchParams.get("method") || "").trim() || null;
  const q = normalizeSearchQuery(request.nextUrl.searchParams.get("q"));

  const page = Math.max(1, parsePositiveInt(request.nextUrl.searchParams.get("page"), 1));
  const internalProxy = isInternalProxyRequest(request);
  const maxPageSize = internalProxy ? 5000 : 100;
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 20))
  );

  const from = (page - 1) * pageSize;
  const requiredTake = from + pageSize;
  const maxPrefetch = 5000;
  const cookieToken = request.cookies.get(getAdminSessionCookieName())?.value || null;

  const needCN = source === "ALL" || source === "CN";
  const needINTL = source === "ALL" || source === "INTL";

  const cnOrigin = process.env.CN_APP_ORIGIN || "";
  const intlOrigin = process.env.INTL_APP_ORIGIN || "";

  const sources: SourceInfo[] = [];

  const fetchSource = async (
    which: DataSource,
    skip: number,
    limit: number
  ): Promise<{ rows: PaymentRow[]; total: number; stats: PaymentStats | null; chart: DailyPoint[] | null }> => {
    const isCN = which === "CN";
    const hasConfig = isCN ? hasCnDbConfig() : hasIntlDbConfig();
    const origin = isCN ? cnOrigin : intlOrigin;
    const proxySecret = getProxySecret();
    const canProxy = !internalProxy && !!origin && !!proxySecret;

    const safeProxy = async (): Promise<{ rows: PaymentRow[]; total: number; stats: PaymentStats | null; chart: DailyPoint[] | null }> => {
      try {
        const proxied = await proxyFetch(
          origin,
          which,
          {
            status,
            page: Math.floor(skip / Math.max(1, limit)) + 1,
            pageSize: limit,
            method,
            q,
          },
          cookieToken
        );
        sources.push({ source: which, ok: true, mode: "proxy" });
        return {
          rows: proxied.items,
          total: proxied.pagination.total,
          stats: proxied.stats,
          chart: proxied.charts[which] || null,
        };
      } catch (e: any) {
        sources.push({
          source: which,
          ok: false,
          mode: "proxy",
          message: e?.message ? String(e.message) : "代理查询失败",
        });
        return { rows: [], total: 0, stats: null, chart: null };
      }
    };

    if (hasConfig) {
      const [listRes, statsRes, chartRes] = await Promise.allSettled([
        q
          ? isCN
            ? searchCnPayments({ q, status, method, skip, limit })
            : searchIntlPayments({ q, status, method, skip, limit })
          : isCN
            ? fetchCnPayments({ skip, limit, status, method })
            : fetchIntlPayments({ skip, limit, status, method }),
        computePaymentStats(which, 30),
        computeDailyChart(which, 30),
      ]);

      if (listRes.status === "fulfilled") {
        const stats = statsRes.status === "fulfilled" ? statsRes.value : null;
        const chart = chartRes.status === "fulfilled" ? chartRes.value : null;
        sources.push({
          source: which,
          ok: true,
          mode: "direct",
          message:
            statsRes.status === "rejected"
              ? `统计失败：${statsRes.reason?.message ? String(statsRes.reason.message) : "未知错误"}`
              : chartRes.status === "rejected"
                ? `图表失败：${chartRes.reason?.message ? String(chartRes.reason.message) : "未知错误"}`
                : undefined,
        });
        return { rows: listRes.value.rows, total: listRes.value.total, stats, chart };
      }

      sources.push({
        source: which,
        ok: false,
        mode: "direct",
        message: listRes.reason?.message ? String(listRes.reason.message) : isCN ? "CloudBase 查询失败" : "Supabase 查询失败",
      });

      if (canProxy) return await safeProxy();
      return { rows: [], total: 0, stats: null, chart: null };
    }

    if (canProxy) return await safeProxy();

    const missing: string[] = [];
    if (internalProxy) missing.push("内部代理请求禁止二次代理");
    if (!origin) missing.push(isCN ? "缺少 CN_APP_ORIGIN" : "缺少 INTL_APP_ORIGIN");
    if (!proxySecret) missing.push("缺少 ADMIN_PROXY_SECRET");

    sources.push({
      source: which,
      ok: false,
      mode: "missing",
      message: isCN
        ? `未配置 CloudBase 直连${missing.length ? `，且${missing.join("，")}` : ""}`
        : `未配置 Supabase 直连${missing.length ? `，且${missing.join("，")}` : ""}`,
    });
    return { rows: [], total: 0, stats: null, chart: null };
  };

  if (source === "ALL" && requiredTake > maxPrefetch) {
    const emptyStats: PaymentStats = {
      totalAll: 0,
      byStatus: { pending: 0, completed: 0, failed: 0, refunded: 0, other: 0 },
      revenue30dCny: 0,
      revenue30dUsd: 0,
    };
    return NextResponse.json(
      {
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
        stats: emptyStats,
        charts: {},
        sources: [
          { source: "CN", ok: false, mode: "missing", message: `ALL 模式分页过深（page=${page}），请缩小页码或过滤条件` },
          { source: "INTL", ok: false, mode: "missing", message: `ALL 模式分页过深（page=${page}），请缩小页码或过滤条件` },
        ],
      } satisfies PaymentsResponse,
      { status: 400 }
    );
  }

  if (source === "CN") {
    const cn = await fetchSource("CN", from, pageSize);
    const totalPages = Math.ceil(cn.total / pageSize);
    return NextResponse.json({
      items: cn.rows,
      pagination: { page, pageSize, total: cn.total, totalPages },
      stats: cn.stats || mergeStats(null, null),
      charts: cn.chart ? { CN: cn.chart } : {},
      sources,
    } satisfies PaymentsResponse);
  }

  if (source === "INTL") {
    const intl = await fetchSource("INTL", from, pageSize);
    const totalPages = Math.ceil(intl.total / pageSize);
    return NextResponse.json({
      items: intl.rows,
      pagination: { page, pageSize, total: intl.total, totalPages },
      stats: intl.stats || mergeStats(null, null),
      charts: intl.chart ? { INTL: intl.chart } : {},
      sources,
    } satisfies PaymentsResponse);
  }

  const [cn, intl] = await Promise.all([
    needCN ? fetchSource("CN", 0, requiredTake) : Promise.resolve({ rows: [], total: 0, stats: null, chart: null }),
    needINTL
      ? fetchSource("INTL", 0, requiredTake)
      : Promise.resolve({ rows: [], total: 0, stats: null, chart: null }),
  ]);

  const combined = [...cn.rows, ...intl.rows];
  combined.sort(sortByCreatedAtDesc);
  const items = combined.slice(from, from + pageSize);

  const total = cn.total + intl.total;
  const totalPages = Math.ceil(total / pageSize);
  const stats = mergeStats(cn.stats, intl.stats);
  const charts: Partial<Record<DataSource, DailyPoint[]>> = {};
  if (cn.chart) charts.CN = cn.chart;
  if (intl.chart) charts.INTL = intl.chart;

  return NextResponse.json({
    items,
    pagination: { page, pageSize, total, totalPages },
    stats,
    charts,
    sources,
  } satisfies PaymentsResponse);
}
