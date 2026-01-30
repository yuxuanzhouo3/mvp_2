import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin/session";
import { CloudBaseCollections, getCloudBaseDatabase } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

export const dynamic = "force-dynamic";

type UsersSource = "ALL" | "CN" | "INTL";
type DataSource = "CN" | "INTL";
type SourceMode = "direct" | "proxy" | "missing";

type SourceInfo = {
  source: DataSource;
  ok: boolean;
  mode: SourceMode;
  message?: string;
};

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  subscriptionTier: string | null;
  subscriptionStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: DataSource;
};

type UsersResponse = {
  items: UserRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  sources: SourceInfo[];
};

function parseSource(value: string | null): UsersSource {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "CN" || normalized === "INTL") return normalized;
  return "ALL";
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function hasCnDbConfig(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID &&
    process.env.CLOUDBASE_SECRET_ID &&
    process.env.CLOUDBASE_SECRET_KEY
  );
}

function hasIntlDbConfig(): boolean {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return Boolean(url && serviceRoleKey);
}

function getProxySecret(): string | null {
  return process.env.ADMIN_PROXY_SECRET || process.env.AI_STATS_PROXY_SECRET || null;
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

function sortByCreatedAtDesc(a: UserRow, b: UserRow): number {
  const av = a.createdAt || "";
  const bv = b.createdAt || "";
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return bv.localeCompare(av);
}

async function fetchCnUsers(params: {
  skip: number;
  limit: number;
  q: string;
  id?: string | null;
}): Promise<{ rows: UserRow[]; total: number }> {
  const db = getCloudBaseDatabase();
  const collection = db.collection(CloudBaseCollections.USERS);

  const idv = (params.id || "").trim();
  if (idv) {
    const query: any = collection.where({ _id: idv });
    const countRes = await query.count();
    const total = Number(countRes.total) || 0;
    const listRes = await query.limit(1).get();
    const rows = ((listRes.data || []) as any[]).map((u: any) => ({
      id: String(u._id),
      email: u.email ?? null,
      name: u.name ?? null,
      subscriptionTier: u.subscription_plan ?? "free",
      subscriptionStatus: u.subscription_status ?? "active",
      createdAt: u.createdAt ?? u.created_at ?? null,
      updatedAt: u.updatedAt ?? u.updated_at ?? null,
      source: "CN" as const,
    }));
    return { rows, total };
  }

  const qv = params.q.trim();
  const candidates = qv ? (qv.toLowerCase() !== qv ? [qv, qv.toLowerCase()] : [qv]) : [];

  const countAndList = async (emailFilter?: string): Promise<{ rows: UserRow[]; total: number }> => {
    let query: any = collection;
    if (emailFilter) query = query.where({ email: emailFilter });
    const countRes = await query.count();
    const total = Number(countRes.total) || 0;

    let listRes: any;
    try {
      listRes = await query.orderBy("createdAt", "desc").skip(params.skip).limit(params.limit).get();
    } catch {
      listRes = await query.orderBy("created_at", "desc").skip(params.skip).limit(params.limit).get();
    }

    const rows = ((listRes.data || []) as any[]).map((u: any) => ({
      id: String(u._id),
      email: u.email ?? null,
      name: u.name ?? null,
      subscriptionTier: u.subscription_plan ?? "free",
      subscriptionStatus: u.subscription_status ?? "active",
      createdAt: u.createdAt ?? u.created_at ?? null,
      updatedAt: u.updatedAt ?? u.updated_at ?? null,
      source: "CN" as const,
    }));
    return { rows, total };
  };

  if (!qv) return await countAndList();
  for (const c of candidates) {
    const res = await countAndList(c);
    if (res.total > 0) return res;
  }
  return { rows: [], total: 0 };
}

async function fetchIntlUsers(params: {
  skip: number;
  limit: number;
  q: string;
  id?: string | null;
}): Promise<{ rows: UserRow[]; total: number }> {
  const supabase = getSupabaseAdmin();
  const idv = (params.id || "").trim();
  const qv = params.q.trim();

  let countQuery = supabase.from("user_profiles").select("id", { count: "exact", head: true });
  if (idv) countQuery = countQuery.eq("id", idv);
  else if (qv) countQuery = countQuery.ilike("email", `%${qv}%`);
  const { count, error: countError } = await countQuery;
  if (countError) throw countError;
  const total = Number(count) || 0;

  let listQuery = supabase
    .from("user_profiles")
    .select("id,email,full_name,subscription_tier,subscription_status,created_at,updated_at")
    .order("created_at", { ascending: false })
    .range(params.skip, params.skip + params.limit - 1);
  if (idv) listQuery = listQuery.eq("id", idv).range(0, 0);
  else if (qv) listQuery = listQuery.ilike("email", `%${qv}%`);

  const { data, error } = await listQuery;
  if (error) throw error;
  const rows = ((data || []) as any[]).map((u: any) => ({
    id: String(u.id),
    email: u.email ?? null,
    name: u.full_name ?? null,
    subscriptionTier: u.subscription_tier ?? "free",
    subscriptionStatus: u.subscription_status ?? "active",
    createdAt: u.created_at ?? null,
    updatedAt: u.updated_at ?? null,
    source: "INTL" as const,
  }));
  return { rows, total };
}

async function proxyFetch(
  origin: string,
  source: DataSource,
  query: { q: string; page: number; pageSize: number; id?: string | null },
  token?: string | null
): Promise<UsersResponse> {
  const secret = getProxySecret();
  if (!secret) throw new Error("未配置 ADMIN_PROXY_SECRET，无法跨环境代理查询");
  const headers: Record<string, string> = {
    "x-admin-proxy-hop": "1",
    "x-admin-proxy-secret": secret,
  };
  if (token) headers["cookie"] = `${getAdminSessionCookieName()}=${token}`;
  const url = new URL(`${origin.replace(/\/$/, "")}/api/admin/users`);
  url.searchParams.set("source", source);
  if (query.q) url.searchParams.set("q", query.q);
  if (query.id) url.searchParams.set("id", query.id);
  url.searchParams.set("page", String(query.page));
  url.searchParams.set("pageSize", String(query.pageSize));
  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`Proxy ${source} failed: HTTP ${res.status}`);
  return (await res.json()) as UsersResponse;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = parseSource(request.nextUrl.searchParams.get("source"));
  const q = String(request.nextUrl.searchParams.get("q") || "").trim();
  const id = String(request.nextUrl.searchParams.get("id") || "").trim() || null;

  const page = Math.max(1, parsePositiveInt(request.nextUrl.searchParams.get("page"), 1));
  const internalProxy = isInternalProxyRequest(request);
  const maxPageSize = internalProxy ? 5000 : 200;
  const pageSize = Math.min(maxPageSize, Math.max(1, parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 50)));

  if (id && source === "ALL") {
    return NextResponse.json({ error: "id 查询仅支持 source=CN 或 source=INTL" }, { status: 400 });
  }

  const effectivePage = id ? 1 : page;
  const effectivePageSize = id ? 1 : pageSize;

  const from = (effectivePage - 1) * effectivePageSize;
  const requiredTake = from + effectivePageSize;
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
  ): Promise<{ rows: UserRow[]; total: number }> => {
    const isCN = which === "CN";
    const hasConfig = isCN ? hasCnDbConfig() : hasIntlDbConfig();
    const origin = isCN ? cnOrigin : intlOrigin;
    const proxySecret = getProxySecret();
    const canProxy = !internalProxy && !!origin && !!proxySecret;

    const safeProxy = async (): Promise<{ rows: UserRow[]; total: number }> => {
      try {
        const proxied = await proxyFetch(
          origin,
          which,
          { q, id, page: Math.floor(skip / Math.max(1, limit)) + 1, pageSize: limit },
          cookieToken
        );
        sources.push({ source: which, ok: true, mode: "proxy" });
        return { rows: proxied.items, total: proxied.pagination.total };
      } catch (e: any) {
        sources.push({
          source: which,
          ok: false,
          mode: "proxy",
          message: e?.message ? String(e.message) : "代理查询失败",
        });
        return { rows: [], total: 0 };
      }
    };

    if (hasConfig) {
      try {
        const listRes = isCN
          ? await fetchCnUsers({ skip, limit, q, id })
          : await fetchIntlUsers({ skip, limit, q, id });
        sources.push({ source: which, ok: true, mode: "direct" });
        return listRes;
      } catch (e: any) {
        sources.push({
          source: which,
          ok: false,
          mode: "direct",
          message: e?.message ? String(e.message) : isCN ? "CloudBase 查询失败" : "Supabase 查询失败",
        });
        if (canProxy) return await safeProxy();
        return { rows: [], total: 0 };
      }
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
    return { rows: [], total: 0 };
  };

  if (source === "ALL" && requiredTake > maxPrefetch) {
    return NextResponse.json(
      {
        items: [],
        pagination: { page: effectivePage, pageSize: effectivePageSize, total: 0, totalPages: 0 },
        sources: [
          {
            source: "CN",
            ok: false,
            mode: "missing",
            message: `ALL 模式分页过深（page=${effectivePage}），请缩小页码或过滤条件`,
          },
          {
            source: "INTL",
            ok: false,
            mode: "missing",
            message: `ALL 模式分页过深（page=${effectivePage}），请缩小页码或过滤条件`,
          },
        ],
      } satisfies UsersResponse,
      { status: 400 }
    );
  }

  if (source === "CN") {
    const cn = await fetchSource("CN", from, effectivePageSize);
    const totalPages = Math.ceil(cn.total / effectivePageSize);
    return NextResponse.json({
      items: cn.rows,
      pagination: { page: effectivePage, pageSize: effectivePageSize, total: cn.total, totalPages },
      sources,
    } satisfies UsersResponse);
  }

  if (source === "INTL") {
    const intl = await fetchSource("INTL", from, effectivePageSize);
    const totalPages = Math.ceil(intl.total / effectivePageSize);
    return NextResponse.json({
      items: intl.rows,
      pagination: { page: effectivePage, pageSize: effectivePageSize, total: intl.total, totalPages },
      sources,
    } satisfies UsersResponse);
  }

  const [cn, intl] = await Promise.all([
    needCN ? fetchSource("CN", 0, requiredTake) : Promise.resolve({ rows: [], total: 0 }),
    needINTL ? fetchSource("INTL", 0, requiredTake) : Promise.resolve({ rows: [], total: 0 }),
  ]);

  const combined = [...cn.rows, ...intl.rows];
  combined.sort(sortByCreatedAtDesc);
  const items = combined.slice(from, from + effectivePageSize);

  const total = cn.total + intl.total;
  const totalPages = Math.ceil(total / effectivePageSize);

  return NextResponse.json({
    items,
    pagination: { page: effectivePage, pageSize: effectivePageSize, total, totalPages },
    sources,
  } satisfies UsersResponse);
}
