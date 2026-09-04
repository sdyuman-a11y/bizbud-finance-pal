import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ChatWindow } from "@/components/chat-window";
import {
  createThread,
  deleteThread,
  loadThreads,
  newThreadId,
  type ChatThread,
} from "@/lib/chat-storage";

export const Route = createFileRoute("/chat/$threadId")({
  component: ChatThreadPage,
  head: () => ({
    meta: [
      { title: "FinBuddy | SecuraFlow AI Assistant" },
      {
        name: "description",
        content:
          "Ask FinBuddy logical thinking questions, puzzles and finance problems inside SecuraFlow.",
      },
      { property: "og:title", content: "FinBuddy | SecuraFlow AI Assistant" },
      {
        property: "og:description",
        content: "Step-by-step reasoning for logic puzzles, budgets and loans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ChatThreadPage() {
  const { threadId } = useParams({ from: "/chat/$threadId" });
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ChatThread[] | null>(null);

  useEffect(() => {
    const stored = loadThreads();
    const found = stored.find((t) => t.id === threadId);
    if (found) {
      setThreads(stored);
      return;
    }
    createThread(threadId);
    setThreads(loadThreads());
  }, [threadId]);

  const active = threads?.find((t) => t.id === threadId);

  const startNew = () => {
    const id = newThreadId();
    createThread(id);
    setThreads(loadThreads());
    void navigate({ to: "/chat/$threadId", params: { threadId: id } });
  };

  const removeThread = (id: string) => {
    const remaining = deleteThread(id);
    setThreads(remaining);
    if (id === threadId) {
      const next = remaining[0] ?? createThread();
      setThreads(loadThreads());
      void navigate({ to: "/chat/$threadId", params: { threadId: next.id }, replace: true });
    }
  };

  return (
    <AppShell
      title="FinBuddy"
      subtitle="Your AI thinking partner — logic puzzles, reasoning problems, and money questions, answered step by step."
      tabs={[
        { to: "/individual", label: "Budget" },
        { to: "/business", label: "Business" },
        { to: "/chat", label: "FinBuddy" },
      ]}
    >
      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="surface flex max-h-[70vh] flex-col overflow-hidden p-2">
          <button
            type="button"
            onClick={startNew}
            className="mb-2 flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New chat
          </button>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {(threads ?? []).map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-1 rounded-lg px-1 ${
                  t.id === threadId ? "bg-secondary" : "hover:bg-secondary/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    void navigate({ to: "/chat/$threadId", params: { threadId: t.id } })
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-xs"
                >
                  <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeThread(t.id)}
                  aria-label={`Delete ${t.title}`}
                  className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {active ? (
          <ChatWindow key={active.id} thread={active} />
        ) : (
          <div className="surface flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
            Loading conversation...
          </div>
        )}
      </div>
    </AppShell>
  );
}
