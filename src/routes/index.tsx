import { createFileRoute, Link } from "@tanstack/react-router";
import { User, Building2, ArrowRight, Wallet, Sparkles, LineChart } from "lucide-react";
import { HeaderControls } from "@/components/header-controls";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FInvest — Budget, Loan & Cash Flow Assistant" },
      {
        name: "description",
        content:
          "FInvest is a financial assistant for individuals and businesses: budget planning, loan comparison, cash flow analysis and lending decisions.",
      },
      { property: "og:title", content: "FInvest — Budget, Loan & Cash Flow Assistant" },
      {
        property: "og:description",
        content:
          "Plan budgets, compare bank loans, analyze business cash flow and evaluate borrowers — all in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6">
        <div className="flex items-center gap-2.5">
          <span className="ink-panel flex size-9 items-center justify-center rounded-xl">
            <Wallet className="size-4.5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">FInvest</span>
        </div>
        <HeaderControls />
      </header>


      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pb-16">
        <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
          Financial assistant
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] font-semibold sm:text-6xl">
          Money decisions,
          <br />
          worked out on paper.
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          Tell us who you are and FInvest opens the right desk — a household budget and loan bench,
          or a business cash flow and lending review.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <ChoiceCard
            to="/individual"
            icon={<User className="size-5" />}
            title="Individual"
            body="Budget planner with savings, budget score, emergency fund and expense charts, a multi-bank loan comparison bench, and a secure vault for your financial documents."
            points={["Budget planner", "Loan comparison", "Document vault"]}
          />
          <ChoiceCard
            to="/business"
            icon={<Building2 className="size-5" />}
            title="Business"
            body="Cash flow analyzer for revenue, expenses, profit and cash position, a bank advisor that scores client repayment ability, and a smart invoice assistant."
            points={["Cash flow analyzer", "Bank advisor", "Invoice assistant"]}
          />
        </div>

        <Link
          to="/portfolio"
          className="surface group mt-5 flex items-center justify-between gap-4 p-5 transition-transform hover:-translate-y-1"
        >
          <span className="flex items-center gap-4">
            <span className="ink-panel flex size-11 items-center justify-center rounded-xl">
              <LineChart className="size-5" />
            </span>
            <span>
              <span className="block text-lg font-semibold">Portfolio intelligence</span>
              <span className="block text-sm text-muted-foreground">
                Holdings, live value and gain/loss, allocation and sector charts, plus news ranked
                by how much of your portfolio it touches.
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          to="/chat"
          className="surface group mt-5 flex items-center justify-between gap-4 p-5 transition-transform hover:-translate-y-1"
        >
          <span className="flex items-center gap-4">
            <span className="ink-panel flex size-11 items-center justify-center rounded-xl">
              <Sparkles className="size-5" />
            </span>
            <span>
              <span className="block text-lg font-semibold">FinBuddy</span>
              <span className="block text-sm text-muted-foreground">
                AI assistant for logical thinking questions, puzzles and money decisions.
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
        </Link>
      </main>
    </div>
  );
}

function ChoiceCard({
  to,
  icon,
  title,
  body,
  points,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <Link
      to={to}
      className="surface group relative flex flex-col p-6 transition-transform hover:-translate-y-1"
    >
      <span className="ink-panel flex size-11 items-center justify-center rounded-xl">{icon}</span>
      <h2 className="mt-5 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {points.map((p) => (
          <li
            key={p}
            className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
          >
            {p}
          </li>
        ))}
      </ul>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        Continue <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
