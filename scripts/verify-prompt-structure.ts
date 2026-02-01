import { buildExpansionSignalPrompt } from "../lib/ai/zhipu-recommendation";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const zh = buildExpansionSignalPrompt({
    locale: "zh",
    topTags: ["悬疑", "解谜"],
    positiveSamples: [{ title: "流浪地球2", tags: ["科幻"], searchQuery: "流浪地球2 豆瓣 评分" }],
    negativeSamples: [{ title: "某个不喜欢的内容", tags: ["爆款"], feedbackType: "interest", rating: null }],
    avoidTitles: ["某个不喜欢的内容", "已展示标题A"],
    requestNonce: "nonce",
  });

  assert(zh.includes("【拓展信号（三段式）】"), "zh prompt missing signals header");
  assert(zh.includes("Top Tags"), "zh prompt missing top tags");
  assert(zh.includes("最近正反馈样本"), "zh prompt missing positive samples");
  assert(zh.includes("负反馈样本"), "zh prompt missing negative samples");
  assert(zh.includes("需要避开的标题"), "zh prompt missing avoid titles");
  assert(zh.includes("nonce"), "zh prompt missing nonce");

  const en = buildExpansionSignalPrompt({
    locale: "en",
    topTags: ["mystery", "puzzle"],
    positiveSamples: [{ title: "Example", tags: ["tag"], searchQuery: "q" }],
    negativeSamples: [{ title: "Bad", tags: ["spam"], feedbackType: "skip", rating: 1 }],
    avoidTitles: ["Bad"],
    requestNonce: "nonce2",
  });

  assert(en.includes("[Expansion Signals (3-part)]"), "en prompt missing signals header");
  assert(en.includes("Top tags"), "en prompt missing top tags");
  assert(en.includes("Recent positive examples"), "en prompt missing positive samples");
  assert(en.includes("Negative examples"), "en prompt missing negative samples");
  assert(en.includes("Titles to avoid"), "en prompt missing avoid titles");
  assert(en.includes("nonce2"), "en prompt missing nonce");

  console.log("Prompt structure verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

