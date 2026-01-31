import { NextRequest } from "next/server";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin/session";

export type AdminDataSource = "CN" | "INTL";

export function hasCnDbConfig(): boolean {
  return !!(
    process.env["NEXT_PUBLIC_WECHAT_CLOUDBASE_ID"] &&
    process.env["CLOUDBASE_SECRET_ID"] &&
    process.env["CLOUDBASE_SECRET_KEY"]
  );
}

export function hasIntlDbConfig(): boolean {
  const url = process.env["SUPABASE_URL"] || process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
  const key =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    "";
  return Boolean(url && key);
}

export function getAdminProxySecret(): string | null {
  return process.env["ADMIN_PROXY_SECRET"] || process.env["AI_STATS_PROXY_SECRET"] || null;
}

export function isInternalAdminProxyRequest(request: NextRequest): boolean {
  const hop = request.headers.get("x-admin-proxy-hop");
  const secret = request.headers.get("x-admin-proxy-secret");
  const expected = getAdminProxySecret();
  return hop === "1" && !!expected && secret === expected;
}

export async function isAdminAuthorized(request: NextRequest): Promise<boolean> {
  if (isInternalAdminProxyRequest(request)) return true;
  const token = request.cookies.get(getAdminSessionCookieName())?.value;
  const session = await verifyAdminSessionToken(token);
  return !!session;
}

export function getAdminSessionToken(request: NextRequest): string | null {
  return request.cookies.get(getAdminSessionCookieName())?.value || null;
}

export async function proxyAdminJsonFetch<T>(params: {
  origin: string;
  pathWithQuery: string;
  token?: string | null;
}): Promise<T> {
  const secret = getAdminProxySecret();
  const headers: Record<string, string> = {};
  if (secret) {
    headers["x-admin-proxy-hop"] = "1";
    headers["x-admin-proxy-secret"] = secret;
  }
  if (params.token) {
    headers["cookie"] = `${getAdminSessionCookieName()}=${params.token}`;
  }

  const url = `${params.origin.replace(/\/$/, "")}${params.pathWithQuery}`;
  const controller = new AbortController();
  const timeoutMs = 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
  } catch (e: any) {
    const causeCode = e?.cause?.code ? String(e.cause.code) : "";
    const causeMessage = e?.cause?.message ? String(e.cause.message) : "";
    const detail = [causeCode, causeMessage].filter(Boolean).join(": ");
    throw new Error(
      `Proxy fetch failed${detail ? ` (${detail})` : ""}: ${params.origin}${params.pathWithQuery}`
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Proxy failed: HTTP ${res.status}`);
  return (await res.json()) as T;
}
