import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { PORT } from "./config.js";
import { run } from "./agent.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

// ─── Request handler ──────────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Health check
  if (url.pathname === "/" && req.method === "GET") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  // Main proxy endpoint — accepts any path for flexibility with ngrok / Hub
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await parseBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const { sessionID, msg } = body;

    if (typeof sessionID !== "string" || sessionID.trim().length === 0) {
      sendJson(res, 400, { error: "sessionID is required and must be a non-empty string" });
      return;
    }

    if (typeof msg !== "string" || msg.trim().length === 0) {
      sendJson(res, 400, { error: "msg is required and must be a non-empty string" });
      return;
    }

    if (msg.length > 4000) {
      sendJson(res, 400, { error: "msg exceeds maximum length of 4000 characters" });
      return;
    }

    const sid = sessionID.trim();
    const userMsg = msg.trim();

    console.log(`[server] POST ${url.pathname} session=${sid} msg="${userMsg.slice(0, 80)}"`);

    try {
      const response = await run(sid, userMsg);
      console.log(`[server] response="${response.slice(0, 120)}"`);
      sendJson(res, 200, { msg: response });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[server] error: ${message}`);
      sendJson(res, 500, { error: "Internal server error" });
    }

    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

// ─── Start server ─────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("[server] unhandled error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  console.log(`[server] POST http://localhost:${PORT}/ — { sessionID, msg }`);
});
