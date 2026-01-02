// app/address/[slug]/page.tsx
import supabaseAdmin from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import AddressClient from "./address-client";


export const revalidate = 60;

type PublicProfile = {
  createdAt: string;
  proxyWallet: string;
  profileImage: string | null;
  displayUsernamePublic: boolean;
  pseudonym: string | null;
  name: string | null;
  users: Array<{ id: string; creator: boolean; mod: boolean }>;
  verifiedBadge: boolean;
};

type ProfileStats = {
  trades: number;
  largestWin: number;
  views: number;
  joinDate: string; // e.g. "Aug 2025"
};

type KOLRow = {
  polymarket_address: string;
  x_username: string;
  x_display_name: string | null;
  x_profile_image_url: string | null;
  x_badge_label: string | null;
  x_badge_icon_url: string | null;
  x_followers: number | null;
};

type TopLeftStats = {
  joinDate: string | null;
  views: number | null;
  largestWin: number | null;
  trades: number | null;
  positionsValue: number | null;
  marketsTraded: number | null;
};

function isWalletAddress(s: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}

async function fetchPublicProfile(address: string): Promise<PublicProfile | null> {
  const res = await fetch(`https://gamma-api.polymarket.com/public-profile?address=${address}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchProfileStats(proxyAddress: string): Promise<ProfileStats | null> {
  const res = await fetch(`https://polymarket.com/api/profile/stats?proxyAddress=${proxyAddress}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  if (typeof json?.views !== "number") return null;
  return json as ProfileStats;
}

// value endpoint returns: [{ user, value }]
async function fetchPositionsValue(address: string): Promise<number | null> {
  const res = await fetch(`https://data-api.polymarket.com/value?user=${address}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  const v = Array.isArray(json) ? json?.[0]?.value : json?.value;
  return typeof v === "number" ? v : null;
}

// traded endpoint returns: { user, traded }
async function fetchMarketsTraded(address: string): Promise<number | null> {
  const res = await fetch(`https://data-api.polymarket.com/traded?user=${address}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  return typeof json?.traded === "number" ? json.traded : null;
}

async function fetchLinkedKols(address: string): Promise<KOLRow[]> {
  const { data, error } = await supabaseAdmin
    .from("polymarket_kols")
    .select(
      "polymarket_address,x_username,x_display_name,x_profile_image_url,x_badge_label,x_badge_icon_url,x_followers"
    )
    .eq("polymarket_address", address)
    .limit(12);

  if (error) return [];
  return (data ?? []) as any;
}

export default async function AddressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: slugParam } = await params;
  const slug = decodeURIComponent(slugParam || "").trim();
  if (!isWalletAddress(slug)) notFound();

  const address = slug.toLowerCase();

  const profile = await fetchPublicProfile(address);
  if (!profile) notFound();

  const [stats, positionsValue, marketsTraded, linkedKols] = await Promise.all([
    fetchProfileStats(profile.proxyWallet ?? address),
    fetchPositionsValue(address),
    fetchMarketsTraded(address),
    fetchLinkedKols(address),
  ]);

  const topLeftStats: TopLeftStats = {
    joinDate: stats?.joinDate ?? null,
    views: stats?.views ?? null,
    largestWin: stats?.largestWin ?? null,
    trades: stats?.trades ?? null,
    positionsValue,
    marketsTraded,
  };

  return (
    <AddressClient
      address={address}
      profile={profile}
      linkedKols={linkedKols}
      topLeftStats={topLeftStats}
    />
  );
}