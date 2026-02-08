/**
 * 应用下载API路由
 * 处理不同平台的应用下载请求
 * - CN环境: 从CloudBase下载文件并返回二进制内容
 * - INTL环境: 从Supabase Storage下载或重定向到外部URL
 */

import { NextRequest, NextResponse } from "next/server";
import {
  PlatformType,
  MacOSArchType,
  getDownloadConfig,
} from "@/lib/config/download.config";
import { getCloudBaseDatabase } from "@/lib/database/cloudbase-client";
import { getSupabaseAdmin } from "@/lib/integrations/supabase-admin";
import { downloadFileFromCloudBase } from "@/lib/services/cloudbase-download";
import { downloadFileFromSupabase } from "@/lib/services/supabase-download";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 文件MIME类型映射
 */
const MIME_TYPES: Record<string, string> = {
  apk: "application/vnd.android.package-archive",
  ipa: "application/octet-stream",
  exe: "application/x-msdownload",
  msi: "application/x-msi",
  dmg: "application/x-apple-diskimage",
  AppImage: "application/x-executable",
  deb: "application/x-debian-package",
  rpm: "application/x-rpm",
};

/**
 * 根据文件名获取MIME类型
 */
function getMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return MIME_TYPES[extension || ""] || "application/octet-stream";
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

type DbReleaseRow = {
  platform: string | null;
  arch: string | null;
  fileName: string | null;
  storageRef: string | null;
};

