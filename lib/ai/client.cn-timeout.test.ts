import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("callAI CN qwen timeout budget", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();

    process.env.NEXT_PUBLIC_DEPLOYMENT_REGION = "CN";
    process.env.QWEN_API_KEY = "test-qwen-key";
    delete process.env.ASSISTANT_AI_FAST_MODE;
    delete process.env.ASSISTANT_AI_PROVIDER_TIMEOUT_MS;
    delete process.env.ASSISTANT_AI_TOTAL_TIMEOUT_MS;
    delete process.env.ASSISTANT_AI_MAX_RETRIES;

    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;

        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                choices: [{ message: { content: "ok" } }],
              }),
            } satisfies Partial<Response> as Response);
          }, 11_000);

          signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
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

  it("allows qwen3.5-flash to finish within default CN timeout", async () => {
    const { callAI } = await import("./client");

    const pending = callAI({
      messages: [{ role: "user", content: "我想要吃炸鸡" }],
      maxTokens: 200,
    });

    await vi.advanceTimersByTimeAsync(11_000);

    await expect(pending).resolves.toMatchObject({
      model: "qwen3.5-flash",
      content: "ok",
    });
  });
});
