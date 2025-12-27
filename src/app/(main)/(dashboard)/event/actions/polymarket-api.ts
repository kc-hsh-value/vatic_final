import { createClient } from '@supabase/supabase-js';
import { normalizeMarketsFromEvent } from './normalize-markets';


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getEventPageData(eventSlug: string, marketSlug?: string) {
  // 1. Fetch Event from Polymarket
  const eventRes = await fetch(
    `https://gamma-api.polymarket.com/events?slug=${eventSlug}`,
    { next: { revalidate: 60 } } // Cache for 1 min
  );
  const eventDataRaw = await eventRes.json();
  
  if (!eventDataRaw || eventDataRaw.length === 0) return null;
  const event = eventDataRaw[0]; // Gamma returns an array
  
  // 2. Normalize Markets (Extract outcomes, IDs, etc using your logic)
  const markets = normalizeMarketsFromEvent({ markets: event.markets });
  const marketIds = markets.map(m => m.id);

  // 3. Fetch Correlations with deeply nested joins
  // We join correlations -> tweets -> x_accounts
  const { data: correlations, error } = await supabase
    .from('tweet_market_correlations_v2')
    .select(`
      *,
      tweet:tweets (
        id, text, tweet_url, author_name, published_at,
        x_account:x_accounts (
          profile_picture, handle, followers_count
        )
      )
    `)
    .in('market_id', marketIds)
    .order('created_at_utc', { ascending: false })
    .limit(200); // Limit to last 200 for performance

  if (error) console.error("Supabase Load Error:", error);

  // 4. Determine Active View
  // If marketSlug exists, find that market. Else, it's a "Multi/Combined" view.
  const activeMarket = marketSlug 
    ? markets.find(m => m.slug === marketSlug) 
    : null; // null implies "Top 5" or "All" view

  return {
    eventTitle: event.title,
    eventImage: event.image,
    markets,
    activeMarket,
    correlations: correlations as any[] // Cast to EnrichedCorrelation[] in UI
  };
}