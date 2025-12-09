// lib/polymarket.ts

export type PriceMap = Record<string, number>; // token_id -> price

export async function fetchBatchPrices(tokenIds: string[]): Promise<PriceMap> {
  if (!tokenIds.length) return {};

  // We want the "SELL" side because we are buying. 
  // We take the liquidity from the Sellers (Asks).
  const body = tokenIds.map((id) => ({
    token_id: id,
    side: "SELL", 
  }));

  try {
    const res = await fetch("https://clob.polymarket.com/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      next: { revalidate: 0 } // No caching for Next.js server side, though we call this client side
    });

    if (!res.ok) throw new Error("Failed to fetch prices");

    const raw = await res.json();
    
    // Transform response: { "token_1": { "SELL": "0.55" } } -> { "token_1": 0.55 }
    const prices: PriceMap = {};
    
    // The API returns a Map-like object
    for (const [tokenId, sides] of Object.entries(raw)) {
      // @ts-expect-error -- sides has dynamic keys
      if (sides && sides.SELL) {
        // @ts-expect-error -- sides has dynamic keys
        prices[tokenId] = parseFloat(sides.SELL);
      }
    }

    return prices;
  } catch (err) {
    console.error("Price fetch error:", err);
    return {};
  }
}