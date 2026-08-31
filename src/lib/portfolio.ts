/**
 * Deterministic portfolio math. No network, no AI — pure functions only.
 */

export type Holding = {
  id: string;
  ticker: string;
  company_name: string;
  sector: string | null;
  shares: number;
  avg_price: number;
  notes: string | null;
};

export type Quote = {
  ticker: string;
  price: number | null;
  currency: string | null;
  previousClose: number | null;
  changePercent: number | null;
  shortName: string | null;
  sector: string | null;
};

export type HoldingPerformance = {
  holding: Holding;
  price: number | null;
  invested: number;
  marketValue: number;
  gain: number;
  returnPct: number;
  dayChangePct: number | null;
  weightPct: number;
  priced: boolean;
};

export type PortfolioSummary = {
  rows: HoldingPerformance[];
  totalInvested: number;
  totalValue: number;
  totalGain: number;
  totalReturnPct: number;
  pricedCount: number;
  allocation: { name: string; value: number }[];
  sectorAllocation: { name: string; value: number }[];
  largest: HoldingPerformance[];
};

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function summarizePortfolio(holdings: Holding[], quotes: Quote[]): PortfolioSummary {
  const byTicker = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

  const base = holdings.map((h) => {
    const quote = byTicker.get(h.ticker.toUpperCase());
    const shares = Number(h.shares) || 0;
    const avg = Number(h.avg_price) || 0;
    const price = quote?.price ?? null;
    const invested = round2(shares * avg);
    const marketValue = round2(shares * (price ?? avg));
    return {
      holding: h,
      price,
      invested,
      marketValue,
      gain: round2(marketValue - invested),
      returnPct: invested > 0 ? ((marketValue - invested) / invested) * 100 : 0,
      dayChangePct: quote?.changePercent ?? null,
      weightPct: 0,
      priced: price !== null,
    } satisfies HoldingPerformance;
  });

  const totalValue = round2(base.reduce((s, r) => s + r.marketValue, 0));
  const totalInvested = round2(base.reduce((s, r) => s + r.invested, 0));
  const rows = base.map((r) => ({
    ...r,
    weightPct: totalValue > 0 ? (r.marketValue / totalValue) * 100 : 0,
  }));

  const sectorMap = new Map<string, number>();
  for (const r of rows) {
    const sector = (r.holding.sector || "Unclassified").trim() || "Unclassified";
    sectorMap.set(sector, round2((sectorMap.get(sector) ?? 0) + r.marketValue));
  }

  return {
    rows,
    totalInvested,
    totalValue,
    totalGain: round2(totalValue - totalInvested),
    totalReturnPct: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
    pricedCount: rows.filter((r) => r.priced).length,
    allocation: rows
      .filter((r) => r.marketValue > 0)
      .map((r) => ({ name: r.holding.ticker.toUpperCase(), value: r.marketValue }))
      .sort((a, b) => b.value - a.value),
    sectorAllocation: [...sectorMap.entries()]
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    largest: [...rows].sort((a, b) => b.marketValue - a.marketValue).slice(0, 5),
  };
}

export type NewsItem = {
  id: string;
  title: string;
  publisher: string;
  publishedAt: string | null;
  url: string;
  summary: string;
  tickers: string[];
  sectors: string[];
  relevance: number;
};

/** Deterministic ranking: portfolio weight of the mentioned holding + source trust + recency. */
export function rankNews(
  items: NewsItem[],
  weights: Record<string, number>,
): NewsItem[] {
  const trusted = ["bloomberg", "reuters", "financial times", "wall street journal", "cnbc"];
  const scored = items.map((n) => {
    const weight = n.tickers.reduce((s, t) => s + (weights[t.toUpperCase()] ?? 0), 0);
    const publisher = n.publisher.toLowerCase();
    const trustIdx = trusted.findIndex((t) => publisher.includes(t));
    const trust = trustIdx === -1 ? 0 : 20 - trustIdx * 3;
    const ageHours = n.publishedAt
      ? (Date.now() - new Date(n.publishedAt).getTime()) / 3_600_000
      : 96;
    const recency = Math.max(0, 30 - ageHours / 4);
    return { ...n, relevance: Math.round(weight + trust + recency) };
  });
  return scored.sort(
    (a, b) =>
      b.relevance - a.relevance ||
      new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
  );
}

/** Compact, factual context handed to the existing FinBuddy assistant. */
export function buildAiContext(summary: PortfolioSummary, news: NewsItem[]) {
  const lines: string[] = [];
  lines.push("PORTFOLIO SNAPSHOT (authoritative — do not invent other numbers):");
  lines.push(
    `Total value $${summary.totalValue.toFixed(2)}; invested $${summary.totalInvested.toFixed(
      2,
    )}; gain/loss $${summary.totalGain.toFixed(2)} (${summary.totalReturnPct.toFixed(2)}%).`,
  );
  for (const r of summary.rows) {
    lines.push(
      `- ${r.holding.ticker.toUpperCase()} (${r.holding.company_name || "n/a"}, sector ${
        r.holding.sector || "unclassified"
      }): ${r.holding.shares} shares @ avg $${Number(r.holding.avg_price).toFixed(2)}, price ${
        r.price === null ? "unavailable" : `$${r.price.toFixed(2)}`
      }, value $${r.marketValue.toFixed(2)}, gain $${r.gain.toFixed(2)} (${r.returnPct.toFixed(
        2,
      )}%), weight ${r.weightPct.toFixed(1)}%.`,
    );
  }
  if (news.length) {
    lines.push("", "RETRIEVED NEWS (headline metadata only):");
    for (const n of news.slice(0, 20)) {
      lines.push(
        `- [${n.tickers.join(",") || "portfolio"}] "${n.title}" — ${n.publisher}, ${
          n.publishedAt ?? "date unknown"
        } (${n.url})${n.summary ? ` :: ${n.summary}` : ""}`,
      );
    }
  } else {
    lines.push("", "RETRIEVED NEWS: none available right now.");
  }
  lines.push(
    "",
    "Rules: use only the figures and articles above. If something is not listed, say it is unavailable. Never invent prices, holdings, statistics or headlines.",
  );
  return lines.join("\n");
}
