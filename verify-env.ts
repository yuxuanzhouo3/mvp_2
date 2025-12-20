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

// 环境变量配置定义
const ENV_CONFIG = {
  // 通用必需变量
  common: {
    required: ["JWT_SECRET"],
    optional: ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL", "NEXTAUTH_URL"],
  },
  // CN 环境变量
  CN: {
    required: [
      "NEXT_PUBLIC_WECHAT_CLOUDBASE_ID",
      "CLOUDBASE_SECRET_ID",
      "CLOUDBASE_SECRET_KEY",
      "ZHIPU_API_KEY",
    ],
    optional: [
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

  // 1. 检查文件存在
  if (!fs.existsSync(envPath)) {
    log.error(".env.local 文件不存在");
    console.log("\n💡 创建方法:");
    console.log("   1. 复制项目根目录的环境变量模板");
    console.log("   2. 或手动创建 .env.local 文件并配置环境变量");
    console.log("\n📖 参考文档: docs/2025-12-19/DUAL_ENVIRONMENT_GUIDE.md");
    process.exit(1);
  }

  log.success(".env.local 文件存在");

  // 2. 读取文件
  const envContent = fs.readFileSync(envPath, "utf-8");
  const lines = envContent.split("\n");

  const getEnvValue = (key: string): string | null => {
    const line = lines.find((l) => l.trim().startsWith(`${key}=`));
    if (!line) return null;
    const value = line.slice(key.length + 1).trim();
    // 移除引号
    return value.replace(/^["']|["']$/g, "");
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

  // 4. 验证通用配置
  log.section("通用配置");

  for (const key of ENV_CONFIG.common.required) {
    if (isValidKey(getEnvValue(key))) {
      log.success(`${key} 已配置`);
    } else {
      log.error(`${key} 未配置（必需）`);
      hasError = true;
    }
  }

  for (const key of ENV_CONFIG.common.optional) {
    if (isValidKey(getEnvValue(key))) {
      log.success(`${key} 已配置`);
    } else {
      log.warn(`${key} 未配置（可选）`);
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
    }

    if (hasAlipay) {
      log.success("支付宝配置已添加");
    } else {
      log.info("支付宝未配置（待后续实现）");
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
    } else {
      log.info("Stripe 支付未配置");
    }

    // PayPal
    const paypalConfigured = ENV_CONFIG.INTL.payment.paypal.filter(key => isValidKey(getEnvValue(key)));
    if (paypalConfigured.length === ENV_CONFIG.INTL.payment.paypal.length) {
      log.success("PayPal 支付已完整配置");
    } else if (paypalConfigured.length > 0) {
      log.warn(`PayPal 支付部分配置 (${paypalConfigured.length}/${ENV_CONFIG.INTL.payment.paypal.length})`);
      hasWarning = true;
    } else {
      log.info("PayPal 支付未配置");
    }

    // 至少需要一个支付方式
    if (stripeConfigured.length === 0 && paypalConfigured.length === 0) {
      log.warn("未配置任何支付方式（支付功能将不可用）");
      hasWarning = true;
    }
  }

  // 6. 总结
  log.title("📊 验证结果");

  if (hasError) {
    log.error("配置验证失败，请修复上述错误后重试");
    process.exit(1);
  } else if (hasWarning) {
    log.warn("配置验证通过，但有一些警告");
    log.info("部分功能可能不可用，请根据需要补充配置");
  } else {
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
