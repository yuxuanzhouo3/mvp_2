/**
 * Supabase Storage文件下载服务
 * 用于INTL环境从Supabase Storage存储桶下载应用安装包
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * 初始化Supabase客户端
 */
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "服务器配置错误：缺少 NEXT_PUBLIC_SUPABASE_URL 环境变量"
    );
  }

  if (!supabaseServiceKey) {
    throw new Error(
      "服务器配置错误：缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量"
    );
  }

  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (error) {
    console.error("Supabase客户端初始化失败:", error);
    throw new Error(
      `Supabase 初始化失败: ${
        error instanceof Error ? error.message : "未知错误"
      }`
    );
  }
}

/**
 * 从Supabase Storage下载文件
 * @param bucketName - 存储桶名称，例如: "downloads"
 * @param filePath - 文件路径，例如: "apps/android/RandomLife.apk"
 * @returns 文件内容Buffer
 */
export async function downloadFileFromSupabase(
  bucketName: string,
  filePath: string
): Promise<Buffer> {
  if (!bucketName) {
    throw new Error("存储桶名称不能为空");
  }

  if (!filePath) {
    throw new Error("文件路径不能为空");
  }

  console.log(
    `[Supabase Download] 开始下载文件: bucket=${bucketName}, path=${filePath}`
  );

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseClient();
  } catch (error) {
    console.error("[Supabase Download] 初始化失败:", error);
    throw error;
  }

  try {
    const startTime = Date.now();

    // 从Supabase Storage下载文件
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("下载的文件内容为空");
    }

    // 将Blob转换为Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const duration = Date.now() - startTime;
    const fileSize = buffer.length;

    console.log(
      `[Supabase Download] 下载成功: ${filePath}, 大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB, 耗时: ${duration}ms`
    );

    return buffer;
  } catch (error: any) {
    console.error(
      `[Supabase Download] 下载失败: bucket=${bucketName}, path=${filePath}`,
      error
    );

    // 详细的错误处理
    if (
      error?.message?.includes("Object not found") ||
      error?.message?.includes("404")
    ) {
      throw new Error(
        `文件不存在（bucket: ${bucketName}, path: ${filePath}），请检查文件路径配置是否正确`
      );
    }

    if (
      error?.message?.includes("permission") ||
      error?.message?.includes("403") ||
      error?.message?.includes("Unauthorized")
    ) {
      throw new Error(
        `无权限访问该文件（bucket: ${bucketName}, path: ${filePath}），请检查 Supabase Storage 权限设置`
      );
    }

    if (
      error?.code === "ETIMEDOUT" ||
      error?.code === "ESOCKETTIMEDOUT" ||
      error?.message?.includes("timeout")
    ) {
      throw new Error(
        `文件下载超时（bucket: ${bucketName}, path: ${filePath}），请稍后重试或检查网络连接`
      );
    }

    // 通用错误
    throw new Error(
      `Supabase文件下载失败: ${error?.message || "未知错误"}。bucket: ${bucketName}, path: ${filePath}`
    );
  }
}

/**
 * 获取Supabase Storage文件的公开访问URL
 * @param bucketName - 存储桶名称
 * @param filePath - 文件路径
 * @returns 文件访问URL
 */
export function getSupabaseFileUrl(
  bucketName: string,
  filePath: string
): string {
  if (!bucketName || !filePath) {
    throw new Error("存储桶名称和文件路径不能为空");
  }

  console.log(
    `[Supabase] 生成文件URL: bucket=${bucketName}, path=${filePath}`
  );

  try {
    const supabase = getSupabaseClient();
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);

    if (data?.publicUrl) {
      console.log(`[Supabase] 生成URL成功: ${data.publicUrl}`);
      return data.publicUrl;
    }

    throw new Error("无法生成文件URL");
  } catch (error) {
    console.error(
      `[Supabase] 生成文件URL失败: bucket=${bucketName}, path=${filePath}`,
      error
    );
    throw new Error(
      `获取Supabase文件URL失败: ${
        error instanceof Error ? error.message : "未知错误"
      }`
    );
  }
}

/**
 * 获取Supabase Storage文件的临时签名URL（用于私有文件）
 * @param bucketName - 存储桶名称
 * @param filePath - 文件路径
 * @param expiresIn - URL过期时间（秒），默认3600秒（1小时）
 * @returns 临时访问URL
 */
export async function getSupabaseSignedUrl(
  bucketName: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!bucketName || !filePath) {
    throw new Error("存储桶名称和文件路径不能为空");
  }

  console.log(
    `[Supabase] 生成签名URL: bucket=${bucketName}, path=${filePath}, expiresIn=${expiresIn}s`
  );

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      throw error;
    }

    if (data?.signedUrl) {
      console.log(`[Supabase] 生成签名URL成功`);
      return data.signedUrl;
    }

    throw new Error("无法生成签名URL");
  } catch (error) {
    console.error(
      `[Supabase] 生成签名URL失败: bucket=${bucketName}, path=${filePath}`,
      error
    );
    throw new Error(
      `获取Supabase签名URL失败: ${
        error instanceof Error ? error.message : "未知错误"
      }`
    );
  }
}
