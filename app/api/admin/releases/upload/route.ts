import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin/session";
import { getCloudBaseApp, getCloudBaseDatabase, getDbCommand } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import {
  getDeploymentAdminSource,
  isAdminSourceAllowedInDeployment,
} from "@/lib/admin/deployment-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DataSource = "CN" | "INTL";
type PlatformType = "android" | "ios" | "windows" | "macos" | "linux";
type MacOSArchType = "intel" | "apple-silicon";
const SUPABASE_BUCKET = "downloads";

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

function hasCnConfig(): boolean {
  return !!(
    process.env["NEXT_PUBLIC_WECHAT_CLOUDBASE_ID"] &&
    process.env["CLOUDBASE_SECRET_ID"] &&
    process.env["CLOUDBASE_SECRET_KEY"]
  );
}

function hasIntlConfig(): boolean {
  const url = process.env["SUPABASE_URL"] || process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
  return Boolean(url && serviceRoleKey);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : value != null ? String(value).trim() : "";
}

function normalizeArch(value: unknown): string | null {
  const v = normalizeText(value);
  return v ? v : null;
}

function normalizePlatform(value: unknown): PlatformType | null {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return null;
  if (["android"].includes(raw)) return "android";
  if (["ios", "iphone", "ipad"].includes(raw)) return "ios";
  if (["windows", "win", "win32", "win64"].includes(raw)) return "windows";
  if (["macos", "mac", "darwin", "osx", "mac-os"].includes(raw)) return "macos";
  if (["linux"].includes(raw)) return "linux";
  return null;
}

function normalizeMacArch(value: unknown): MacOSArchType | null {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return null;
  const normalized = raw.replaceAll("_", "-").replaceAll(" ", "-");
  if (
    [
      "apple-silicon",
      "applesilicon",
      "arm",
      "arm64",
      "aarch64",
      "m1",
      "m2",
      "m3",
    ].includes(normalized)
  ) {
    return "apple-silicon";
  }
  if (["intel", "x64", "x86-64", "amd64", "x86_64"].includes(normalized)) {
    return "intel";
  }
  return null;
}

function normalizeBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = normalizeText(value).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function sanitizePathPart(part: string): string {
  const cleaned = part.replaceAll("\\", "/").replaceAll("..", ".").replaceAll("\u0000", "");
  return cleaned
    .split("/")
    .filter((s) => !!s && s !== "." && s !== "..")
    .join("/")
    .replaceAll(/[^\w.\-()/]+/g, "_");
}

function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function normalizeFileSize(value: unknown): number | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function normalizeSha256(value: unknown): string | null {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return null;
  if (!/^[a-f0-9]{64}$/.test(raw)) return null;
  return raw;
}

function buildIntlObjectPath(platform: PlatformType, version: string, originalName: string): string {
  return sanitizePathPart(
    `${platform}/${sanitizePathPart(version)}/${Date.now()}_${sanitizePathPart(originalName)}`
  );
}

function parseSupabaseStorageRef(storageRef: string): { bucket: string; objectPath: string } | null {
  if (!storageRef.startsWith("supabase://")) return null;
  const withoutScheme = storageRef.slice("supabase://".length);
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex <= 0 || slashIndex >= withoutScheme.length - 1) return null;
  const bucket = withoutScheme.slice(0, slashIndex).trim();
  const objectPath = sanitizePathPart(withoutScheme.slice(slashIndex + 1));
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

