const ts = () => new Date().toISOString();

const write = (level: string, msg: string, detail?: string) => {
  const suffix = detail ? ` ${detail}` : "";
  console.log(`[${ts()}] [${level}] ${msg}${suffix}`);
};

export const logger = {
  info: (msg: string, detail?: string) => write("INFO", msg, detail),
  warn: (msg: string, detail?: string) => write("WARN", msg, detail),
  error: (msg: string, detail?: string) => write("ERROR", msg, detail),
  section: (title: string) => console.log(`\n=== ${title} ===`),

  request: (action: string, params?: Record<string, unknown>) => {
    const extra = params && Object.keys(params).length
      ? ` params=${JSON.stringify(params)}`
      : "";
    write("HTTP", `→ action="${action}"${extra}`);
  },

  response: (status: number, body: unknown) => {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    const truncated = text.length > 500 ? `${text.slice(0, 500)}…` : text;
    write("HTTP", `← ${status}`, truncated);
  },

  headers: (h: Record<string, string>) => {
    const relevant = Object.entries(h)
      .filter(([k]) => /rate|limit|retry|reset/i.test(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (relevant) write("RATE", relevant);
  },

  retry: (attempt: number, max: number, delayMs: number, reason: string) => {
    write("RETRY", `${attempt}/${max} waiting ${delayMs}ms`, reason);
  },

  wait: (ms: number, reason: string) => {
    write("WAIT", `${Math.ceil(ms / 1000)}s`, reason);
  },

  flag: (flag: string) => {
    console.log(`\n🚩 FLAG FOUND: ${flag}\n`);
  },
};
