export interface HubRequest {
  apikey: string;
  task: string;
  answer: Record<string, unknown>;
}

export interface HubResponse {
  code?: number;
  message?: string;
  [key: string]: unknown;
}

export interface RateLimitInfo {
  remaining: number;
  resetAtMs: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  type: "function_call_output";
  call_id: string;
  output: string;
}

export interface AppConfig {
  hubApiKey: string;
  verifyUrl: string;
  taskName: string;
  requestTimeoutMs: number;
  retry: RetryConfig;
  aiApiKey: string;
  aiEndpoint: string;
  aiModel: string;
  extraAiHeaders: Record<string, string>;
}
