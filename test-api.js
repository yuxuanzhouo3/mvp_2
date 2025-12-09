import { ZhipuAI } from 'zhipuai';

const client = new ZhipuAI({
  apiKey: "xxxxx"
});

async function getAIRecommendation(userHistory, category) {
  const response = await client.chat.completions.create({
    model: "glm-4.5-flash",
    messages: [
      { role: "system", content: "你只能返回纯 JSON 数组，禁止加任何说明或标记" },
      {
        role: "user",
        content: `用户浏览记录：${JSON.stringify(userHistory)}\n请返回3个${category}推荐，只返回JSON数组：
[{"title":"示例商品","reason":"理由很短","url":"https://item.jd.com/123.html"}]`
      }
    ],
    temperature: 0.3,
    max_tokens: 600
  });

  const content = response.choices[0].message.content.trim()
    .replace(/^```json\s*/g, "")
    .replace(/\s*```$/g, "");

  console.log("原始返回：", content);

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error("解析失败，尝试修复...");
    const fixed = content.replace(/}\s*$/, "}]");
    return JSON.parse(fixed);
  }
}

(async () => {
  try {
    const result = await getAIRecommendation(
      ["笔记本电脑", "手机", "程序员T恤"],
      "数码配件"
    );
    console.log("\n成功！推荐结果：");
    console.log(result);
  } catch (err) {
    console.error("失败：", err.message);
  }
})();