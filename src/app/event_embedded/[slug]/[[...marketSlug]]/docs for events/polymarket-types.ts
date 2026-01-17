/**
 * TypeScript interfaces for Polymarket API responses
 * Based on analysis of different event types
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  markets: Market[];
  type?: string;
  enableOrderBook: boolean;
  series: Series | null;
  liquidity?: string | number;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Market {
  id: string;
  question: string;
  outcome?: string;
  outcomePrices?: [string, string]; // [yes price, no price]
  volume?: string | number;
  liquidity?: string | number;
  groupItemTitle?: string;
  groupItemThreshold?: string | null;
  derivative?: Derivative | null;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  acceptingOrders?: boolean;
  endDate?: string;
  startDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Derivative {
  type: string; // e.g., "midpoint", "range", "threshold"
  id: string; // ID of the parent market this derives from
  config?: Record<string, any>;
}

export interface Series {
  id?: string;
  title?: string;
  description?: string;
  slug?: string;
  markets?: Market[];
}

// ============================================================================
// EVENT TYPE ENUMS
// ============================================================================

export enum EventType {
  SINGLE_MARKET = 'SINGLE_MARKET',
  SINGLE_WITH_DERIVATIVES = 'SINGLE_WITH_DERIVATIVES',
  MUTUALLY_EXCLUSIVE = 'MUTUALLY_EXCLUSIVE',
  INDEPENDENT_MULTI_MARKET = 'INDEPENDENT_MULTI_MARKET',
  SPORTS_EVENT = 'SPORTS_EVENT',
  RANGE_BASED_SERIES = 'RANGE_BASED_SERIES',
  UNKNOWN = 'UNKNOWN'
}

// ============================================================================
// CLASSIFIED EVENT TYPE
// ============================================================================

export interface ClassifiedEvent extends PolymarketEvent {
  eventType: EventType;
  sortedMarkets: Market[];
  metadata: EventMetadata;
}

export interface EventMetadata {
  marketCount: number;
  hasGroupTitles: boolean;
  hasDerivatives: boolean;
  isSeries: boolean;
  totalLiquidity?: number;
  totalVolume?: number;
  primaryMarket?: Market; // For single market or sports events
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface MarketProbabilities {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  impliedProbability: number; // Percentage (0-100)
  isResolved: boolean;
}

export interface MutuallyExclusiveValidation {
  isValid: boolean;
  totalProbability: number;
  expectedSum: number;
  deviation: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Classify an event into one of the known types
 */
export function classifyEvent(event: PolymarketEvent): EventType {
  const marketCount = event.markets?.length || 0;
  
  // Single market
  if (marketCount === 1) {
    const hasDerivative = event.markets.some(m => m.derivative);
    return hasDerivative ? EventType.SINGLE_WITH_DERIVATIVES : EventType.SINGLE_MARKET;
  }
  
  // Multi-market classification
  const hasGroupTitles = event.markets.some(m => m.groupItemTitle && m.groupItemTitle !== '');
  
  if (!hasGroupTitles) {
    return EventType.UNKNOWN;
  }
  
  // Check if all markets share similar base question (timeline events)
  const questions = event.markets.map(m => {
    return m.question
      .replace(/by [A-Z][a-z]+ \d+, \d+\?/g, 'by DATE?')
      .replace(/between [\d-]+°F/g, 'in RANGE')
      .replace(/on [A-Z][a-z]+ \d+/g, 'on DATE');
  });
  
  const uniqueQuestions = new Set(questions);
  const similarQuestions = uniqueQuestions.size <= 3;
  
  // Check for date-based groupItemTitles
  const datePattern = /(January|February|March|April|May|June|July|August|September|October|November|December) \d+/;
  const hasDateTitles = event.markets.some(m => datePattern.test(m.groupItemTitle || ''));
  
  // Sports events have many varied markets
  const thresholds = event.markets
    .map(m => m.groupItemThreshold)
    .filter((t): t is string => t !== null && t !== undefined);
  const maxThreshold = thresholds.length > 0 ? Math.max(...thresholds.map(Number)) : 0;
  const hasLargeGaps = maxThreshold > marketCount * 2;
  
  if (hasLargeGaps || marketCount > 15) {
    return EventType.SPORTS_EVENT;
  }
  
  if (hasDateTitles || similarQuestions) {
    return EventType.INDEPENDENT_MULTI_MARKET;
  }
  
  // Range-based events
  const hasRanges = event.markets.some(m => 
    /\d+-\d+/.test(m.groupItemTitle || '') || 
    /or below|or higher/.test(m.groupItemTitle || '')
  );
  
  if (hasRanges) {
    return EventType.RANGE_BASED_SERIES;
  }
  
  return EventType.MUTUALLY_EXCLUSIVE;
}

/**
 * Sort markets by their threshold
 */
export function sortMarketsByThreshold(markets: Market[]): Market[] {
  return [...markets].sort((a, b) => {
    const thresholdA = Number(a.groupItemThreshold ?? 0);
    const thresholdB = Number(b.groupItemThreshold ?? 0);
    return thresholdA - thresholdB;
  });
}

/**
 * Calculate market probabilities
 */
