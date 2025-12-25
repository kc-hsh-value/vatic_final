// lib/normalize-markets.ts

type SimpleOutcome = {
  label: string;
  tokenId: string;
  price?: number;
};

export type SimpleMarket = {
  id: string;
  slug: string;
  question: string;
  image?: string;
  liquidity: number; // <--- Added this
  volume: number;    // <--- Added this
  firstOutcome: SimpleOutcome | null;
  allOutcomes: SimpleOutcome[];
};

function parseStrArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const arr = JSON.parse(val);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asNumberOrUndef(x: any): number | undefined {
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeMarketsFromEvent(eventJson: any): SimpleMarket[] {
  // Polymarket API response structure check
  const raw = Array.isArray(eventJson?.markets) ? eventJson.markets : [];
  const out: SimpleMarket[] = [];

  for (const m of raw) {
    const id = String(m.id ?? "");
    const slug = String(m.slug ?? "");
    const question = String(m.question ?? m.title ?? "");

    if (!id || !slug) continue;

    const outcomes = parseStrArray(m.outcomes ?? m.outcomesArray); 
    const prices   = parseStrArray(m.outcomePrices ?? m.prices).map(asNumberOrUndef);
    const tokens   = parseStrArray(m.clobTokenIds ?? m.tokenIds ?? m.tokens);

    const aligned: SimpleOutcome[] = outcomes.map((label, i) => ({
      label,
      tokenId: tokens[i] ?? "",
      price: prices[i],
    })).filter(o => o.tokenId); 

    const firstOutcome = aligned.length > 0 ? aligned[0] : null;

    out.push({
      id,
      slug,
      question,
      image: m.image,
      liquidity: Number(m.liquidity) || 0, // <--- Capture liquidity
      volume: Number(m.volume) || 0,       // <--- Capture volume
      firstOutcome,
      allOutcomes: aligned,
    });
  }

  return out;
}