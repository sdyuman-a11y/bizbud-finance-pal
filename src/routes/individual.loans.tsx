import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AppShell, Field, Stat } from "@/components/app-shell";
import { currency, evaluateLoan, type Bank } from "@/lib/finance";

const TABS = [
  { to: "/individual", label: "Budget planner" },
  { to: "/individual/loans", label: "Loan comparison" },
];

export const Route = createFileRoute("/individual/loans")({
  head: () => ({
    meta: [
      { title: "Loan Comparison Calculator — Biz-Bud" },
      {
        name: "description",
        content:
          "Compare loan offers from multiple banks side by side: monthly EMI, total repayment, total interest and fees.",
      },
      { property: "og:title", content: "Loan Comparison Calculator — Biz-Bud" },
      {
        property: "og:description",
        content: "Compare bank offers by EMI, total repayment and interest to find the cheapest loan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoanComparison,
});

const initial: Bank[] = [
  { id: "a", name: "Northline Bank", amount: 25000, rate: 8.9, years: 5, fees: 350 },
  { id: "b", name: "Harbor Credit Union", amount: 25000, rate: 7.4, years: 5, fees: 600 },
  { id: "c", name: "Meridian Finance", amount: 25000, rate: 9.8, years: 4, fees: 0 },
];

export default function noop() {}

function LoanComparison() {
  const [banks, setBanks] = useState<Bank[]>(initial);

  const update = (id: string, patch: Partial<Bank>) =>
    setBanks((p) => p.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const results = useMemo(
    () => banks.map((b) => ({ bank: b, ...evaluateLoan(b) })),
    [banks],
  );
  const best = results.reduce<(typeof results)[number] | null>(
    (acc, r) => (!acc || r.totalRepayment < acc.totalRepayment ? r : acc),
    null,
  );
  const worst = results.reduce<(typeof results)[number] | null>(
    (acc, r) => (!acc || r.totalRepayment > acc.totalRepayment ? r : acc),
    null,
  );
  const savings = best && worst ? worst.totalRepayment - best.totalRepayment : 0;

  return (
    <AppShell
      title="Loan comparison"
      subtitle="Line up offers from several banks and compare monthly EMI, total repayment and lifetime interest."
      tabs={TABS}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Cheapest offer"
          value={best ? best.bank.name : "—"}
          hint={best ? `${currency(best.totalRepayment)} total` : undefined}
          tone="positive"
        />
        <Stat label="Potential saving" value={currency(savings)} hint="vs. most expensive offer" />
        <Stat
          label="Lowest monthly EMI"
          value={currency(Math.min(...results.map((r) => r.monthly)), 2)}
          hint="per month"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {results.map((r) => {
          const isBest = best?.bank.id === r.bank.id;
          return (
            <section
              key={r.bank.id}
              className={`surface relative p-5 ${isBest ? "ring-2 ring-primary" : ""}`}
            >
              {isBest && (
                <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                  <Trophy className="size-3" /> Best value
                </span>
              )}
              <div className="flex items-start justify-between gap-2">
                <input
                  value={r.bank.name}
                  onChange={(e) => update(r.bank.id, { name: e.target.value })}
                  className="w-full bg-transparent text-lg font-semibold outline-none"
                />
                {banks.length > 1 && (
                  <button
                    onClick={() => setBanks((p) => p.filter((b) => b.id !== r.bank.id))}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${r.bank.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field
                  label="Amount"
                  value={String(r.bank.amount)}
                  onChange={(v) => update(r.bank.id, { amount: parseFloat(v) || 0 })}
                />
                <Field
                  label="Rate"
                  prefix={null}
                  suffix="% p.a."
                  step="0.1"
                  value={String(r.bank.rate)}
                  onChange={(v) => update(r.bank.id, { rate: parseFloat(v) || 0 })}
                />
                <Field
                  label="Term"
                  prefix={null}
                  suffix="years"
                  value={String(r.bank.years)}
                  onChange={(v) => update(r.bank.id, { years: parseFloat(v) || 0 })}
                />
                <Field
                  label="Fees"
                  value={String(r.bank.fees)}
                  onChange={(v) => update(r.bank.id, { fees: parseFloat(v) || 0 })}
                />
              </div>

              <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                <Row label="Monthly EMI" value={currency(r.monthly, 2)} strong />
                <Row label="Total repayment" value={currency(r.totalRepayment)} />
                <Row label="Total interest" value={currency(r.totalInterest)} />
              </dl>
            </section>
          );
        })}
      </div>

      <button
        onClick={() =>
          setBanks((p) => [
            ...p,
            {
              id: crypto.randomUUID(),
              name: "New bank",
              amount: 25000,
              rate: 8,
              years: 5,
              fees: 0,
            },
          ])
        }
        className="mt-5 inline-flex items-center gap-2 rounded-full border border-input bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
      >
        <Plus className="size-4" /> Add bank
      </button>

      <section className="surface mt-8 p-5">
        <h2 className="text-lg font-semibold">Repayment vs. interest</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={results.map((r) => ({
                name: r.bank.name,
                Principal: r.bank.amount,
                Interest: r.totalInterest,
              }))}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => currency(v)} cursor={{ opacity: 0.08 }} />
              <Bar dataKey="Principal" stackId="a" fill="var(--chart-1)" radius={[0, 0, 6, 6]} />
              <Bar dataKey="Interest" stackId="a" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </AppShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`numeric ${strong ? "text-base font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
