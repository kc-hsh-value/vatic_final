"use server";

// ==========================================
// TYPES (based on Polymarket API response)
// ==========================================

export interface ClobReward {
  id: string;
  conditionId: string;
  assetAddress: string;
  rewardsAmount: number;
  rewardsDailyRate: number;
  startDate: string;
  endDate: string;
}

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
  acceptingOrders?: boolean;
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
  groupItemThreshold?: string;
  rewardsMinSize?: number;
  rewardsMaxSpread?: number;
  clobRewards?: ClobReward[];
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

export enum EventType {
  SINGLE_MARKET = "SINGLE_MARKET",
  SINGLE_WITH_DERIVATIVES = "SINGLE_WITH_DERIVATIVES",
  MUTUALLY_EXCLUSIVE = "MUTUALLY_EXCLUSIVE",
  INDEPENDENT_MULTI_MARKET = "INDEPENDENT_MULTI_MARKET",
  SPORTS_EVENT = "SPORTS_EVENT",
  RANGE_BASED_SERIES = "RANGE_BASED_SERIES",
  UNKNOWN = "UNKNOWN",
}

export interface EventMetadata {
  event: PolymarketEvent;
  seriesData?: PolymarketSeriesWithEvents;
  isSeries: boolean;
  hasMultipleMarkets: boolean;
  eventType: EventType;
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

    // Enrich ALL markets with rewards data (not just primary)
    // This ensures orderbooks work for all markets in multi-market events
    if (event.markets && event.markets.length > 0) {
      event.markets = await Promise.all(
        event.markets.map(market => enrichMarketWithRewards(market))
      );
    }

    // Determine if it's a series
    const isSeries = Boolean(event.series && event.series.length > 0);
    const hasMultipleMarkets = event.markets.length > 1;

    // Classify event type
    const eventType = await classifyEventType(event);

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
      eventType,
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
    // Safety check: some markets (not deployed yet) don't have prices/tokenIds
    if (!market.outcomes || !market.outcomePrices || !market.clobTokenIds) {
      console.warn(`Market ${market.id} missing required fields:`, {
        hasOutcomes: !!market.outcomes,
        hasPrices: !!market.outcomePrices,
        hasTokenIds: !!market.clobTokenIds,
      });
      return [];
    }

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
  return await parseMarketOutcomes(market);
}

/**
 * Filter out inactive/undeployed markets
 * Markets without prices/tokenIds can't be traded
 */
export async function filterActiveMarkets(markets: PolymarketMarket[]): Promise<PolymarketMarket[]> {
  return markets.filter(m => {
    // Must have all required fields for trading
    return m.outcomePrices && m.clobTokenIds && m.active !== false;
  });
}

/**
 * Enrich market data with rewards information
 * Fetches detailed market data including clobRewards
 * Note: clobRewards may not be available from API - pending resolution with Polymarket devrel
 */
async function enrichMarketWithRewards(
  market: PolymarketMarket
): Promise<PolymarketMarket> {
  try {
    const response = await fetch(
      `${BASE_URL}/markets/${market.id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch market details for ${market.id}`);
      return market;
    }

    const detailedMarket = await response.json();
    
    // Merge ALL fields from detailed market
    return {
      ...market,
      ...detailedMarket,
    };
  } catch (error) {
    console.error(`Error enriching market ${market.id} with rewards:`, error);
    return market;
  }
}

/**
 * Classify event into one of the known types
 */
export async function classifyEventType(event: PolymarketEvent): Promise<EventType> {
  const marketCount = event.markets?.length || 0;

  // Single market
  if (marketCount === 1) {
    // Check if it has derivatives (check tags for derivative markets)
    const hasDerivative = event.tags?.some(tag => tag.slug === "derivatives");
    return hasDerivative
      ? EventType.SINGLE_WITH_DERIVATIVES
      : EventType.SINGLE_MARKET;
  }

  // Multi-market classification
  const hasGroupTitles = event.markets.some(
    (m) => m.groupItemTitle && m.groupItemTitle !== ""
  );

  if (!hasGroupTitles) {
    return EventType.UNKNOWN;
  }

  // Check for date-based groupItemTitles (timeline events)
  const datePattern = /(January|February|March|April|May|June|July|August|September|October|November|December) \d+/;
  const hasDateTitles = event.markets.some((m) =>
    datePattern.test(m.groupItemTitle || "")
  );

  // Sports events have sportsMarketType field (e.g., "moneyline")
  // @ts-expect-error - sportsMarketType is not in type definition but exists on sports markets
  const isSportsEvent = event.markets.some((m) => m.sportsMarketType);
  
  if (isSportsEvent) {
    return EventType.SPORTS_EVENT;
  }

  // Check if all markets share similar base question
  const questions = event.markets.map((m) => {
    return m.question
      .replace(/by [A-Z][a-z]+ \d+, \d+\?/g, "by DATE?")
      .replace(/between [\d-]+°F/g, "in RANGE")
      .replace(/on [A-Z][a-z]+ \d+/g, "on DATE");
  });

  const uniqueQuestions = new Set(questions);
  const similarQuestions = uniqueQuestions.size <= 3;

  if (hasDateTitles || similarQuestions) {
    return EventType.INDEPENDENT_MULTI_MARKET;
  }

  // Range-based events (temperature, prices, etc.)
  const hasRanges = event.markets.some(
    (m) =>
      /\d+-\d+/.test(m.groupItemTitle || "") ||
      /or below|or higher/.test(m.groupItemTitle || "")
  );

  if (hasRanges) {
    return EventType.RANGE_BASED_SERIES;
  }

  // Default to mutually exclusive
  return EventType.MUTUALLY_EXCLUSIVE;
}