import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin/session";
import { getCloudBaseDatabase, getDbCommand } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";

export const dynamic = "force-dynamic";

type DataSource = "CN" | "INTL";

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

function hasCnConfig(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID &&
    process.env.CLOUDBASE_SECRET_ID &&
    process.env.CLOUDBASE_SECRET_KEY
  );
}

function hasIntlConfig(): boolean {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return Boolean(url && serviceRoleKey);
}

function normalizeBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = typeof value === "string" ? value.trim().toLowerCase() : value != null ? String(value).trim().toLowerCase() : "";
  return s === "1" || s === "true" || s === "yes";
}

async function proxyJson(request: NextRequest, target: DataSource, body: any): Promise<NextResponse> {
  const secret = getProxySecret();
  const cnOrigin = process.env.CN_APP_ORIGIN || "";
  const intlOrigin = process.env.INTL_APP_ORIGIN || "";
  const origin = target === "CN" ? cnOrigin : intlOrigin;
  if (!secret || !origin) {
    return NextResponse.json({ error: "Missing proxy config" }, { status: 400 });
  }

  const cookieToken = request.cookies.get(getAdminSessionCookieName())?.value || null;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-admin-proxy-hop": "1",
    "x-admin-proxy-secret": secret,
  };
  if (cookieToken) headers["cookie"] = `${getAdminSessionCookieName()}=${cookieToken}`;

  const url = new URL(`${origin.replace(/\/$/, "")}/api/admin/releases/active`);
  const res = await fetch(url.toString(), { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  const text = await res.text().catch(() => "");
  return new NextResponse(text || null, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "text/plain" } });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalProxy = isInternalProxyRequest(request);
  const json = await request.json().catch(() => null);
  const source: DataSource = String(json?.source || "").toUpperCase() === "INTL" ? "INTL" : "CN";
  const id = String(json?.id || "").trim();
  const active = normalizeBool(json?.active);

  if (!id) return NextResponse.json({ error: "Bad Request" }, { status: 400 });

  if (source === "CN") {
    if (!hasCnConfig()) {
      if (internalProxy) return NextResponse.json({ error: "Internal proxy cannot re-proxy" }, { status: 400 });
      return await proxyJson(request, "CN", { source: "CN", id, active });
    }

    const db = getCloudBaseDatabase();
    const collection = db.collection("releases");
    const nowIso = new Date().toISOString();

    if (!active) {
      try {
        await collection.doc(id).update({ active: false, updated_at: nowIso });
        return NextResponse.json({ ok: true });
      } catch {
        const cmd = getDbCommand();
        await collection.where(cmd.or([{ _id: id }, { id }]) as any).update({ active: false, updated_at: nowIso });
        return NextResponse.json({ ok: true });
      }
    }

    const docRes: any = await collection.doc(id).get().catch(async () => {
      const cmd = getDbCommand();
      const res = await collection.where(cmd.or([{ _id: id }, { id }]) as any).limit(1).get();
      return res;
    });
    const row = (docRes?.data && Array.isArray(docRes.data) ? docRes.data[0] : docRes?.data) || null;
    const platform = row?.platform != null ? String(row.platform) : "";
    const arch = row?.arch != null ? String(row.arch) : null;
    if (!platform) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const cmd = getDbCommand();
    const whereOthers: any = { platform };
    if (arch == null) whereOthers.arch = cmd.in([null, ""]);
    else whereOthers.arch = arch;
    await collection.where(whereOthers).update({ active: false, updated_at: nowIso });
    try {
      await collection.doc(id).update({ active: true, updated_at: nowIso });
    } catch {
      await collection.where(cmd.or([{ _id: id }, { id }]) as any).update({ active: true, updated_at: nowIso });
    }
    return NextResponse.json({ ok: true });
  }

  if (!hasIntlConfig()) {
    if (internalProxy) return NextResponse.json({ error: "Internal proxy cannot re-proxy" }, { status: 400 });
    return await proxyJson(request, "INTL", { source: "INTL", id, active });
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  if (!active) {
    const { error } = await supabase.from("releases").update({ active: false, updated_at: nowIso }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { data: row, error: loadError } = await supabase
    .from("releases")
    .select("id,platform,arch")
    .eq("id", id)
    .single();
  if (loadError || !row) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  let q = supabase
    .from("releases")
    .update({ active: false, updated_at: nowIso })
    .eq("platform", row.platform)
    .neq("id", id);
  if (row.arch == null) q = q.is("arch", null);
  else q = q.eq("arch", row.arch);
  await q;

  const { error: setError } = await supabase.from("releases").update({ active: true, updated_at: nowIso }).eq("id", id);
  if (setError) return NextResponse.json({ error: setError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
