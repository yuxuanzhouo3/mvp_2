import { config } from 'dotenv';
import path from 'path';
// 加载 .env.local 文件（优先级最高）
config({ path: path.resolve(process.cwd(), '.env.local') });
import OpenAI from 'openai';
const client = new OpenAI();  // 现在就能读取到 OPENAI_API_KEY 了

async function main() {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',  // 或 'gpt-3.5-turbo' 等可用模型
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello! 请用中文介绍一下 JavaScript 的 async/await。' },
    ],
    temperature: 0.7,
  });

  console.log('AI 回复：');
  console.log(completion.choices[0].message.content);
}

main().catch(err => console.error(err));