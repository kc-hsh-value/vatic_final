import { matchTokensToOutcomes } from '@/lib/polymarket/polytmarket-parser';
import { createClient } from '@supabase/supabase-js';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Define types for better DX
type PolymarketEvent = {
  id: string;
  title: string;
  description: string;
  markets: any[]; // We'll process this raw data
};

type CorrelatedTweet = {
  id: string;
  tweet_id: string;
  market_id: string;
  relevance_reason: string;
  relevance_score: number;
  // ... add other fields as needed
};

export async function getPageData(eventSlug: string, marketSlug?: string) {
  // 1. Fetch Event Data from Polymarket Gamma API
  // We use the events endpoint querying by slug
  const polyRes = await fetch(
    `https://gamma-api.polymarket.com/events?slug=${eventSlug}`
  );
  
  const polyData = await polyRes.json();
  
  // Polymarket search returns a list. Use the first exact match or first result.
  if (!polyData || polyData.length === 0) return null;
  
  const eventData = polyData[0]; // The raw event object
  
  // 2. Process Markets to get IDs
  // We need to extract all market IDs from this event to query our DB
  const rawMarkets = eventData.markets || [];
  const marketIds = rawMarkets.map((m: any) => m.id);
  
  // 3. Fetch Correlations from Internal DB
  // We search for ANY tweets correlated to ANY market in this event
  const { data: tweets, error } = await supabase
    .from('tweet_market_correlations_v2')
    .select('*')
    .in('market_id', marketIds) // This is efficient
    .order('created_at_utc', { ascending: false });

  if (error) console.error("Supabase Error:", error);

  // 4. Identify the "Active" Market
  // If user provided a marketSlug, find that specific market.
  // Otherwise, default to the first market in the list (or handle multi-view later).
  const activeMarketRaw = marketSlug 
    ? rawMarkets.find((m: any) => m.slug === marketSlug) 
    : rawMarkets[0];

  // 5. Apply "The Trick" to the active market
  const activeMarketProcessed = activeMarketRaw ? {
    ...activeMarketRaw,
    outcomesProcessed: matchTokensToOutcomes(
      activeMarketRaw.outcomes, 
      activeMarketRaw.clobTokenIds,
      activeMarketRaw.outcomePrices
    )
  } : null;

  return {
    event: eventData,
    activeMarket: activeMarketProcessed,
    correlatedTweets: tweets as CorrelatedTweet[],
    allMarketsRaw: rawMarkets // Useful for sidebar or combinatory view
  };
}