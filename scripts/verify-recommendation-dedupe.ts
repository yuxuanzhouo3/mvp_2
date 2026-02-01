import { dedupeRecommendations } from "../lib/recommendation/dedupe";

function countDuplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);
}

async function main() {
  const userHistory = [
    { title: "流浪地球2", metadata: { searchQuery: "流浪地球2 豆瓣 评分" } },
    { title: "宫保鸡丁", metadata: { searchQuery: "宫保鸡丁 做法" } },
  ];

  const excludeTitles = ["狂飙", "中国·西安·大雁塔"];

  const recommendations = [
    { title: "流浪地球2", searchQuery: "流浪地球2 豆瓣 评分", entertainmentType: "video" },
    { title: "流浪地球 2", searchQuery: "流浪地球2 豆瓣评分", entertainmentType: "video" },
    { title: "狂飙", searchQuery: "狂飙 电视剧 观看", entertainmentType: "video" },
    { title: "中国·西安·大雁塔", searchQuery: "西安 大雁塔 攻略", fitnessType: "nearby_place" },
    { title: "美国·纽约·中央公园", searchQuery: "纽约 中央公园 玩法", fitnessType: "nearby_place" },
    { title: "商务午餐", searchQuery: "商务午餐 川菜餐厅", fitnessType: "nearby_place" },
    { title: "深蹲入门教程", searchQuery: "深蹲 入门 教程 跟练", fitnessType: "tutorial" },
    { title: "泡沫轴使用教程", searchQuery: "泡沫轴 怎么用 入门 动作要点", fitnessType: "equipment" },
  ];

  const strictOutput = dedupeRecommendations(recommendations, {
    count: 5,
    userHistory,
    excludeTitles,
    mode: "strict",
  });

  const strictTitles = strictOutput.map((r) => (r.title || "").trim()).filter(Boolean);
  const strictQueries = strictOutput.map((r) => (r.searchQuery || "").trim()).filter(Boolean);

  if (strictOutput.length > 5) {
    throw new Error(`strict mode should not exceed count, got ${strictOutput.length}`);
  }
  if (strictTitles.some((t) => ["流浪地球2", "流浪地球 2", "宫保鸡丁", "狂飙", "中国·西安·大雁塔"].includes(t))) {
    throw new Error(`strict mode returned an excluded/history title: ${JSON.stringify(strictTitles)}`);
  }
  if (countDuplicates(strictTitles).length > 0) {
    throw new Error(`strict mode returned duplicate titles: ${JSON.stringify(countDuplicates(strictTitles))}`);
  }
  if (countDuplicates(strictQueries).length > 0) {
    throw new Error(`strict mode returned duplicate queries: ${JSON.stringify(countDuplicates(strictQueries))}`);
  }

  const fillOutput = dedupeRecommendations(
    [...recommendations, { title: "宫保鸡丁", searchQuery: "宫保鸡丁 做法", entertainmentType: "video" }],
    {
      count: 6,
      userHistory,
      excludeTitles,
      mode: "fill",
    }
  );

  const fillTitles = fillOutput.map((r) => (r.title || "").trim()).filter(Boolean);

  if (fillTitles.some((t) => ["狂飙", "中国·西安·大雁塔"].includes(t))) {
    throw new Error(`fill mode should never include excludeTitles: ${JSON.stringify(fillTitles)}`);
  }

  console.log("Strict output count:", strictOutput.length);
  console.log("Strict output titles:", strictTitles);
  console.log("Strict title duplicates:", countDuplicates(strictTitles));
  console.log("Strict query duplicates:", countDuplicates(strictQueries));
  console.log("Fill output count:", fillOutput.length);
  console.log("Fill output titles:", fillTitles);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
