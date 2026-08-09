import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { createThread, loadThreads } from "@/lib/chat-storage";

export const Route = createFileRoute("/chat/")({
  component: ChatIndex,
  head: () => ({
    meta: [
      { title: "Biz-Chat | AI Logic & Finance Assistant" },
      {
        name: "description",
        content:
          "Biz-Chat is Biz-Bud's AI assistant for logical reasoning, puzzles, budgeting and lending questions.",
      },
      { property: "og:title", content: "Biz-Chat | AI Logic & Finance Assistant" },
      {
        property: "og:description",
        content: "Chat with Biz-Bud's AI for logic problems and money decisions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ChatIndex() {
  const navigate = useNavigate();

  useEffect(() => {
    const existing = loadThreads();
    const thread = existing[0] ?? createThread();
    void navigate({ to: "/chat/$threadId", params: { threadId: thread.id }, replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Opening Biz-Chat...
    </div>
  );
}
