import { getConfig } from "./config.js";
import { sendAction, extractFlag } from "./hub.js";
import { chat, extractToolCalls, extractText } from "./ai.js";
import type { RawToolCall } from "./ai.js";
import { logger } from "./logger.js";
import type { AppConfig, HubResponse, ToolResult } from "./types.js";

const MAX_STEPS = 15;
const discoverOnly = process.argv.includes("--discover");

const TOOL_DEF = {
  type: "function" as const,
  name: "send_hub_action",
  description: "Send an action to the railway control API.",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", description: "The API action name: help, reconfigure, getstatus, setstatus, save" },
      route: { type: "string", description: "Route identifier, e.g. 'x-01'. Required for: reconfigure, getstatus, setstatus, save." },
      value: { type: "string", description: "Status value: RTOPEN or RTCLOSE. Required for: setstatus." },
    },
    required: ["action"],
    additionalProperties: false,
  },
};

const buildSystemPrompt = (helpResponse: HubResponse) => `You are an agent that activates railway route X-01 using the railway control API.

## API Documentation (from help action)
${JSON.stringify(helpResponse, null, 2)}

## Your Goal
Activate route X-01 (Gdańsk–Żarnowiec) by setting its status to RTOPEN.

## Rules
- Use the send_hub_action tool to interact with the API.
- Follow the API documentation exactly — use the correct action names and parameters.
- Read error messages carefully — they tell you what went wrong.
- When you see a flag {FLG:...} in any response, report it immediately and stop.
- Be efficient — minimize the number of API calls.`;

const executeTool = async (
  config: AppConfig,
  callId: string,
  args: Record<string, unknown>,
): Promise<{ result: ToolResult; flag: string | null }> => {
  const { action, ...params } = args as { action: string; [k: string]: unknown };
  const res = await sendAction(config, action, Object.keys(params).length ? params : undefined);
  const flag = extractFlag(res);
  return {
    result: { type: "function_call_output", call_id: callId, output: JSON.stringify(res) },
    flag,
  };
};

const main = async () => {
  const config = getConfig();

  // Step 1: Get API documentation
  logger.section("Discovery — help");
  const help = await sendAction(config, "help");
  const helpFlag = extractFlag(help);
  if (helpFlag) { logger.flag(helpFlag); return; }

  if (discoverOnly) {
    console.log("\n--- Full help response ---");
    console.log(JSON.stringify(help, null, 2));
    return;
  }

  // Step 2: Agent loop with Function Calling
  logger.section("Agent — starting");
  const instructions = buildSystemPrompt(help);
  const input: unknown[] = [
    { role: "user", content: "Activate railway route X-01. Set its status to open." },
  ];

  for (let step = 1; step <= MAX_STEPS; step++) {
    logger.info(`Step ${step}/${MAX_STEPS}`);

    const response = await chat(config, { input, tools: [TOOL_DEF], instructions });
    const toolCalls = extractToolCalls(response);

    if (toolCalls.length === 0) {
      const text = extractText(response);
      logger.info("Agent finished", text);
      return;
    }

    // Add raw tool calls to conversation (preserves fc_ IDs)
    for (const tc of toolCalls) {
      input.push(tc);
    }

    // Execute tools sequentially
    for (const tc of toolCalls) {
      const args = JSON.parse(tc.arguments) as Record<string, unknown>;
      logger.info(`Tool call: ${tc.name}`, JSON.stringify(args));
      const { result, flag } = await executeTool(config, tc.call_id, args);
      input.push(result);

      if (flag) {
        logger.flag(flag);
        return;
      }
    }
  }

  logger.warn("Max steps reached without completing the task.");
};

main().catch((err) => {
  logger.error("Fatal", (err as Error).message);
  process.exit(1);
});
