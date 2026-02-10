import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin/session";
import { proxyAdminJsonFetch } from "@/lib/admin/proxy";
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

type UsersPatchInput = {
  source: DataSource;
  id: string;
  name?: string | null;
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
};

type UsersPatchResponse = {
  success: boolean;
  source: DataSource;
  mode: SourceMode;
  item: UserRow | null;
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

function normalizeOptionalText(
  value: unknown,
  options: { maxLength: number; allowEmpty: boolean; label: string }
): { ok: true; value: string | null | undefined } | { ok: false; message: string } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  const text = String(value).trim();
  if (!text) {
    if (options.allowEmpty) return { ok: true, value: null };
    return { ok: false, message: `${options.label} 不能为空` };
  }
  if (text.length > options.maxLength) {
    return { ok: false, message: `${options.label} 过长（最大 ${options.maxLength}）` };
  }
  return { ok: true, value: text };
}

function normalizeTagLike(
  value: unknown,
  options: { maxLength: number; label: string }
): { ok: true; value: string | null | undefined } | { ok: false; message: string } {
  const normalized = normalizeOptionalText(value, {
    maxLength: options.maxLength,
    allowEmpty: false,
    label: options.label,
  });
  if (!normalized.ok || normalized.value == null || normalized.value === undefined) {
    return normalized;
  }
  const token = normalized.value.toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(token)) {
    return { ok: false, message: `${options.label} 仅支持字母数字/下划线/中划线` };
  }
  return { ok: true, value: token };
}

async function parsePatchBody(request: NextRequest): Promise<
  | { ok: true; payload: UsersPatchInput }
  | { ok: false; response: NextResponse }
> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "请求体必须为 JSON" }, { status: 400 }),
    };
  }

  const sourceRaw = String(body?.source || "").toUpperCase();
  if (sourceRaw !== "CN" && sourceRaw !== "INTL") {
    return {
      ok: false,
      response: NextResponse.json({ error: "source 仅支持 CN 或 INTL" }, { status: 400 }),
    };
  }
  const source = sourceRaw as DataSource;

  const id = String(body?.id || "").trim();
  if (!id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "id 不能为空" }, { status: 400 }),
    };
  }

  const name = normalizeOptionalText(body?.name, {
    maxLength: 100,
    allowEmpty: true,
    label: "name",
  });
  if (!name.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: name.message }, { status: 400 }),
    };
  }

  const subscriptionTier = normalizeTagLike(body?.subscriptionTier, {
    maxLength: 32,
    label: "subscriptionTier",
  });
  if (!subscriptionTier.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: subscriptionTier.message }, { status: 400 }),
    };
  }

  const subscriptionStatus = normalizeTagLike(body?.subscriptionStatus, {
    maxLength: 32,
    label: "subscriptionStatus",
  });
  if (!subscriptionStatus.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: subscriptionStatus.message }, { status: 400 }),
    };
  }

  const payload: UsersPatchInput = {
    source,
    id,
  };

  if (name.value !== undefined) payload.name = name.value;
  if (subscriptionTier.value !== undefined) payload.subscriptionTier = subscriptionTier.value;
  if (subscriptionStatus.value !== undefined) payload.subscriptionStatus = subscriptionStatus.value;

  const hasAnyField =
    payload.name !== undefined ||
    payload.subscriptionTier !== undefined ||
    payload.subscriptionStatus !== undefined;

  if (!hasAnyField) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "至少提供一个可更新字段：name/subscriptionTier/subscriptionStatus" },
        { status: 400 }
      ),
    };
  }

  return { ok: true, payload };
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

function sortByCreatedAtDesc(a: UserRow, b: UserRow): number {
  const av = a.createdAt || "";
  const bv = b.createdAt || "";
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return bv.localeCompare(av);
}

function mapCnUserRecord(u: any): UserRow {
  return {
    id: String(u._id),
    email: u.email ?? null,
    name: u.name ?? null,
    subscriptionTier: u.subscription_plan ?? "free",
    subscriptionStatus: u.subscription_status ?? "active",
    createdAt: u.createdAt ?? u.created_at ?? null,
    updatedAt: u.updatedAt ?? u.updated_at ?? null,
    source: "CN" as const,
  };
}

function mapIntlUserRecord(u: any): UserRow {
  return {
    id: String(u.id),
    email: u.email ?? null,
    name: u.full_name ?? null,
    subscriptionTier: u.subscription_tier ?? "free",
    subscriptionStatus: u.subscription_status ?? "active",
    createdAt: u.created_at ?? null,
    updatedAt: u.updated_at ?? null,
    source: "INTL" as const,
  };
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
    const rows = ((listRes.data || []) as any[]).map(mapCnUserRecord);
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

    const rows = ((listRes.data || []) as any[]).map(mapCnUserRecord);
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
  const rows = ((data || []) as any[]).map(mapIntlUserRecord);
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
  const search = new URLSearchParams();
  search.set("source", source);
  if (query.q) search.set("q", query.q);
  if (query.id) search.set("id", query.id);
  search.set("page", String(query.page));
  search.set("pageSize", String(query.pageSize));
  return await proxyAdminJsonFetch<UsersResponse>({
    origin,
    pathWithQuery: `/api/admin/users?${search.toString()}`,
    token,
  });
}

