import { describe, expect, it, vi } from "vitest";
import { callAI } from "@/lib/ai/client";
import { resolveCandidateLink } from "@/lib/outbound/link-resolver";

const malformedResultsJson =
  '{"type":"results","message":"找到了以下候选结果：","intent":"search_nearby","candidates":[{"id":"1","name":"门店A","description":"描述A","category":"汽车服务","distance":"1.2km","rating":4.6,"priceRange":"¥30-80","platform":"高德地图","searchQuery":"洗车 店"},"{"id":"2","name":"门店B","description":"描述B","category":"汽车服务","distance":"2.8km","rating":4.4,"priceRange":"¥25-60","platform":"大众点评","searchQuery":"洗车 店"}],"followUps":[{"text":"要不要更近一点？","type":"refine"}]}'

const doubleEncodedResultsJson = JSON.stringify(
  JSON.stringify({
    type: "results",
    message: "找到了以下健身视频推荐：",
    intent: "search_nearby",
    plan: [
      { step: 1, description: "获取您的位置", status: "done" },
      { step: 2, description: "搜索健身类视频内容", status: "done" },
      { step: 3, description: "按热度/评分筛选优质视频", status: "done" },
    ],
    candidates: [
      {
        id: "1",
        name: "居家高效燃脂训练",
        description: "无需器械，适合初学者全身激活动作",
        category: "健身视频",
        distance: "0km",
        rating: 4.9,
        priceRange: "免费",
        businessHours: "随时可看",
        phone: "",
        address: "",
        tags: ["燃脂", "居家"],
        platform: "B站",
        searchQuery: "居家燃脂训练 15分钟",
      },
    ],
    followUps: [{ text: "要不要再来点力量训练？", type: "refine" }],
  })
);

const smartQuoteResultsJson =
  "下面是结果：\n```json\n{“type”:“results”,“message”:“找到 1 个候选结果：”,“intent”:“search_nearby”,“candidates”:[{“id”:“1”,“name”:“家庭拉伸入门”,“description”:“适合久坐人群，5分钟快速放松”,“category”:“健身视频”,“distance”:“0km”,“rating”:4.8,“platform”:“B站”,“searchQuery”:“办公室拉伸 5分钟”}],“followUps”:[{“text”:“想看无器械力量训练吗？”,“type”:“refine”}]}\n```";

const extraClosingBraceInArrayJson =
  '{"type":"results","message":"找到了以下健身视频推荐：","intent":"search_nearby","plan":[{"step":1,"description":"获取您的位置","status":"done"},{"step":2,"description":"搜索健身类视频内容","status":"done"}],"candidates":[{"id":"1","name":"居家高效燃脂训练｜15分钟瘦腰腹","description":"无需器械，适合初学者的全身燃脂动作，跟练轻松上手","category":"健身视频","distance":"0km","rating":4.9,"priceRange":"免费","businessHours":"随时可看","phone":"","address":"","tags":["燃脂","减脂","居家"],"platform":"B站","searchQuery":"居家燃脂训练 15分钟"}},{"id":"2","name":"力量训练入门指南｜新手必看","description":"详细讲解基础力量训练动作要领，安全有效提升肌肉力量","category":"健身视频","distance":"0km","rating":4.8,"priceRange":"免费","businessHours":"随时可看","phone":"","address":"","tags":["力量训练","新手","增肌"],"platform":"B站","searchQuery":"力量训练入门 新手"}],"followUps":[{"text":"要不要更侧重某个部位？","type":"refine"}]}';

vi.mock("./preference-manager", () => ({
  getUserPreferences: vi.fn(async () => []),
  savePreference: vi.fn(),
}));

vi.mock("./reverse-geocode", () => ({
  buildLocationContext: vi.fn(async () => "location hint"),
}));

vi.mock("./nearby-store-search", () => ({
  searchNearbyStores: vi.fn(),
}));

vi.mock("@/lib/outbound/link-resolver", () => ({
  resolveCandidateLink: vi.fn(() => ({
    metadata: { providerDisplayName: "高德地图" },
  })),
}));

vi.mock("@/lib/outbound/outbound-url", () => ({
  buildOutboundHref: vi.fn(() => "/outbound?mock=1"),
}));

vi.mock("@/lib/ai/client", () => ({
  callAI: vi.fn(async () => ({
    model: "qwen-flash",
    content: malformedResultsJson,
  })),
}));

import { processChat } from "./chat-engine";

