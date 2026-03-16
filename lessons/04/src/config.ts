import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AppConfig, RuntimeOptions } from "./types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const LESSON_ROOT = path.resolve(MODULE_DIR, "..");
const PROJECT_ROOT = path.resolve(LESSON_ROOT, "..", "..");
const ROOT_ENV_FILE = path.join(PROJECT_ROOT, ".env");
const DOCS_BASE_URL = "https://hub.ag3nts.org/dane/doc/";
const VERIFY_URL = "https://hub.ag3nts.org/verify";
const RESPONSES_ENDPOINTS = {
  openai: "https://api.openai.com/v1/responses",
  openrouter: "https://openrouter.ai/api/v1/responses"
} as const;

const loadRootEnv = () => {
  if (!existsSync(ROOT_ENV_FILE) || typeof process.loadEnvFile !== "function") {
    return;
  }

  process.loadEnvFile(ROOT_ENV_FILE);
};

const requireEnv = (value: string | undefined, message: string) => {
  const normalizedValue = value?.trim() ?? "";

  if (!normalizedValue) {
    throw new Error(message);
  }

  return normalizedValue;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const resolveAiProvider = () => {
  const requestedProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());

  if (requestedProvider === "openai" || requestedProvider === "openrouter") {
    return requestedProvider;
  }

  if (hasOpenAiKey) {
    return "openai";
  }

  if (hasOpenRouterKey) {
    return "openrouter";
  }

  throw new Error(
    "Brak klucza do modelu. Ustaw OPENAI_API_KEY albo OPENROUTER_API_KEY w pliku .env."
  );
};

export const getConfig = (options: RuntimeOptions): AppConfig => {
  loadRootEnv();

  const aiProvider = resolveAiProvider();
  const aiApiKey = aiProvider === "openai"
    ? requireEnv(
      process.env.OPENAI_API_KEY,
      "AI_PROVIDER=openai wymaga OPENAI_API_KEY w pliku .env."
    )
    : requireEnv(
      process.env.OPENROUTER_API_KEY,
      "AI_PROVIDER=openrouter wymaga OPENROUTER_API_KEY w pliku .env."
    );

  const modelName = process.env.MODEL_NAME?.trim() || "gpt-5-mini";
  const visionModel = process.env.VISION_MODEL?.trim() || modelName;
  const hubApiKey = options.submit
    ? requireEnv(
      process.env.AIDEVS_API_KEY || process.env.HUB_API_KEY,
      "Wysyłka do verify wymaga AIDEVS_API_KEY albo HUB_API_KEY w pliku .env."
    )
    : (process.env.AIDEVS_API_KEY || process.env.HUB_API_KEY || "").trim();

  return {
    projectRoot: PROJECT_ROOT,
    lessonRoot: LESSON_ROOT,
    cacheDir: path.join(LESSON_ROOT, ".cache", "docs"),
    docsBaseUrl: DOCS_BASE_URL,
    verifyUrl: VERIFY_URL,
    aiProvider,
    aiApiKey,
    hubApiKey,
    modelName,
    visionModel,
    requestTimeoutMs: parsePositiveInt(process.env.REQUEST_TIMEOUT_MS, 30_000),
    visionTimeoutMs: parsePositiveInt(process.env.VISION_TIMEOUT_MS, 90_000),
    maxVisionAttempts: parsePositiveInt(process.env.MAX_VISION_ATTEMPTS, 2),
    responsesApiEndpoint: RESPONSES_ENDPOINTS[aiProvider],
    extraApiHeaders: aiProvider === "openrouter"
      ? {
        ...(process.env.OPENROUTER_HTTP_REFERER?.trim()
          ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER.trim() }
          : {}),
        ...(process.env.OPENROUTER_APP_NAME?.trim()
          ? { "X-Title": process.env.OPENROUTER_APP_NAME.trim() }
          : {})
      }
      : {},
    routeCodeOverride: options.routeCodeOverride?.trim() || process.env.ROUTE_CODE_OVERRIDE?.trim() || ""
  };
};