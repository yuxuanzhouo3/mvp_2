import { buildExpansionSignalPrompt } from "../lib/ai/zhipu-recommendation";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const zh = buildExpansionSignalPrompt({
    locale: "zh",
    topTags: ["悬疑", "解谜"],
    positiveSamples: [{ title: "流浪地球2", tags: ["科幻"], searchQuery: "流浪地球2 豆瓣 评分" }],
    negativeSamples: [{ title: "不喜欢内容", tags: ["爆款"], feedbackType: "interest", rating: undefined }],
    avoidTitles: ["不喜欢内容", "已展示标题A"],
    requestNonce: "nonce",
  });

  assert(zh.includes("Top"), "zh prompt missing top section");
  assert(zh.includes("nonce"), "zh prompt missing nonce");

  const en = buildExpansionSignalPrompt({
    locale: "en",
    topTags: ["mystery", "puzzle"],
    positiveSamples: [{ title: "Example", tags: ["tag"], searchQuery: "q" }],
    negativeSamples: [{ title: "Bad", tags: ["spam"], feedbackType: "skip", rating: 1 }],
    avoidTitles: ["Bad"],
    requestNonce: "nonce2",
  });

  assert(en.includes("Top"), "en prompt missing top section");
  assert(en.includes("nonce2"), "en prompt missing nonce");

  console.log("Prompt structure verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
