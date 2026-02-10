import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", () => ({
  callAI: vi.fn(),
}));

vi.mock("./preference-manager", () => ({
  getUserPreferences: vi.fn(async () => []),
  savePreference: vi.fn(),
}));

vi.mock("./reverse-geocode", () => ({
  buildLocationContext: vi.fn(async () => "location hint"),
}));

vi.mock("@/lib/outbound/link-resolver", () => ({
  resolveCandidateLink: vi.fn(),
}));

vi.mock("@/lib/outbound/outbound-url", () => ({
  buildOutboundHref: vi.fn(),
}));

import { processChat } from "./chat-engine";

describe("processChat nearby clarify", () => {
  it("asks for location when message contains 中文 nearby keyword", async () => {
    const response = await processChat(
      {
        message: "帮我找附近好吃的",
        locale: "zh",
        region: "INTL",
      },
      "test-user"
    );

    expect(response.type).toBe("clarify");
    expect(response.intent).toBe("search_nearby");
    expect(response.clarifyQuestions?.length).toBeGreaterThan(0);
  });

  it("asks for location when message contains English nearby keyword", async () => {
    const response = await processChat(
      {
        message: "find gyms nearby",
        locale: "en",
        region: "INTL",
      },
      "test-user"
    );

    expect(response.type).toBe("clarify");
    expect(response.intent).toBe("search_nearby");
    expect(response.clarifyQuestions?.[0]).toContain("location");
  });
});

