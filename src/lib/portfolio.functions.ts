import { createServerFn } from "@tanstack/react-start";
import type { NewsItem, Quote } from "@/lib/portfolio";

/**
 * Market data + news retrieval. Runs server-side only; no keys are exposed to the browser.
 * Bloomberg items are surfaced when the syndicated feed carries them (headline metadata +
 * link only, never full article text); otherwise other reputable outlets are used.
 */

const UA =
  "Mozilla/5.0 (compatible; FInvestPortfolio/1.0; +https://lovable.dev) AppleWebKit/537.36";

function cleanTickers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z0-9.\-^]{1,12}$/.test(t)),
    ),
  ].slice(0, 25);
}

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((input: { tickers: string[] }) => ({ tickers: cleanTickers(input?.tickers) }))
  .handler(async ({ data }) => {
    const results = await Promise.all(
      data.tickers.map(async (ticker): Promise<Quote> => {
        const empty: Quote = {
          ticker,
          price: null,
          currency: null,
          previousClose: null,
          changePercent: null,
          shortName: null,
          sector: null,
        };
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`,
            { headers: { "User-Agent": UA, Accept: "application/json" } },
          );
          if (!res.ok) return empty;
          const json = (await res.json()) as {
            chart?: { result?: { meta?: Record<string, unknown> }[] };
          };
          const meta = json.chart?.result?.[0]?.meta;
          if (!meta) return empty;
          const price = Number(meta["regularMarketPrice"]);
          const prev = Number(meta["chartPreviousClose"] ?? meta["previousClose"]);
          return {
            ticker,
            price: Number.isFinite(price) ? price : null,
            currency: typeof meta["currency"] === "string" ? (meta["currency"] as string) : null,
            previousClose: Number.isFinite(prev) ? prev : null,
            changePercent:
              Number.isFinite(price) && Number.isFinite(prev) && prev > 0
                ? ((price - prev) / prev) * 100
                : null,
            shortName:
              typeof meta["shortName"] === "string" ? (meta["shortName"] as string) : null,
            sector: null,
          };
        } catch {
          return empty;
        }
      }),
    );
    return { quotes: results, fetchedAt: new Date().toISOString() };
  });

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m?.[1] ? decode(m[1]) : "";
}

async function fetchFeed(url: string): Promise<string[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml" } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const xml = await res.text();
  return xml.split(/<item[\s>]/i).slice(1);
}

async function newsForTicker(ticker: string, sector: string | null): Promise<NewsItem[]> {
  const sources = [
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(`${ticker} stock`)}&hl=en-US&gl=US&ceid=US:en`,
  ];
  for (const url of sources) {
    try {
      const items = await fetchFeed(url);
      const mapped = items
        .map((block, i): NewsItem | null => {
          const title = tag(block, "title");
          const link = tag(block, "link");
          if (!title || !link) return null;
          const pub = tag(block, "pubDate");
          const source = tag(block, "source") || tag(block, "dc:creator");
          const description = tag(block, "description");
          const publisher =
            source ||
            (() => {
              try {
                return new URL(link).hostname.replace(/^www\./, "");
              } catch {
                return "Unknown source";
              }
            })();
          return {
            id: `${ticker}-${i}-${link.slice(-24)}`,
            title,
            publisher,
            publishedAt: pub ? new Date(pub).toISOString() : null,
            url: link,
            summary: description.slice(0, 260),
            tickers: [ticker],
            sectors: sector ? [sector] : [],
            relevance: 0,
          };
        })
        .filter((n): n is NewsItem => n !== null)
        .slice(0, 8);
      if (mapped.length) return mapped;
    } catch {
      // try the next reputable source rather than failing the feature
    }
  }
  return [];
}

export const getPortfolioNews = createServerFn({ method: "POST" })
  .inputValidator((input: { holdings: { ticker: string; sector?: string | null }[] }) => ({
    holdings: (Array.isArray(input?.holdings) ? input.holdings : [])
      .map((h) => ({
        ticker: String(h?.ticker ?? "").trim().toUpperCase(),
        sector: typeof h?.sector === "string" ? h.sector : null,
      }))
      .filter((h) => /^[A-Z0-9.\-^]{1,12}$/.test(h.ticker))
      .slice(0, 15),
  }))
  .handler(async ({ data }) => {
    if (!data.holdings.length) return { items: [] as NewsItem[], fetchedAt: new Date().toISOString() };
    const batches = await Promise.all(
      data.holdings.map((h) => newsForTicker(h.ticker, h.sector)),
    );
    const seen = new Set<string>();
    const items: NewsItem[] = [];
    for (const batch of batches) {
      for (const n of batch) {
        const key = n.url.split("?")[0] ?? n.url;
        if (seen.has(key)) {
          const existing = items.find((i) => (i.url.split("?")[0] ?? i.url) === key);
          if (existing && !existing.tickers.includes(n.tickers[0]!)) {
            existing.tickers.push(n.tickers[0]!);
          }
          continue;
        }
        seen.add(key);
        items.push(n);
      }
    }
    return { items, fetchedAt: new Date().toISOString() };
  });
