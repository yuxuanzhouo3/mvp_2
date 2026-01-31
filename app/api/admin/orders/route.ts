import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSessionCookieName,
  verifyAdminSessionToken,
} from "@/lib/admin/session";
import { proxyAdminJsonFetch } from "@/lib/admin/proxy";
import { getCloudBaseDatabase, getDbCommand } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

export const dynamic = "force-dynamic";

type OrdersSource = "ALL" | "CN" | "INTL";
type OrdersStatus = "all" | "pending" | "completed" | "failed" | "refunded";

type DataSource = "CN" | "INTL";
type SourceMode = "direct" | "proxy" | "missing";

type SourceInfo = {
  source: DataSource;
  ok: boolean;
  mode: SourceMode;
  message?: string;
};

type OrderRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  paymentMethod: string | null;
  transactionId: string | null;
  createdAt: string | null;
  completedAt: string | null;
  source: DataSource;
};

type OrdersStats = {
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

type OrdersResponse = {
  items: OrderRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: OrdersStats;
  sources: SourceInfo[];
};

function normalizeEmailFilter(value: string | null): string | null {
  const v = (value || "").trim();
  return v || null;
}

/**
 * 解析 source 参数（默认 ALL）。
 */
function parseSource(value: string | null): OrdersSource {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "CN" || normalized === "INTL") return normalized;
  return "ALL";
}

/**
 * 解析 status 参数（默认 all）。
 */
