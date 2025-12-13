/**
 * Polymarket often returns arrays as stringified JSON.
 * e.g. "['Yes', 'No']" or "[\"Yes\", \"No\"]"
 */
export function parsePolyList(strVal: string | null | undefined): string[] {
  if (!strVal) return [];
  try {
    return JSON.parse(strVal);
  } catch (e) {
    try {
      // Fallback for single quotes which isn't valid JSON
      return JSON.parse(strVal.replace(/'/g, '"'));
    } catch (e2) {
      return [];
    }
  }
}

export interface MarketOutcome {
  name: string;
  tokenId: string;
  price: number; // We will parse this from outcomePrices later
}

/**
 * The "Trick": Matches Outcome Names to CLOB Token IDs 1:1
 */
export function matchTokensToOutcomes(
  outcomesStr: string,
  clobTokenIdsStr: string,
  pricesStr: string
): MarketOutcome[] {
  const names = parsePolyList(outcomesStr);
  const ids = parsePolyList(clobTokenIdsStr);
  const prices = parsePolyList(pricesStr);

  return names.map((name, index) => ({
    name: name,
    tokenId: ids[index] || "",
    price: parseFloat(prices[index] || "0"),
  }));
}