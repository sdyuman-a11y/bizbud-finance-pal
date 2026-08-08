import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppShell, Field, Stat } from "@/components/app-shell";
import { analyzeBudget, currency, num, pct } from "@/lib/finance";

const TABS = [
  { to: "/individual", label: "Budget planner" },
  { to: "/individual/loans", label: "Loan comparison" },
];

export const Route = createFileRoute("/individual/")({
  head: () => ({
    meta: [
      { title: "Budget Planner — Biz-Bud" },
      {
        name: "description",
        content:
          "Plan monthly income and expenses, see your savings rate, budget score, emergency fund target and expense breakdown charts.",
      },
      { property: "og:title", content: "Budget Planner — Biz-Bud" },
      {
        property: "og:description",
        content:
          "Income, expenses, savings, budget score and emergency fund — calculated instantly with charts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BudgetPlanner,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
  "var(--accent)",
];

function BudgetPlanner() {
  const [f, setF] = useState({
    income: "5200",
    housing: "1500",
    food: "600",
    transport: "320",
    utilities: "240",
    debt: "450",
    lifestyle: "380",
    other: "180",
    savingsTarget: "600",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const r = useMemo(
    () =>
      analyzeBudget({
        income: num(f.income),
        housing: num(f.housing),
        food: num(f.food),
        transport: num(f.transport),
        utilities: num(f.utilities),
        debt: num(f.debt),
        lifestyle: num(f.lifestyle),
        other: num(f.other),
        savingsTarget: num(f.savingsTarget),
      }),
    [f],
  );

  return (
    <AppShell
      title="Budget planner"
      subtitle="Enter your monthly numbers. Biz-Bud calculates savings, scores the budget, sizes your emergency fund and charts where the money goes."
      tabs={TABS}
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="surface h-fit p-5">
          <h2 className="text-lg font-semibold">Monthly inputs</h2>
          <div className="mt-4 grid gap-3">
            <Field label="Net income" value={f.income} onChange={set("income")} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Housing" value={f.housing} onChange={set("housing")} />
              <Field label="Food" value={f.food} onChange={set("food")} />
              <Field label="Transport" value={f.transport} onChange={set("transport")} />
              <Field label="Utilities" value={f.utilities} onChange={set("utilities")} />
              <Field label="Debt payments" value={f.debt} onChange={set("debt")} />
              <Field label="Lifestyle" value={f.lifestyle} onChange={set("lifestyle")} />
              <Field label="Other" value={f.other} onChange={set("other")} />
              <Field label="Savings target" value={f.savingsTarget} onChange={set("savingsTarget")} />
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total expenses" value={currency(r.expenses)} hint="per month" />
            <Stat
              label="Savings / surplus"
              value={currency(r.surplus)}
              hint={`${pct(r.savingsRate)} of income`}
              tone={r.surplus >= 0 ? "positive" : "negative"}
            />
            <Stat label="Housing ratio" value={pct(r.housingRatio)} hint="target ≤ 30%" />
            <Stat label="Debt ratio" value={pct(r.debtRatio)} hint="target ≤ 15%" />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="ink-panel p-5">
              <h2 className="text-sm font-semibold tracking-wide uppercase opacity-80">
                Budget score
              </h2>
              <div className="mt-3 flex items-end gap-3">
                <span className="numeric text-5xl font-semibold">{r.score}</span>
                <span className="pb-2 text-sm opacity-80">/ 100 · {r.grade}</span>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-white/90" style={{ width: `${r.score}%` }} />
              </div>
              <p className="mt-4 text-sm opacity-85">
                Scored on savings rate, housing share, debt load and whether you finish the month in
                surplus.
              </p>
            </section>

            <section className="surface p-5">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Emergency fund
              </h2>
              <div className="numeric mt-3 text-3xl font-semibold">
                {currency(r.emergencyTarget)}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">6 months of expenses</p>
              <div className="mt-4 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
                {Number.isFinite(r.monthsToEmergency) ? (
                  <>
                    At{" "}
                    <strong className="numeric">
                      {currency(Math.max(r.surplus, num(f.savingsTarget)))}
                    </strong>{" "}
                    saved per month you reach it in{" "}
                    <strong className="numeric">{r.monthsToEmergency}</strong> months (
                    {(r.monthsToEmergency / 12).toFixed(1)} years).
                  </>
                ) : (
                  <>No monthly surplus — trim expenses before building the fund.</>
                )}
              </div>
            </section>
          </div>

          <section className="surface p-5">
            <h2 className="text-lg font-semibold">Where the money goes</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={r.breakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {r.breakdown.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.breakdown} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid horizontal={false} stroke="var(--border)" />
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={80}
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: 12 }}
                    />
                    <Tooltip formatter={(v: number) => currency(v)} cursor={{ opacity: 0.08 }} />
                    <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
