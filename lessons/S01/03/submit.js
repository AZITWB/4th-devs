// Zgłoszenie zadania proxy do Hub
// Użycie: node submit.js <ngrok-url> [sessionID]
// Przykład: node submit.js https://petra-impeccable-amberly.ngrok-free.dev

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT_ENV_FILE = path.join(ROOT_DIR, ".env");
if (existsSync(ROOT_ENV_FILE) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(ROOT_ENV_FILE);
}

const HUB_API_KEY = process.env.AIDEVS_API_KEY?.trim();
if (!HUB_API_KEY) {
  console.error("Brak AIDEVS_API_KEY w pliku .env");
  process.exit(1);
}

const url = process.argv[2] ?? "https://petra-impeccable-amberly.ngrok-free.dev";
const sessionID = process.argv[3] ?? "test-session-01";

const body = {
  apikey: HUB_API_KEY,
  task: "proxy",
  answer: { url, sessionID },
};

console.log("Wysyłam zgłoszenie:", JSON.stringify(body, null, 2));

const res = await fetch("https://hub.ag3nts.org/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const data = await res.json();
console.log("Odpowiedź Hub:", JSON.stringify(data, null, 2));
