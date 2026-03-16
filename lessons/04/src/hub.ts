import type { AppConfig, DocKind, HubVerifyResponse } from "./types.js";

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const assertOk = async (response: Response, docName: string) => {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new Error(`Nie udało się pobrać ${docName}: HTTP ${response.status} ${body}`.trim());
};

export const fetchRemoteDoc = async (
  config: AppConfig,
  name: string,
  kind: DocKind
) => {
  const url = new URL(name, config.docsBaseUrl).toString();
  const response = await fetchWithTimeout(url, { method: "GET" }, config.requestTimeoutMs);
  await assertOk(response, name);

  if (kind === "binary") {
    return Buffer.from(await response.arrayBuffer());
  }

  return await response.text();
};

export const submitAnswer = async (
  config: AppConfig,
  declaration: string
): Promise<HubVerifyResponse> => {
  const response = await fetchWithTimeout(
    config.verifyUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: config.hubApiKey,
        task: "sendit",
        answer: {
          declaration
        }
      })
    },
    config.requestTimeoutMs
  );

  const data = await response.json() as HubVerifyResponse;

  if (!response.ok) {
    throw new Error(data.message || `Verify zwrócił HTTP ${response.status}`);
  }

  return data;
};