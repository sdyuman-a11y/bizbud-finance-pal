import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPT = `You are FinBuddy, the AI assistant inside SecuraFlow, a financial assistant app.
You excel at logical thinking: puzzles, riddles, deductions, math, probability, and step-by-step reasoning.
You also answer personal finance and small-business questions (budgeting, loans/EMI, cash flow, lending risk).
Always reason carefully and show the key steps of your logic before stating the final answer clearly.
Use concise markdown. Bold the final answer.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, context } = (await request.json()) as {
          messages?: unknown;
          context?: unknown;
        };
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const grounding =
          typeof context === "string" && context.trim()
            ? `\n\nThe user is viewing their SecuraFlow portfolio. Use ONLY the data below for anything about their holdings, prices or news. Never invent prices, holdings, headlines or statistics; if the data is not present, say so.\n\n${context.slice(0, 12000)}`
            : "";

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: SYSTEM_PROMPT + grounding,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });


        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
