import type { RateLimitInfo, RetryConfig } from "./types.js";
import { logger } from "./logger.js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const jitter = (ms: number) => ms * (0.8 + Math.random() * 0.4);

export const parseRateLimitHeaders = (headers: Headers): RateLimitInfo | null => {
  const remaining = headers.get("x-ratelimit-remaining")
    ?? headers.get("ratelimit-remaining")
    ?? headers.get("x-rate-limit-remaining");

  const reset = headers.get("x-ratelimit-reset")
    ?? headers.get("ratelimit-reset")
    ?? headers.get("x-rate-limit-reset");

  const retryAfter = headers.get("retry-after");

  if (remaining === null && reset === null && retryAfter === null) return null;

  let resetAtMs = 0;
  if (retryAfter) {
    const secs = Number(retryAfter);
    resetAtMs = Number.isFinite(secs) ? Date.now() + secs * 1000 : new Date(retryAfter).getTime();
  } else if (reset) {
    const num = Number(reset);
    // If it's a small number, treat as seconds-from-now; otherwise as epoch seconds
    resetAtMs = num < 1e10 ? Date.now() + num * 1000 : num * 1000;
  }

  return {
    remaining: remaining !== null ? Number(remaining) : -1,
    resetAtMs,
  };
};

export const waitForRateLimit = async (info: RateLimitInfo | null) => {
  if (!info || info.remaining > 0) return;
  const waitMs = Math.max(info.resetAtMs - Date.now(), 500);
  logger.wait(waitMs, "rate limit — waiting for reset");
  await sleep(waitMs);
};

interface RetryableResult {
  response: Response;
  body: unknown;
}

export const withRetry = async (
  fn: () => Promise<RetryableResult>,
  config: RetryConfig,
): Promise<RetryableResult> => {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn();
      const { response } = result;

      if (response.ok) return result;

      // Rate-limited (429) or server overload (503) → retry
      if (response.status === 429 || response.status === 503) {
        if (attempt === config.maxRetries) break;

        const rl = parseRateLimitHeaders(response.headers);
        let delayMs: number;

        if (rl && rl.resetAtMs > Date.now()) {
          delayMs = rl.resetAtMs - Date.now() + 500; // small buffer
        } else {
          delayMs = jitter(Math.min(config.baseDelayMs * 2 ** attempt, config.maxDelayMs));
        }

        logger.retry(attempt + 1, config.maxRetries, Math.round(delayMs),
          `HTTP ${response.status}`);
        await sleep(delayMs);
        continue;
      }

      // Other non-OK status — don't retry
      return result;
    } catch (err) {
      // Network / timeout errors → retry
      if (attempt === config.maxRetries) throw err;
      const delayMs = jitter(Math.min(config.baseDelayMs * 2 ** attempt, config.maxDelayMs));
      logger.retry(attempt + 1, config.maxRetries, Math.round(delayMs),
        (err as Error).message);
      await sleep(delayMs);
    }
  }

  throw new Error(`All ${config.maxRetries} retries exhausted`);
};