export function calculateProbabilities(market: Market): MarketProbabilities {
  const yesPrice = parseFloat(market.outcomePrices?.[0] || '0');
  const noPrice = parseFloat(market.outcomePrices?.[1] || '0');
  
  return {
    marketId: market.id,
    yesPrice,
    noPrice,
    impliedProbability: yesPrice * 100,
    isResolved: yesPrice === 0 || yesPrice === 1
  };
}

/**
 * Validate mutually exclusive event probabilities
 */
export function validateMutuallyExclusive(
  event: PolymarketEvent
): MutuallyExclusiveValidation {
  const totalProbability = event.markets.reduce((sum, market) => {
    const yesPrice = parseFloat(market.outcomePrices?.[0] || '0');
    return sum + yesPrice;
  }, 0);
  
  const expectedSum = 1.0;
  const deviation = Math.abs(totalProbability - expectedSum);
  const isValid = deviation < 0.15; // 15% tolerance for fees and rounding
  
  return {
    isValid,
    totalProbability,
    expectedSum,
    deviation
  };
}

/**
 * Get enriched event with classification
 */
export function enrichEvent(event: PolymarketEvent): ClassifiedEvent {
  const eventType = classifyEvent(event);
  const sortedMarkets = sortMarketsByThreshold(event.markets);
  
  const totalVolume = event.markets.reduce((sum, m) => {
    const volume = typeof m.volume === 'string' ? parseFloat(m.volume) : (m.volume || 0);
    return sum + volume;
  }, 0);
  
  const hasDerivatives = event.markets.some(m => m.derivative !== null && m.derivative !== undefined);
  const hasGroupTitles = event.markets.some(m => m.groupItemTitle && m.groupItemTitle !== '');
  
  // Find primary market (usually the first one or the one with highest volume)
  const primaryMarket = event.markets.length === 1 
    ? event.markets[0]
    : event.markets.reduce((prev, current) => {
        const prevVol = typeof prev.volume === 'string' ? parseFloat(prev.volume) : (prev.volume || 0);
        const currVol = typeof current.volume === 'string' ? parseFloat(current.volume) : (current.volume || 0);
        return currVol > prevVol ? current : prev;
      });
  
  return {
    ...event,
    eventType,
    sortedMarkets,
    metadata: {
      marketCount: event.markets.length,
      hasGroupTitles,
      hasDerivatives,
      isSeries: event.series !== null,
      totalVolume,
      totalLiquidity: typeof event.liquidity === 'string' 
        ? parseFloat(event.liquidity) 
        : event.liquidity,
      primaryMarket
    }
  };
}

/**
 * Calculate implied probability between two timeline markets
 */
export function calculateTimelineProbabilityDensity(
  market1: Market,
  market2: Market
): number {
  const prob1 = parseFloat(market1.outcomePrices?.[0] || '0');
  const prob2 = parseFloat(market2.outcomePrices?.[0] || '0');
  
  // Probability of event happening between market1 and market2
  return Math.max(0, prob2 - prob1);
}

/**
 * Group sports markets by category
 */
export function groupSportsMarkets(markets: Market[]): Record<string, Market[]> {
  const groups: Record<string, Market[]> = {
    'Match Winner': [],
    'Map Winners': [],
    'Handicaps': [],
    'Over/Under': [],
    'Other': []
  };
  
  markets.forEach(market => {
    const title = market.groupItemTitle || market.question;
    
    if (title.includes('Map') && title.includes('Winner')) {
      groups['Map Winners'].push(market);
    } else if (title.includes('Handicap')) {
      groups['Handicaps'].push(market);
    } else if (title.includes('Over/Under') || title.includes('O/U') || title.includes('Total')) {
      groups['Over/Under'].push(market);
    } else if (
      !title.includes('Winner') && 
      !title.includes('Handicap') && 
      (market === markets[0] || market.volume && parseFloat(String(market.volume)) > 100000)
    ) {
      groups['Match Winner'].push(market);
    } else {
      groups['Other'].push(market);
    }
  });
  
  return groups;
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/*
// Fetch and classify an event
async function fetchAndClassifyEvent(slug: string): Promise<ClassifiedEvent> {
  const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
  const events: PolymarketEvent[] = await response.json();
  const event = events[0];
  
  return enrichEvent(event);
}

// Use the classified event
const event = await fetchAndClassifyEvent('fed-decision-in-january');

console.log(`Event Type: ${event.eventType}`);
console.log(`Markets: ${event.metadata.marketCount}`);
console.log(`Has Derivatives: ${event.metadata.hasDerivatives}`);

// Validate if mutually exclusive
if (event.eventType === EventType.MUTUALLY_EXCLUSIVE) {
  const validation = validateMutuallyExclusive(event);
  console.log(`Valid: ${validation.isValid}`);
  console.log(`Total Probability: ${(validation.totalProbability * 100).toFixed(2)}%`);
}

// Display markets in correct order
event.sortedMarkets.forEach(market => {
  const probs = calculateProbabilities(market);
  console.log(`${market.groupItemTitle}: ${probs.impliedProbability.toFixed(2)}%`);
});
*/
