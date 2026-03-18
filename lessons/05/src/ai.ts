import type { AppConfig, ToolCall } from "./types.js";

interface ChatOptions {
  model?: string;
  input: unknown;
  tools?: unknown[];
  instructions?: string;
}

interface ChatResponse {
  output: Array<{ type: string; [key: string]: unknown }>;
  output_text?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export const chat = async (config: AppConfig, options: ChatOptions): Promise<ChatResponse> => {
  const body: Record<string, unknown> = {
    model: options.model ?? config.aiModel,
    input: options.input,
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }
  if (options.instructions) body.instructions = options.instructions;

  const res = await fetch(config.aiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.aiApiKey}`,
      ...config.extraAiHeaders,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as ChatResponse & { error?: { message?: string } };

  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `AI API error ${res.status}`);
  }

  return data;
};

export interface RawToolCall {
  type: "function_call";
  id: string;
  call_id: string;
  name: string;
  arguments: string;
}

export const extractToolCalls = (response: ChatResponse): RawToolCall[] =>
  response.output
    .filter((item): item is Record<string, unknown> & { type: "function_call" } =>
      item.type === "function_call")
    .map((item) => ({
      type: "function_call" as const,
      id: item.id as string,
      call_id: item.call_id as string,
      name: item.name as string,
      arguments: item.arguments as string,
    }));

export const extractText = (response: ChatResponse): string =>
  response.output_text ?? "";
