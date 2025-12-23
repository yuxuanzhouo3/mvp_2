/**
 * CloudBase文件下载服务
 * 用于CN环境从腾讯云CloudBase存储桶下载应用安装包
 */

import cloudbase from "@cloudbase/node-sdk";

/**
 * 初始化CloudBase实例
 */
function initCloudBase() {
  const env = process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID;
  const secretId = process.env.CLOUDBASE_SECRET_ID;
  const secretKey = process.env.CLOUDBASE_SECRET_KEY;

  if (!env) {
    throw new Error(
      "服务器配置错误：缺少 NEXT_PUBLIC_WECHAT_CLOUDBASE_ID 环境变量"
    );
  }

  if (!secretId || !secretKey) {
    throw new Error(
      "服务器配置错误：缺少 CLOUDBASE_SECRET_ID 或 CLOUDBASE_SECRET_KEY 环境变量"
    );
  }

  try {
    return cloudbase.init({
      env,
      secretId,
      secretKey,
    });
  } catch (error) {
    console.error("CloudBase初始化失败:", error);
    throw new Error(
      `CloudBase 初始化失败，请检查环境变量配置是否正确: ${
        error instanceof Error ? error.message : "未知错误"
      }`
    );
  }
}

/**
 * 从CloudBase下载文件
 * @param fileID - CloudBase文件ID，格式: cloud://bucket-name/path/to/file
 * @returns 文件内容Buffer
 */
export async function downloadFileFromCloudBase(
  fileID: string
): Promise<Buffer> {
  if (!fileID) {
    throw new Error("文件ID不能为空");
  }

  if (!fileID.startsWith("cloud://")) {
    throw new Error(
      `无效的文件ID格式: ${fileID}。正确格式应为: cloud://bucket-name/path/to/file`
    );
  }

  console.log(`[CloudBase Download] 开始下载文件: ${fileID}`);

  let app: ReturnType<typeof cloudbase.init>;
  try {
    app = initCloudBase();
  } catch (error) {
    console.error("[CloudBase Download] 初始化失败:", error);
    throw error;
  }

  try {
    const startTime = Date.now();

    // 使用CloudBase SDK下载文件
    const result = await app.downloadFile({
      fileID: fileID,
    });

    const duration = Date.now() - startTime;
    const fileSize = result.fileContent?.length || 0;

    console.log(
      `[CloudBase Download] 下载成功: ${fileID}, 大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB, 耗时: ${duration}ms`
    );

    if (!result.fileContent) {
      throw new Error("下载的文件内容为空");
    }

    return result.fileContent;
  } catch (error: any) {
    console.error(`[CloudBase Download] 下载失败: ${fileID}`, error);

    // 详细的错误处理
    if (error?.code === "STORAGE_FILE_NONEXIST" || error?.message?.includes("404") || error?.message?.includes("not found")) {
      throw new Error(
        `文件不存在（fileID: ${fileID}），请检查 fileID 配置是否正确`
      );
    }

    if (error?.code === "STORAGE_REQUEST_EXPIRED" || error?.message?.includes("403") || error?.message?.includes("permission denied")) {
      throw new Error(
        `无权限访问该文件（fileID: ${fileID}），请检查 CloudBase 配置和权限设置`
      );
    }

    if (error?.code === "ETIMEDOUT" || error?.code === "ESOCKETTIMEDOUT" || error?.message?.includes("timeout")) {
      throw new Error(
        `文件下载超时（fileID: ${fileID}），请稍后重试或检查网络连接`
      );
    }

    // 通用错误
    throw new Error(
      `CloudBase文件下载失败: ${error?.message || "未知错误"}。fileID: ${fileID}`
    );
  }
}

/**
 * 获取CloudBase文件的公开访问URL（如果文件是公开的）
 * @param fileID - CloudBase文件ID
 * @returns 文件访问URL
 */
export async function getCloudBaseFileUrl(fileID: string): Promise<string> {
  if (!fileID) {
    throw new Error("文件ID不能为空");
  }

  console.log(`[CloudBase] 获取文件URL: ${fileID}`);

  try {
    const app = initCloudBase();
    const result = await app.getTempFileURL({
      fileList: [fileID],
    });

    if (result.fileList && result.fileList.length > 0) {
      const fileInfo = result.fileList[0];
      if (fileInfo.tempFileURL) {
        console.log(`[CloudBase] 获取临时URL成功: ${fileInfo.tempFileURL}`);
        return fileInfo.tempFileURL;
      }
    }

    throw new Error("无法获取文件URL");
  } catch (error) {
    console.error(`[CloudBase] 获取文件URL失败: ${fileID}`, error);
    throw new Error(
      `获取CloudBase文件URL失败: ${
        error instanceof Error ? error.message : "未知错误"
      }`
    );
  }
}