async function patchCnUser(payload: UsersPatchInput): Promise<UserRow> {
  const db = getCloudBaseDatabase();
  const collection = db.collection(CloudBaseCollections.USERS);
  const nowIso = new Date().toISOString();

  const updateDoc: Record<string, unknown> = {
    updatedAt: nowIso,
    updated_at: nowIso,
  };
  if (payload.name !== undefined) updateDoc.name = payload.name;
  if (payload.subscriptionTier !== undefined) updateDoc.subscription_plan = payload.subscriptionTier;
  if (payload.subscriptionStatus !== undefined) updateDoc.subscription_status = payload.subscriptionStatus;

  await collection.doc(payload.id).update(updateDoc);

  const readRes = await collection.where({ _id: payload.id }).limit(1).get();
  const row = (readRes.data || [])[0];
  if (!row) throw new Error("更新后未找到用户记录");
  return mapCnUserRecord(row);
}

async function patchIntlUser(payload: UsersPatchInput): Promise<UserRow> {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const updateDoc: Record<string, unknown> = {
    updated_at: nowIso,
  };
  if (payload.name !== undefined) updateDoc.full_name = payload.name;
  if (payload.subscriptionTier !== undefined) updateDoc.subscription_tier = payload.subscriptionTier;
  if (payload.subscriptionStatus !== undefined) updateDoc.subscription_status = payload.subscriptionStatus;

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update(updateDoc)
    .eq("id", payload.id);
  if (updateError) throw updateError;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,email,full_name,subscription_tier,subscription_status,created_at,updated_at")
    .eq("id", payload.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("更新后未找到用户记录");

  if (payload.name !== undefined) {
    await supabase.auth.admin
      .updateUserById(payload.id, { user_metadata: { full_name: payload.name ?? null } })
      .catch(() => null);
  }

  return mapIntlUserRecord(data);
}

async function proxyPatchUser(origin: string, payload: UsersPatchInput, token?: string | null): Promise<UsersPatchResponse> {
  const secret = getProxySecret();
  if (!secret) throw new Error("未配置 ADMIN_PROXY_SECRET，无法跨环境代理更新");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-admin-proxy-hop": "1",
    "x-admin-proxy-secret": secret,
  };
  if (token) {
    headers.cookie = `${getAdminSessionCookieName()}=${token}`;
  }

  const url = `${origin.replace(/\/$/, "")}/api/admin/users`;
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const bodyText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Proxy failed: HTTP ${res.status}${bodyText ? `: ${bodyText}` : ""}`);
  }

  try {
    return JSON.parse(bodyText) as UsersPatchResponse;
  } catch {
    throw new Error("代理返回了不可解析的 JSON");
  }
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

export async function PATCH(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parsePatchBody(request);
  if (!parsed.ok) return parsed.response;

  const payload = parsed.payload;
  const internalProxy = isInternalProxyRequest(request);
  const cookieToken = request.cookies.get(getAdminSessionCookieName())?.value || null;

  const cnOrigin = process.env.CN_APP_ORIGIN || "";
  const intlOrigin = process.env.INTL_APP_ORIGIN || "";

  const targetIsCn = payload.source === "CN";
  const hasDirect = targetIsCn ? hasCnDbConfig() : hasIntlDbConfig();
  const targetOrigin = targetIsCn ? cnOrigin : intlOrigin;
  const canProxy = !internalProxy && !!targetOrigin && !!getProxySecret();

  const patchDirect = async (): Promise<UsersPatchResponse> => {
    const item = targetIsCn ? await patchCnUser(payload) : await patchIntlUser(payload);
    return {
      success: true,
      source: payload.source,
      mode: "direct",
      item,
    };
  };

  if (hasDirect) {
    try {
      const res = await patchDirect();
      return NextResponse.json(res satisfies UsersPatchResponse);
    } catch (e: any) {
      if (canProxy) {
        try {
          const proxied = await proxyPatchUser(targetOrigin, payload, cookieToken);
          return NextResponse.json({ ...proxied, mode: "proxy" } satisfies UsersPatchResponse);
        } catch (pe: any) {
          return NextResponse.json(
            {
              error: "用户更新失败",
              details: {
                direct: e?.message ? String(e.message) : "direct_failed",
                proxy: pe?.message ? String(pe.message) : "proxy_failed",
              },
            },
            { status: 500 }
          );
        }
      }
      return NextResponse.json(
        {
          error: "用户更新失败",
          details: e?.message ? String(e.message) : "direct_failed",
        },
        { status: 500 }
      );
    }
  }

  if (canProxy) {
    try {
      const proxied = await proxyPatchUser(targetOrigin, payload, cookieToken);
      return NextResponse.json({ ...proxied, mode: "proxy" } satisfies UsersPatchResponse);
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "跨环境代理更新失败",
          details: e?.message ? String(e.message) : "proxy_failed",
        },
        { status: 500 }
      );
    }
  }

  const missing: string[] = [];
  if (internalProxy) missing.push("内部代理请求禁止二次代理");
  if (!targetOrigin) missing.push(targetIsCn ? "缺少 CN_APP_ORIGIN" : "缺少 INTL_APP_ORIGIN");
  if (!getProxySecret()) missing.push("缺少 ADMIN_PROXY_SECRET");

  return NextResponse.json(
    {
      error: "目标数据源不可用",
      details: targetIsCn
        ? `未配置 CloudBase 直连${missing.length ? `，且${missing.join("，")}` : ""}`
        : `未配置 Supabase 直连${missing.length ? `，且${missing.join("，")}` : ""}`,
    },
    { status: 400 }
  );
}
