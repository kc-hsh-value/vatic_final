import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabase/server";

type PolymarketProfile = {
  id: string;
  proxyWallet: string;
  name?: string | null;
  pseudonym?: string | null;
  profileImage?: string | null;
  displayUsernamePublic?: boolean | null;
};

type PolymarketEvent = {
  id: string;
  title?: string | null;
  slug?: string | null;
  image?: string | null;
  icon?: string | null;
  markets?: PolymarketMarket[];
};

type PolymarketMarket = {
  id: string;
  question: string;
  slug: string;
  image?: string | null;
  icon?: string | null;
  outcomes?: string;
  outcomePrices?: string;
  volume?: string | number;
  liquidity?: string | number;
  endDate?: string | null;
  closed?: boolean | null;
  archived?: boolean | null;
  active?: boolean | null;
};

type KOLResult = {
  polymarket_address: string;
  x_username: string | null;
  x_display_name: string | null;
  x_profile_image_url: string | null;
  x_badge_label: string | null;
  x_badge_icon_url: string | null;
  x_followers: number | null;
  source: "kol" | "polymarket";
};

type MarketResult = {
  id: string;
  question: string;
  slug: string;
  image?: string | null;
  icon?: string | null;
  outcomes?: string[];
  outcomePrices?: number[];
  volume?: number;
  liquidity?: number;
  endDate?: string | null;
  event?: {
    title?: string;
    slug?: string;
  };
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() || "";

    if (!query) {
      return NextResponse.json({ traders: [], markets: [] });
    }

    // Run all searches in parallel
    const [kolResults, polymarketProfiles, polymarketData] = await Promise.allSettled([
      searchKOLs(query),
      searchPolymarketProfiles(query),
      searchPolymarketMarketsAndEvents(query),
    ]);

    // Combine trader results
    const kols: KOLResult[] =
      kolResults.status === "fulfilled" ? kolResults.value : [];
    const polyProfiles: KOLResult[] =
      polymarketProfiles.status === "fulfilled" ? polymarketProfiles.value : [];

    // Deduplicate: KOLs take priority over Polymarket profiles
    const kolAddresses = new Set(
      kols.map((k) => k.polymarket_address.toLowerCase())
    );
    const uniquePolyProfiles = polyProfiles.filter(
      (p) => !kolAddresses.has(p.polymarket_address.toLowerCase())
    );

    // Merge traders: KOLs first (sorted by followers), then Polymarket profiles
    const traders = [...kols, ...uniquePolyProfiles].slice(0, 20);

    // Get markets
    const markets: MarketResult[] =
      polymarketData.status === "fulfilled" ? polymarketData.value : [];

    return NextResponse.json({ traders, markets });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ traders: [], markets: [] });
  }
}

async function searchKOLs(query: string): Promise<KOLResult[]> {
  const { data, error } = await supabaseAdmin
    .from("polymarket_kols")
    .select(
      "polymarket_address, x_username, x_display_name, x_profile_image_url, x_badge_label, x_badge_icon_url, x_followers"
    )
    .or(
      `x_username.ilike.%${query}%,x_display_name.ilike.%${query}%,polymarket_address.ilike.%${query}%`
    )
    .order("x_followers", { ascending: false, nullsFirst: false })
    .limit(15);

  if (error) {
    console.error("KOL search error:", error);
    return [];
  }

  return (data || []).map((row) => ({
    ...row,
    source: "kol" as const,
  }));
}

async function searchPolymarketProfiles(query: string): Promise<KOLResult[]> {
  try {
    // Hit Polymarket's public search API for profiles
    const url = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(
      query
    )}&search_profiles=true&limit_per_type=10`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 }, // Cache for 60s
    });

    if (!response.ok) {
      console.error("Polymarket API error:", response.status);
      return [];
    }

    const json = await response.json();
    const profiles: PolymarketProfile[] = json?.profiles || [];

    // Map Polymarket profiles to our KOLResult format
    return profiles
      .filter((p) => p.proxyWallet) // Must have wallet address
      .map((p) => ({
        polymarket_address: p.proxyWallet.toLowerCase(),
        x_username: null,
        x_display_name: p.displayUsernamePublic
          ? p.name || p.pseudonym || null
          : p.pseudonym || "Polymarket User",
        x_profile_image_url: p.profileImage || null,
        x_badge_label: null,
        x_badge_icon_url: null,
        x_followers: null,
        source: "polymarket" as const,
      }));
  } catch (err) {
    console.error("Polymarket profile search error:", err);
    return [];
  }
}

async function searchPolymarketMarketsAndEvents(
  query: string
): Promise<MarketResult[]> {
  try {
    // Hit Polymarket's public search API for events and markets
    // keep_closed_markets=0 excludes closed markets
    // sort=volume sorts by volume
    // ascending=false gives us descending order
    const url = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(
      query
    )}&search_profiles=false&limit_per_type=20&keep_closed_markets=0&sort=volume&ascending=false`;

    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 }, // Cache for 60s
    });

    if (!response.ok) {
      console.error("Polymarket API error:", response.status);
      return [];
    }

    const json = await response.json();
    const events: PolymarketEvent[] = json?.events || [];

    // Flatten events into markets
    const markets: MarketResult[] = [];

    events.forEach((event) => {
      if (event.markets && Array.isArray(event.markets)) {
        event.markets.forEach((market) => {
          try {
            // Additional client-side filtering for safety
            // Skip if market is closed, archived, or inactive
            if (
              market.closed === true ||
              market.archived === true ||
              market.active === false
            ) {
              return; // Skip this market
            }

            const outcomes = market.outcomes
              ? JSON.parse(market.outcomes)
              : undefined;
            const outcomePrices = market.outcomePrices
              ? JSON.parse(market.outcomePrices)
              : undefined;

            const volume =
              typeof market.volume === "number"
                ? market.volume
                : typeof market.volume === "string"
                ? parseFloat(market.volume)
                : undefined;

            markets.push({
              id: market.id,
              question: market.question,
              slug: market.slug,
              image: market.image,
              icon: market.icon,
              outcomes,
              outcomePrices,
              volume,
              liquidity:
                typeof market.liquidity === "number"
                  ? market.liquidity
                  : typeof market.liquidity === "string"
                  ? parseFloat(market.liquidity)
                  : undefined,
              endDate: market.endDate,
              event: {
                title: event.title || undefined,
                slug: event.slug || undefined,
              },
            });
          } catch (e) {
            // Skip markets with parsing errors
          }
        });
      }
    });

    // Sort by volume descending (extra safety in case API sorting didn't work)
    markets.sort((a, b) => {
      const volA = a.volume || 0;
      const volB = b.volume || 0;
      return volB - volA;
    });

    return markets.slice(0, 20);
  } catch (err) {
    console.error("Polymarket markets search error:", err);
    return [];
  }
}
