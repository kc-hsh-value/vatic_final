'use server'

import supabaseAdmin from "@/lib/supabase/server";



// --- Types ---
export type RelatedMarket = {
  market_id: string;
  question: string;
  relevance: number;
  urgency: number;
  category: string;
  reason: string;
};

export type FeedItem = {
  tweet_id: string;
  author_name: string;
  author_url: string;
  tweet_text: string;
  published_at: string;
  max_urgency: number;
  related_markets: RelatedMarket[];
};

// 1. HOME FEED ACTION
export async function getAlphaFeedAction(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_alpha_feed', {
      p_user_id: userId,
      p_limit: 50,
      p_min_urgency: 0.4
    });

    if (error) throw error;
    return { success: true, data: data as FeedItem[] };
  } catch (error) {
    console.error('Error fetching alpha feed:', error);
    return { success: false, data: [] };
  }
}

// 2. EVENT PAGE ACTION
export async function getEventNewsAction(eventSlug: string) {
  try {
    // A. Resolve Slug -> IDs via Polymarket API
    // (We do this server-side to keep API keys hidden if needed later)
    const polyRes = await fetch(`https://gamma-api.polymarket.com/events?slug=${eventSlug}`, {
        next: { revalidate: 300 } // Cache this lookup for 5 mins
    });
    const polyData = await polyRes.json();

    if (!polyData || polyData.length === 0) return { success: false, data: [] };

    const marketIds = polyData[0].markets.map((m: any) => m.id);

    // B. Query Supabase
    const { data, error } = await supabaseAdmin.rpc('get_news_for_markets', {
      p_market_ids: marketIds
    });

    if (error) throw error;
    return { success: true, data: data }; // Returns the grouped rows
  } catch (error) {
    console.error('Error fetching event news:', error);
    return { success: false, data: [] };
  }
}

// 2. GLOBAL SUPER FEED (New)
export async function getGlobalAlphaFeedAction() {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_global_alpha_feed', {
      p_limit: 50,
      p_min_urgency: 0.0 // Fetch everything, let UI filter
    });

    if (error) throw error;
    return { success: true, data: data };
  } catch (error) {
    console.error('Error fetching global feed:', error);
    return { success: false, data: [] };
  }
}
