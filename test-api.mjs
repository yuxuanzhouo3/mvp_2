// test-api.mjs
import { ZhipuAI } from 'zhipuai';

const client = new ZhipuAI({
  apiKey: "xxxxxxxxxx"   // 你的 key（建议后面改成 .env 方式）
});

async function getAIRecommendation(userHistory, category) {
  const response = await client.chat.completions.create({
    model: "glm-4-flash",           // 注意：免费的是 glm-4-flash，不是 glm-4.5-flash
    messages: [
      {
        role: "user",
        content: `你是一个推荐助手。
用户历史浏览/购买记录：${JSON.stringify(userHistory)}
请给出3个${category}分类下的真实商品/内容推荐，包含真实可点击的链接。
严格按照以下 JSON 格式返回（不要有任何多余文字）：

[
  { "title": "商品名称", "reason": "推荐理由", "url": "https://..." },
  ...
]`
      }
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  const content = response.choices[0].message.content.trim();
  console.log("原始返回：\n", content);   // 先看看模型到底返回了什么

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error("JSON 解析失败，返回的不是合法 JSON");
    throw e;
  }
}

// ────── 下面这几行才是关键！立刻执行测试 ──────
(async () => {
  try {
    const result = await getAIRecommendation(
      ["笔记本电脑", "手机", "程序员T恤"],
      "数码配件"
    );
    console.log("\n最终解析结果：");
    console.log(result);
  } catch (error) {
    console.error("请求失败：", error);
  }
})();