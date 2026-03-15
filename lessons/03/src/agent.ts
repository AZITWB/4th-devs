import { OPENAI_API_KEY, RESPONSES_API_ENDPOINT, MODEL, MAX_TOOL_ROUNDS, SYSTEM_PROMPT } from "./config.js";
import { toolDefinitions, toolHandlers } from "./tools.js";
import { getMessages, addMessages } from "./sessions.js";

type Message = Record<string, unknown>;
type ResponseOutput = { type: string; call_id?: string; arguments?: string; name?: string; content?: unknown[] };

// ─── OpenAI Responses API client ────────────────────────────────────────────

async function callModel(input: Message[]): Promise<Record<string, unknown>> {
  const response = await fetch(RESPONSES_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input,
      tools: toolDefinitions,
      tool_choice: "auto",
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = await response.json() as Record<string, unknown>;

  if (!response.ok || (data.error as Record<string, unknown> | undefined)) {
    const msg = (data?.error as Record<string, unknown>)?.message ?? `HTTP ${response.status}`;
    throw new Error(`OpenAI API error: ${msg}`);
  }

  return data;
}

function extractToolCalls(response: Record<string, unknown>): ResponseOutput[] {
  const output = response.output as ResponseOutput[] | undefined;
  return (output ?? []).filter((item) => item.type === "function_call");
}

function extractText(response: Record<string, unknown>): string | null {
  if (typeof (response as Record<string, unknown>).output_text === "string") {
    return (response as Record<string, unknown>).output_text as string;
  }
  const output = response.output as ResponseOutput[] | undefined;
  const message = (output ?? []).find((item) => item.type === "message");
  const content = message?.content as { text?: string }[] | undefined;
  return content?.[0]?.text ?? null;
}

// ─── Agent loop ───────────────────────────────────────────────────────────────

export async function run(sessionID: string, userMsg: string): Promise<string> {
  // Build input: existing history + new user message
  const history = getMessages(sessionID);
  const userMessage: Message = { role: "user", content: userMsg };
  const input = [...history, userMessage];

  console.log(`[agent] session=${sessionID} history=${history.length} msg="${userMsg.slice(0, 80)}"`);

  let messages = input;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    console.log(`[agent] round=${round + 1} messages=${messages.length}`);

    const response = await callModel(messages);
    const toolCalls = extractToolCalls(response);

    if (toolCalls.length === 0) {
      // Model returned a text response — persist history and return
      const text = extractText(response) ?? "Przepraszam, coś poszło nie tak.";
      console.log(`[agent] text response: "${text.slice(0, 120)}"`);

      addMessages(sessionID, userMessage, ...((response.output as Message[]) ?? []));
      return text;
    }

    // Execute all tool calls in parallel
    console.log(`[agent] tool calls: ${toolCalls.map((tc) => tc.name).join(", ")}`);

    const toolResults = await Promise.all(
      toolCalls.map(async (call) => {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.arguments ?? "{}") as Record<string, unknown>;
        } catch {
          console.warn(`[agent] failed to parse args for ${call.name}`);
        }

        console.log(`[agent] → ${call.name}(${JSON.stringify(args)})`);

        const handler = toolHandlers[call.name ?? ""];
        let result: unknown;
        if (!handler) {
          result = { error: `Unknown tool: ${call.name}`, recoveryHint: "Use one of the available tools: check_package, redirect_package." };
        } else {
          try {
            result = await handler(args);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            result = { error: msg, recoveryHint: "Tool execution failed. Try again or check the parameters." };
          }
        }

        console.log(`[agent] ↳ ${JSON.stringify(result).slice(0, 200)}`);

        return {
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        } as Message;
      })
    );

    // Append model output and tool results to conversation
    messages = [
      ...messages,
      ...((response.output as Message[]) ?? []),
      ...toolResults,
    ];
  }

  console.warn(`[agent] max tool rounds (${MAX_TOOL_ROUNDS}) reached for session=${sessionID}`);

  // Persist what we have and return a safe fallback
  addMessages(sessionID, userMessage);
  return "Przepraszam, przekroczono limit operacji. Spróbuj ponownie.";
}
