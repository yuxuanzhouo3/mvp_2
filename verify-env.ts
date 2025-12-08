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
  console.log('   echo "ZHIPU_API_KEY=your_key_here" > .env.local');
  process.exit(1);
}

console.log("✅ .env.local 文件存在");

// 2. 读取文件
const envContent = fs.readFileSync(envPath, "utf-8");
const lines = envContent.split("\n");

// 3. 检查 ZHIPU_API_KEY
const zhipuLine = lines.find((line) => line.startsWith("ZHIPU_API_KEY="));

if (!zhipuLine) {
  console.error("\n❌ 未找到 ZHIPU_API_KEY 配置");
  console.log("💡 请在 .env.local 中添加:");
  console.log('   ZHIPU_API_KEY=sk_xxxxx...');
  process.exit(1);
}

const [, apiKey] = zhipuLine.split("=");

if (!apiKey || apiKey.includes("your_") || apiKey.trim() === "") {
  console.error("\n❌ ZHIPU_API_KEY 值无效");
  console.log("当前值:", apiKey);
  console.log("💡 请在 .env.local 中设置有效的 API Key");
  process.exit(1);
}

console.log("✅ ZHIPU_API_KEY 已配置");
console.log(`   Key 长度: ${apiKey.trim().length} 字符`);
console.log(`   Key 前缀: ${apiKey.trim().substring(0, 10)}...`);

// 4. 检查其他配置
const otherAiKeys = [
  "GROQ_API_KEY",
  "TOGETHER_API_KEY",
  "HUGGINGFACE_API_KEY",
];

const foundKeys = otherAiKeys.filter((key) =>
  lines.some((line) => line.startsWith(key + "="))
);

if (foundKeys.length > 0) {
  console.log("\n⚠️  检测到其他 AI 提供商配置 (已删除，但在 .env.local 中仍存在):");
  foundKeys.forEach((key) => {
    console.log(`   - ${key}`);
  });
  console.log("💡 这些不会被使用，但建议删除");
}

console.log("\n" + "=".repeat(60));
console.log("✅ 配置检查完成！可以开始使用了");
console.log("=".repeat(60));

console.log("\n📝 下一步:");
console.log("   1. npm run test:zhipu    (测试 API 连接)");
console.log("   2. npm run dev           (启动应用)");
