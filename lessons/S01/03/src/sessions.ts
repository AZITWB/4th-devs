const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_HISTORY_LENGTH = 100; // max messages per session

type Message = Record<string, unknown>;

interface Session {
  messages: Message[];
  lastActivity: number;
}

const store = new Map<string, Session>();

// Periodic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of store.entries()) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      store.delete(id);
    }
  }
}, 5 * 60 * 1000); // run every 5 minutes

export function getOrCreate(sessionID: string): Session {
  let session = store.get(sessionID);
  if (!session) {
    session = { messages: [], lastActivity: Date.now() };
    store.set(sessionID, session);
  }
  return session;
}

export function addMessages(sessionID: string, ...messages: Message[]): void {
  const session = getOrCreate(sessionID);
  session.messages.push(...messages);
  session.lastActivity = Date.now();

  // Trim history keeping the most recent messages
  if (session.messages.length > MAX_HISTORY_LENGTH) {
    session.messages = session.messages.slice(-MAX_HISTORY_LENGTH);
  }
}

export function getMessages(sessionID: string): Message[] {
  return getOrCreate(sessionID).messages;
}
