// app/(main)/address/[slug]/address-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Button } from "@/components/ui/button";
import { Copy, Gift, ChevronDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import Link from "next/link";
import PnlChart from "./pnl-chart";

// ... [Types remain identical to your original code] ...
type PublicProfile = {
  createdAt: string;
  proxyWallet: string;
  profileImage: string | null;
  displayUsernamePublic: boolean;
  pseudonym: string | null;
  name: string | null;
  users: Array<{ id: string; creator: boolean; mod: boolean }>;
  verifiedBadge: boolean;
  x_label_badge: string | null;
  x_badge_icon_url: string | null;
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

type PnlPoint = { t: number; p: number };

type LeaderboardRow = {
  rank?: string | number;
  proxyWallet?: string;
  userName?: string;
  xUsername?: string;
  verifiedBadge?: boolean;
  vol?: number;
  pnl?: number;
  profileImage?: string;
};

export type PolymarketActivePosition = {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  percentRealizedPnl: number;
  curPrice: number;
  redeemable: boolean;
  mergeable: boolean;
  title: string;
  slug: string;
  icon: string;
  eventId: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  oppositeOutcome: string;
  oppositeAsset: string;
  endDate: string;
  negativeRisk: boolean;
};

type ClosedPosition = any;

type PolymarketActivityRow = {
  proxyWallet: string;
  timestamp: number;
  conditionId: string;
  type: "TRADE" | "SPLIT" | "MERGE" | "REDEEM" | "REWARD" | "CONVERSION";
  size?: number;
  usdcSize?: number;
  transactionHash?: string;
  price?: number;
  asset?: string;
  side?: "BUY" | "SELL";
  outcomeIndex?: number;
  title?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
  outcome?: string;
};

// ... [Utils remain identical to your original code] ...
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
function proxifyImg(url?: string | null) { if (!url) return null; return `/KOLwrapped/api/image?url=${encodeURIComponent(url)}`; }
function fmtNumber(n?: number | null) { if (n == null || Number.isNaN(n)) return "—"; return new Intl.NumberFormat("en-US").format(n); }
function fmtMoney(n?: number | null) { if (n == null || Number.isNaN(n)) return "—"; const abs = Math.abs(n); const sign = n >= 0 ? "" : "-"; if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`; if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`; return `${sign}$${abs.toFixed(2)}`; }
function shortAddr(a: string) { if (!a) return "—"; return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a; }
function shortHash(h?: string | null) { if (!h) return "—"; return h.length > 12 ? `${h.slice(0, 8)}...${h.slice(-6)}` : h; }
async function copyText(s: string) { try { await navigator.clipboard.writeText(s); } catch { const ta = document.createElement("textarea"); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } }
function fmtTs(tsSeconds?: number | null) { if (!tsSeconds || !Number.isFinite(tsSeconds)) return "—"; const d = new Date(Number(tsSeconds) * 1000); return d.toISOString().replace("T", " ").slice(0, 16) + " UTC"; }
function fmtDate(tsSeconds?: number | null) { if (!tsSeconds || !Number.isFinite(tsSeconds)) return "—"; const d = new Date(Number(tsSeconds) * 1000); return d.toISOString().slice(0, 10); }
function sideBadge(side?: "BUY" | "SELL") { if (!side) return null; return side === "BUY" ? "bg-green-500/10 text-green-300 border-green-500/15" : "bg-red-500/10 text-red-300 border-red-500/15"; }
function pnlQueryForRange(r: "1D" | "1W" | "1M" | "ALL") { if (r === "1D") return { interval: "1d", fidelity: "1h" }; if (r === "1W") return { interval: "1w", fidelity: "1h" }; if (r === "1M") return { interval: "1m", fidelity: "1h" }; return { interval: "all", fidelity: "12h" }; }
function computeDelta(points: PnlPoint[]) { if (!Array.isArray(points) || points.length < 2) return null; const first = points[0]?.p; const last = points[points.length - 1]?.p; if (!Number.isFinite(first) || !Number.isFinite(last)) return null; return Number(last) - Number(first); }
function normalizeSeriesForShortRanges(range: "1D" | "1W" | "1M" | "ALL", pts: PnlPoint[]) { if (range === "ALL") return pts; if (!Array.isArray(pts) || pts.length === 0) return pts; const base = pts[0]?.p; if (!Number.isFinite(base)) return pts; return pts.map((x) => ({ ...x, p: x.p - base })); }

const card = "bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden";
const subCard = "bg-zinc-950/35 border border-white/10 rounded-xl";

type ActiveSortKey = "VALUE" | "PNL_USD" | "PNL_PCT" | "BET" | "ALPHA" | "AVG_PRICE" | "CURRENT_PRICE";
type ClosedSortKey = "PNL_USD" | "AVG_PRICE" | "ALPHA" | "DATE";

const ACTIVE_SORTS: Array<{ key: ActiveSortKey; label: string; sortBy: string; defaultDirection: "ASC" | "DESC"; disabled?: boolean; }> = [
  { key: "VALUE", label: "Value", sortBy: "CURRENT", defaultDirection: "DESC" },
  { key: "PNL_USD", label: "Profit/Loss $", sortBy: "CASHPNL", defaultDirection: "DESC" },
  { key: "PNL_PCT", label: "Profit/Loss %", sortBy: "PERCENTPNL", defaultDirection: "DESC" },
  { key: "BET", label: "Bet", sortBy: "TOKENS", defaultDirection: "DESC" },
  { key: "ALPHA", label: "Alphabetically", sortBy: "TITLE", defaultDirection: "ASC" },
  { key: "AVG_PRICE", label: "Average Price", sortBy: "AVGPRICE", defaultDirection: "DESC" },
  { key: "CURRENT_PRICE", label: "Current Price", sortBy: "CURRENT", defaultDirection: "DESC", disabled: true },
];

const CLOSED_SORTS: Array<{ key: ClosedSortKey; label: string; sortBy: string; defaultDirection: "ASC" | "DESC"; }> = [
  { key: "PNL_USD", label: "Profit/Loss $", sortBy: "REALIZEDPNL", defaultDirection: "DESC" },
  { key: "AVG_PRICE", label: "Average Price", sortBy: "AVGPRICE", defaultDirection: "DESC" },
  { key: "ALPHA", label: "Alphabetically", sortBy: "TITLE", defaultDirection: "ASC" },
  { key: "DATE", label: "Date", sortBy: "TIMESTAMP", defaultDirection: "DESC" },
];

type ActivitySortKey = "DATE" | "TOKENS" | "CASH";
const ACTIVITY_SORTS: Array<{ key: ActivitySortKey; label: string; sortBy: "TIMESTAMP" | "TOKENS" | "CASH"; defaultDirection: "ASC" | "DESC"; }> = [
  { key: "DATE", label: "Date", sortBy: "TIMESTAMP", defaultDirection: "DESC" },
  { key: "TOKENS", label: "Tokens", sortBy: "TOKENS", defaultDirection: "DESC" },
  { key: "CASH", label: "Cash", sortBy: "CASH", defaultDirection: "DESC" },
];

type ActivityType = PolymarketActivityRow["type"];
const ACTIVITY_FILTERS: Array<{ type: ActivityType; label: string }> = [
  { type: "TRADE", label: "Trade" },
  { type: "REWARD", label: "Reward" },
  { type: "REDEEM", label: "Redeem" },
  { type: "MERGE", label: "Merge" },
  { type: "SPLIT", label: "Split" },
  { type: "CONVERSION", label: "Conversion" },
];

function safeStr(x: any) { return typeof x === "string" ? x : ""; }
function safeNum(x: any) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function includesQuery(hay: string, q: string) { if (!q) return true; return hay.toLowerCase().includes(q.toLowerCase()); }

function activeKey(p: PolymarketActivePosition) { return `${p.conditionId}:${p.asset}`; }
function closedKey(r: any) {
  const c = safeStr(r?.conditionId);
  const a = safeStr(r?.asset);
  const ts = r?.timestamp != null ? String(r.timestamp) : safeStr(r?.endDate) || safeStr(r?.slug);
  return `${c}:${a}:${ts}`;
}
function activityKey(a: PolymarketActivityRow) {
  const h = a.transactionHash ?? "";
  const t = String(a.timestamp ?? "");
  const ty = a.type ?? "";
  const c = a.conditionId ?? "";
  const side = a.side ?? "";
  const asset = a.asset ?? "";
  return `${h}:${t}:${ty}:${c}:${side}:${asset}`;
}

function flipDir(d: "ASC" | "DESC") { return d === "DESC" ? "ASC" : "DESC"; }
function dirArrow(d: "ASC" | "DESC") { return d === "DESC" ? "↓" : "↑"; }

function SkeletonLine({ w = "w-full" }: { w?: string }) { return <div className={cn("h-3 rounded-md bg-white/10", w)} />; }

function PositionSkeletonRow() {
  return (
    <div className="py-4 flex items-center gap-4 animate-pulse">
      <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine w="w-3/4" />
        <div className="flex items-center gap-2">
          <SkeletonLine w="w-16" />
          <SkeletonLine w="w-40" />
          <SkeletonLine w="w-24" />
        </div>
      </div>
      <div className="hidden md:flex items-center gap-10">
        <div className="w-16 space-y-2"><SkeletonLine w="w-12" /><SkeletonLine w="w-10" /></div>
        <div className="w-20 space-y-2"><SkeletonLine w="w-16" /><SkeletonLine w="w-12" /></div>
        <div className="w-32 space-y-2"><SkeletonLine w="w-24" /><SkeletonLine w="w-20" /></div>
      </div>
    </div>
  );
}

function ActivitySkeletonRow() {
  return (
    <div className="py-4 flex items-center gap-4 animate-pulse">
      <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonLine w="w-2/3" />
        <div className="flex items-center gap-2"><SkeletonLine w="w-14" /><SkeletonLine w="w-24" /><SkeletonLine w="w-32" /></div>
      </div>
      <div className="w-28 space-y-2 text-right"><SkeletonLine w="w-24" /><SkeletonLine w="w-20" /></div>
    </div>
  );
}

// ---------- component ----------
export default function AddressClient({
  address,
  profile,
  linkedKols,
  topLeftStats,
}: {
  address: string;
  profile: PublicProfile;
  linkedKols: KOLRow[];
  topLeftStats: TopLeftStats;
}) {
  const [tab, setTab] = useState<"positions" | "activity">("positions");
  const [pnlRange, setPnlRange] = useState<"1D" | "1W" | "1M" | "ALL">("ALL");

  const title = useMemo(() => profile.name ?? profile.pseudonym ?? "Unknown", [profile.name, profile.pseudonym]);
  const wallet = useMemo(() => (profile?.proxyWallet || address).toLowerCase(), [profile?.proxyWallet, address]);

  // ---- PnL state ----
  const [pnlPoints, setPnlPoints] = useState<PnlPoint[]>([]);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [allTimePnl, setAllTimePnl] = useState<number | null>(null);
  const [allTimeVol, setAllTimeVol] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const url = `https://data-api.polymarket.com/v1/leaderboard?timePeriod=all&user=${wallet}&category=overall`;
        const res = await fetch(url, { signal: controller.signal });
        const json: any = await res.json();
        const row: LeaderboardRow | null = Array.isArray(json) ? json?.[0] ?? null : null;
        setAllTimePnl(typeof row?.pnl === "number" ? row.pnl : null);
        setAllTimeVol(typeof row?.vol === "number" ? row.vol : null);
      } catch (e) {}
    })();
    return () => controller.abort();
  }, [wallet]);

  useEffect(() => {
    const { interval, fidelity } = pnlQueryForRange(pnlRange);
    const controller = new AbortController();
    (async () => {
      try {
        setPnlLoading(true);
        const url = `https://user-pnl-api.polymarket.com/user-pnl?user_address=${wallet}&interval=${interval}&fidelity=${fidelity}`;
        const res = await fetch(url, { signal: controller.signal });
        const json: any = await res.json();
        const arr: PnlPoint[] = Array.isArray(json) ? json.filter((x) => Number.isFinite(x?.t) && Number.isFinite(x?.p)).map((x) => ({ t: Number(x.t), p: Number(x.p) })) : [];
        setPnlPoints(arr);
      } catch (e) {} finally { setPnlLoading(false); }
    })();
    return () => controller.abort();
  }, [pnlRange, wallet]);

  const pnlDisplayValue = useMemo(() => pnlRange === "ALL" ? allTimePnl : computeDelta(pnlPoints), [pnlRange, allTimePnl, pnlPoints]);
  const chartPoints = useMemo(() => normalizeSeriesForShortRanges(pnlRange, pnlPoints), [pnlRange, pnlPoints]);

  // ---- Positions state ----
  const [positionsTab, setPositionsTab] = useState<"active" | "closed">("active");
  const [search, setSearch] = useState("");
  const [activeSort, setActiveSort] = useState<ActiveSortKey>("VALUE");
  const [activeDir, setActiveDir] = useState<"ASC" | "DESC">("DESC");
  const [closedSort, setClosedSort] = useState<ClosedSortKey>("PNL_USD");
  const [closedDir, setClosedDir] = useState<"ASC" | "DESC">("DESC");

  // Pagination Settings
  const PAGE_SIZE = 25;
  const [activeOffset, setActiveOffset] = useState(0);
  const [closedOffset, setClosedOffset] = useState(0);
  const [activeRows, setActiveRows] = useState<PolymarketActivePosition[]>([]);
  const [closedRows, setClosedRows] = useState<ClosedPosition[]>([]);
  const [activeHasMore, setActiveHasMore] = useState(false);
  const [closedHasMore, setClosedHasMore] = useState(false);
  const [posLoading, setPosLoading] = useState(false);

  const activeSortMeta = useMemo(() => ACTIVE_SORTS.find((s) => s.key === activeSort)!, [activeSort]);
  const closedSortMeta = useMemo(() => CLOSED_SORTS.find((s) => s.key === closedSort)!, [closedSort]);

  // ---- Activity state ----
  const [activityRows, setActivityRows] = useState<PolymarketActivityRow[]>([]);
  const [activityOffset, setActivityOffset] = useState(0);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activitySort, setActivitySort] = useState<ActivitySortKey>("DATE");
  const [activityDir, setActivityDir] = useState<"ASC" | "DESC">("DESC");
  const [activityTypes, setActivityTypes] = useState<Set<ActivityType>>(() => new Set(ACTIVITY_FILTERS.map((x) => x.type)));
  const activitySortMeta = useMemo(() => ACTIVITY_SORTS.find((s) => s.key === activitySort)!, [activitySort]);

  // ---- FETCHERS ----
  async function fetchActive(offset: number) {
    setPosLoading(true);
    try {
      const url = `https://data-api.polymarket.com/positions?limit=${PAGE_SIZE}&offset=${offset}&user=${wallet}&sortBy=${encodeURIComponent(activeSortMeta.sortBy)}&sortDirection=${activeDir}`;
      const res = await fetch(url);
      const data = await res.json();
      setActiveRows(Array.isArray(data) ? data : []);
      setActiveHasMore(data.length === PAGE_SIZE);
    } catch (e) {} finally { setPosLoading(false); }
  }

  async function fetchClosed(offset: number) {
    setPosLoading(true);
    try {
      const url = `https://data-api.polymarket.com/closed-positions?limit=${PAGE_SIZE}&offset=${offset}&user=${wallet}&sortBy=${encodeURIComponent(closedSortMeta.sortBy)}&sortDirection=${closedDir}`;
      const res = await fetch(url);
      const data = await res.json();
      setClosedRows(Array.isArray(data) ? data : []);
      setClosedHasMore(data.length === PAGE_SIZE);
    } catch (e) {} finally { setPosLoading(false); }
  }

  async function fetchActivity(offset: number) {
    setActivityLoading(true);
    try {
      const url = `https://data-api.polymarket.com/activity?limit=${PAGE_SIZE}&offset=${offset}&user=${wallet}&sortBy=${encodeURIComponent(activitySortMeta.sortBy)}&sortDirection=${activityDir}`;
      const res = await fetch(url);
      const data = await res.json();
      setActivityRows(Array.isArray(data) ? data : []);
      setActivityHasMore(data.length === PAGE_SIZE);
    } catch (e) {} finally { setActivityLoading(false); }
  }

  // Effect triggers
  useEffect(() => { if (tab === "positions" && positionsTab === "active") fetchActive(activeOffset); }, [wallet, activeSort, activeDir, activeOffset, positionsTab, tab]);
  useEffect(() => { if (tab === "positions" && positionsTab === "closed") fetchClosed(closedOffset); }, [wallet, closedSort, closedDir, closedOffset, positionsTab, tab]);
  useEffect(() => { if (tab === "activity") fetchActivity(activityOffset); }, [wallet, activitySort, activityDir, activityOffset, tab]);

  // Reset offset on sort/search change
  useEffect(() => { setActiveOffset(0); }, [activeSort, activeDir, search, positionsTab]);
  useEffect(() => { setClosedOffset(0); }, [closedSort, closedDir, search, positionsTab]);
  useEffect(() => { setActivityOffset(0); }, [activitySort, activityDir, search, tab]);

  // Client side filtering (for current page)
  const filteredActive = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? activeRows.filter(r => `${r.title} ${r.outcome} ${r.eventSlug}`.toLowerCase().includes(q)) : activeRows;
  }, [activeRows, search]);

  const filteredClosed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? closedRows.filter(r => includesQuery(`${r.title} ${r.outcome}`, q)) : closedRows;
  }, [closedRows, search]);

  const filteredActivity = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activityRows.filter(a => {
      if (!activityTypes.has(a.type)) return false;
      if (!q) return true;
      return `${a.title} ${a.slug} ${a.eventSlug} ${a.type} ${a.side}`.toLowerCase().includes(q);
    });
  }, [activityRows, search, activityTypes]);

  const currentSortLabel = positionsTab === "active" ? activeSortMeta.label : closedSortMeta.label;
  const currentDir = positionsTab === "active" ? activeDir : closedDir;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-10 px-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-[1180px]">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg opacity-90" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-zinc-200 truncate">Account</div>
            <div className="text-xs text-zinc-500 font-mono truncate">{address}</div>
          </div>
          <Button 
            variant="outline" 
            className="bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-200 rounded-none"
            onClick={() => toast.success("Copytrade feature coming soon!")}
          >
            copytrade
          </Button>
        </div>

        {/* Top grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Profile card */}
          <div className={cn(card, "p-6")}>
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                {profile.profileImage && <img src={profile.profileImage} alt="" className="h-full w-full object-cover" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold tracking-tight truncate">{title}</div>
                  {profile.verifiedBadge && <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/20 text-indigo-300">Verified</span>}
                </div>
                <div className="text-sm text-zinc-400 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                  <span>Joined {topLeftStats.joinDate ?? "—"}</span>
                  <span className="opacity-40">·</span>
                  <span className="text-zinc-500">{fmtNumber(topLeftStats.views)} views</span>
                </div>

                {/* RESTORED: Linked X accounts */}
                {linkedKols.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {linkedKols.map((k) => (
                      <div key={k.x_username} className="flex items-center gap-2 shrink-0">
                        <Link href={`https://twitter.com/${k.x_username}`} target="_blank" className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/40 border border-white/10 hover:bg-zinc-900/50 transition-colors max-w-[200px]" title={`@${k.x_username}`}>
                          <div className="h-6 w-6 rounded-lg overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                            {k.x_profile_image_url && <img src={proxifyImg(k.x_profile_image_url) ?? undefined} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <div className="min-w-0 overflow-hidden">
                            <div className="text-xs text-zinc-200 font-medium truncate whitespace-nowrap">{k.x_display_name ?? `@${k.x_username}`}</div>
                            <div className="text-[10px] text-zinc-500 truncate whitespace-nowrap">@{k.x_username}</div>
                          </div>
                        </Link>
                        {k.x_badge_icon_url && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-950/60 border border-white/10 shrink-0" title={k.x_badge_label ?? undefined}>
                            <img src={proxifyImg(k.x_badge_icon_url) ?? undefined} alt={k.x_badge_label ?? ""} className="h-3.5 w-3.5 shrink-0" />
                            {k.x_badge_label && <span className="text-[10px] text-zinc-400 font-medium whitespace-nowrap">{k.x_badge_label}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                    <Link href="/KOLwrapped" className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border border-indigo-500/20 transition-all">
                      <Gift className="w-4 h-4 text-white" />
                      <span className="text-xs text-white font-semibold whitespace-nowrap">Get KOL Wrapped 2025</span>
                    </Link>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" className="bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-200" onClick={async () => { await copyText(address); toast.success("Address copied to clipboard!"); }}><Copy className="w-4 h-4 mr-2" />{shortAddr(address)}</Button>
                {/* <Button variant="outline" className="bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-200"><Gift className="w-4 h-4 mr-2" />Gift</Button> */}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={cn(subCard, "p-4")}><div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Positions Value</div><div className="mt-1 text-xl font-bold text-zinc-100">{fmtMoney(topLeftStats.positionsValue)}</div></div>
              <div className={cn(subCard, "p-4")}><div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Biggest Win</div><div className="mt-1 text-xl font-bold text-zinc-100">{fmtMoney(topLeftStats.largestWin)}</div></div>
              <div className={cn(subCard, "p-4")}><div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Cumulative Volume</div><div className="mt-1 text-xl font-bold text-zinc-100">{fmtMoney(allTimeVol)}</div></div>
            </div>
          </div>

          {/* RIGHT: PnL card */}
          <div className={cn(card, "p-6")}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400 font-medium">Profit/Loss</div>
                <div className={cn("text-3xl font-extrabold mt-1", (pnlDisplayValue ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>{pnlLoading ? "…" : fmtMoney(pnlDisplayValue)}</div>
              </div>
              <div className="flex items-center gap-2">
                {(["1D", "1W", "1M", "ALL"] as const).map((t) => (
                  <button key={t} onClick={() => setPnlRange(t)} className={cn("px-2.5 py-1 rounded-lg text-xs border transition-colors", pnlRange === t ? "bg-indigo-500/15 border-indigo-500/25 text-indigo-200" : "bg-zinc-950/40 border-white/10 text-zinc-400 hover:bg-zinc-900/50")}>{t}</button>
                ))}
              </div>
            </div>
            <div className="mt-6"><PnlChart points={chartPoints} height={150} /></div>
          </div>
        </div>

        {/* CONTENT TABS */}
        <div className="mt-8">
          <div className="flex items-center gap-2 border-b border-white/10">
            {["positions", "activity"].map((t: any) => (
              <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-3 text-sm font-semibold -mb-px border-b-2 capitalize", tab === t ? "border-indigo-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300")}>{t}</button>
            ))}
          </div>

          <div className={cn(card, "mt-4 p-6")}>
            {/* SEARCH / FILTERS / DROPDOWNS (identical to your original code) */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                {tab === "positions" ? (
                  <div className="inline-flex rounded-xl overflow-hidden border border-white/10 bg-zinc-950/35">
                    {["active", "closed"].map((pt: any) => (
                      <button key={pt} onClick={() => setPositionsTab(pt)} className={cn("px-4 py-2 text-sm font-semibold capitalize", positionsTab === pt ? "bg-zinc-900/60 text-zinc-100" : "text-zinc-500 hover:text-zinc-200")}>{pt}</button>
                    ))}
                  </div>
                ) : (
                  <div className="relative">
                    <details className="group">
                      <summary className="list-none cursor-pointer px-4 py-2.5 rounded-xl bg-zinc-950/35 border border-white/10 text-sm flex items-center gap-2 hover:bg-zinc-900/50">
                        <span className="text-zinc-200 font-semibold">{activitySortMeta.label} <span className="text-zinc-500">{dirArrow(activityDir)}</span></span>
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="absolute left-0 mt-2 w-56 rounded-xl overflow-hidden border border-white/10 bg-zinc-950/95 backdrop-blur shadow-xl z-20">
                        <div className="p-1">
                          {ACTIVITY_SORTS.map((opt) => (
                            <button key={opt.key} onClick={() => { if (opt.key === activitySort) setActivityDir(flipDir(activityDir)); else { setActivitySort(opt.key); setActivityDir(opt.defaultDirection); } }} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors", opt.key === activitySort ? "bg-indigo-500/15 text-indigo-200" : "text-zinc-300 hover:bg-white/5")}>{opt.label}</button>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>
                )}

                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950/35 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                </div>

                {tab === "positions" && (
                  <div className="relative">
                    <details className="group">
                      <summary className="list-none cursor-pointer px-4 py-2.5 rounded-xl bg-zinc-950/35 border border-white/10 text-sm flex items-center gap-2 hover:bg-zinc-900/50">
                        <span className="text-zinc-200 font-semibold">{currentSortLabel} <span className="text-zinc-500">{dirArrow(currentDir)}</span></span>
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="absolute right-0 mt-2 w-60 rounded-xl border border-white/10 bg-zinc-950/95 shadow-xl z-20 p-1">
                        {(positionsTab === "active" ? ACTIVE_SORTS : CLOSED_SORTS).map((opt: any) => (
                          <button key={opt.key} disabled={opt.disabled} onClick={() => { if (positionsTab === "active") { if (opt.key === activeSort) setActiveDir(flipDir(activeDir)); else { setActiveSort(opt.key); setActiveDir(opt.defaultDirection); } } else { if (opt.key === closedSort) setClosedDir(flipDir(closedDir)); else { setClosedSort(opt.key); setClosedDir(opt.defaultDirection); } } }} className={cn("w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between", opt.disabled ? "text-zinc-600 cursor-not-allowed" : (positionsTab === "active" ? opt.key === activeSort : opt.key === closedSort) ? "bg-indigo-500/15 text-indigo-200" : "text-zinc-300 hover:bg-white/5")}>
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>

            {/* RESTORED COLUMN UI */}
            <div className="mt-5 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">{posLoading || activityLoading ? "Loading..." : tab === "positions" ? (positionsTab === "active" ? "Active Positions" : "Closed Positions") : "Activity"}</div>

            <div className="mt-3 divide-y divide-white/5">
              {posLoading || activityLoading ? (
                Array.from({ length: 5 }).map((_, i) => tab === "positions" ? <PositionSkeletonRow key={i} /> : <ActivitySkeletonRow key={i} />)
              ) : tab === "positions" ? (
                (positionsTab === "active" ? filteredActive : filteredClosed).map((r: any) => {
                  if (positionsTab === "active") {
                    const p = r as PolymarketActivePosition;
                    return (
                      <Link target="_blank" key={activeKey(p)} href={`/event_test/${p.eventSlug}/${p.slug}`} className="py-4 flex items-center gap-4 hover:bg-zinc-900/30 transition-colors rounded-lg px-2 -mx-2">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                          {p.icon && <img src={p.icon} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-zinc-100 truncate">{p.title}</div>
                          <div className="text-xs text-zinc-500 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-300 border border-green-500/15">{p.outcome}</span>
                            <span>{fmtNumber(p.size)} shares @ {(p.avgPrice * 100).toFixed(0)}¢</span>
                          </div>
                        </div>
                        {/* RESTORED DESKTOP COLUMNS */}
                        <div className="hidden md:flex items-center gap-10 text-sm">
                          <div className="w-16 text-right"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Avg</div><div className="font-semibold text-zinc-200">{(p.avgPrice * 100).toFixed(0)}¢</div></div>
                          <div className="w-20 text-right"><div className="text-[11px] text-zinc-500 uppercase tracking-wider">Current</div><div className="font-semibold text-zinc-200">{(p.curPrice * 100).toFixed(0)}¢</div></div>
                          <div className="w-32 text-right">
                            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Value</div>
                            <div className="font-semibold text-zinc-200">{fmtMoney(p.currentValue)}</div>
                            <div className={cn("text-xs font-medium", p.cashPnl >= 0 ? "text-green-400" : "text-red-400")}>{fmtMoney(p.cashPnl)} ({p.percentPnl.toFixed(2)}%)</div>
                          </div>
                        </div>
                        {/* Mobile view */}
                        <div className="md:hidden text-right">
                          <div className="text-sm font-semibold text-zinc-200">{fmtMoney(p.currentValue)}</div>
                          <div className={cn("text-xs font-medium", p.cashPnl >= 0 ? "text-green-400" : "text-red-400")}>{fmtMoney(p.cashPnl)}</div>
                        </div>
                      </Link>
                    );
                  }
                  return (
                    <Link key={closedKey(r)} href={`/event_test/${r.eventSlug}/${r.slug}`} className="py-4 flex items-center gap-4 hover:bg-zinc-900/30 transition-colors rounded-lg px-2 -mx-2">
                      <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                        {(r.icon || r.image) && <img src={r.icon || r.image} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-100 truncate">{r.title || r.marketTitle}</div>
                        <div className="text-xs text-zinc-500">
                          {r.outcome} · bought {fmtNumber(r.totalBought)} @ {(safeNum(r.avgPrice)! * 100).toFixed(0)}¢ · {fmtDate(r.timestamp)}
                        </div>
                      </div>
                      {/* DESKTOP COLUMNS */}
                      <div className="hidden md:flex items-center gap-10 text-sm">
                        <div className="w-24 text-right">
                          <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Total Bet</div>
                          <div className="font-semibold text-zinc-200">{fmtMoney(safeNum(r.totalBought)! * safeNum(r.avgPrice)!)}</div>
                        </div>
                        <div className="w-32 text-right">
                          <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Amount Won</div>
                          <div className="font-semibold text-zinc-200">{fmtMoney(safeNum(r.totalBought)! * safeNum(r.curPrice)!)}</div>
                          <div className={cn("text-xs font-medium", safeNum(r.realizedPnl)! >= 0 ? "text-green-400" : "text-red-400")}>
                            {fmtMoney(safeNum(r.realizedPnl))} ({safeNum(r.realizedPnl)! >= 0 ? "+" : ""}{((safeNum(r.realizedPnl)! / (safeNum(r.totalBought)! * safeNum(r.avgPrice)!)) * 100).toFixed(1)}%)
                          </div>
                          <div className="text-[11px] text-zinc-500">settled {(safeNum(r.curPrice)! * 100).toFixed(0)}¢</div>
                        </div>
                      </div>
                      {/* MOBILE VIEW */}
                      <div className="md:hidden text-right">
                        <div className="text-sm font-semibold text-zinc-200">{fmtMoney(safeNum(r.totalBought)! * safeNum(r.curPrice)!)}</div>
                        <div className={cn("text-xs font-medium", safeNum(r.realizedPnl)! >= 0 ? "text-green-400" : "text-red-400")}>{fmtMoney(safeNum(r.realizedPnl))}</div>
                        <div className="text-[11px] text-zinc-500">settled {(safeNum(r.curPrice)! * 100).toFixed(0)}¢</div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                filteredActivity.map((a, idx) => (
                  <Link key={`${activityKey(a)}-${idx}`} href={a.eventSlug && a.slug ? `/event_test/${a.eventSlug}/${a.slug}` : '#'} className="py-4 flex items-center gap-4 hover:bg-zinc-900/30 transition-colors rounded-lg px-2 -mx-2">
                    <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                      {a.icon && <img src={a.icon} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><div className="text-sm font-semibold text-zinc-100 truncate">{a.title}</div><span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-950/40 border border-white/10 text-zinc-400">{a.type}</span></div>
                      <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                        {a.side && <span className={cn("px-2 py-0.5 rounded-md border text-[10px]", sideBadge(a.side))}>{a.side}</span>}
                        <span>{fmtTs(a.timestamp)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-zinc-200">{a.usdcSize ? fmtMoney(a.usdcSize) : "—"}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* ADDED: PAGINATION FOOTER */}
            <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-6">
              <div className="text-xs text-zinc-500">
                Page {Math.floor((tab === "positions" ? (positionsTab === "active" ? activeOffset : closedOffset) : activityOffset) / PAGE_SIZE) + 1}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="bg-zinc-950 border-white/10 hover:bg-zinc-900 h-8 text-xs"
                  disabled={tab === "positions" ? (positionsTab === "active" ? activeOffset === 0 : closedOffset === 0) : activityOffset === 0}
                  onClick={() => {
                    if (tab === "positions") {
                      if (positionsTab === "active") setActiveOffset(o => Math.max(0, o - PAGE_SIZE));
                      else setClosedOffset(o => Math.max(0, o - PAGE_SIZE));
                    } else setActivityOffset(o => Math.max(0, o - PAGE_SIZE));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" className="bg-zinc-950 border-white/10 hover:bg-zinc-900 h-8 text-xs"
                  disabled={tab === "positions" ? (positionsTab === "active" ? !activeHasMore : !closedHasMore) : !activityHasMore}
                  onClick={() => {
                    if (tab === "positions") {
                      if (positionsTab === "active") setActiveOffset(o => o + PAGE_SIZE);
                      else setClosedOffset(o => o + PAGE_SIZE);
                    } else setActivityOffset(o => o + PAGE_SIZE);
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                >
                  Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
