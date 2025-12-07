/**
 * 区域配置管理
 *
 * 这个文件提供区域判断工具，实际的部署配置来自 deployment.config.ts
 */

import { currentRegion } from "./deployment.config";

export type Region = "CN" | "INTL";

/**
 * 延迟初始化部署区域，避免构建时访问环境变量
 */
let cachedRegion: Region | null = null;

function getDeployRegion(): Region {
  if (cachedRegion) {
    return cachedRegion;
  }

  // 从 deployment.config.ts 读取配置
  cachedRegion = currentRegion;

  return cachedRegion;
}

/**
 * 获取当前部署区域
 * 注意：这会在运行时动态获取，而不是在构建时
 */
export function getDEPLOY_REGION(): Region {
  return getDeployRegion();
}

/**
 * 导出当前区域作为命名导出（用于向后兼容）
 * 注意：这是一个常量，在编译时确定，不会动态改变
 */
export const DEPLOY_REGION: Region = getDeployRegion();

/**
 * 判断是否为中国区域
 */
export const isChinaRegion = (): boolean => {
  return getDeployRegion() === "CN";
};

/**
 * 判断是否为国际区域
 */
export const isInternationalRegion = (): boolean => {
  return getDeployRegion() === "INTL";
};

/**
 * 服务提供商配置
 */
export const RegionConfig = {
  /**
   * 认证服务提供商
   */
  auth: {
    provider: isChinaRegion() ? "cloudbase" : "supabase",
    features: {
      // 中国：支持邮箱 + 微信登录
      // 国际：支持邮箱 + Google + GitHub
      emailAuth: true, // 所有地区都支持邮箱认证
      wechatAuth: isChinaRegion(), // 只有中国支持微信
      googleAuth: !isChinaRegion(), // 只有国际支持 Google
      githubAuth: !isChinaRegion(), // 只有国际支持 GitHub
    },
  },

  /**
   * 数据库服务提供商
   */
  database: {
    provider: isChinaRegion() ? "cloudbase" : "supabase",
  },

  /**
   * 支付服务提供商
   */
  payment: {
    providers: isChinaRegion() ? ["alipay"] : ["paypal"],
    primary: isChinaRegion() ? "alipay" : "paypal",
  },
} as const;

/**
 * 环境变量验证
 */
export function validateRegionConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const region = getDeployRegion();
  if (!["CN", "INTL"].includes(region)) {
    errors.push(`Invalid deploy region: ${region}, must be CN or INTL`);
  }

  // 验证中国区域配置
  if (isChinaRegion()) {
    if (!process.env.NEXT_PUBLIC_WECHAT_CLOUDBASE_ID) {
      errors.push("Missing NEXT_PUBLIC_WECHAT_CLOUDBASE_ID for China region");
    }
  }

  // 验证国际区域配置
  if (isInternationalRegion()) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push("Missing NEXT_PUBLIC_SUPABASE_URL for international region");
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for international region");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 打印当前区域配置信息
 */
export function printRegionConfig() {
  const region = getDeployRegion();
  console.log("\n========== Region Configuration ==========");
  console.log(`Region: ${region === "CN" ? "China" : "International"}`);
  console.log(`Auth Provider: ${RegionConfig.auth.provider}`);
  console.log(`Database Provider: ${RegionConfig.database.provider}`);
  console.log(`Payment Provider: ${RegionConfig.payment.primary}`);
  console.log("==========================================\n");

  // 验证配置
  const validation = validateRegionConfig();
  if (!validation.valid) {
    console.error("Config validation failed:");
    validation.errors.forEach((error) => console.error(error));
    console.log("");
  }
}