function parseStatus(value: string | null): OrdersStatus {
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

/**
 * 解析正整数，失败则返回默认值。
 */
function parsePositiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/**
 * 判断是否具备 CloudBase 直连配置。
 */
function hasCnDbConfig(): boolean {
  return !!(
    process.env["NEXT_PUBLIC_WECHAT_CLOUDBASE_ID"] &&
    process.env["CLOUDBASE_SECRET_ID"] &&
    process.env["CLOUDBASE_SECRET_KEY"]
  );
}

/**
 * 判断是否具备 Supabase 直连配置。
 */
function hasIntlDbConfig(): boolean {
  const url = process.env["SUPABASE_URL"] || process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  return Boolean(url && serviceRoleKey);
}

/**
 * 获取 admin 跨环境代理 secret（若配置）。
 */
function getProxySecret(): string | null {
  return process.env["ADMIN_PROXY_SECRET"] || process.env["AI_STATS_PROXY_SECRET"] || null;
}

/**
 * 判断当前请求是否为内部代理请求（用于避免循环代理、放行鉴权）。
 */
function isInternalProxyRequest(request: NextRequest): boolean {
  const hop = request.headers.get("x-admin-proxy-hop");
  const secret = request.headers.get("x-admin-proxy-secret");
  const expected = getProxySecret();
  return hop === "1" && !!expected && secret === expected;
}

/**
 * 校验 admin_session cookie，或允许内部代理请求直通。
 */
async function isAuthorized(request: NextRequest): Promise<boolean> {
  if (isInternalProxyRequest(request)) return true;
  const token = request.cookies.get(getAdminSessionCookieName())?.value;
  const session = await verifyAdminSessionToken(token);
  return !!session;
}

/**
 * 将各种时间字段归一化为 ISO 字符串。
 */
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

/**
 * 兼容历史 status：success 视为 completed。
 */
function normalizeStatus(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.toLowerCase() : raw ? String(raw).toLowerCase() : "";
  if (!s) return null;
  if (s === "success") return "completed";
  return s;
}

/**
 * CloudBase 订单列表（payments 集合）查询。
 */
async function fetchCnOrders(params: {
  skip: number;
  limit: number;
  status: OrdersStatus;
  userId?: string | null;
  email?: string | null;
}): Promise<{ rows: OrderRow[]; total: number }> {
  const db = getCloudBaseDatabase();
  const cmd = getDbCommand();
  const collection = db.collection("payments");

  let query: any = collection;
  if (params.status !== "all") {
    if (params.status === "completed") {
      query = query.where({ status: cmd.in(["completed", "success"]) });
    } else {
      query = query.where({ status: params.status });
    }
  }

  if (params.userId) {
    query = query.where({ user_id: params.userId });
  }

  const loadRowsFromQuery = async (q: any, skip: number, limit: number): Promise<OrderRow[]> => {
    const rows: OrderRow[] = [];
    const chunkSize = 100;
    let orderField: "created_at" | "createdAt" = "created_at";
    for (let fetched = 0; fetched < limit; fetched += chunkSize) {
      const take = Math.min(chunkSize, limit - fetched);
      let listRes: any;
      try {
        listRes = await q
          .orderBy(orderField, "desc")
          .skip(skip + fetched)
          .limit(take)
          .get();
      } catch (e) {
        if (orderField === "created_at") {
          orderField = "createdAt";
          listRes = await q
            .orderBy(orderField, "desc")
            .skip(skip + fetched)
            .limit(take)
            .get();
        } else {
          throw e;
        }
      }

      for (const p of listRes.data || []) {
        const createdAt = normalizeIso(p.created_at ?? p.createdAt ?? null);
        const completedAt = normalizeIso(p.completed_at ?? p.completedAt ?? null);
        const rawStatus = p.status ?? null;
        const status = normalizeStatus(rawStatus);
        const amount =
          typeof p.amount === "number" ? p.amount : p.amount != null ? Number(p.amount) : null;
        const userEmail =
          p?.metadata?.userEmail ?? p?.metadata?.user_email ?? p?.metadata?.email ?? p?.user_email ?? null;

        rows.push({
          id: String(p._id ?? p.id ?? p.payment_id ?? p.paymentId ?? p.transaction_id ?? ""),
          userId: p.user_id ?? null,
          userEmail: userEmail ? String(userEmail) : null,
          amount: Number.isFinite(amount as number) ? (amount as number) : null,
          currency: p.currency ?? "CNY",
          status,
          paymentMethod: p.payment_method ?? null,
          transactionId: p.transaction_id ?? null,
          createdAt,
          completedAt,
          source: "CN",
        });
      }

      if (!listRes.data || listRes.data.length < take) break;
    }
    return rows;
  };

  if (params.email) {
    const maxTake = Math.max(1, Math.min(5000, params.skip + params.limit));
    const email = params.email;
    const alt = email.toLowerCase() !== email ? email.toLowerCase() : null;
    const emails = alt ? [email, alt] : [email];
    const emailLowerSet = new Set(emails.map((e) => e.toLowerCase()));
    const fields: Array<Record<string, any>> = emails.flatMap((e) => [
      { user_email: e },
      { "metadata.userEmail": e },
      { "metadata.user_email": e },
      { "metadata.email": e },
    ]);

    const byId = new Map<string, OrderRow>();
    for (const where of fields) {
      try {
        const rows = await loadRowsFromQuery(query.where(where), 0, maxTake);
        for (const r of rows) byId.set(`${r.source}:${r.id}`, r);
      } catch {}
    }

    try {
      const scanned = await loadRowsFromQuery(query, 0, 5000);
      for (const r of scanned) {
        const re = (r.userEmail || "").toLowerCase();
        if (re && emailLowerSet.has(re)) byId.set(`${r.source}:${r.id}`, r);
      }
    } catch {}

    const all = Array.from(byId.values());
    all.sort(sortByCreatedAtDesc);
    const sliced = all.slice(params.skip, params.skip + params.limit);
    return { rows: sliced, total: all.length };
  }

  const countRes = await query.count();
  const total = Number(countRes.total) || 0;

  const rows = await loadRowsFromQuery(query, params.skip, params.limit);

  return { rows, total };
}

/**
 * Supabase 订单列表（payments 表）查询。
 */
async function fetchIntlOrders(params: {
  skip: number;
  limit: number;
  status: OrdersStatus;
  userId?: string | null;
  email?: string | null;
}): Promise<{ rows: OrderRow[]; total: number }> {
  const supabase = getSupabaseAdmin();

  let emailUserIds: string[] | null = null;
  if (params.email && !params.userId) {
    const email = params.email;
    const loadIds = async (table: "profiles" | "user_profiles"): Promise<string[] | null> => {
      const { data, error } = await supabase.from(table).select("id,email").ilike("email", email);
      if (error) return null;
      return Array.from(
        new Set((data || []).map((p: any) => (p?.id ? String(p.id) : "")).filter((v: string) => !!v))
      );
    };
    emailUserIds = (await loadIds("profiles")) || (await loadIds("user_profiles")) || [];
    if (emailUserIds.length === 0) {
      return { rows: [], total: 0 };
    }
  }

  let countQuery = supabase.from("payments").select("id", { count: "exact", head: true });
  if (params.status !== "all") {
    if (params.status === "completed") countQuery = countQuery.in("status", ["completed", "success"]);
    else countQuery = countQuery.eq("status", params.status);
  }
  if (params.userId) {
    countQuery = countQuery.eq("user_id", params.userId);
  } else if (emailUserIds) {
    countQuery = countQuery.in("user_id", emailUserIds);
  }
  const { count: totalCount, error: countError } = await countQuery;
  if (countError) throw countError;
  const total = Number(totalCount) || 0;

  const rows: OrderRow[] = [];
  const chunkSize = 500;
  for (let fetched = 0; fetched < params.limit; fetched += chunkSize) {
    const take = Math.min(chunkSize, params.limit - fetched);
    let listQuery = supabase
      .from("payments")
      .select(
        "id,user_id,amount,currency,status,payment_method,transaction_id,created_at,completed_at,metadata"
      )
      .order("created_at", { ascending: false })
      .range(params.skip + fetched, params.skip + fetched + take - 1);

    if (params.status !== "all") {
      if (params.status === "completed") listQuery = listQuery.in("status", ["completed", "success"]);
      else listQuery = listQuery.eq("status", params.status);
    }
    if (params.userId) {
      listQuery = listQuery.eq("user_id", params.userId);
    } else if (emailUserIds) {
      listQuery = listQuery.in("user_id", emailUserIds);
    }

    const { data, error } = await listQuery;
    if (error) throw error;
    const payments = (data || []) as any[];

    const userIds = Array.from(
      new Set(
        payments
          .map((p: any) => (p?.user_id ? String(p.user_id) : ""))
          .filter((v: string) => !!v)
      )
    );
    const profileEmailById = new Map<string, string | null>();

    if (userIds.length > 0) {
      const loadProfiles = async (
        table: "profiles" | "user_profiles"
      ): Promise<Array<{ id: string; email: string | null; full_name?: string | null }> | null> => {
        const { data: profiles, error: profilesError } = await supabase
          .from(table)
          .select("id,email,full_name")
          .in("id", userIds);
        if (profilesError) return null;
        return (profiles || []) as any;
      };

      const profiles = (await loadProfiles("profiles")) || (await loadProfiles("user_profiles")) || [];
      for (const p of profiles) {
        profileEmailById.set(String(p.id), p.email ?? null);
      }
    }

    for (const p of payments) {
      const createdAt = normalizeIso(p.created_at ?? null);
      const completedAt = normalizeIso(p.completed_at ?? null);
      const rawStatus = p.status ?? null;
      const status = normalizeStatus(rawStatus);
      const amount =
        typeof p.amount === "number"
          ? p.amount
          : p.amount != null
            ? Number(p.amount)
            : null;
      const profileEmail = p?.user_id ? profileEmailById.get(String(p.user_id)) : null;
      const userEmail = profileEmail ?? p?.metadata?.userEmail ?? p?.metadata?.email ?? null;
      rows.push({
        id: String(p.id),
        userId: p.user_id ?? null,
        userEmail: userEmail ? String(userEmail) : null,
        amount: Number.isFinite(amount as number) ? (amount as number) : null,
        currency: p.currency ?? "USD",
        status,
        paymentMethod: p.payment_method ?? null,
        transactionId: p.transaction_id ?? null,
        createdAt,
        completedAt,
        source: "INTL",
      });
    }

    if (!payments || payments.length < take) break;
  }

  return { rows, total };
}

/**
 * 统计单侧订单状态分布与近 30 天收入。
 */
async function computeOrdersStats(source: DataSource, days: number): Promise<OrdersStats> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - Math.max(1, days) + 1);
  const startIso = start.toISOString();

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

      const startMs = start.getTime();
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
    for (const p of ((data || []) as any[])) {
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

/**
 * 请求远端环境的 orders API（带 hop/secret 防循环）。
 */
async function proxyFetch(
  origin: string,
  source: DataSource,
  query: { status: OrdersStatus; page: number; pageSize: number; email?: string | null; userId?: string | null },
  token?: string | null
): Promise<OrdersResponse> {
  const secret = getProxySecret();
  if (!secret) {
    throw new Error("未配置 ADMIN_PROXY_SECRET，无法跨环境代理查询");
  }
  const search = new URLSearchParams();
  search.set("source", source);
  search.set("status", query.status);
  search.set("page", String(query.page));
  search.set("pageSize", String(query.pageSize));
  if (query.email) search.set("email", query.email);
  if (query.userId) search.set("userId", query.userId);
  return await proxyAdminJsonFetch<OrdersResponse>({
    origin,
    pathWithQuery: `/api/admin/orders?${search.toString()}`,
    token,
  });
}

/**
 * 合并 CN/INTL 两侧统计。
 */
function mergeStats(a: OrdersStats | null, b: OrdersStats | null): OrdersStats {
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

/**
 * 按 createdAt 降序排序（缺失时间的放最后）。
 */
function sortByCreatedAtDesc(a: OrderRow, b: OrderRow): number {
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
  const email = normalizeEmailFilter(request.nextUrl.searchParams.get("email"));
  const userId = (request.nextUrl.searchParams.get("userId") || "").trim() || null;

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
  ): Promise<{ rows: OrderRow[]; total: number; stats: OrdersStats | null }> => {
    const isCN = which === "CN";
    const hasConfig = isCN ? hasCnDbConfig() : hasIntlDbConfig();
    const origin = isCN ? cnOrigin : intlOrigin;
    const proxySecret = getProxySecret();
    const canProxy = !internalProxy && !!origin && !!proxySecret;

    const safeProxy = async (): Promise<{ rows: OrderRow[]; total: number; stats: OrdersStats | null }> => {
      try {
        const proxied = await proxyFetch(
          origin,
          which,
          {
            status,
            page: Math.floor(skip / Math.max(1, limit)) + 1,
            pageSize: limit,
            email,
            userId,
          },
          cookieToken
        );
        sources.push({ source: which, ok: true, mode: "proxy" });
        return { rows: proxied.items, total: proxied.pagination.total, stats: proxied.stats };
      } catch (e: any) {
        sources.push({
          source: which,
          ok: false,
          mode: "proxy",
          message: e?.message ? String(e.message) : "代理查询失败",
        });
        return { rows: [], total: 0, stats: null };
      }
    };

    if (hasConfig) {
      const withStats = !(email || userId);
      const [listRes, statsRes] = await Promise.allSettled([
        isCN
          ? fetchCnOrders({ skip, limit, status, email, userId })
          : fetchIntlOrders({ skip, limit, status, email, userId }),
        withStats ? computeOrdersStats(which, 30) : Promise.resolve(mergeStats(null, null)),
      ]);

      if (listRes.status === "fulfilled") {
        const stats = withStats && statsRes.status === "fulfilled" ? statsRes.value : null;
        sources.push({
          source: which,
          ok: true,
          mode: "direct",
          message:
            withStats && statsRes.status === "rejected"
              ? `统计失败：${statsRes.reason?.message ? String(statsRes.reason.message) : "未知错误"}`
              : undefined,
        });
        return { rows: listRes.value.rows, total: listRes.value.total, stats };
      }

      sources.push({
        source: which,
        ok: false,
        mode: "direct",
        message:
          listRes.reason?.message ? String(listRes.reason.message) : isCN ? "CloudBase 查询失败" : "Supabase 查询失败",
      });

      if (canProxy) {
        return await safeProxy();
      }

      return { rows: [], total: 0, stats: null };
    }

    if (canProxy) {
      return await safeProxy();
    }

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
    return { rows: [], total: 0, stats: null };
  };

  if (source === "ALL" && requiredTake > maxPrefetch) {
    const emptyStats: OrdersStats = {
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
        sources: [
          {
            source: "CN",
            ok: false,
            mode: "missing",
            message: `ALL 模式分页过深（page=${page}），请缩小页码或过滤条件`,
          },
          {
            source: "INTL",
            ok: false,
            mode: "missing",
            message: `ALL 模式分页过深（page=${page}），请缩小页码或过滤条件`,
          },
        ],
      } satisfies OrdersResponse,
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
      sources,
    } satisfies OrdersResponse);
  }

  if (source === "INTL") {
    const intl = await fetchSource("INTL", from, pageSize);
    const totalPages = Math.ceil(intl.total / pageSize);
    return NextResponse.json({
      items: intl.rows,
      pagination: { page, pageSize, total: intl.total, totalPages },
      stats: intl.stats || mergeStats(null, null),
      sources,
    } satisfies OrdersResponse);
  }

  const [cn, intl] = await Promise.all([
    needCN ? fetchSource("CN", 0, requiredTake) : Promise.resolve({ rows: [], total: 0, stats: null }),
    needINTL
      ? fetchSource("INTL", 0, requiredTake)
      : Promise.resolve({ rows: [], total: 0, stats: null }),
  ]);

  const combined = [...cn.rows, ...intl.rows];
  combined.sort(sortByCreatedAtDesc);
  const items = combined.slice(from, from + pageSize);

  const total = cn.total + intl.total;
  const totalPages = Math.ceil(total / pageSize);
  const stats = mergeStats(cn.stats, intl.stats);

  return NextResponse.json({
    items,
    pagination: { page, pageSize, total, totalPages },
    stats,
    sources,
  } satisfies OrdersResponse);
}
