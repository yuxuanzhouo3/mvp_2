import { describe, expect, it, vi } from "vitest";

const malformedResultsJson =
  '{"type":"results","message":"找到了以下候选结果：","intent":"search_nearby","candidates":[{"id":"1","name":"门店A","description":"描述A","category":"汽车服务","distance":"1.2km","rating":4.6,"priceRange":"¥30-80","platform":"高德地图","searchQuery":"洗车 店"},"{"id":"2","name":"门店B","description":"描述B","category":"汽车服务","distance":"2.8km","rating":4.4,"priceRange":"¥25-60","platform":"大众点评","searchQuery":"洗车 店"}],"followUps":[{"text":"要不要更近一点？","type":"refine"}]}'

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
  });
});

