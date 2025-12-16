// test-openai-api.js
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';

// ============ 修复 .env.local 加载问题 ============
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 强制从项目根目录加载 .env.local（往上两级）
const envPath = resolve(__dirname, '..', '.env.local');   // 只往上 1 级
config({ path: envPath });

// 调试输出（可以删掉）
console.log('加载的 .env.local 路径:', envPath);
console.log('OPENAI_API_KEY 是否存在:', !!process.env.OPENAI_API_KEY);
if (!process.env.OPENAI_API_KEY) {
  console.error('还是没加载到 Key！请检查 .env.local 文件是否存在、内容是否正确');
  process.exit(1);
}

// ============ 创建 OpenAI 客户端 ============
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,   // 现在一定有值了
  timeout: 900000, // 15分钟，防止超时
  // 如果你本地有 Clash/v2rayN 等代理，取消下面这行注释（默认端口 7890）
  httpAgent: new HttpsProxyAgent('http://127.0.0.1:7891'),
});

// ============ 简单测试 ============
async function test() {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: '说一句“你好，世界！”' }],
      max_tokens: 50,
    });
    console.log('成功！OpenAI 返回：');
    console.log(completion.choices[0].message.content);
  } catch (err) {
    console.error('请求失败：', err.message);
    if (err.code === 'ENOTFOUND' || err.message.includes('timeout')) {
      console.error('大概率是没走代理，国内直连 OpenAI 基本连不上');
    }
  }
}

test();