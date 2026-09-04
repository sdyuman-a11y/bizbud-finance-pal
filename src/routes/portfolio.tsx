import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Lock,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/app-shell";
import { ChatWindow } from "@/components/chat-window";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { currency, pct } from "@/lib/finance";
import {
  buildAiContext,
  rankNews,
  summarizePortfolio,
  type Holding,
  type NewsItem,
} from "@/lib/portfolio";
import { getPortfolioNews, getQuotes } from "@/lib/portfolio.functions";
import { createThread, loadThreads, newThreadId, type ChatThread } from "@/lib/chat-storage";

const TABS = [
  { to: "/portfolio", label: "Portfolio" },
  { to: "/individual", label: "Individual" },
  { to: "/business", label: "Business" },
  { to: "/chat", label: "FinBuddy" },
];

const SECTORS = [
  "Technology",
  "Financials",
  "Healthcare",
  "Energy",
  "Consumer",
  "Industrials",
  "Real estate",
  "Utilities",
  "Communication",
  "Materials",
  "Diversified / ETF",
  "Unclassified",
];

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Intelligence — Securaflow" },
      {
        name: "description",
        content:
          "Track stock and ETF holdings, see live value, gain/loss, allocation and sector mix, plus the latest financial news affecting your portfolio.",
      },
      { property: "og:title", content: "Portfolio Intelligence — Securaflow" },
      {
        property: "og:description",
        content:
          "Holdings, deterministic performance maths, allocation charts and ranked portfolio news in one dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortfolioPage,
});

type Draft = {
  id: string | null;
  ticker: string;
  company_name: string;
  sector: string;
  shares: string;
  avg_price: string;
};

const emptyDraft: Draft = {
  id: null,
  ticker: "",
  company_name: "",
  sector: "Unclassified",
  shares: "",
  avg_price: "",
};

