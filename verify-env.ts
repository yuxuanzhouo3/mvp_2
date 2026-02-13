#!/usr/bin/env node

/**
 * 双环境配置验证脚本
 * 
 * 验证 CN 和 INTL 两个环境的环境变量配置
 * 使用方法: npm run verify:env
 */

import fs from "fs";
import path from "path";

// ANSI 颜色代码
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  title: (msg: string) => console.log(`\n${colors.magenta}${"=".repeat(60)}${colors.reset}\n${colors.magenta}${msg}${colors.reset}\n${colors.magenta}${"=".repeat(60)}${colors.reset}`),
  section: (msg: string) => console.log(`\n${colors.blue}▶ ${msg}${colors.reset}`),
};

const envPath = path.resolve(".env.local");

function normalizeEnvValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function parseEnvFile(content: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1);
    entries[key] = normalizeEnvValue(value);
  }

  return entries;
}

// 环境变量配置定义
const ENV_CONFIG = {
  // 通用必需变量
  common: {
    required: ["JWT_SECRET", "ADMIN_SESSION_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD"],
    optional: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL", "NEXTAUTH_URL"],
  },
  adminCrossSource: {
    required: [
      "NEXT_PUBLIC_WECHAT_CLOUDBASE_ID",
      "CLOUDBASE_SECRET_ID",
      "CLOUDBASE_SECRET_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
  },
  // CN 环境变量
  CN: {
    required: [
      "NEXT_PUBLIC_WECHAT_CLOUDBASE_ID",
      "CLOUDBASE_SECRET_ID",
      "CLOUDBASE_SECRET_KEY",
      "ZHIPU_API_KEY",
      "AUTH_EMAIL_SMTP_HOST",
      "AUTH_EMAIL_SMTP_PORT",
      "AUTH_EMAIL_SMTP_USER",
      "AUTH_EMAIL_SMTP_PASS",
      "AUTH_EMAIL_FROM",
    ],
    optional: [
      "WECHAT_MOBILE_APP",
      "WECHAT_MOBILE_APP_ID",
      "WECHAT_MOBILE_APP_SECRET",
      // 微信支付（稍后实现）
      "WECHAT_PAY_APPID",
      "WECHAT_PAY_MCHID",
      "WECHAT_PAY_SERIAL_NO",
      "WECHAT_PAY_PRIVATE_KEY",
      "WECHAT_PAY_API_V3_KEY",
      // 支付宝（稍后实现）
      "ALIPAY_APP_ID",
      "ALIPAY_PRIVATE_KEY",
      "ALIPAY_PUBLIC_KEY",
    ],
  },
  // INTL 环境变量
  INTL: {
    required: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    optional: [
      "NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID",
      "NOMINATIM_USER_AGENT",
      "NOMINATIM_CONTACT_EMAIL",
      "NOMINATIM_CONTACT_URL",
      "OVERPASS_API_ENDPOINT",
    ],
    ai: {
      // 至少需要一个 AI 服务
      oneOf: ["OPENAI_API_KEY", "MISTRAL_API_KEY", "GROQ_API_KEY", "GOOGLE_AI_API_KEY"],
    },
    payment: {
      stripe: [
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
      ],
      paypal: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
    },
  },
};

function main() {
  log.title("🔍 双环境配置验证");

  const hasEnvFile = fs.existsSync(envPath);
  let envFromFile: Record<string, string> = {};

  // 1. 加载环境变量来源
  if (hasEnvFile) {
    envFromFile = parseEnvFile(fs.readFileSync(envPath, "utf-8"));
    log.success(".env.local 文件存在（本地文件模式）");
  } else {
    log.warn(".env.local 文件不存在，将使用进程环境变量（适用于 Vercel/CI）");
  }

  // 2. 统一获取环境变量：process.env 优先，其次 .env.local
  const getEnvValue = (key: string): string | null => {
    const processValue = process.env[key];
    if (typeof processValue === "string" && processValue.trim() !== "") {
      return normalizeEnvValue(processValue);
    }

    const fileValue = envFromFile[key];
    if (typeof fileValue === "string" && fileValue.trim() !== "") {
      return fileValue;
    }

    return null;
  };

  const isValidKey = (value: string | null): boolean =>
    Boolean(value && value.trim() && !value.includes("your_") && value !== "");

  // 3. 检测部署区域
  const deploymentRegion = (getEnvValue("NEXT_PUBLIC_DEPLOYMENT_REGION") || "INTL").toUpperCase();

  log.section(`部署区域: ${deploymentRegion}`);
  console.log(
    deploymentRegion === "CN"
      ? "   使用 CloudBase + 微信/支付宝支付"
      : "   使用 Supabase + Stripe/PayPal 支付"
  );

  let hasError = false;
  let hasWarning = false;
  const missingRequired: string[] = [];
  const warningItems: string[] = [];

  // 4. 验证通用配置
  log.section("通用配置");

  for (const key of ENV_CONFIG.common.required) {
    if (isValidKey(getEnvValue(key))) {
      log.success(`${key} 已配置`);
    } else {
      log.error(`${key} 未配置（必需）`);
      hasError = true;
      missingRequired.push(key);
    }
  }

  for (const key of ENV_CONFIG.common.optional) {
    if (isValidKey(getEnvValue(key))) {
      log.success(`${key} 已配置`);
    } else {
      log.warn(`${key} 未配置（可选）`);
      warningItems.push(`${key}:optional`);
    }
  }

  // 5. 根据区域验证特定配置
  if (deploymentRegion === "CN") {
    log.section("CN 环境配置");

    // 验证必需变量
    for (const key of ENV_CONFIG.CN.required) {
      const value = getEnvValue(key);
      if (isValidKey(value)) {
        const displayValue = key.includes("SECRET") || key.includes("KEY")
          ? `${value!.slice(0, 8)}...`
          : value;
        log.success(`${key} 已配置 (${displayValue})`);
      } else {
        log.error(`${key} 未配置（必需）`);
        hasError = true;
        missingRequired.push(key);
      }
    }

    // 验证可选变量（支付）
    log.section("CN 支付配置（待实现）");
    
    const hasWeChatPay = ENV_CONFIG.CN.optional.slice(0, 5).some(key => isValidKey(getEnvValue(key)));
    const hasAlipay = ENV_CONFIG.CN.optional.slice(5).some(key => isValidKey(getEnvValue(key)));

    if (hasWeChatPay) {
      log.success("微信支付配置已添加");
    } else {
      log.info("微信支付未配置（待后续实现）");
      warningItems.push("CN_WECHAT_PAY_NOT_CONFIGURED");
    }

    if (hasAlipay) {
      log.success("支付宝配置已添加");
    } else {
      log.info("支付宝未配置（待后续实现）");
      warningItems.push("CN_ALIPAY_NOT_CONFIGURED");
    }

  } else {
    // INTL 环境
    log.section("INTL 环境配置 - Supabase");

    for (const key of ENV_CONFIG.INTL.required) {
      const value = getEnvValue(key);
      if (isValidKey(value)) {
        const displayValue = key.includes("KEY") ? `${value!.slice(0, 12)}...` : value;
        log.success(`${key} 已配置 (${displayValue})`);
      } else {
        log.error(`${key} 未配置（必需）`);
        hasError = true;
        missingRequired.push(key);
      }
    }

    for (const key of ENV_CONFIG.INTL.optional) {
      const value = getEnvValue(key);
      if (isValidKey(value)) {
        log.success(`${key} 已配置 (${value!.slice(0, 12)}...)`);
      } else {
        log.info(`${key} 未配置（可选：Android 原生 Google 登录将不可用）`);
        warningItems.push(`${key}:optional`);
      }
    }

    // AI 服务验证
    log.section("INTL 环境配置 - AI 服务");
    
    const configuredAI = ENV_CONFIG.INTL.ai.oneOf.filter(key => isValidKey(getEnvValue(key)));
    
    if (configuredAI.length > 0) {
      for (const key of configuredAI) {
        const value = getEnvValue(key);
        log.success(`${key} 已配置 (${value!.slice(0, 8)}...)`);
      }
    } else {
      log.error("至少需要配置一个 AI 服务密钥");
      console.log(`   可选: ${ENV_CONFIG.INTL.ai.oneOf.join(", ")}`);
      hasError = true;
      missingRequired.push(`oneOf:${ENV_CONFIG.INTL.ai.oneOf.join("|")}`);
    }

    // 支付服务验证
    log.section("INTL 环境配置 - 支付服务");

    // Stripe
    const stripeConfigured = ENV_CONFIG.INTL.payment.stripe.filter(key => isValidKey(getEnvValue(key)));
    if (stripeConfigured.length === ENV_CONFIG.INTL.payment.stripe.length) {
      log.success("Stripe 支付已完整配置");
    } else if (stripeConfigured.length > 0) {
      log.warn(`Stripe 支付部分配置 (${stripeConfigured.length}/${ENV_CONFIG.INTL.payment.stripe.length})`);
      hasWarning = true;
      warningItems.push("INTL_STRIPE_PARTIAL");
    } else {
      log.info("Stripe 支付未配置");
      warningItems.push("INTL_STRIPE_NOT_CONFIGURED");
    }

    // PayPal
    const paypalConfigured = ENV_CONFIG.INTL.payment.paypal.filter(key => isValidKey(getEnvValue(key)));
    if (paypalConfigured.length === ENV_CONFIG.INTL.payment.paypal.length) {
      log.success("PayPal 支付已完整配置");
    } else if (paypalConfigured.length > 0) {
      log.warn(`PayPal 支付部分配置 (${paypalConfigured.length}/${ENV_CONFIG.INTL.payment.paypal.length})`);
      hasWarning = true;
      warningItems.push("INTL_PAYPAL_PARTIAL");
    } else {
      log.info("PayPal 支付未配置");
      warningItems.push("INTL_PAYPAL_NOT_CONFIGURED");
    }

    // 至少需要一个支付方式
    if (stripeConfigured.length === 0 && paypalConfigured.length === 0) {
      log.warn("未配置任何支付方式（支付功能将不可用）");
      hasWarning = true;
      warningItems.push("INTL_PAYMENT_NOT_CONFIGURED");
    }
  }

  log.section("Admin 跨环境数据源（/admin 需要）");
  const cnDbConfigured = ["NEXT_PUBLIC_WECHAT_CLOUDBASE_ID", "CLOUDBASE_SECRET_ID", "CLOUDBASE_SECRET_KEY"].every(
    (k) => isValidKey(getEnvValue(k))
  );
  const intlUrlConfigured = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"].some((k) => isValidKey(getEnvValue(k)));
  const intlDbConfigured = intlUrlConfigured && isValidKey(getEnvValue("SUPABASE_SERVICE_ROLE_KEY"));

  const cnOrigin = getEnvValue("CN_APP_ORIGIN");
  const intlOrigin = getEnvValue("INTL_APP_ORIGIN");
  const proxySecret = getEnvValue("ADMIN_PROXY_SECRET");

  const cnProxyReady = isValidKey(cnOrigin) && isValidKey(proxySecret);
  const intlProxyReady = isValidKey(intlOrigin) && isValidKey(proxySecret);

  if (cnDbConfigured || cnProxyReady) {
    log.success(`CN 数据源可用（${cnDbConfigured ? "CloudBase 直连" : "CN_APP_ORIGIN + ADMIN_PROXY_SECRET 代理"}）`);
  } else {
    const detail = isValidKey(cnOrigin)
      ? "已配置 CN_APP_ORIGIN，但缺少 ADMIN_PROXY_SECRET"
      : "缺少 CloudBase 直连配置，且未配置 CN_APP_ORIGIN";
    log.error(`CN 数据源不可用：${detail}`);
    hasError = true;
    missingRequired.push("CN_ADMIN_DATA_SOURCE");
  }

  if (intlDbConfigured || intlProxyReady) {
    log.success(`INTL 数据源可用（${intlDbConfigured ? "Supabase 直连" : "INTL_APP_ORIGIN + ADMIN_PROXY_SECRET 代理"}）`);
  } else {
    const detail = isValidKey(intlOrigin)
      ? "已配置 INTL_APP_ORIGIN，但缺少 ADMIN_PROXY_SECRET"
      : "缺少 Supabase 直连配置，且未配置 INTL_APP_ORIGIN";
    log.error(`INTL 数据源不可用：${detail}`);
    hasError = true;
    missingRequired.push("INTL_ADMIN_DATA_SOURCE");
  }

  const needsProxy = (isValidKey(cnOrigin) && !cnDbConfigured) || (isValidKey(intlOrigin) && !intlDbConfigured);
  if (isValidKey(proxySecret)) {
    log.success(`ADMIN_PROXY_SECRET 已配置 (${proxySecret!.slice(0, 8)}...)`);
  } else if (needsProxy) {
    log.error("ADMIN_PROXY_SECRET 未配置（必需：跨环境 /admin/orders 代理查询需要）");
    hasError = true;
    missingRequired.push("ADMIN_PROXY_SECRET");
  } else {
    log.info("ADMIN_PROXY_SECRET 未配置（当前配置不依赖跨环境代理）");
    warningItems.push("ADMIN_PROXY_SECRET_NOT_CONFIGURED");
  }

  // 6. 总结
  log.title("📊 验证结果");

  if (hasError) {
    console.log(
      `ENV_VERIFY_JSON=${JSON.stringify({
        ok: false,
        deploymentRegion,
        missingRequired,
        warnings: warningItems,
      })}`
    );
    log.error("配置验证失败，请修复上述错误后重试");
    process.exit(1);
  } else if (hasWarning) {
    console.log(
      `ENV_VERIFY_JSON=${JSON.stringify({
        ok: true,
        deploymentRegion,
        missingRequired,
        warnings: warningItems,
      })}`
    );
    log.warn("配置验证通过，但有一些警告");
    log.info("部分功能可能不可用，请根据需要补充配置");
  } else {
    console.log(
      `ENV_VERIFY_JSON=${JSON.stringify({
        ok: true,
        deploymentRegion,
        missingRequired,
        warnings: warningItems,
      })}`
    );
    log.success("配置验证通过！");
  }

  // 7. 下一步提示
  console.log("\n📋 下一步操作:");
  
  if (deploymentRegion === "CN") {
    console.log("   1. npm run test:zhipu     # 测试智谱 AI 连接");
    console.log("   2. npx tsx scripts/init-cloudbase-collections.ts  # 初始化 CloudBase 集合");
    console.log("   3. npm run dev            # 启动开发服务器");
  } else {
    console.log("   1. 确保 Supabase 项目已创建并运行迁移");
    console.log("   2. npm run dev            # 启动开发服务器");
  }

  console.log("\n📖 详细文档: docs/2025-12-19/DUAL_ENVIRONMENT_GUIDE.md\n");
}

main();
