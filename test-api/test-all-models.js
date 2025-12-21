/**
 * 测试所有配置的AI模型
 * 运行: node test-api/test-all-models.js
 */

import dotenv from "dotenv";
import { resolve } from "path";

// 加载 .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const ZHIPU_API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const MODELS = [
  { name: "qwen-max", provider: "qwen" },
  { name: "qwen-plus", provider: "qwen" },
  { name: "qwen-turbo", provider: "qwen" },
  { name: "glm-4.5-flash", provider: "zhipu" },
];

const testMessage = {
  messages: [
    { role: "system", content: "You are a helpful assistant. Reply briefly." },
    { role: "user", content: "请用一句话介绍你自己" },
  ],
};

async function testQwen(model) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    return { success: false, error: "QWEN_API_KEY not configured" };
  }

  try {
    const response = await fetch(QWEN_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: testMessage.messages,
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return { success: true, content, usage: data.usage };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function testZhipu(model) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return { success: false, error: "ZHIPU_API_KEY not configured" };
  }

  try {
    const response = await fetch(ZHIPU_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: testMessage.messages,
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return { success: true, content, usage: data.usage };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("AI 模型连接测试");
  console.log("=".repeat(60));
  console.log();

  // 检查环境变量
  console.log("环境变量检查:");
  console.log(`  QWEN_API_KEY: ${process.env.QWEN_API_KEY ? "✅ 已配置" : "❌ 未配置"}`);
  console.log(`  ZHIPU_API_KEY: ${process.env.ZHIPU_API_KEY ? "✅ 已配置" : "❌ 未配置"}`);
  console.log();

  const results = [];

  for (const { name, provider } of MODELS) {
    console.log(`测试 ${name} (${provider})...`);
    const startTime = Date.now();

    let result;
    if (provider === "qwen") {
      result = await testQwen(name);
    } else {
      result = await testZhipu(name);
    }

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`  ✅ 成功 (${duration}ms)`);
      console.log(`  📝 回复: ${result.content?.slice(0, 80)}...`);
      if (result.usage) {
        console.log(`  📊 Token: ${result.usage.total_tokens}`);
      }
    } else {
      console.log(`  ❌ 失败: ${result.error}`);
    }
    console.log();

    results.push({ model: name, provider, ...result, duration });
  }

  // 汇总
  console.log("=".repeat(60));
  console.log("测试结果汇总:");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ 成功: ${successful.length}/${results.length}`);
  if (successful.length > 0) {
    console.log("   可用模型: " + successful.map((r) => r.model).join(", "));
  }

  if (failed.length > 0) {
    console.log(`❌ 失败: ${failed.length}/${results.length}`);
    failed.forEach((r) => {
      console.log(`   - ${r.model}: ${r.error.slice(0, 60)}`);
    });
  }
}

main().catch(console.error);
