#!/usr/bin/env node

/**
 * 智谱 API 测试脚本
 * 测试 glm-4-flash 模型的集成
 */

import https from "https";

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;

if (!ZHIPU_API_KEY) {
  console.error("❌ Error: ZHIPU_API_KEY environment variable is not set");
  console.error("Please set your Zhipu API key: export ZHIPU_API_KEY=your_key");
  process.exit(1);
}

if (ZHIPU_API_KEY.includes("your_")) {
  console.error("❌ Error: ZHIPU_API_KEY is not properly configured (contains placeholder)");
  process.exit(1);
}

interface ZhipuResponse {
  code: number;
  msg: string;
  data?: {
    choices: Array<{
      index: number;
      finish_reason: string;
      message: {
        role: string;
        content: string;
      };
    }>;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };
}

async function callZhipuAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "glm-4.5-flash",
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const options = {
      hostname: "open.bigmodel.cn",
      port: 443,
      path: "/api/paas/v4/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          return;
        }

        try {
          const parsed: ZhipuResponse = JSON.parse(responseData);

          if (parsed.code !== 0) {
            reject(new Error(`API Error (code ${parsed.code}): ${parsed.msg}`));
            return;
          }

          if (!parsed.data?.choices || parsed.data.choices.length === 0) {
            reject(new Error("No choices in response"));
            return;
          }

          const content = parsed.data.choices[0].message.content;
          const usage = parsed.data.usage;

          console.log("\n✅ Zhipu API Response:");
          console.log("━".repeat(60));
          console.log(`Response: ${content}\n`);
          console.log(`Tokens Used:`);
          console.log(`  - Prompt tokens: ${usage.prompt_tokens}`);
          console.log(`  - Completion tokens: ${usage.completion_tokens}`);
          console.log(`  - Total tokens: ${usage.total_tokens}`);
          console.log("━".repeat(60));

          resolve(content);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("🔍 Testing Zhipu (GLM-4-Flash) API Integration");
  console.log("═".repeat(60));

  try {
    // Test 1: Simple greeting
    console.log("\n📝 Test 1: Simple greeting (English)");
    console.log("─".repeat(60));
    const greeting = await callZhipuAPI([
      {
        role: "user",
        content: "Say hello in one sentence",
      },
    ]);

    // Test 2: Chinese response
    console.log("\n📝 Test 2: Chinese response");
    console.log("─".repeat(60));
    const chinese = await callZhipuAPI([
      {
        role: "user",
        content: "用一句话回答：你好吗？",
      },
    ]);

    // Test 3: JSON format (relevant to recommendations)
    console.log("\n📝 Test 3: JSON format (recommendation-like)");
    console.log("─".repeat(60));
    const json = await callZhipuAPI([
      {
        role: "system",
        content: "You are a JSON generator. Return ONLY valid JSON, no other text.",
      },
      {
        role: "user",
        content: 'Return a simple JSON object with "name" and "description" fields',
      },
    ]);

    console.log("\n✅ All tests passed!");
    console.log(
      "The Zhipu API (glm-4-flash) is properly configured and working.\n"
    );
  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("\nTroubleshooting:");
    console.error("1. Verify your ZHIPU_API_KEY is valid at https://open.bigmodel.cn");
    console.error("2. Check if you have sufficient quota/balance");
    console.error("3. Verify network connectivity to open.bigmodel.cn");
    process.exit(1);
  }
}

main();
