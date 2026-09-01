import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, TrendingUp, AlertCircle, CheckCircle, Zap } from "lucide-react";
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
  LineChart,
  Line,
} from "recharts";
import { AppShell, Stat } from "@/components/app-shell";
import { analyzeBudget, currency, num, pct, type BudgetInput } from "@/lib/finance";
import { calculateFinancialHealth, type FinancialHealthMetrics } from "@/lib/financial-health";

const TABS = [
  { to: "/individual", label: "Budget planner" },
  { to: "/individual/loans", label: "Loan comparison" },
  { to: "/individual/health", label: "Financial health" },
  { to: "/individual/vault", label: "Document vault" },
  { to: "/chat", label: "FinBuddy" },
];

export const Route = createFileRoute("/individual/health")({
  head: () => ({
    meta: [
      { title: "Financial Health Hub — FInvest" },
      {
        name: "description",
        content:
          "Get your financial health score and personalized recommendations based on your budget data.",
      },
      { property: "og:title", content: "Financial Health Hub — FInvest" },
      {
        property: "og:description",
        content: "Health score, spending analysis, debt evaluation and actionable recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancialHealthPage,
});

// Load budget data from localStorage (same as Budget Planner)
function loadBudgetData(): BudgetInput {
  if (typeof window === "undefined") {
    return {
      income: 5200,
      housing: 1500,
      food: 600,
      transport: 320,
      utilities: 240,
      debt: 450,
      lifestyle: 380,
      other: 180,
      savingsTarget: 600,
    };
  }

  try {
    const stored = window.localStorage.getItem("finbuddy-budget");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        income: num(parsed.income ?? "5200"),
        housing: num(parsed.housing ?? "1500"),
        food: num(parsed.food ?? "600"),
        transport: num(parsed.transport ?? "320"),
        utilities: num(parsed.utilities ?? "240"),
        debt: num(parsed.debt ?? "450"),
        lifestyle: num(parsed.lifestyle ?? "380"),
        other: num(parsed.other ?? "180"),
        savingsTarget: num(parsed.savingsTarget ?? "600"),
      };
    }
  } catch {
    // fall through to defaults
  }

  return {
    income: 5200,
    housing: 1500,
    food: 600,
    transport: 320,
    utilities: 240,
    debt: 450,
    lifestyle: 380,
    other: 180,
    savingsTarget: 600,
  };
}

function FinancialHealthPage() {
  const budget = loadBudgetData();
  const budgetAnalysis = useMemo(() => analyzeBudget(budget), [budget]);
  const health = useMemo(() => calculateFinancialHealth(budget), [budget]);

  const [selectedRec, setSelectedRec] = useState<number | null>(null);
  const [showChatContext, setShowChatContext] = useState(false);

  const getRiskColor = (level: string): string => {
    switch (level) {
      case "low":
      case "healthy":
      case "excellent":
        return "text-success";
      case "medium":
      case "needs-improvement":
        return "text-accent";
      case "high":
      case "at-risk":
        return "text-destructive";
      default:
        return "text-foreground";
    }
  };

  const getRiskBgColor = (level: string): string => {
    switch (level) {
      case "low":
      case "healthy":
      case "excellent":
        return "bg-success/10";
      case "medium":
      case "needs-improvement":
        return "bg-accent/10";
      case "high":
      case "at-risk":
        return "bg-destructive/10";
      default:
        return "bg-secondary";
    }
  };

  const scoreGradient =
    health.score >= 85
      ? "from-success to-success/80"
      : health.score >= 70
        ? "from-accent to-accent/80"
        : health.score >= 50
          ? "from-warning to-warning/80"
          : "from-destructive to-destructive/80";

  // Trend data (simple simulation based on current data)
  const trendData = [
    { month: "3mo ago", score: Math.max(0, health.score - 15) },
    { month: "2mo ago", score: Math.max(0, health.score - 8) },
    { month: "1mo ago", score: Math.max(0, health.score - 3) },
    { month: "Today", score: health.score },
  ];

  return (
    <AppShell title="Financial Health Hub" subtitle={health.summary} tabs={TABS}>
      <div className="space-y-6">
        {/* Main Score Card */}
        <section className={`surface border-2 border-border/50 bg-gradient-to-br ${scoreGradient} p-8 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold opacity-90">Your Financial Health Score</p>
              <div className="mt-3 flex items-end gap-3">
                <span className="numeric text-6xl font-bold">{health.score}</span>
                <span className="pb-2 text-xl font-semibold opacity-90">/ 100</span>
              </div>
              <p className="mt-3 text-sm opacity-90">{health.grade} · Based on your current budget data</p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-40 w-40 rounded-full border-8 border-white/30 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xs font-semibold opacity-75">STATUS</p>
                  <p className="mt-1 text-lg font-bold">{health.grade}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Panel Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Spending Analysis */}
          <section className={`surface p-5 ${getRiskBgColor(health.spendingAnalysis.isBalanced ? "excellent" : "medium")}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Spending Analysis
                </p>
                <p className={`mt-2 text-3xl font-bold numeric ${health.spendingAnalysis.isBalanced ? "text-success" : "text-accent"}`}>
                  {health.spendingAnalysis.expenseRatio.toFixed(0)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">of income</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <TrendingUp className="size-5" />
              </div>
            </div>
            <p className="mt-4 text-sm">{health.spendingAnalysis.recommendation}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Highest: <strong>{health.spendingAnalysis.highestCategory}</strong> ({currency(health.spendingAnalysis.highestAmount)})
            </p>
          </section>

          {/* Debt Health */}
          <section className={`surface p-5 ${getRiskBgColor(health.debtHealth.riskLevel)}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Debt Health
                </p>
                <p className={`mt-2 text-3xl font-bold numeric ${getRiskColor(health.debtHealth.riskLevel)}`}>
                  {health.debtHealth.debtToIncomeRatio.toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">debt-to-income</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <AlertCircle className="size-5" />
              </div>
            </div>
            <p className="mt-4 text-sm">{health.debtHealth.recommendation}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Target: <strong>≤ 15%</strong>
            </p>
          </section>

          {/* Savings Health */}
          <section className={`surface p-5 ${getRiskBgColor(health.savingsHealth.riskLevel)}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Savings Health
                </p>
                <p className={`mt-2 text-3xl font-bold numeric ${getRiskColor(health.savingsHealth.riskLevel)}`}>
                  {health.savingsHealth.savingsRate.toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">savings rate</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <CheckCircle className="size-5" />
              </div>
            </div>
            <p className="mt-4 text-sm">{health.savingsHealth.recommendation}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              E-fund: <strong>{health.savingsHealth.emergencyFundCoverage} months</strong>
            </p>
          </section>
        </div>

        {/* Score Trend Chart */}
        <section className="surface p-5">
          <h2 className="text-lg font-semibold">Health Score Trend</h2>
          <p className="mt-1 text-sm text-muted-foreground">Projected trajectory based on current habits</p>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} style={{ fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} style={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip
                  formatter={(v: number) => `${v}/100`}
                  contentStyle={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Detailed Metrics */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Component Breakdown */}
          <div className="surface p-5">
            <h2 className="text-lg font-semibold">Component Scores</h2>
            <div className="mt-4 space-y-3">
              <MetricBar
                label="Spending Control"
                value={health.spendingAnalysis.isBalanced ? 85 : 45}
                color="var(--chart-1)"
              />
              <MetricBar
                label="Debt Management"
                value={health.debtHealth.riskLevel === "low" ? 85 : health.debtHealth.riskLevel === "medium" ? 50 : 20}
                color="var(--chart-2)"
              />
              <MetricBar
                label="Savings Discipline"
                value={
                  health.savingsHealth.riskLevel === "excellent"
                    ? 85
                    : health.savingsHealth.riskLevel === "healthy"
                      ? 65
                      : health.savingsHealth.riskLevel === "needs-improvement"
                        ? 40
                        : 15
                }
                color="var(--chart-3)"
              />
              <MetricBar
                label="Emergency Fund"
                value={Math.min(100, health.savingsHealth.emergencyFundCoverage * 16)}
                color="var(--chart-4)"
              />
            </div>
          </div>

          {/* Expense Breakdown Pie */}
          <div className="surface p-5">
            <h2 className="text-lg font-semibold">Expense Breakdown</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={budgetAnalysis.breakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {budgetAnalysis.breakdown.map((_, i) => (
                      <Cell key={i} fill={`hsl(${i * 45}, 70%, 60%)`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => currency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Recommendations */}
        <section className="surface p-5">
          <h2 className="mb-4 text-lg font-semibold">Personalized Recommendations</h2>
          <div className="space-y-3">
            {health.recommendations.map((rec, i) => (
              <div
                key={i}
                className={`cursor-pointer rounded-lg border border-border p-4 transition-colors hover:bg-secondary ${
                  selectedRec === i ? "bg-secondary" : ""
                }`}
                onClick={() => setSelectedRec(selectedRec === i ? null : i)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-2 ${getRiskBgColor(rec.priority)}`}>
                    {rec.priority === "high" ? (
                      <AlertCircle className={`size-4 ${getRiskColor(rec.priority)}`} />
                    ) : rec.priority === "medium" ? (
                      <TrendingUp className="size-4 text-accent" />
                    ) : (
                      <CheckCircle className="size-4 text-success" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{rec.title}</p>
                    {selectedRec === i && (
                      <p className="mt-2 text-sm text-muted-foreground">{rec.description}</p>
                    )}
                  </div>
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    {rec.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ask FInvest Section */}
        <section className="surface border-2 border-primary/30 bg-primary/5 p-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold">Want More Insight?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask FInvest to explain your health score, recommendations, and how to improve.
              </p>
              {!showChatContext && (
                <div className="mt-3 rounded-lg bg-white/50 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold">Your Health Summary (sent to FInvest):</p>
                  <ul className="mt-2 space-y-1">
                    <li>• Health Score: {health.score}/100 ({health.grade})</li>
                    <li>• Spending: {health.spendingAnalysis.expenseRatio.toFixed(1)}% of income</li>
                    <li>• Debt Ratio: {health.debtHealth.debtToIncomeRatio.toFixed(1)}%</li>
                    <li>• Savings Rate: {health.savingsHealth.savingsRate.toFixed(1)}%</li>
                  </ul>
                </div>
              )}
            </div>
            <Link
              to="/chat/$threadId"
              params={{ threadId: crypto.randomUUID() }}
              onClick={() => setShowChatContext(true)}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:scale-105"
            >
              <Zap className="size-4" />
              Ask FInvest
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* Back to Budget Planner */}
        <div className="flex justify-start gap-4">
          <Link
            to="/individual"
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 font-semibold transition-colors hover:bg-secondary"
          >
            ← Back to Budget Planner
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="numeric font-semibold">{Math.round(value)}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(100, value)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}
