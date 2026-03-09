import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("CN recommendation qwen timeout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();

    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "CN";
    process.env.QWEN_API_KEY = "test-qwen-key";
    process.env.RECOMMENDATION_AI_PROVIDER_TIMEOUT_MS = "45000";

    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;

        return new Promise((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => {
              reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
            },
            { once: true }
          );
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();

    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    }

    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      process.env[key] = value;
    }
  });

  it("uses configurable recommendation timeout instead of hard-coded 30s", async () => {
    const { callRecommendationAI } = await import("./zhipu-recommendation");

    let settled = false;
    const pending = callRecommendationAI([{ role: "user", content: "test prompt" }]);
    const observedError = pending.catch((error) => error);
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );

    await vi.advanceTimersByTimeAsync(30_000);
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(15_000);

    await expect(observedError).resolves.toMatchObject({
      kind: "http_error",
      provider: "qwen3.5-plus",
      status: 408,
    });
  });
});
