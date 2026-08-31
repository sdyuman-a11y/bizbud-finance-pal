import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { deriveTitle, upsertThread, type ChatThread } from "@/lib/chat-storage";

const DEFAULT_SUGGESTIONS = [
  "If all Blips are Blaps and some Blaps are Blops, what follows?",
  "A loan of $20,000 at 9% for 4 years — is it worth refinancing at 7%?",
  "Three switches, one bulb, one trip upstairs. How do I solve it?",
];

export function ChatWindow({
  thread,
  context,
  suggestions,
  emptyTitle = "Ask FinBuddy anything",
  emptyHint = "Logic puzzles, reasoning problems, budgeting and lending questions.",
  persist = true,
  className = "h-[70vh] min-h-[520px]",
}: {
  thread: ChatThread;
  /** Extra factual grounding (e.g. portfolio + news) passed to the same FinBuddy assistant. */
  context?: string;
  suggestions?: string[];
  emptyTitle?: string;
  emptyHint?: string;
  persist?: boolean;
  className?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { ...body, messages, context: contextRef.current ?? null },
        }),
      }),
    [],
  );

  const SUGGESTIONS = suggestions ?? DEFAULT_SUGGESTIONS;

  const { messages, sendMessage, status, stop } = useChat({
    id: thread.id,
    messages: thread.messages,
    transport,
    onError: (error) => toast.error(error.message || "FinBuddy could not respond."),
  });


  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [thread.id, status]);

  useEffect(() => {
    if (!persist || isLoading || messages.length === 0) return;
    upsertThread({
      id: thread.id,
      title: deriveTitle(messages as UIMessage[]),
      updatedAt: Date.now(),
      messages: messages as UIMessage[],
    });
  }, [messages, isLoading, thread.id, persist]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || isLoading) return;
    setInput("");
    void sendMessage({ text: value });
  };

  return (
    <div className={`surface flex flex-col overflow-hidden ${className}`}>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="ink-panel flex size-11 items-center justify-center rounded-xl">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">{emptyTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>

            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="max-w-xs rounded-full border border-border px-3.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("")
              .trim();
            const isUser = m.role === "user";
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert [&_li]:my-0.5 [&_p]:my-1.5 [&_strong]:font-semibold">
                      <ReactMarkdown>{text || "..."}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {status === "submitted" ? (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl border border-border bg-card px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-end gap-2 border-t border-border/70 p-3"
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder="Ask a logic or finance question..."
          className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={() => stop()}
            className="flex size-11 items-center justify-center rounded-xl border border-border text-muted-foreground"
            aria-label="Stop generating"
          >
            <Square className="size-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </button>
        )}
      </form>
    </div>
  );
}
