import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { HeaderControls } from "@/components/header-controls";


type Tab = { to: string; label: string };

export function AppShell({
  title,
  subtitle,
  tabs,
  children,
}: {
  title: string;
  subtitle: string;
  tabs: Tab[];
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="ink-panel flex size-9 items-center justify-center rounded-xl">
              <Wallet className="size-4.5" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">FinBuddy</span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
              {tabs.map((t) => {
                const active = pathname === t.to;
                return (
                  <Link
                    key={t.to}
                    to={t.to}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>
            <HeaderControls />
          </div>
        </div>
      </header>


      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  prefix = "$",
  suffix,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string | null;
  suffix?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring/50">
        {prefix ? <span className="text-sm text-muted-foreground">{prefix}</span> : null}
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="numeric w-full bg-transparent text-sm outline-none"
        />
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "accent";
}) {
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-destructive"
        : tone === "accent"
          ? "text-accent-foreground"
          : "text-foreground";
  return (
    <div className="surface p-4">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className={`numeric mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
