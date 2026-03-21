import type { AppConfig, HubResponse, RateLimitInfo } from "./types.js";
import { logger } from "./logger.js";
import { parseRateLimitHeaders, waitForRateLimit, withRetry } from "./retry.js";

const FLAG_RE = /\{FLG:[^}]+\}/;

let lastRateLimit: RateLimitInfo | null = null;

const fetchWithTimeout = (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const sendAction = async (
  config: AppConfig,
  action: string,
  params?: Record<string, unknown>,
): Promise<HubResponse> => {
  // Respect rate-limit from previous call
  await waitForRateLimit(lastRateLimit);

  const body = {
    apikey: config.hubApiKey,
    task: config.taskName,
    answer: { action, ...params },
  };

  logger.request(action, params);

  const { response, body: data } = await withRetry(async () => {
    const resp = await fetchWithTimeout(
      config.verifyUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      config.requestTimeoutMs,
    );
    const json = await resp.json() as HubResponse;
    return { response: resp, body: json };
  }, config.retry);

  // Update rate-limit state
  lastRateLimit = parseRateLimitHeaders(response.headers);

  // Log headers & response
  const headerObj: Record<string, string> = {};
  response.headers.forEach((v, k) => { headerObj[k] = v; });
  logger.headers(headerObj);
  logger.response(response.status, data);

  // Return both success and business errors (4xx) to the caller —
  // the agent can read error messages and adapt.
  return data as HubResponse;
};

export const extractFlag = (response: HubResponse): string | null => {
  const text = JSON.stringify(response);
  const match = text.match(FLAG_RE);
  return match ? match[0] : null;
};
