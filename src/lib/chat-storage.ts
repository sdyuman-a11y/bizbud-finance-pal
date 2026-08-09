import type { UIMessage } from "ai";

export type ChatThread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

const KEY = "bizz-chat-threads";

export function isBrowser() {
  return typeof window !== "undefined";
}

export function newThreadId() {
  if (isBrowser() && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 12);
}

export function loadThreads(): ChatThread[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as ChatThread[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: ChatThread[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(threads));
  } catch {
    /* storage full or unavailable */
  }
}

export function upsertThread(next: ChatThread) {
  const threads = loadThreads();
  const idx = threads.findIndex((t) => t.id === next.id);
  if (idx >= 0) threads[idx] = next;
  else threads.unshift(next);
  threads.sort((a, b) => b.updatedAt - a.updatedAt);
  saveThreads(threads);
  return threads;
}

export function deleteThread(id: string) {
  const threads = loadThreads().filter((t) => t.id !== id);
  saveThreads(threads);
  return threads;
}

export function createThread(id = newThreadId()): ChatThread {
  const thread: ChatThread = { id, title: "New chat", updatedAt: Date.now(), messages: [] };
  upsertThread(thread);
  return thread;
}

export function messageText(message: UIMessage) {
  return message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

export function deriveTitle(messages: UIMessage[]) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text = messageText(first);
  if (!text) return "New chat";
  return text.length > 42 ? `${text.slice(0, 42)}...` : text;
}
