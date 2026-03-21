const timestamp = () => new Date().toISOString();

const write = (level: string, message: string, details?: string) => {
  const suffix = details ? ` ${details}` : "";
  console.log(`[${timestamp()}] [${level}] ${message}${suffix}`);
};

export const logger = {
  info: (message: string, details?: string) => write("INFO", message, details),
  warn: (message: string, details?: string) => write("WARN", message, details),
  error: (message: string, details?: string) => write("ERROR", message, details),
  section: (title: string) => console.log(`\n=== ${title} ===`)
};