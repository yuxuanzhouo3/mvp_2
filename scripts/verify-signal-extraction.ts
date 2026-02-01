import { extractNegativeFeedbackSamples, type UserFeedbackRecord } from "../lib/services/feedback-service";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const historyById = new Map<string, { title: string; metadata?: Record<string, any> | null }>([
    [
      "h1",
      {
        title: "宫保鸡丁",
        metadata: { tags: ["川菜", "下饭"], searchQuery: "宫保鸡丁 做法" },
      },
    ],
    [
      "h2",
      {
        title: "某个不喜欢的内容",
        metadata: { tags: ["泛化", "爆款"], searchQuery: "热门 爆款" },
      },
    ],
    [
      "h3",
      {
        title: "评分很低的内容",
        metadata: { tags: ["噪音"], searchQuery: "吵闹" },
      },
    ],
  ]);

  const feedbacks: UserFeedbackRecord[] = [
    {
      user_id: "u",
      recommendation_id: "h2",
      feedback_type: "interest",
      is_interested: false,
      has_purchased: null,
      rating: null,
      comment: null,
      triggered_by: "dialog",
      created_at: new Date().toISOString(),
    },
    {
      user_id: "u",
      recommendation_id: "h1",
      feedback_type: "skip",
      is_interested: null,
      has_purchased: null,
      rating: null,
      comment: null,
      triggered_by: "dialog",
      created_at: new Date().toISOString(),
    },
    {
      user_id: "u",
      recommendation_id: "h3",
      feedback_type: "rating",
      is_interested: true,
      has_purchased: null,
      rating: 1,
      comment: null,
      triggered_by: "dialog",
      created_at: new Date().toISOString(),
    },
    {
      user_id: "u",
      recommendation_id: "unknown",
      feedback_type: "skip",
      is_interested: null,
      has_purchased: null,
      rating: null,
      comment: null,
      triggered_by: "dialog",
      created_at: new Date().toISOString(),
    },
  ];

  const negatives = extractNegativeFeedbackSamples({ feedbacks, historyById, maxSamples: 10 });
  assert(negatives.length === 3, `expected 3 negative samples, got ${negatives.length}`);
  assert(negatives.some((n) => n.title === "某个不喜欢的内容" && n.feedbackType === "interest"), "missing interest=false sample");
  assert(negatives.some((n) => n.title === "宫保鸡丁" && n.feedbackType === "skip"), "missing skip sample");
  assert(negatives.some((n) => n.title === "评分很低的内容" && n.feedbackType === "rating"), "missing low-rating sample");

  console.log("Signal extraction verification passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

