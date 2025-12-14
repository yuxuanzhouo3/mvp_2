#!/usr/bin/env node

/**
 * 环境配置验证脚本
 */

import fs from "fs";
import path from "path";

const envPath = path.resolve(".env.local");

console.log("🔍 环境配置检查\n");

// 1. 检查文件存在
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local 文件不存在");
  console.log("💡 创建方法:");
  console.log("   cp .env.example .env.local");
  process.exit(1);
}

console.log("✅ .env.local 文件存在");

// 2. 读取文件
const envContent = fs.readFileSync(envPath, "utf-8");
const lines = envContent.split("\n");

const getEnvValue = (key: string) => {
  const line = lines.find((line) => line.startsWith(`${key}=`));
  if (!line) return null;
  return line.slice(key.length + 1).trim();
};

const isValidKey = (value: string | null) =>
  Boolean(value && value.trim() && !value.includes("your_"));

const deploymentRegion =
  (getEnvValue("NEXT_PUBLIC_DEPLOYMENT_REGION") || "INTL").toUpperCase();

console.log(`🌏 部署区域: ${deploymentRegion}`);

if (deploymentRegion === "CN") {
  const zhipuKey = getEnvValue("ZHIPU_API_KEY");

  if (!isValidKey(zhipuKey)) {
    console.error("\n❌ CN 环境需要配置 ZHIPU_API_KEY");
    console.log("💡 请在 .env.local 中设置:");
    console.log("   ZHIPU_API_KEY=sk_xxx");
    process.exit(1);
  }

  console.log("\n✅ ZHIPU_API_KEY 已配置");
  console.log(`   Key 长度: ${zhipuKey!.length} 字符`);
  console.log(`   Key 前缀: ${zhipuKey!.slice(0, 10)}...`);
} else {
  const openaiKey = getEnvValue("OPENAI_API_KEY");
  const mistralKey = getEnvValue("MISTRAL_API_KEY");

  if (!isValidKey(openaiKey) && !isValidKey(mistralKey)) {
    console.error("\n❌ INTL 环境需要配置 OPENAI_API_KEY 或 MISTRAL_API_KEY");
    console.log("💡 请至少设置一个可用的密钥");
    process.exit(1);
  }

  if (isValidKey(openaiKey)) {
    console.log("\n✅ OPENAI_API_KEY 已配置");
    console.log(`   Key 前缀: ${openaiKey!.slice(0, 8)}...`);
  } else {
    console.warn("\n⚠️ 未检测到 OPENAI_API_KEY");
  }

  if (isValidKey(mistralKey)) {
    console.log("✅ MISTRAL_API_KEY 已配置");
    console.log(`   Key 前缀: ${mistralKey!.slice(0, 8)}...`);
  } else {
    console.warn("⚠️ 未检测到 MISTRAL_API_KEY");
  }
}

console.log("\n" + "=".repeat(60));
console.log("✅ 配置检查完成！");
console.log("=".repeat(60));

console.log("\n📋 下一步");
if (deploymentRegion === "CN") {
  console.log("   1. npm run test:zhipu    (测试智谱 API 连接)");
} else {
  console.log("   1. 可运行 API 测试脚本验证 OpenAI/Mistral 连接");
}
console.log("   2. npm run dev           (启动应用)");
