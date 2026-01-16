"use server";

// ==========================================
// TYPES (based on Polymarket API response)
// ==========================================

export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  image: string;
  icon: string;
  startDate: string;
  endDate: string;
  clobTokenIds: string;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  volume1yr: number;
  groupItemTitle?: string;
  // ... add more fields as needed
}

export interface PolymarketSeries {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  seriesType: string;
  recurrence: string;
  active: boolean;
  volume: number;
  liquidity: number;
  commentCount: number;
}

export interface PolymarketTag {
  id: string;
  label: string;
  slug: string;
}

export interface PolymarketEvent {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  featured: boolean;
  restricted: boolean;
  liquidity: number;
  volume: number;
  volume24hr: number;
  volume1wk: number;
  volume1mo: number;
  volume1yr: number;
  startDate: string;
  endDate: string;
  creationDate: string;
  markets: PolymarketMarket[];
  series?: PolymarketSeries[];
  tags: PolymarketTag[];
  commentCount: number;
  enableOrderBook: boolean;
  competitive: number;
}

export interface PolymarketSeriesWithEvents extends PolymarketSeries {
  events: PolymarketEvent[];
}

export interface MarketOutcome {
  name: string;
  price: number;
  clobTokenId: string;
}

export interface EventMetadata {
  event: PolymarketEvent;
  seriesData?: PolymarketSeriesWithEvents;
  isSeries: boolean;
  hasMultipleMarkets: boolean;
}

// ==========================================
// SERVER ACTIONS
// ==========================================

const BASE_URL = "https://gamma-api.polymarket.com";

/**
 * Fetch event metadata from Polymarket API
 * This is lightweight (~100-200ms) and safe for server-side execution
 */
export async function fetchEventMetadata(
  slug: string
): Promise<EventMetadata | null> {
  try {
    // Fetch main event data
    const eventUrl = `${BASE_URL}/events/slug/${slug}?include_template=true&include_chat=true`;
    const eventResponse = await fetch(eventUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    });

    if (!eventResponse.ok) {
      console.error(`Failed to fetch event: ${eventResponse.status}`);
      return null;
    }

    const event: PolymarketEvent = await eventResponse.json();

    // Determine if it's a series
    const isSeries = Boolean(event.series && event.series.length > 0);
    const hasMultipleMarkets = event.markets.length > 1;

    // If it's a series, optionally fetch series data with all events
    let seriesData: PolymarketSeriesWithEvents | undefined;
    if (isSeries && event.series && event.series[0]) {
      const seriesId = event.series[0].id;
      try {
        const seriesUrl = `${BASE_URL}/series/${seriesId}?include_chat=true`;
        const seriesResponse = await fetch(seriesUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          next: { revalidate: 60 },
        });

        if (seriesResponse.ok) {
          seriesData = await seriesResponse.json();
        }
      } catch (err) {
        console.error("Failed to fetch series data:", err);
        // Non-critical, continue without series data
      }
    }

    return {
      event,
      seriesData,
      isSeries,
      hasMultipleMarkets,
    };
  } catch (error) {
    console.error("Error fetching event metadata:", error);
    return null;
  }
}

/**
 * Parse market outcomes with proper name/price/tokenId mapping
 * Maps index 0 of outcomes -> index 0 of prices -> index 0 of tokenIds
 */
export async function parseMarketOutcomes(
  market: PolymarketMarket
): Promise<MarketOutcome[]> {
  try {
    const outcomes: string[] = JSON.parse(market.outcomes);
    const prices: string[] = JSON.parse(market.outcomePrices);
    const tokenIds: string[] = JSON.parse(market.clobTokenIds);

    return outcomes.map((name, index) => ({
      name,
      price: parseFloat(prices[index] || "0"),
      clobTokenId: tokenIds[index] || "",
    }));
  } catch (error) {
    console.error("Failed to parse market outcomes:", error);
    return [];
  }
}

/**
 * Get primary market from event
 * Selects market with highest first outcome price (most interesting/volatile)
 */
export async function getPrimaryMarket(
  event: PolymarketEvent
): Promise<PolymarketMarket | null> {
  if (event.markets.length === 0) return null;
  if (event.markets.length === 1) return event.markets[0];

  // Find market with highest first outcome price
  let bestMarket = event.markets[0];
  let highestPrice = 0;

  for (const market of event.markets) {
    const outcomes = await parseMarketOutcomes(market);
    if (outcomes.length > 0 && outcomes[0].price > highestPrice) {
      highestPrice = outcomes[0].price;
      bestMarket = market;
    }
  }

  return bestMarket;
}

/**
 * Get main outcome (first one, typically "Yes" in binary markets)
 */
export async function getMainOutcome(market: PolymarketMarket): Promise<MarketOutcome | null> {
  const outcomes = await parseMarketOutcomes(market);
  return outcomes.length > 0 ? outcomes[0] : null;
}

/**
 * Get all outcomes for a market
 */
export async function getAllOutcomes(market: PolymarketMarket): Promise<MarketOutcome[]> {
  return parseMarketOutcomes(market);
}
