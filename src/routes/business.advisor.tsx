import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { AppShell, Field, Stat } from "@/components/app-shell";
import { adviseClient, currency, num, pct } from "@/lib/finance";

const TABS = [
  { to: "/business", label: "Cash flow" },
  { to: "/business/advisor", label: "Bank advisor" },
];

export const Route = createFileRoute("/business/advisor")({
  head: () => ({
    meta: [
      { title: "Bank Advisor — Client Lending Assessment | Biz-Bud" },
      {
        name: "description",
        content:
          "Evaluate a client's borrowing case: debt-to-income ratio, repayment ability, affordability score and a recommended safe loan amount.",
      },
      { property: "og:title", content: "Bank Advisor — Client Lending Assessment" },
      {
        property: "og:description",
        content: "Score clients on income, debt ratio and repayment ability before approving a loan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdvisorPage,
});

function AdvisorPage() {
  const [f, setF] = useState({
    name: "Larkspur Bakery Ltd.",
    monthlyIncome: "18000",
    existingDebt: "3200",
    requestedAmount: "120000",
    rate: "9.5",
    years: "7",
    creditScore: "710",
    yearsInBusiness: "4",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const r = useMemo(
    () =>
      adviseClient({
        name: f.name,
        monthlyIncome: num(f.monthlyIncome),
        existingDebt: num(f.existingDebt),
        requestedAmount: num(f.requestedAmount),
        rate: num(f.rate),
        years: num(f.years),
        creditScore: num(f.creditScore),
        yearsInBusiness: num(f.yearsInBusiness),
      }),
    [f],
  );

  const tone =
    r.decision === "Approve" ? "success" : r.decision === "Decline" ? "destructive" : "warning";
  const Icon =
    r.decision === "Approve" ? CheckCircle2 : r.decision === "Decline" ? XCircle : AlertTriangle;

  return (
    <AppShell
      title="Bank advisor"
      subtitle="Assess a client's application against income, existing debt, repayment ability and credit profile — with a recommended safe loan size."
      tabs={TABS}
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="surface h-fit p-5">
          <h2 className="text-lg font-semibold">Client profile</h2>
          <label className="mt-4 block">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Client name
            </span>
            <input
              value={f.name}
              onChange={(e) => set("name")(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field
              label="Monthly income"
              value={f.monthlyIncome}
              onChange={set("monthlyIncome")}
            />
            <Field label="Existing debt / mo" value={f.existingDebt} onChange={set("existingDebt")} />
            <Field
              label="Requested amount"
              value={f.requestedAmount}
              onChange={set("requestedAmount")}
            />
            <Field
              label="Rate"
              prefix={null}
              suffix="% p.a."
              step="0.1"
              value={f.rate}
              onChange={set("rate")}
            />
            <Field
              label="Term"
              prefix={null}
              suffix="years"
              value={f.years}
              onChange={set("years")}
            />
            <Field
              label="Credit score"
              prefix={null}
              value={f.creditScore}
              onChange={set("creditScore")}
            />
            <Field
              label="Years trading"
              prefix={null}
              suffix="yrs"
              value={f.yearsInBusiness}
              onChange={set("yearsInBusiness")}
            />
          </div>
        </section>

        <div className="space-y-6">
          <section className="ink-panel flex flex-wrap items-center justify-between gap-6 p-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-70">
                Recommendation for {f.name || "client"}
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <Icon className="size-7" />
                <span className="font-display text-3xl font-semibold">{r.decision}</span>
              </div>
              <p className="mt-2 max-w-md text-sm opacity-85">
                {r.decision === "Approve"
                  ? "Debt load and repayment capacity are comfortably within policy."
                  : r.decision === "Decline"
                    ? "Repayment ability is too thin at the requested amount and term."
                    : "Viable with a smaller amount, longer term or added security."}
              </p>
            </div>
            <div className="text-right">
              <div className="numeric text-5xl font-semibold">{r.score}</div>
              <div className="text-xs tracking-wide uppercase opacity-70">Affordability score</div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="New monthly EMI" value={currency(r.newEmi, 2)} hint="on requested loan" />
            <Stat
              label="Debt-to-income"
              value={pct(r.dti)}
              hint="policy limit 35%"
              tone={r.dti <= 35 ? "positive" : "negative"}
            />
            <Stat
              label="Disposable income"
              value={currency(r.disposable)}
              hint="after all repayments"
              tone={r.disposable > 0 ? "positive" : "negative"}
            />
            <Stat
              label="Repayment coverage"
              value={`${r.coverage.toFixed(2)}×`}
              hint="free income ÷ new EMI"
            />
          </div>

          <section className="surface p-5">
            <h2 className="text-lg font-semibold">Safe lending limit</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Largest loan keeping total repayments at or below 35% of income, over{" "}
              {num(f.years)} years at {num(f.rate)}%.
            </p>
            <div className="numeric mt-4 text-4xl font-semibold text-primary">
              {currency(r.safeAmount)}
            </div>
            <div className="mt-4 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
              Requested {currency(num(f.requestedAmount))} —{" "}
              {num(f.requestedAmount) <= r.safeAmount ? (
                <strong>within the safe limit.</strong>
              ) : (
                <strong>
                  {currency(num(f.requestedAmount) - r.safeAmount)} above the safe limit.
                </strong>
              )}
            </div>
            <div className={`mt-4 h-2 w-full overflow-hidden rounded-full bg-muted`}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, r.safeAmount > 0 ? (num(f.requestedAmount) / r.safeAmount) * 100 : 100)}%`,
                  backgroundColor: `var(--${tone})`,
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
