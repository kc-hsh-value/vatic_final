// Types for our Frontend
export interface MarketOutcome {
  label: string; // "Yes"
  tokenId: string; // "0x..."
  price: number; // 0.395
}

export interface UnifiedMarket {
  id: string;
  slug: string;
  question: string;
  title: string; // Uses groupItemTitle if available (e.g. "Kevin Warsh")
  image: string;
  volume24hr: number;
  priceChange24hr: number;
  active: boolean;
  groupItemTitle?: string; // e.g. "Kevin Warsh"
  
  // The "Index 0" Logic
  mainOutcome: MarketOutcome; 
  outcomes: MarketOutcome[]; 
}

export interface UnifiedEvent {
  id: string;
  title: string;
  image: string;
  description: string;
  totalVolume: number;
  totalLiquidity: number;
  markets: UnifiedMarket[];
}

// Helper: Polymarket strings are messy (single vs double quotes)
function safeParsePolyArray(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  
  if (typeof raw === "string") {
    const cleaned = raw.trim();
    if (cleaned === "[]") return [];
    try {
      return JSON.parse(cleaned);
    } catch {
      try {
        // Fallback: Replace single quotes with double quotes
        return JSON.parse(cleaned.replace(/'/g, '"'));
      } catch {
        return [];
      }
    }
  }
  return [];
}

export function normalizeEvent(apiResponse: any): UnifiedEvent | null {
  // 1. Safety Check
  if (!apiResponse || !Array.isArray(apiResponse) || apiResponse.length === 0) {
    return null;
  }

  const rawEvent = apiResponse[0]; // The Event Object

  console.log("raw markets: ", rawEvent.markets);

  // 2. Process Markets
  const markets: UnifiedMarket[] = (rawEvent.markets || []).map((m: any) => {


    
    // A. Parse the Arrays
    const outcomesLabels = safeParsePolyArray(m.outcomes);      // ["Yes", "No"]
    const outcomePrices  = safeParsePolyArray(m.outcomePrices); // ["0.395", "0.605"]
    const tokenIds       = safeParsePolyArray(m.clobTokenIds);  // ["0x123", "0x456"]

    // B. Build Outcomes (Zip them together)
    const processedOutcomes: MarketOutcome[] = outcomesLabels.map((label, index) => {
      return {
      label: label,
      tokenId: tokenIds[index] || "",
      price: parseFloat(outcomePrices[index] || "0"),
    }}).filter(o => o.tokenId) // Remove if no token ID

    // C. "Index 0 is King" Rule
    const mainOutcome = processedOutcomes[0] || { label: "N/A", tokenId: "", price: 0 };


    return {
      id: String(m.id),
      slug: m.slug,
      question: m.question,
      // Use groupItemTitle (e.g. "Kevin Warsh") if it exists, else full question
      groupItemTitle: m.groupItemTitle,
      title: m.title || m.question, 
      image: m.image || rawEvent.image, // Fallback to event image
      volume24hr: Number(m.volume24hr || 0),
      priceChange24hr: Number(m.oneDayPriceChange || 0),
      active: m.active,
      outcomes: processedOutcomes,
      mainOutcome: mainOutcome
    };
  }).filter((um: UnifiedMarket) => um.active !== false);

  // 3. Sort Markets: Frontrunners first, then by Volume/Liquidity
  markets.sort((a, b) => b.mainOutcome.price - a.mainOutcome.price);

  console.log("markets after normalization: ", markets);

  // 4. Return Clean Event
  return {
    id: rawEvent.id,
    title: rawEvent.title,
    image: rawEvent.image,
    description: rawEvent.description,
    totalVolume: Number(rawEvent.volume || 0),
    totalLiquidity: Number(rawEvent.liquidity || 0),
    markets: markets
  };
}