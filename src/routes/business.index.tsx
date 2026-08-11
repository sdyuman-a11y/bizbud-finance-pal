import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AppShell, Field, Stat } from "@/components/app-shell";
import { analyzeCashflow, currency, num, pct, type CashflowMonth } from "@/lib/finance";

const TABS = [
  { to: "/business", label: "Cash flow" },
  { to: "/business/advisor", label: "Bank advisor" },
  { to: "/business/invoices", label: "Invoice assistant" },
  { to: "/chat", label: "Biz-Chat" },
];

export const Route = createFileRoute("/business/")({
  head: () => ({
    meta: [
      { title: "Small Business Cash Flow Analyzer — FinVest" },
      {
        name: "description",
        content:
          "Track monthly revenue, cost of goods, operating expenses, profit margin and running cash position for your small business.",
      },
      { property: "og:title", content: "Small Business Cash Flow Analyzer — FinVest" },
      {
        property: "og:description",
        content: "Revenue, expenses, profit and cash position month by month, with runway warnings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CashflowPage,
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const initial: CashflowMonth[] = [
  { id: "1", month: "Jan", revenue: 42000, cogs: 15000, opex: 19000 },
  { id: "2", month: "Feb", revenue: 38500, cogs: 14200, opex: 19400 },
  { id: "3", month: "Mar", revenue: 51000, cogs: 18100, opex: 20100 },
  { id: "4", month: "Apr", revenue: 47500, cogs: 16800, opex: 20500 },
];

function CashflowPage() {
  const [opening, setOpening] = useState("30000");
  const [rows, setRows] = useState<CashflowMonth[]>(initial);

  const update = (id: string, patch: Partial<CashflowMonth>) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const r = useMemo(() => analyzeCashflow(rows, num(opening)), [rows, opening]);

  return (
    <AppShell
      title="Cash flow analyzer"
      subtitle="Enter monthly revenue and costs. FinVest calculates gross and net profit, margin, burn and your running cash position."
      tabs={TABS}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total revenue" value={currency(r.revenue)} hint={`${rows.length} months`} />
        <Stat label="Total expenses" value={currency(r.expenses)} hint="COGS + operating" />
        <Stat
          label="Net profit"
          value={currency(r.profit)}
          hint={`${pct(r.margin)} margin`}
          tone={r.profit >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Cash position"
          value={currency(r.closing)}
          hint={
            Number.isFinite(r.runway)
              ? `${r.runway.toFixed(1)} months runway`
              : "cash flow positive"
          }
          tone={r.closing >= 0 ? "positive" : "negative"}
        />
      </div>

      <section className="surface mt-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg font-semibold">Monthly ledger</h2>
          <div className="w-48">
            <Field label="Opening cash" value={opening} onChange={setOpening} />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="pb-2 font-semibold">Month</th>
                <th className="pb-2 font-semibold">Revenue</th>
                <th className="pb-2 font-semibold">COGS</th>
                <th className="pb-2 font-semibold">Operating</th>
                <th className="pb-2 text-right font-semibold">Net</th>
                <th className="pb-2 text-right font-semibold">Cash</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-2 pr-3">
                    <select
                      value={row.month}
                      onChange={(e) => update(row.id, { month: e.target.value })}
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  {(["revenue", "cogs", "opex"] as const).map((k) => (
                    <td key={k} className="py-2 pr-3">
                      <input
                        type="number"
                        value={row[k]}
                        onChange={(e) => update(row.id, { [k]: parseFloat(e.target.value) || 0 })}
                        className="numeric w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                      />
                    </td>
                  ))}
                  <td
                    className={`numeric py-2 text-right font-semibold ${row.net >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {currency(row.net)}
                  </td>
                  <td className="numeric py-2 text-right">{currency(row.cash)}</td>
                  <td className="py-2 pl-3 text-right">
                    {r.rows.length > 1 && (
                      <button
                        onClick={() => setRows((p) => p.filter((x) => x.id !== row.id))}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label={`Remove ${row.month}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={() =>
            setRows((p) => [
              ...p,
              {
                id: crypto.randomUUID(),
                month: MONTHS[p.length % 12] ?? "Jan",
                revenue: 0,
                cogs: 0,
                opex: 0,
              },
            ])
          }
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-input bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
        >
          <Plus className="size-4" /> Add month
        </button>
      </section>

      <section className="surface mt-6 p-5">
        <h2 className="text-lg font-semibold">Revenue, expenses & cash position</h2>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={r.rows.map((x) => ({
                month: x.month,
                Revenue: x.revenue,
                Expenses: x.cogs + x.opex,
                Cash: x.cash,
              }))}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => currency(v)} cursor={{ opacity: 0.08 }} />
              <Legend />
              <Bar dataKey="Revenue" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Expenses" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
              <Line
                type="monotone"
                dataKey="Cash"
                stroke="var(--chart-2)"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
    </AppShell>
  );
}