function timeAgo(iso: string | null) {
  if (!iso) return "date unknown";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "date unknown";
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function PortfolioPage() {
  const { user, setAuthOpen } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [newsFilter, setNewsFilter] = useState<string>("all");
  const [thread, setThread] = useState<ChatThread | null>(null);

  useEffect(() => {
    setThread({ id: `portfolio-${newThreadId()}`, title: "Portfolio", updatedAt: Date.now(), messages: [] });
  }, []);

  const holdingsQuery = useQuery({
    queryKey: ["holdings", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holdings")
        .select("id, ticker, company_name, sector, shares, avg_price, notes")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((h) => ({
        ...h,
        shares: Number(h.shares),
        avg_price: Number(h.avg_price),
      })) as Holding[];
    },
  });

  const holdings = useMemo(() => holdingsQuery.data ?? [], [holdingsQuery.data]);
  const tickerKey = holdings.map((h) => h.ticker.toUpperCase()).sort().join(",");

  const quotesQuery = useQuery({
    queryKey: ["quotes", tickerKey],
    enabled: holdings.length > 0,
    staleTime: 60_000,
    queryFn: () => getQuotes({ data: { tickers: holdings.map((h) => h.ticker) } }),
  });

  const newsQuery = useQuery({
    queryKey: ["portfolio-news", tickerKey],
    enabled: holdings.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () =>
      getPortfolioNews({
        data: { holdings: holdings.map((h) => ({ ticker: h.ticker, sector: h.sector })) },
      }),
  });

  const summary = useMemo(
    () => summarizePortfolio(holdings, quotesQuery.data?.quotes ?? []),
    [holdings, quotesQuery.data],
  );

  const weights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const r of summary.rows) w[r.holding.ticker.toUpperCase()] = r.weightPct;
    return w;
  }, [summary]);

  const rankedNews: NewsItem[] = useMemo(
    () => rankNews(newsQuery.data?.items ?? [], weights),
    [newsQuery.data, weights],
  );

  const visibleNews = useMemo(() => {
    if (newsFilter === "all") return rankedNews;
    if (newsFilter.startsWith("t:")) {
      const t = newsFilter.slice(2);
      return rankedNews.filter((n) => n.tickers.includes(t));
    }
    const s = newsFilter.slice(2);
    return rankedNews.filter((n) => n.sectors.includes(s));
  }, [rankedNews, newsFilter]);

  const aiContext = useMemo(
    () => buildAiContext(summary, rankedNews),
    [summary, rankedNews],
  );

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!user) throw new Error("Sign in first");
      const ticker = d.ticker.trim().toUpperCase();
      if (!ticker) throw new Error("Ticker is required");
      const shares = Number(d.shares);
      const avg = Number(d.avg_price);
      if (!Number.isFinite(shares) || shares <= 0) throw new Error("Shares must be greater than 0");
      if (!Number.isFinite(avg) || avg < 0) throw new Error("Average price must be a number");
      const payload = {
        user_id: user.id,
        ticker,
        company_name: d.company_name.trim(),
        sector: d.sector || null,
        shares,
        avg_price: avg,
      };
      if (d.id) {
        const { error } = await supabase.from("holdings").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("holdings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(draft.id ? "Holding updated" : "Holding added");
      setDraft(emptyDraft);
      void qc.invalidateQueries({ queryKey: ["holdings", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holdings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Holding removed");
      void qc.invalidateQueries({ queryKey: ["holdings", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <AppShell
        title="Portfolio intelligence"
        subtitle="Track holdings, performance, allocation and the news that moves them."
        tabs={TABS}
      >
        <div className="surface flex flex-col items-start gap-4 p-8">
          <span className="ink-panel flex size-11 items-center justify-center rounded-xl">
            <Lock className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Sign in to build your portfolio</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Holdings are stored privately against your account, so a sign-in is required before
              anything can be added or read.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Sign in to continue
          </button>
        </div>
      </AppShell>
    );
  }

  const sectorsInUse = [...new Set(holdings.map((h) => h.sector || "Unclassified"))];

  return (
    <AppShell
      title="Portfolio intelligence"
      subtitle="Add your stock and ETF holdings, see deterministic performance maths, allocation charts and the latest news ranked by how much of your portfolio it touches."
      tabs={TABS}
    >
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Portfolio value" value={currency(summary.totalValue)} hint={`${summary.pricedCount}/${holdings.length} priced live`} />
          <Stat label="Invested" value={currency(summary.totalInvested)} hint="cost basis" />
          <Stat
            label="Gain / loss"
            value={currency(summary.totalGain)}
            tone={summary.totalGain >= 0 ? "positive" : "negative"}
            hint="unrealised"
          />
          <Stat
            label="Return"
            value={pct(summary.totalReturnPct, 2)}
            tone={summary.totalReturnPct >= 0 ? "positive" : "negative"}
            hint="vs cost basis"
          />
        </div>

        {/* Holdings editor */}
        <section className="surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{draft.id ? "Edit holding" : "Add a holding"}</h2>
            {draft.id ? (
              <button
                type="button"
                onClick={() => setDraft(emptyDraft)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" /> Cancel edit
              </button>
            ) : null}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="block">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ticker</span>
              <input
                value={draft.ticker}
                onChange={(e) => setDraft({ ...draft, ticker: e.target.value.toUpperCase() })}
                placeholder="NVDA"
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Company name</span>
              <input
                value={draft.company_name}
                onChange={(e) => setDraft({ ...draft, company_name: e.target.value })}
                placeholder="NVIDIA Corporation"
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sector</span>
              <select
                value={draft.sector}
                onChange={(e) => setDraft({ ...draft, sector: e.target.value })}
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              >
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Shares</span>
              <input
                type="number"
                step="0.0001"
                value={draft.shares}
                onChange={(e) => setDraft({ ...draft, shares: e.target.value })}
                className="numeric mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Avg purchase price</span>
              <input
                type="number"
                step="0.01"
                value={draft.avg_price}
                onChange={(e) => setDraft({ ...draft, avg_price: e.target.value })}
                className="numeric mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(draft)}
            className="mt-5 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {draft.id ? "Save changes" : "Add holding"}
          </button>
        </section>

        {/* Holdings table */}
        <section className="surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
            <h2 className="text-lg font-semibold">Holding performance</h2>
            <button
              type="button"
              onClick={() => void quotesQuery.refetch()}
              className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`size-3.5 ${quotesQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh prices
            </button>
          </div>
          {holdingsQuery.isLoading ? (
            <p className="p-6 pt-0 text-sm text-muted-foreground">Loading your holdings…</p>
          ) : holdingsQuery.isError ? (
            <p className="p-6 pt-0 text-sm text-destructive">Could not load your holdings. Try again.</p>
          ) : holdings.length === 0 ? (
            <p className="p-6 pt-0 text-sm text-muted-foreground">
              No holdings yet — add your first ticker above to unlock the dashboard and news.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border/70 text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Holding</th>
                    <th className="px-4 py-3 text-right font-semibold">Shares</th>
                    <th className="px-4 py-3 text-right font-semibold">Avg cost</th>
                    <th className="px-4 py-3 text-right font-semibold">Price</th>
                    <th className="px-4 py-3 text-right font-semibold">Value</th>
                    <th className="px-4 py-3 text-right font-semibold">Gain / loss</th>
                    <th className="px-4 py-3 text-right font-semibold">Weight</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.holding.id} className="border-b border-border/50 last:border-0">
                      <td className="px-6 py-3">
                        <div className="font-semibold">{r.holding.ticker.toUpperCase()}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.holding.company_name || "—"} · {r.holding.sector || "Unclassified"}
                        </div>
                      </td>
                      <td className="numeric px-4 py-3 text-right">{r.holding.shares}</td>
                      <td className="numeric px-4 py-3 text-right">{currency(r.holding.avg_price, 2)}</td>
                      <td className="numeric px-4 py-3 text-right">
                        {r.price === null ? (
                          <span className="text-xs text-muted-foreground">unavailable</span>
                        ) : (
                          currency(r.price, 2)
                        )}
                      </td>
                      <td className="numeric px-4 py-3 text-right">{currency(r.marketValue, 2)}</td>
                      <td
                        className={`numeric px-4 py-3 text-right ${r.gain >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {currency(r.gain, 2)}
                        <div className="text-xs">{pct(r.returnPct, 2)}</div>
                      </td>
                      <td className="numeric px-4 py-3 text-right">{pct(r.weightPct, 1)}</td>
                      <td className="px-6 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            aria-label={`Edit ${r.holding.ticker}`}
                            onClick={() =>
                              setDraft({
                                id: r.holding.id,
                                ticker: r.holding.ticker,
                                company_name: r.holding.company_name,
                                sector: r.holding.sector || "Unclassified",
                                shares: String(r.holding.shares),
                                avg_price: String(r.holding.avg_price),
                              })
                            }
                            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${r.holding.ticker}`}
                            onClick={() => remove.mutate(r.holding.id)}
                            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {quotesQuery.isError ? (
            <p className="flex items-center gap-2 border-t border-border/70 px-6 py-3 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5" /> Live prices are unavailable right now — values fall
              back to your cost basis.
            </p>
          ) : null}
        </section>

        {/* Charts */}
        {holdings.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="surface p-6">
              <h2 className="text-lg font-semibold">Portfolio allocation</h2>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.allocation}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      isAnimationActive={false}
                      label={(e: { name?: string }) => e.name ?? ""}
                    >
                      {summary.allocation.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => currency(v, 2)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="surface p-6">
              <h2 className="text-lg font-semibold">Sector allocation</h2>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.sectorAllocation}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} height={54} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => currency(v, 2)} />
                    <Bar dataKey="value" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        ) : null}

        {/* Largest holdings */}
        {summary.largest.length > 0 ? (
          <section className="surface p-6">
            <h2 className="text-lg font-semibold">Largest holdings</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {summary.largest.map((r) => (
                <div key={r.holding.id} className="rounded-xl border border-border p-4">
                  <div className="font-semibold">{r.holding.ticker.toUpperCase()}</div>
                  <div className="numeric mt-1 text-lg font-semibold">{currency(r.marketValue)}</div>
                  <div className="text-xs text-muted-foreground">{pct(r.weightPct, 1)} of portfolio</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* News */}
        <section className="surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Newspaper className="size-4.5" /> Latest news affecting your portfolio
            </h2>
            <button
              type="button"
              onClick={() => void newsQuery.refetch()}
              className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`size-3.5 ${newsQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh news
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNewsFilter("all")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${newsFilter === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
            >
              All holdings
            </button>
            {holdings.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setNewsFilter(`t:${h.ticker.toUpperCase()}`)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${newsFilter === `t:${h.ticker.toUpperCase()}` ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
              >
                {h.ticker.toUpperCase()}
              </button>
            ))}
            {sectorsInUse.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setNewsFilter(`s:${s}`)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${newsFilter === `s:${s}` ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a holding to start tracking its news.</p>
            ) : newsQuery.isLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Retrieving the latest headlines…
              </p>
            ) : newsQuery.isError ? (
              <p className="text-sm text-destructive">
                News sources are unreachable right now. Your portfolio figures above are unaffected.
              </p>
            ) : visibleNews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent articles match this filter.</p>
            ) : (
              visibleNews.map((n) => (
                <article key={n.id} className="rounded-xl border border-border p-4">
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 font-semibold hover:underline"
                  >
                    {n.title}
                    <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                  </a>
                  {n.summary ? (
                    <p className="mt-2 text-sm text-muted-foreground">{n.summary}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold text-secondary-foreground">
                      {n.publisher}
                    </span>
                    <span>{timeAgo(n.publishedAt)}</span>
                    <span>·</span>
                    <span>{n.tickers.join(", ")}</span>
                    <span>·</span>
                    <span>relevance {n.relevance}</span>
                  </div>
                </article>
              ))
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Headlines, publisher, timestamp and links only — articles open on the publisher's own site.
          </p>
        </section>

        {/* Existing FinBuddy assistant, grounded in this portfolio */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="size-4.5" /> Ask FinBuddy about this portfolio
          </h2>
          <p className="text-sm text-muted-foreground">
            The same FinBuddy assistant, given only the holdings and headlines shown above.
          </p>
          {thread ? (
            <ChatWindow
              thread={thread}
              context={aiContext}
              persist={false}
              className="h-[60vh] min-h-[440px]"
              emptyTitle="Portfolio questions, grounded in your data"
              emptyHint="FinBuddy answers from the holdings and news on this page only."
              suggestions={[
                "What news is affecting my portfolio today?",
                "Which of my holdings has the most important news?",
                "What are the biggest risks in my portfolio?",
              ]}
            />
          ) : null}
          <button
            type="button"
            onClick={() => {
              const existing = loadThreads()[0] ?? createThread();
              window.location.href = `/chat/${existing.id}`;
            }}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Open the full FinBuddy chat →
          </button>
        </section>
      </div>
    </AppShell>
  );
}
