import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AppConfig, RetryConfig } from "./types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, "..", "..", "..");
const ROOT_ENV = path.join(PROJECT_ROOT, ".env");

const RESPONSES_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/responses",
  openrouter: "https://openrouter.ai/api/v1/responses",
};

const loadRootEnv = () => {
  if (existsSync(ROOT_ENV) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(ROOT_ENV);
  }
};

const requireEnv = (key: string, hint: string): string => {
  const val = process.env[key]?.trim();
  if (!val) throw new Error(`${key} is not set. ${hint}`);
  return val;
};

const resolveAiProvider = () => {
  const requested = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (requested === "openai" || requested === "openrouter") return requested;
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.OPENROUTER_API_KEY?.trim()) return "openrouter";
  throw new Error("Set OPENAI_API_KEY or OPENROUTER_API_KEY in root .env");
};

const resolveModel = (provider: string): string => {
  const base = "gpt-4.1-mini";
  return provider === "openrouter" ? `openai/${base}` : base;
};

export const getConfig = (): AppConfig => {
  loadRootEnv();

  const provider = resolveAiProvider();
  const aiApiKey = provider === "openai"
    ? requireEnv("OPENAI_API_KEY", "Required for AI provider.")
    : requireEnv("OPENROUTER_API_KEY", "Required for AI provider.");

  const extraAiHeaders: Record<string, string> = {};
  if (provider === "openrouter") {
    const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
    const appName = process.env.OPENROUTER_APP_NAME?.trim();
    if (referer) extraAiHeaders["HTTP-Referer"] = referer;
    if (appName) extraAiHeaders["X-Title"] = appName;
  }

  const retry: RetryConfig = {
    maxRetries: 10,
    baseDelayMs: 1_000,
    maxDelayMs: 30_000,
  };

  return {
    hubApiKey: requireEnv("AIDEVS_API_KEY", "Add it to the root .env file."),
    verifyUrl: "https://hub.ag3nts.org/verify",
    taskName: "railway",
    requestTimeoutMs: 30_000,
    retry,
    aiApiKey,
    aiEndpoint: RESPONSES_ENDPOINTS[provider],
    aiModel: resolveModel(provider),
    extraAiHeaders,
  };
};
