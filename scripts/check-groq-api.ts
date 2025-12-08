/**
 * Groq API 诊断工具
 * 帮助检查 API Key 和连接是否正确配置
 */

import * as fs from "fs";
import * as path from "path";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function checkGroqAPI() {
  console.log("🔍 Groq API 诊断工具\n");

  // 1. 检查环境变量
  console.log("1️⃣ 检查 API Key...");
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.log("❌ GROQ_API_KEY 未设置");
    printSolution();
    return;
  }

  console.log(`✅ API Key 存在 (长度: ${apiKey.length})`);

  if (!apiKey.startsWith("gsk_")) {
    console.log("⚠️  警告: API Key 不以 'gsk_' 开头，可能格式不正确");
  }

  // 2. 测试 API 连接
  console.log("\n2️⃣ 测试 API 连接...");

  try {
    const testMessage = {
      role: "user",
      content: "请用一个词回答: hello",
    };

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [testMessage],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    console.log(`HTTP 状态码: ${response.status}`);

    const responseText = await response.text();
    console.log(`响应大小: ${responseText.length} 字节`);

    if (!response.ok) {
      console.log("\n❌ API 返回错误:");
      try {
        const errorJson = JSON.parse(responseText);
        console.log(JSON.stringify(errorJson, null, 2));
      } catch {
        console.log(responseText);
      }

      // 诊断不同的错误代码
      if (response.status === 403) {
        console.log(
          "\n💡 诊断: 403 Forbidden - API Key 权限不足或已失效"
        );
        console.log("解决方案:");
        console.log("  1. 访问 https://console.groq.com");
        console.log("  2. 检查 API Key 是否仍然有效");
        console.log("  3. 确保账户没有被暂停或限制");
        console.log("  4. 生成新的 API Key 并更新 .env.local");
      } else if (response.status === 401) {
        console.log("\n💡 诊断: 401 Unauthorized - API Key 格式错误");
      } else if (response.status === 429) {
        console.log(
          "\n💡 诊断: 429 Too Many Requests - 速率限制，请稍后重试"
        );
      }
      return;
    }

    try {
      const data = JSON.parse(responseText);
      if (data.choices && data.choices.length > 0) {
        console.log("✅ API 连接成功!");
        console.log(`回复: ${data.choices[0].message.content}`);
      } else {
        console.log("❌ API 返回非预期格式");
        console.log(JSON.stringify(data, null, 2));
      }
    } catch {
      console.log("❌ 无法解析 API 响应");
    }
  } catch (error) {
    console.log(`❌ 连接失败: ${error}`);
  }

  // 3. 检查本地配置文件
  console.log("\n3️⃣ 检查 .env.local 文件...");
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const hasGroqKey = envContent.includes("GROQ_API_KEY=");
    if (hasGroqKey) {
      console.log("✅ GROQ_API_KEY 在 .env.local 中已配置");
    } else {
      console.log("❌ GROQ_API_KEY 未在 .env.local 中");
    }
  } else {
    console.log("⚠️  .env.local 文件不存在");
  }
}

function printSolution() {
  console.log("\n📋 解决方案:");
  console.log("1. 访问 https://console.groq.com 获取或更新 API Key");
  console.log("2. 将 API Key 添加到 .env.local:");
  console.log("   GROQ_API_KEY=your_groq_api_key");
  console.log("3. 重启 Next.js 开发服务器");
  console.log("4. 重新运行此诊断脚本");
}

// 运行诊断
checkGroqAPI().catch(console.error);
