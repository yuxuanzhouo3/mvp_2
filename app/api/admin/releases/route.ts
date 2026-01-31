import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin/session";
import { proxyAdminJsonFetch } from "@/lib/admin/proxy";
import { getCloudBaseDatabase, getDbCommand } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

export const dynamic = "force-dynamic";

type DataSource = "CN" | "INTL";
type ReleasesSource = "ALL" | DataSource;
type SourceMode = "direct" | "proxy" | "missing";

type SourceInfo = {
  source: DataSource;
  ok: boolean;
  mode: SourceMode;
  message?: string;
};

type ReleaseRow = {
  id: string;
  version: string;
  platform: string;
  arch: string | null;
  fileName: string | null;
  fileSize: number | null;
  sha256: string | null;
  storageRef: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: DataSource;
};

type ReleasesResponse = {
  items: ReleaseRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  sources: SourceInfo[];
};

function parseSource(value: string | null): ReleasesSource {
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

function normalizeBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = typeof value === "string" ? value.toLowerCase() : value != null ? String(value).toLowerCase() : "";
  return s === "1" || s === "true" || s === "yes";
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sortByCreatedAtDesc(a: ReleaseRow, b: ReleaseRow): number {
  const av = a.createdAt || "";
  const bv = b.createdAt || "";
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return bv.localeCompare(av);
}

function normalizeQueryText(value: string | null): string | null {
  const v = (value || "").trim();
  return v || null;
}

async function fetchCnReleases(params: {
  skip: number;
  limit: number;
  platform?: string | null;
  q?: string | null;
}): Promise<{ rows: ReleaseRow[]; total: number }> {
  const db = getCloudBaseDatabase();
  const collection = db.collection("releases");

  let query: any = collection;
  const platform = (params.platform || "").trim();
  if (platform) {
    query = query.where({ platform });
  }

  const loadRowsFromQuery = async (q: any, skip: number, limit: number): Promise<ReleaseRow[]> => {
    const rows: ReleaseRow[] = [];
    const chunkSize = 100;
    let createdField: "created_at" | "createdAt" = "created_at";
    for (let fetched = 0; fetched < limit; fetched += chunkSize) {
      const take = Math.min(chunkSize, limit - fetched);
      let listRes: any;
      try {
        listRes = await q
          .orderBy(createdField, "desc")
          .skip(skip + fetched)
          .limit(take)
          .get();
      } catch (e) {
        if (createdField === "created_at") {
          createdField = "createdAt";
          listRes = await q
            .orderBy(createdField, "desc")
            .skip(skip + fetched)
            .limit(take)
            .get();
        } else {
          throw e;
        }
      }

      for (const r of listRes.data || []) {
        rows.push({
          id: String(r._id ?? r.id ?? ""),
          version: String(r.version ?? ""),
          platform: String(r.platform ?? ""),
          arch: r.arch != null ? String(r.arch) : null,
          fileName: r.file_name != null ? String(r.file_name) : r.fileName != null ? String(r.fileName) : null,
          fileSize: normalizeNumber(r.file_size ?? r.fileSize),
          sha256: r.sha256 != null ? String(r.sha256) : null,
          storageRef:
            r.storage_ref != null
              ? String(r.storage_ref)
              : r.storageRef != null
                ? String(r.storageRef)
                : r.file_id != null
                  ? String(r.file_id)
                  : r.fileId != null
                    ? String(r.fileId)
                    : null,
          active: normalizeBool(r.active ?? false),
          notes: r.notes != null ? String(r.notes) : null,
          createdAt: normalizeIso(r.created_at ?? r.createdAt ?? null),
          updatedAt: normalizeIso(r.updated_at ?? r.updatedAt ?? null),
          source: "CN",
        });
      }

      if (!listRes.data || listRes.data.length < take) break;
    }
    return rows;
  };

  const qText = params.q;
  if (qText) {
    const maxTake = Math.max(1, Math.min(5000, params.skip + params.limit));
    const qLower = qText.toLowerCase();
    const scanned = await loadRowsFromQuery(query, 0, maxTake);
    const filtered = scanned.filter((r) => {
      const v = (r.version || "").toLowerCase();
      const fn = (r.fileName || "").toLowerCase();
      return (v && v.includes(qLower)) || (fn && fn.includes(qLower));
    });
    filtered.sort(sortByCreatedAtDesc);
    return { rows: filtered.slice(params.skip, params.skip + params.limit), total: filtered.length };
  }

  const countRes = await query.count();
  const total = Number(countRes.total) || 0;
  const rows = await loadRowsFromQuery(query, params.skip, params.limit);
  return { rows, total };
}

async function fetchIntlReleases(params: {
  skip: number;
  limit: number;
  platform?: string | null;
  q?: string | null;
}): Promise<{ rows: ReleaseRow[]; total: number }> {
  const supabase = getSupabaseAdmin();

  let countQuery = supabase.from("releases").select("id", { count: "exact", head: true });
  const platform = (params.platform || "").trim();
  if (platform) countQuery = countQuery.eq("platform", platform);
  const qText = params.q;
  if (qText) {
    const escaped = qText.replaceAll(",", "\\,");
    countQuery = countQuery.or(`version.ilike.%${escaped}%,file_name.ilike.%${escaped}%`);
  }

  const { count: totalCount, error: countError } = await countQuery;
  if (countError) throw countError;
  const total = Number(totalCount) || 0;

  const rows: ReleaseRow[] = [];
  const chunkSize = 500;
  for (let fetched = 0; fetched < params.limit; fetched += chunkSize) {
    const take = Math.min(chunkSize, params.limit - fetched);
    let listQuery = supabase
      .from("releases")
      .select(
        "id,version,platform,arch,file_name,file_size,sha256,storage_ref,active,notes,created_at,updated_at"
      )
      .order("created_at", { ascending: false })
      .range(params.skip + fetched, params.skip + fetched + take - 1);

    if (platform) listQuery = listQuery.eq("platform", platform);
    if (qText) {
      const escaped = qText.replaceAll(",", "\\,");
      listQuery = listQuery.or(`version.ilike.%${escaped}%,file_name.ilike.%${escaped}%`);
    }

    const { data, error } = await listQuery;
    if (error) throw error;
    for (const r of (data || []) as any[]) {
      rows.push({
        id: String(r.id ?? ""),
        version: String(r.version ?? ""),
        platform: String(r.platform ?? ""),
        arch: r.arch != null ? String(r.arch) : null,
        fileName: r.file_name != null ? String(r.file_name) : null,
        fileSize: normalizeNumber(r.file_size),
        sha256: r.sha256 != null ? String(r.sha256) : null,
        storageRef: r.storage_ref != null ? String(r.storage_ref) : null,
        active: !!r.active,
        notes: r.notes != null ? String(r.notes) : null,
        createdAt: normalizeIso(r.created_at ?? null),
        updatedAt: normalizeIso(r.updated_at ?? null),
        source: "INTL",
      });
    }
    if (!data || data.length < take) break;
  }

  return { rows, total };
}

async function proxyFetch(
  origin: string,
  source: DataSource,
  query: { platform?: string | null; q?: string | null; page: number; pageSize: number },
  token?: string | null
): Promise<ReleasesResponse> {
  const secret = getProxySecret();
  if (!secret) {
    throw new Error("未配置 ADMIN_PROXY_SECRET，无法跨环境代理查询");
  }
  const search = new URLSearchParams();
  search.set("source", source);
  search.set("page", String(query.page));
  search.set("pageSize", String(query.pageSize));
  if (query.platform) search.set("platform", query.platform);
  if (query.q) search.set("q", query.q);
  return await proxyAdminJsonFetch<ReleasesResponse>({
    origin,
    pathWithQuery: `/api/admin/releases?${search.toString()}`,
    token,
  });
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = parseSource(request.nextUrl.searchParams.get("source"));
  const platform = normalizeQueryText(request.nextUrl.searchParams.get("platform"));
  const q = normalizeQueryText(request.nextUrl.searchParams.get("q"));

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
  ): Promise<{ rows: ReleaseRow[]; total: number }> => {
    const isCN = which === "CN";
    const hasConfig = isCN ? hasCnDbConfig() : hasIntlDbConfig();
    const origin = isCN ? cnOrigin : intlOrigin;
    const proxySecret = getProxySecret();
    const canProxy = !internalProxy && !!origin && !!proxySecret;

    const safeProxy = async (): Promise<{ rows: ReleaseRow[]; total: number }> => {
      try {
        const proxied = await proxyFetch(
          origin,
          which,
          {
            platform,
            q,
            page: Math.floor(skip / Math.max(1, limit)) + 1,
            pageSize: limit,
          },
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
      const listRes = await Promise.allSettled([
        isCN ? fetchCnReleases({ skip, limit, platform, q }) : fetchIntlReleases({ skip, limit, platform, q }),
      ]);

      if (listRes[0]?.status === "fulfilled") {
        sources.push({ source: which, ok: true, mode: "direct" });
        return listRes[0].value;
      }

      sources.push({
        source: which,
        ok: false,
        mode: "direct",
        message:
          (listRes[0] as PromiseRejectedResult)?.reason?.message
            ? String((listRes[0] as PromiseRejectedResult).reason.message)
            : isCN
              ? "CloudBase 查询失败"
              : "Supabase 查询失败",
      });

      if (canProxy) return await safeProxy();
      return { rows: [], total: 0 };
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
        pagination: { page, pageSize, total: 0, totalPages: 0 },
        sources: [
          { source: "CN", ok: false, mode: "missing", message: `ALL 模式分页过深（page=${page}），请缩小页码或过滤条件` },
          { source: "INTL", ok: false, mode: "missing", message: `ALL 模式分页过深（page=${page}），请缩小页码或过滤条件` },
        ],
      } satisfies ReleasesResponse,
      { status: 400 }
    );
  }

  if (source === "CN") {
    const cn = await fetchSource("CN", from, pageSize);
    const totalPages = Math.ceil(cn.total / pageSize);
    return NextResponse.json({
      items: cn.rows,
      pagination: { page, pageSize, total: cn.total, totalPages },
      sources,
    } satisfies ReleasesResponse);
  }

  if (source === "INTL") {
    const intl = await fetchSource("INTL", from, pageSize);
    const totalPages = Math.ceil(intl.total / pageSize);
    return NextResponse.json({
      items: intl.rows,
      pagination: { page, pageSize, total: intl.total, totalPages },
      sources,
    } satisfies ReleasesResponse);
  }

  const [cn, intl] = await Promise.all([
    needCN ? fetchSource("CN", 0, requiredTake) : Promise.resolve({ rows: [], total: 0 }),
    needINTL ? fetchSource("INTL", 0, requiredTake) : Promise.resolve({ rows: [], total: 0 }),
  ]);

  const combined = [...cn.rows, ...intl.rows];
  combined.sort(sortByCreatedAtDesc);
  const items = combined.slice(from, from + pageSize);

  const total = cn.total + intl.total;
  const totalPages = Math.ceil(total / pageSize);

  return NextResponse.json({
    items,
    pagination: { page, pageSize, total, totalPages },
    sources,
  } satisfies ReleasesResponse);
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = normalizeQueryText(request.nextUrl.searchParams.get("id"));
  const source = parseSource(request.nextUrl.searchParams.get("source"));
  if (!id || (source !== "CN" && source !== "INTL")) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  const internalProxy = isInternalProxyRequest(request);
  const cnOrigin = process.env.CN_APP_ORIGIN || "";
  const intlOrigin = process.env.INTL_APP_ORIGIN || "";
  const proxySecret = getProxySecret();
  const cookieToken = request.cookies.get(getAdminSessionCookieName())?.value || null;

  const doProxy = async (): Promise<NextResponse> => {
    const origin = source === "CN" ? cnOrigin : intlOrigin;
    if (!origin || !proxySecret || internalProxy) {
      return NextResponse.json({ error: "Missing proxy config" }, { status: 400 });
    }
    const headers: Record<string, string> = {
      "x-admin-proxy-hop": "1",
      "x-admin-proxy-secret": proxySecret,
    };
    if (cookieToken) headers["cookie"] = `${getAdminSessionCookieName()}=${cookieToken}`;
    const url = new URL(`${origin.replace(/\/$/, "")}/api/admin/releases`);
    url.searchParams.set("source", source);
    url.searchParams.set("id", id);
    const res = await fetch(url.toString(), { method: "DELETE", headers, cache: "no-store" });
    const text = await res.text().catch(() => "");
    return new NextResponse(text || null, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "text/plain" } });
  };

  if (source === "CN") {
    if (!hasCnDbConfig()) {
      return await doProxy();
    }
    const db = getCloudBaseDatabase();
    const collection = db.collection("releases");
    try {
      await collection.doc(id).remove();
      return NextResponse.json({ ok: true });
    } catch {
      const cmd = getDbCommand();
      await collection.where(cmd.or([{ id }, { _id: id }]) as any).remove();
      return NextResponse.json({ ok: true });
    }
  }

  if (!hasIntlDbConfig()) {
    return await doProxy();
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("releases").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