async function proxyUpload(request: NextRequest, target: DataSource, form: FormData): Promise<NextResponse> {
  const secret = getProxySecret();
  const cnOrigin = process.env["CN_APP_ORIGIN"] || "";
  const intlOrigin = process.env["INTL_APP_ORIGIN"] || "";
  const origin = target === "CN" ? cnOrigin : intlOrigin;
  if (!secret || !origin) {
    return NextResponse.json({ error: "Missing proxy config" }, { status: 400 });
  }

  const cookieToken = request.cookies.get(getAdminSessionCookieName())?.value || null;
  const headers: Record<string, string> = {
    "x-admin-proxy-hop": "1",
    "x-admin-proxy-secret": secret,
  };
  if (cookieToken) headers["cookie"] = `${getAdminSessionCookieName()}=${cookieToken}`;

  const url = new URL(`${origin.replace(/\/$/, "")}/api/admin/releases/upload`);
  const res = await fetch(url.toString(), { method: "POST", headers, body: form, cache: "no-store" });
  const text = await res.text().catch(() => "");
  return new NextResponse(text || null, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "text/plain" } });
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceRaw = normalizeText(request.nextUrl.searchParams.get("source"));
  if (sourceRaw && !isAdminSourceAllowedInDeployment(sourceRaw)) {
    return NextResponse.json(
      { error: `当前部署仅允许 source=${getDeploymentAdminSource()}` },
      { status: 400 }
    );
  }

  const source: DataSource = getDeploymentAdminSource();
  if (source !== "INTL") {
    return NextResponse.json({ error: "Signed upload is only supported in INTL deployment" }, { status: 400 });
  }
  if (!hasIntlConfig()) {
    return NextResponse.json({ error: "INTL storage is not configured" }, { status: 500 });
  }

  const version = normalizeText(request.nextUrl.searchParams.get("version"));
  const platform = normalizePlatform(request.nextUrl.searchParams.get("platform"));
  const fileName = normalizeText(request.nextUrl.searchParams.get("fileName")) || "file";
  if (!version || !platform) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  const objectPath = buildIntlObjectPath(platform, version, fileName);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .createSignedUploadUrl(objectPath, { upsert: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const token = data?.token ? String(data.token) : "";
  const signedPath = data?.path ? sanitizePathPart(String(data.path)) : objectPath;
  if (!token || !signedPath) {
    return NextResponse.json({ error: "Failed to create signed upload token" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    source,
    bucket: SUPABASE_BUCKET,
    objectPath: signedPath,
    token,
    storageRef: `supabase://${SUPABASE_BUCKET}/${signedPath}`,
  });
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const internalProxy = isInternalProxyRequest(request);
  const form = await request.formData();

  const sourceRaw = normalizeText(form.get("source"));
  if (sourceRaw && !isAdminSourceAllowedInDeployment(sourceRaw)) {
    return NextResponse.json(
      { error: `当前部署仅允许 source=${getDeploymentAdminSource()}` },
      { status: 400 }
    );
  }
  const source: DataSource = getDeploymentAdminSource();
  const version = normalizeText(form.get("version"));
  const platform = normalizePlatform(form.get("platform"));
  const archInput = normalizeArch(form.get("arch"));
  const arch = platform === "macos" ? normalizeMacArch(archInput) : null;
  const notes = normalizeText(form.get("notes")) || null;
  const active = normalizeBool(form.get("active"));
  const uploadFile = form.get("file");
  const file = uploadFile instanceof File ? uploadFile : null;
  const providedStorageRef = normalizeText(form.get("storageRef")) || null;
  const providedFileName = normalizeText(form.get("fileName")) || null;
  const providedFileSize = normalizeFileSize(form.get("fileSize"));
  const providedSha256 = normalizeSha256(form.get("sha256"));
  const hasDirectUploadMeta = !!providedStorageRef && !!providedFileName && providedFileSize != null;

  if (!version || !platform || (!file && !hasDirectUploadMeta)) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  if (platform === "macos" && archInput && !arch) {
    return NextResponse.json({ error: "Invalid macOS arch" }, { status: 400 });
  }

  if (source === "CN" && !file) {
    return NextResponse.json({ error: "CN upload requires file data" }, { status: 400 });
  }

  if (source === "CN" && !hasCnConfig()) {
    if (internalProxy) return NextResponse.json({ error: "Internal proxy cannot re-proxy" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "CN upload requires file data" }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    const forwarded = new FormData();
    forwarded.set("source", "CN");
    forwarded.set("version", version);
    forwarded.set("platform", platform);
    forwarded.set("arch", arch || "");
    forwarded.set("notes", notes || "");
    forwarded.set("active", active ? "true" : "false");
    forwarded.set("file", new Blob([buf], { type: file.type || "application/octet-stream" }), file.name || "file");
    return await proxyUpload(request, "CN", forwarded);
  }

  if (source === "INTL" && !hasIntlConfig()) {
    if (internalProxy) return NextResponse.json({ error: "Internal proxy cannot re-proxy" }, { status: 400 });
    const forwarded = new FormData();
    forwarded.set("source", "INTL");
    forwarded.set("version", version);
    forwarded.set("platform", platform);
    forwarded.set("arch", arch || "");
    forwarded.set("notes", notes || "");
    forwarded.set("active", active ? "true" : "false");
    if (file) {
      const buf = Buffer.from(await file.arrayBuffer());
      forwarded.set("file", new Blob([buf], { type: file.type || "application/octet-stream" }), file.name || "file");
    } else {
      forwarded.set("storageRef", providedStorageRef!);
      forwarded.set("fileName", providedFileName!);
      forwarded.set("fileSize", String(providedFileSize!));
      if (providedSha256) forwarded.set("sha256", providedSha256);
    }
    return await proxyUpload(request, "INTL", forwarded);
  }

  let buf: Buffer | null = null;
  let size = providedFileSize ?? 0;
  let sha256 = providedSha256;
  let originalName = providedFileName || "file";
  if (file) {
    buf = Buffer.from(await file.arrayBuffer());
    size = buf.byteLength;
    sha256 = sha256Hex(buf);
    originalName = normalizeText(file.name) || "file";
  }
  const nowIso = new Date().toISOString();

  if (source === "CN") {
    if (!buf) return NextResponse.json({ error: "CN upload requires file data" }, { status: 400 });
    const cloudPath = sanitizePathPart(
      `downloads/${platform}/${sanitizePathPart(version)}/${Date.now()}_${sanitizePathPart(originalName)}`
    );
    const app = getCloudBaseApp();
    const uploadRes: any = await (app as any).uploadFile({
      cloudPath,
      fileContent: buf,
    });
    const fileID = uploadRes?.fileID ? String(uploadRes.fileID) : uploadRes?.fileId ? String(uploadRes.fileId) : "";
    if (!fileID) {
      return NextResponse.json({ error: "CloudBase upload failed" }, { status: 500 });
    }

    const db = getCloudBaseDatabase();
    const collection = db.collection("releases");
    const addRes: any = await collection.add({
      version,
      platform,
      arch,
      file_name: originalName,
      file_size: size,
      sha256,
      storage_ref: fileID,
      active,
      notes,
      created_at: nowIso,
      updated_at: nowIso,
    });
    const id = String(addRes?.id ?? addRes?._id ?? "");

    if (active) {
      const cmd = getDbCommand();
      const where: any = { platform };
      if (arch == null) where.arch = cmd.in([null, ""]);
      else where.arch = arch;
      await collection.where(where).update({ active: false, updated_at: nowIso });
      if (id) {
        try {
          await collection.doc(id).update({ active: true, updated_at: nowIso });
        } catch {}
      }
    }

    return NextResponse.json({
      ok: true,
      source,
      id,
      version,
      platform,
      arch,
      fileName: originalName,
      fileSize: size,
      sha256,
      storageRef: fileID,
      active,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  let storageRef = "";
  const supabase = getSupabaseAdmin();
  if (buf) {
    const objectPath = buildIntlObjectPath(platform, version, originalName);
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(objectPath, buf, { contentType: file?.type || "application/octet-stream", upsert: true });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    storageRef = `supabase://${SUPABASE_BUCKET}/${objectPath}`;
  } else {
    const parsedStorageRef = parseSupabaseStorageRef(providedStorageRef!);
    if (!parsedStorageRef || parsedStorageRef.bucket !== SUPABASE_BUCKET) {
      return NextResponse.json({ error: "Invalid storageRef" }, { status: 400 });
    }
    storageRef = `supabase://${parsedStorageRef.bucket}/${parsedStorageRef.objectPath}`;
  }

  const insertPayload: any = {
    version,
    platform,
    arch,
    file_name: originalName,
    file_size: size,
    sha256,
    storage_ref: storageRef,
    active,
    notes,
    created_at: nowIso,
    updated_at: nowIso,
  };
  const { data, error: insertError } = await supabase.from("releases").insert(insertPayload).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const id = data?.id ? String(data.id) : "";

  if (active && id) {
    let q = supabase.from("releases").update({ active: false, updated_at: nowIso }).eq("platform", platform).neq("id", id);
    if (arch == null) q = q.is("arch", null);
    else q = q.eq("arch", arch);
    await q;
    await supabase.from("releases").update({ active: true, updated_at: nowIso }).eq("id", id);
  }

  return NextResponse.json({
    ok: true,
    source,
    id,
    version,
    platform,
    arch,
    fileName: originalName,
    fileSize: size,
    sha256,
    storageRef,
    active,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}