describe("processChat JSON tolerant parsing", () => {
  it("binds open_app action to each candidate via candidateId", async () => {
    const resolveMock = vi.mocked(resolveCandidateLink);
    resolveMock
      .mockReturnValueOnce({
        provider: "Google Maps",
        title: "Store A",
        primary: { type: "web", url: "https://example.com/a" },
        fallbacks: [],
        metadata: {
          region: "INTL",
          locale: "en",
          category: "shopping",
          providerDisplayName: "Google Maps",
        },
      } as any)
      .mockReturnValueOnce({
        provider: "Google Maps",
        title: "Store B",
        primary: { type: "web", url: "https://example.com/b" },
        fallbacks: [],
        metadata: {
          region: "INTL",
          locale: "en",
          category: "shopping",
          providerDisplayName: "Google Maps",
        },
      } as any);

    vi.mocked(callAI).mockResolvedValueOnce({
      model: "qwen-flash",
      content: JSON.stringify({
        type: "results",
        message: "Found 2 candidates",
        intent: "search_nearby",
        candidates: [
          {
            id: "c1",
            name: "Store A",
            description: "A",
            category: "shopping",
            platform: "Google Maps",
            searchQuery: "query-a",
          },
          {
            id: "c2",
            name: "Store B",
            description: "B",
            category: "shopping",
            platform: "Google Maps",
            searchQuery: "query-b",
          },
        ],
      }),
    });

    const response = await processChat(
      {
        message: "find stores",
        locale: "en",
        region: "INTL",
      },
      "test-user"
    );

    const openActions = (response.actions || []).filter((a) => a.type === "open_app");
    expect(openActions).toHaveLength(2);
    expect(openActions[0]?.candidateId).toBe("c1");
    expect(openActions[1]?.candidateId).toBe("c2");
  });

  it("repairs malformed candidate array JSON and keeps structured cards", async () => {
    const response = await processChat(
      {
        message: "帮我找洗车店",
        locale: "zh",
        region: "CN",
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.message).toContain("候选结果");
    expect(response.candidates?.length).toBe(2);
    expect(response.candidates?.[0]?.name).toBe("门店A");
    expect(response.candidates?.[1]?.name).toBe("门店B");
    expect(response.followUps?.[0]?.text).toContain("更近");
    expect(response.thinking?.length).toBeGreaterThan(0);
  });

  it("normalizes thinking when model returns string steps", async () => {
    vi.mocked(callAI).mockResolvedValueOnce({
      model: "qwen-flash",
      content: JSON.stringify({
        type: "text",
        message: "done",
        thinking: "1. Understand request; 2. Search options; 3. Return best answer",
      }),
    });

    const response = await processChat(
      {
        message: "help me",
        locale: "en",
        region: "INTL",
      },
      "test-user"
    );

    expect(response.type).toBe("text");
    expect(response.thinking).toEqual([
      "Understand request",
      "Search options",
      "Return best answer",
    ]);
  });

  it("parses double-encoded JSON string in CN assistant response", async () => {
    vi.mocked(callAI).mockResolvedValueOnce({
      model: "qwen-flash",
      content: doubleEncodedResultsJson,
    });

    const response = await processChat(
      {
        message: "我想健身，有没有视频推荐",
        locale: "zh",
        region: "CN",
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.message).toContain("健身视频推荐");
    expect(response.candidates?.length).toBe(1);
    expect(response.candidates?.[0]?.name).toBe("居家高效燃脂训练");
    expect(response.followUps?.[0]?.text).toContain("力量训练");
  });

  it("parses smart-quote JSON wrapped by markdown and preface text", async () => {
    vi.mocked(callAI).mockResolvedValueOnce({
      model: "qwen-flash",
      content: smartQuoteResultsJson,
    });

    const response = await processChat(
      {
        message: "推荐一些适合办公室的拉伸视频",
        locale: "zh",
        region: "CN",
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.candidates?.length).toBe(1);
    expect(response.candidates?.[0]?.platform).toBe("B站");
    expect(response.candidates?.[0]?.searchQuery).toContain("拉伸");
  });

  it("repairs candidates array when model emits extra closing brace", async () => {
    vi.mocked(callAI).mockResolvedValueOnce({
      model: "qwen-flash",
      content: extraClosingBraceInArrayJson,
    });

    const response = await processChat(
      {
        message: "我想健身，有没有视频推荐",
        locale: "zh",
        region: "CN",
      },
      "test-user"
    );

    expect(response.type).toBe("results");
    expect(response.candidates?.length).toBe(2);
    expect(response.candidates?.[0]?.name).toContain("燃脂");
    expect(response.candidates?.[1]?.name).toContain("力量训练");
  });
});