function normalizeDbRow(raw: any): DbReleaseRow {
  const platform = raw?.platform != null ? String(raw.platform) : null;
  const arch = raw?.arch != null ? String(raw.arch) : null;
  const fileName =
    raw?.file_name != null ? String(raw.file_name) : raw?.fileName != null ? String(raw.fileName) : null;
  const storageRef =
    raw?.storage_ref != null
      ? String(raw.storage_ref)
      : raw?.storageRef != null
        ? String(raw.storageRef)
        : raw?.file_id != null
          ? String(raw.file_id)
          : raw?.fileId != null
            ? String(raw.fileId)
            : null;
  return { platform, arch, fileName, storageRef };
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

async function findActiveReleaseFromDb(params: {
  region: "CN" | "INTL";
  platform: PlatformType;
  arch?: MacOSArchType;
}): Promise<DbReleaseRow | null> {
  const wantArch = params.arch || null;
  const isMac = params.platform === "macos";

  if (params.region === "CN") {
    if (!hasCnDbConfig()) return null;
    const db = getCloudBaseDatabase();
    const collection = db.collection("releases");
    let listRes: any;
    try {
      listRes = await collection
        .where({ platform: params.platform, active: true })
        .orderBy("created_at", "desc")
        .limit(50)
        .get();
    } catch {
      listRes = await collection
        .where({ platform: params.platform, active: true })
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
    }
    const rows = (listRes?.data || []).map(normalizeDbRow);

    const pick = (candidateArch: string | null): DbReleaseRow | null => {
      for (const r of rows) {
        if (!r.storageRef) continue;
        const a = (r.arch || "").trim();
        if (candidateArch == null) {
          if (!a) return r;
        } else {
          if (a === candidateArch) return r;
        }
      }
      return null;
    };

    if (isMac) {
      if (wantArch) return pick(wantArch);
      return pick("apple-silicon") || pick("intel") || pick(null);
    }
    return pick(null);
  }

  if (!hasIntlDbConfig()) return null;
  const supabase = getSupabaseAdmin();
  const q = supabase
    .from("releases")
    .select("platform,arch,file_name,storage_ref,active,created_at")
    .eq("platform", params.platform)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(50);
  const { data, error } = await q;
  if (error) return null;
  const rows = (data || []).map(normalizeDbRow);

  const pick = (candidateArch: string | null): DbReleaseRow | null => {
    for (const r of rows) {
      if (!r.storageRef) continue;
      const a = (r.arch || "").trim();
      if (candidateArch == null) {
        if (!a) return r;
      } else {
        if (a === candidateArch) return r;
      }
    }
    return null;
  };

  if (isMac) {
    if (wantArch) return pick(wantArch);
    return pick("apple-silicon") || pick("intel") || pick(null);
  }
  return pick(null);
}

/**
 * GET /api/downloads
 * 查询参数:
 * - platform: android | ios | windows | macos | linux
 * - region: CN | INTL
 * - arch: intel | apple-silicon (仅用于macOS)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") as PlatformType | null;
    const region = (searchParams.get("region") as "CN" | "INTL") || "CN";
    const arch = searchParams.get("arch") as MacOSArchType | undefined;

    // 参数验证
    if (!platform) {
      return NextResponse.json(
        { error: "缺少必需参数: platform" },
        { status: 400 }
      );
    }

    const validPlatforms: PlatformType[] = [
      "android",
      "ios",
      "windows",
      "macos",
      "linux",
    ];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: `无效的平台: ${platform}` },
        { status: 400 }
      );
    }

    console.log(
      `[Download API] 收到下载请求: platform=${platform}, region=${region}, arch=${arch}`
    );

    // 根据区域处理下载
    if (region === "CN") {
      return await handleChinaDownload(platform, arch);
    } else {
      return await handleIntlDownload(platform, arch);
    }
  } catch (error) {
    console.error("[Download API] 处理请求失败:", error);
    return NextResponse.json(
      {
        error: "服务器内部错误",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

/**
 * 处理CN环境的下载请求（CloudBase）
 */
async function handleChinaDownload(
  platform: PlatformType,
  arch?: MacOSArchType
): Promise<NextResponse> {
  try {
    const active = await findActiveReleaseFromDb({ region: "CN", platform, arch });
    if (active?.storageRef) {
      const fileID = active.storageRef;
      const fileContent = await downloadFileFromCloudBase(fileID);
      const fileName = active.fileName || `download-${platform}`;
      const mimeType = getMimeType(fileName);
      return new NextResponse(toArrayBuffer(fileContent), {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
          "Content-Length": fileContent.length.toString(),
          "Cache-Control": "public, max-age=604800",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const config = getDownloadConfig("CN");

    // 查找对应的下载配置
    let download = config.downloads.find((d) => {
      if (platform === "macos" && arch) {
        return d.platform === platform && d.arch === arch;
      }
      return d.platform === platform && !d.arch;
    });

    // 如果是macOS但没有指定架构，默认使用Apple Silicon
    if (platform === "macos" && !download) {
      download = config.downloads.find(
        (d) => d.platform === "macos" && d.arch === "apple-silicon"
      );
    }

    if (!download) {
      return NextResponse.json(
        { error: `找不到平台 ${platform} 的下载配置` },
        { status: 404 }
      );
    }

    // 检查平台是否可用
    if (download.available === false) {
      return NextResponse.json(
        {
          error: `该平台尚未上线`,
          message: "尚未上线，敬请期待！",
          platform
        },
        { status: 503 } // Service Unavailable
      );
    }

    if (!download.fileID) {
      return NextResponse.json(
        { error: `平台 ${platform} 未配置 CloudBase fileID` },
        { status: 500 }
      );
    }

    console.log(
      `[CN Download] 从CloudBase下载: fileID=${download.fileID}, fileName=${download.fileName}`
    );

    // 从CloudBase下载文件
    const fileContent = await downloadFileFromCloudBase(download.fileID);

    // 返回文件内容
    const fileName = download.fileName || `download-${platform}`;
    const mimeType = getMimeType(fileName);

    return new NextResponse(toArrayBuffer(fileContent), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": fileContent.length.toString(),
        "Cache-Control": "public, max-age=604800", // 缓存7天
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[CN Download] 下载失败:", error);

    return NextResponse.json(
      {
        error: "文件下载失败",
        message: error instanceof Error ? error.message : "未知错误",
        region: "CN",
        platform,
      },
      { status: 500 }
    );
  }
}

/**
 * 处理INTL环境的下载请求（Supabase或外部URL）
 */
async function handleIntlDownload(
  platform: PlatformType,
  arch?: MacOSArchType
): Promise<NextResponse> {
  try {
    const active = await findActiveReleaseFromDb({ region: "INTL", platform, arch });
    if (active?.storageRef) {
      const storageRef = active.storageRef;
      const fileName = active.fileName || `download-${platform}`;
      if (storageRef.startsWith("supabase://")) {
        const urlParts = storageRef.replace("supabase://", "").split("/");
        const bucketName = urlParts[0];
        const filePath = urlParts.slice(1).join("/");
        const fileContent = await downloadFileFromSupabase(bucketName, filePath);
        const mimeType = getMimeType(fileName);
        return new NextResponse(toArrayBuffer(fileContent), {
          status: 200,
          headers: {
            "Content-Type": mimeType,
            "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
            "Content-Length": fileContent.length.toString(),
            "Cache-Control": "public, max-age=604800",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      return NextResponse.redirect(storageRef, { status: 302 });
    }

    const config = getDownloadConfig("INTL");

    // 查找对应的下载配置
    let download = config.downloads.find((d) => {
      if (platform === "macos" && arch) {
        return d.platform === platform && d.arch === arch;
      }
      return d.platform === platform && !d.arch;
    });

    // 如果是macOS但没有指定架构，默认使用Apple Silicon
    if (platform === "macos" && !download) {
      download = config.downloads.find(
        (d) => d.platform === "macos" && d.arch === "apple-silicon"
      );
    }

    if (!download) {
      return NextResponse.json(
        { error: `找不到平台 ${platform} 的下载配置` },
        { status: 404 }
      );
    }

    // 检查平台是否可用
    if (download.available === false) {
      return NextResponse.json(
        {
          error: `该平台尚未上线`,
          message: "Coming Soon! Stay Tuned!",
          platform
        },
        { status: 503 } // Service Unavailable
      );
    }

    if (!download.url) {
      return NextResponse.json(
        { error: `平台 ${platform} 未配置下载URL` },
        { status: 500 }
      );
    }

    console.log(`[INTL Download] 重定向到: ${download.url}`);

    // 检查是否是Supabase Storage路径
    if (download.url.startsWith("supabase://")) {
      // 格式: supabase://bucket-name/path/to/file
      const urlParts = download.url.replace("supabase://", "").split("/");
      const bucketName = urlParts[0];
      const filePath = urlParts.slice(1).join("/");

      console.log(
        `[INTL Download] 从Supabase下载: bucket=${bucketName}, path=${filePath}`
      );

      // 从Supabase下载文件
      const fileContent = await downloadFileFromSupabase(bucketName, filePath);

      const fileName = download.fileName || filePath.split("/").pop() || `download-${platform}`;
      const mimeType = getMimeType(fileName);

      return new NextResponse(toArrayBuffer(fileContent), {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
          "Content-Length": fileContent.length.toString(),
          "Cache-Control": "public, max-age=604800", // 缓存7天
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // 对于外部URL（GitHub、App Store等），使用302重定向
    return NextResponse.redirect(download.url, { status: 302 });
  } catch (error) {
    console.error("[INTL Download] 下载失败:", error);

    return NextResponse.json(
      {
        error: "文件下载失败",
        message: error instanceof Error ? error.message : "未知错误",
        region: "INTL",
        platform,
      },
      { status: 500 }
    );
  }
}
