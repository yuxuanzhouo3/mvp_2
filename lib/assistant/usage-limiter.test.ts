import { beforeEach, describe, expect, it, vi } from "vitest";

const isChinaDeploymentMock = vi.fn(() => true);

const cloudbaseState = {
  userSubscriptions: [] as Array<Record<string, unknown>>,
  usersByDocId: new Map<string, Record<string, unknown>>(),
  usersByUserId: [] as Array<Record<string, unknown>>,
  assistantUsageCount: 0,
};

function createCloudbaseCollection(name: string) {
  const state = {
    whereCondition: {} as Record<string, unknown>,
  };

  return {
    where(condition: Record<string, unknown>) {
      state.whereCondition = condition;
      return this;
    },
    orderBy() {
      return this;
    },
    limit() {
      return this;
    },
    skip() {
      return this;
    },
    doc(id: string) {
      return {
        get: vi.fn(async () => {
          if (name !== "users") {
            return { data: [] };
          }

          const user = cloudbaseState.usersByDocId.get(id);
          return { data: user ? [user] : [] };
        }),
      };
    },
    async get() {
      if (name === "user_subscriptions") {
        const userId = state.whereCondition.user_id;
        const status = state.whereCondition.status;
        const data = cloudbaseState.userSubscriptions.filter((item) => {
          const matchesUserId = userId === undefined || item.user_id === userId;
          const matchesStatus = status === undefined || item.status === status;
          return matchesUserId && matchesStatus;
        });
        return { data };
      }

      if (name === "users") {
        const userId = state.whereCondition.user_id;
        const data = cloudbaseState.usersByUserId.filter((item) =>
          userId === undefined ? true : item.user_id === userId
        );
        return { data };
      }

      return { data: [] };
    },
    async count() {
      if (name === "assistant_usage") {
        return { total: cloudbaseState.assistantUsageCount };
      }

      return { total: 0 };
    },
    async add() {
      return { id: "mock-id" };
    },
  };
}

const cloudbaseDatabaseMock = {
  command: {
    gte: vi.fn((value: string) => ({ $gte: value })),
  },
  collection: vi.fn((name: string) => createCloudbaseCollection(name)),
};

vi.mock("@/lib/config/deployment.config", () => ({
  isChinaDeployment: isChinaDeploymentMock,
}));

vi.mock("@cloudbase/node-sdk", () => ({
  default: {
    init: vi.fn(() => ({
      database: () => cloudbaseDatabaseMock,
    })),
  },
}));

describe("assistant usage limiter (CN)", () => {
  beforeEach(() => {
    isChinaDeploymentMock.mockReturnValue(true);

    cloudbaseState.userSubscriptions = [];
    cloudbaseState.usersByDocId = new Map();
    cloudbaseState.usersByUserId = [];
    cloudbaseState.assistantUsageCount = 0;

    cloudbaseDatabaseMock.collection.mockClear();
    cloudbaseDatabaseMock.command.gte.mockClear();

    vi.resetModules();
  });

  it("treats CN enterprise subscriber as unlimited", async () => {
    const userId = "cn-enterprise-user";
    cloudbaseState.userSubscriptions = [
      {
        user_id: userId,
        status: "active",
        plan_type: "enterprise",
        subscription_end: "2099-12-31T23:59:59.000Z",
      },
    ];
    cloudbaseState.assistantUsageCount = 999;

    const { canUseAssistant } = await import("./usage-limiter");
    const result = await canUseAssistant(userId);

    expect(result.allowed).toBe(true);
    expect(result.stats.planType).toBe("enterprise");
    expect(result.stats.limit).toBe(-1);
    expect(result.stats.remaining).toBe(-1);
    expect(result.stats.periodType).toBe("daily");
  });

  it("recognizes CN enterprise plan from users collection fallback", async () => {
    const userId = "cn-enterprise-fallback-user";
    cloudbaseState.userSubscriptions = [];
    cloudbaseState.usersByDocId.set(userId, {
      _id: userId,
      subscription_plan: "企业版",
      subscription_status: "active",
    });

    const { getAssistantUsageStats } = await import("./usage-limiter");
    const stats = await getAssistantUsageStats(userId);

    expect(stats.planType).toBe("enterprise");
    expect(stats.limit).toBe(-1);
    expect(stats.remaining).toBe(-1);
  });
});

