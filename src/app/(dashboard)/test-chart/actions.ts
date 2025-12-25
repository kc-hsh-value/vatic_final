"use server";

import supabaseAdmin from "@/lib/supabase/server";

export async function fetchEventData(slug: string) {
  try {
    const res = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`, {
      next: { revalidate: 0 } // Don't cache for testing
    });
    
    if (!res.ok) throw new Error("Failed to fetch");
    
    const data = await res.json();
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error("Server Fetch Error:", error);
    return null;
  }
}


// ... (Your existing fetchEventData is here) ...

export async function fetchEventCorrelations(marketIds: string[]) {
  if (!marketIds || marketIds.length === 0) return [];

  console.log(`🔍 Fetching correlations for ${marketIds.length} markets...`);

  const { data, error } = await supabaseAdmin
    .from("tweet_market_correlations_v2")
    .select(`
      *,
      tweet:tweets (
        id,
        text,
        author_name,
        tweet_url,
        published_at,
        x_account:x_accounts (
          profile_picture,
          handle,
          followers_count
        )
      )
    `)
    .in("market_id", marketIds)
    .order("created_at_utc", { ascending: false })
    .limit(500); // Reasonable limit for a single event

  if (error) {
    console.error("❌ Supabase Error:", error);
    return [];
  }

  return data;
}


export async function fetchEventCorrelationsPage(
  marketIds: string[],
  page: number,
  pageSize: number
) {
  if (!marketIds || marketIds.length === 0) {
    return { rows: [], hasMore: false };
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabaseAdmin
    .from("tweet_market_correlations_v2")
    .select(
      `
      *,
      tweet:tweets (
        id,
        text,
        author_name,
        tweet_url,
        published_at,
        x_account:x_accounts (
          profile_picture,
          handle,
          followers_count
        )
      )
    `
    )
    .in("market_id", marketIds)
    .order("created_at_utc", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("❌ Supabase Error:", error);
    return { rows: [], hasMore: false };
  }

  const rows = data ?? [];
  return { rows, hasMore: rows.length === pageSize };
}


// UPDATED: Accepts specific interval and fidelity
export async function fetchMarketHistory(clobTokenId: string, interval: string, fidelity: number) {
  try {
    const url = `https://clob.polymarket.com/prices-history?market=${clobTokenId}&interval=${interval}&fidelity=${fidelity}`;
    // console.log("Fetching History:", url); // Debugging

    const res = await fetch(url, { next: { revalidate: 10 } }); // Cache for 10s
    
    if (!res.ok) return [];
    
    const json = await res.json();
    return json.history || [];
  } catch (error) {
    console.error("History Fetch Error:", error);
    return [];
  }
}