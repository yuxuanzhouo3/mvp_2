import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = {
  subscriptionRows: [] as Array<Record<string, unknown>>,
  userDoc: {} as Record<string, unknown>,
  usageCount: 0,
};

vi.mock("@/lib/config/deployment.config", () => ({
  isChinaDeployment: vi.fn(() => true),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock("./recommendation-limit-config", () => ({
  getRecommendationUsageLimitConfig: vi.fn(async () => ({
    freeMonthlyLimit: 9,
    vipDailyLimit: 17,
    enterpriseDailyLimit: -1,
    updatedAt: "2026-03-09T00:00:00.000Z",
    source: "storage",
  })),
  resolveRecommendationLimitForPlan: vi.fn((planType: "free" | "pro" | "enterprise", config) => {
    if (planType === "free") {
      return { periodType: "monthly", periodLimit: config.freeMonthlyLimit, isUnlimited: false };
    }
    if (planType === "pro") {
      return { periodType: "daily", periodLimit: config.vipDailyLimit, isUnlimited: false };
    }
    return { periodType: "daily", periodLimit: config.enterpriseDailyLimit, isUnlimited: true };
  }),
}));

vi.mock("@cloudbase/node-sdk", () => ({
  default: {
    init: vi.fn(() => ({
      database: () => ({
        command: {
          gte: vi.fn(() => ({
            and: vi.fn(() => ({})),
          })),
          lte: vi.fn(() => ({})),
        },
        collection: (name: string) => {
          if (name === "user_subscriptions") {
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    get: vi.fn(async () => ({ data: mockState.subscriptionRows })),
                  })),
                })),
              })),
            };
          }

          if (name === "users") {
            return {
              doc: vi.fn(() => ({
                get: vi.fn(async () => ({ data: mockState.userDoc })),
              })),
            };
          }

          if (name === "recommendation_usage") {
            return {
              where: vi.fn(() => ({
                count: vi.fn(async () => ({ total: mockState.usageCount })),
              })),
            };
          }

          throw new Error(`Unexpected collection: ${name}`);
        },
      }),
    })),
  },
}));

describe("CN recommendation usage limit config", () => {
  beforeEach(() => {
    vi.resetModules();
    mockState.subscriptionRows = [];
    mockState.userDoc = {};
    mockState.usageCount = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses configured free monthly shake limit", async () => {
    mockState.userDoc = { pro: false };
    mockState.usageCount = 4;

    const { getUserUsageStats } = await import("./usage-tracker");
    const stats = await getUserUsageStats("user-free");

    expect(stats.planType).toBe("free");
    expect(stats.periodType).toBe("monthly");
    expect(stats.periodLimit).toBe(9);
    expect(stats.remainingUsage).toBe(5);
  });

  it("uses configured VIP daily shake limit", async () => {
    mockState.userDoc = { pro: true };
    mockState.usageCount = 6;

    const { getUserUsageStats } = await import("./usage-tracker");
    const stats = await getUserUsageStats("user-pro");

    expect(stats.planType).toBe("pro");
    expect(stats.periodType).toBe("daily");
    expect(stats.periodLimit).toBe(17);
    expect(stats.remainingUsage).toBe(11);
  });
});

