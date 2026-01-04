"use client";

import { useMemo, useState, useTransition, useEffect, useCallback } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BarChart3, X, MousePointerClick, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { LeaderboardPeriod } from "../actions";
import { getBadgeWars, type BadgeWarRow } from "./actions";
import { getBadgeTraders } from "./traders-actions";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

// ... (Utility functions fmtNumber, fmtMoney, pnlClass, etc. remain the same)
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function fmtNumber(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtMoney(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(n / 1_000).toFixed(1)}k`;
  return `${sign}$${n.toFixed(2)}`;
}

function pnlClass(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "text-zinc-400";
  return n >= 0 ? "text-green-400" : "text-red-400";
}

function rankDeltaClass(n?: number | null) {
  if (n == null || Number.isNaN(n) || n === 0) return "text-zinc-400";
  return n > 0 ? "text-green-400" : "text-red-400";
}

function fmtRankDelta(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

function proxifyImg(url?: string | null, cacheKey?: string) {
  if (!url) return null;
  const v = cacheKey ? `&v=${encodeURIComponent(cacheKey)}` : "";
  return `/KOLwrapped/api/image?url=${encodeURIComponent(url)}${v}`;
}

function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function colorForBadge(label: string) {
  const h = hashString(label);
  const hue = h % 360;
  return `hsl(${hue} 78% 58%)`;
}

const PERIODS: Array<{ key: LeaderboardPeriod; label: string }> = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all", label: "All-time" },
];

function TooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as any;

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur px-3 py-2 shadow-xl">
      <div className="flex items-center gap-2 mb-1">
        {row.badge_icon ? (
          <img src={row.badge_icon} alt="" className="w-4 h-4 rounded-sm" />
        ) : (
          <span className="w-4 h-4 rounded-sm border border-white/10" style={{ background: row.color }} />
        )}
        <div className="text-xs font-semibold text-zinc-200">{row.badge_label}</div>
      </div>
      <div className="text-[11px] text-zinc-400">
        Traders: <span className="text-zinc-200 font-mono">{fmtNumber(row.traders_count)}</span>
      </div>
      <div className="text-[11px] text-zinc-400">
        PnL sum: <span className="text-zinc-200 font-mono">{fmtMoney(row.pnl_sum)}</span>
      </div>
      <div className="text-[11px] text-indigo-400 mt-1 flex items-center gap-1">
        <MousePointerClick className="w-3 h-3" /> Click to filter traders
      </div>
    </div>
  );
}

type SortBy = "pnl_desc" | "pnl_asc" | "traders_desc" | "traders_asc";

export default function BadgeWarsClient({
  initialPeriod = "all",
  initialRows = [],
}: {
  initialPeriod?: LeaderboardPeriod;
  initialRows?: BadgeWarRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL params or defaults
  const [period, setPeriod] = useState<LeaderboardPeriod>(() => {
    const urlPeriod = searchParams?.get("period") as LeaderboardPeriod;
    return urlPeriod && PERIODS.find((p) => p.key === urlPeriod) ? urlPeriod : initialPeriod;
  });
  
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const urlSortBy = searchParams?.get("sortBy") as SortBy;
    return urlSortBy && ["pnl_desc", "pnl_asc", "traders_desc", "traders_asc"].includes(urlSortBy) 
      ? urlSortBy 
      : "pnl_desc";
  });
  
  const [badgeOffset, setBadgeOffset] = useState(() => {
    const urlOffset = searchParams?.get("badgeOffset");
    return urlOffset ? parseInt(urlOffset) : 0;
  });
  
  const [selectedBadge, setSelectedBadge] = useState<string | null>(() => {
    return searchParams?.get("badge") || null;
  });
  
  const [traderOffset, setTraderOffset] = useState(() => {
    const urlOffset = searchParams?.get("traderOffset");
    return urlOffset ? parseInt(urlOffset) : 0;
  });
  
  const [allRows, setAllRows] = useState<BadgeWarRow[]>(initialRows);
  const [traderRows, setTraderRows] = useState<any[]>([]);
  const [traderTotal, setTraderTotal] = useState(0);
  const traderLimit = 25;
  const badgeLimit = 18;
  
  const [isPending, startTransition] = useTransition();
  const [isInitialized, setIsInitialized] = useState(false);

  const cacheKey = useMemo(
    () => `badgewars-${period}-${selectedBadge ?? "none"}-${traderOffset}-${badgeOffset}`,
    [period, selectedBadge, traderOffset, badgeOffset]
  );

  // URL sync helper
  const updateUrl = useCallback(
    (updates: {
      period?: LeaderboardPeriod;
      badgeOffset?: number;
      sortBy?: SortBy;
      selectedBadge?: string | null;
      traderOffset?: number;
    }) => {
      if (!isInitialized) return; // Don't update URL during initialization
      
      const params = new URLSearchParams(searchParams?.toString());
      
      if (updates.period !== undefined) params.set("period", updates.period);
      if (updates.badgeOffset !== undefined) params.set("badgeOffset", String(updates.badgeOffset));
      if (updates.sortBy !== undefined) params.set("sortBy", updates.sortBy);
      if (updates.selectedBadge !== undefined) {
        if (updates.selectedBadge) {
          params.set("badge", updates.selectedBadge);
        } else {
          params.delete("badge");
        }
      }
      if (updates.traderOffset !== undefined) params.set("traderOffset", String(updates.traderOffset));
      
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, isInitialized]
  );

  // Initial load: logic to pick the leading badge
  useEffect(() => {
    if (allRows.length > 0 && !selectedBadge && !isInitialized) {
      const topBadge = [...allRows].sort((a, b) => (b.pnl_sum ?? 0) - (a.pnl_sum ?? 0))[0];
      if (topBadge) {
        loadBadgeTraders(topBadge.badge_label, 0, period);
      }
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRows]);

  async function loadBadgeWars(nextPeriod: LeaderboardPeriod, nextOffset = 0) {
    startTransition(async () => {
      // Fetch all badges (no limit) so we can sort properly on client
      const data = await getBadgeWars({ period: nextPeriod, limit: 1000, offset: 0 });
      setAllRows(data ?? []);
      setPeriod(nextPeriod);
      setBadgeOffset(nextOffset);
      
      // Update URL
      updateUrl({ period: nextPeriod, badgeOffset: nextOffset });

      // Auto-select the new leading badge for the new period
      if (data && data.length > 0) {
        const topBadge = data.sort((a, b) => (b.pnl_sum ?? 0) - (a.pnl_sum ?? 0))[0];
        loadBadgeTraders(topBadge.badge_label, 0, nextPeriod);
      } else {
        setSelectedBadge(null);
        setTraderRows([]);
        updateUrl({ selectedBadge: null, traderOffset: 0 });
      }
    });
  }

  // Function to just change page without reloading data
  function changeBadgePage(nextOffset: number) {
    setBadgeOffset(nextOffset);
    updateUrl({ badgeOffset: nextOffset });
  }

  async function loadBadgeTraders(nextBadge: string, nextOffset = 0, periodOverride?: LeaderboardPeriod) {
    const p = periodOverride ?? period;

    startTransition(async () => {
      const res = await getBadgeTraders({
        period: p,
        badgeLabel: nextBadge,
        limit: traderLimit,
        offset: nextOffset,
      });

      setSelectedBadge(nextBadge);
      setTraderRows(res.rows ?? []);
      setTraderTotal(res.total ?? 0);
      setTraderOffset(nextOffset);
      
      // Update URL
      updateUrl({ selectedBadge: nextBadge, traderOffset: nextOffset });
    });
  }

  const chartData = useMemo(() => {
    // First, apply sorting to ALL rows
    const sorted = [...allRows].sort((a, b) => {
      switch (sortBy) {
        case "pnl_desc":
          return (b.pnl_sum ?? 0) - (a.pnl_sum ?? 0);
        case "pnl_asc":
          return (a.pnl_sum ?? 0) - (b.pnl_sum ?? 0);
        case "traders_desc":
          return (b.traders_count ?? 0) - (a.traders_count ?? 0);
        case "traders_asc":
          return (a.traders_count ?? 0) - (b.traders_count ?? 0);
        default:
          return (b.pnl_sum ?? 0) - (a.pnl_sum ?? 0);
      }
    });

    // Then apply pagination to get the current page
    const pageRows = sorted.slice(badgeOffset, badgeOffset + badgeLimit);

    // Map to chart format
    const mapped = pageRows.map((r) => ({
      ...r,
      value: r.pnl_sum ?? 0,
      badge_icon: proxifyImg((r as any).badge_icon_url, cacheKey),
      color: colorForBadge(r.badge_label),
    }));
    
    // Return all badges on the current page, no "Other" grouping
    return mapped;
  }, [allRows, cacheKey, sortBy, badgeOffset, badgeLimit]);

  const selectedBadgeIcon = useMemo(() => {
    if (!selectedBadge) return null;

    const hit = (chartData as any[]).find((d) => d.badge_label === selectedBadge);
    const icon = hit?.badge_icon ?? null;

    // optionally treat these labels as "no badge"
    if (!icon) return null;
    if (selectedBadge.toLowerCase() === "no badge") return null;

    return icon as string;
  }, [selectedBadge, chartData]);
  const showDailyDeltas = period === "daily";
  
  // Traders table pagination
  const canPrevTraders = traderOffset > 0;
  const canNextTraders = traderOffset + traderLimit < traderTotal;
  
  // Badge wars pagination - now based on total allRows length
  const canPrevBadges = badgeOffset > 0;
  const canNextBadges = badgeOffset + badgeLimit < allRows.length;

  return (
    <section className="w-full mt-10">
      <div className="relative bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-200">
                Badge Wars{" "}
                <span className="text-zinc-500 font-medium">
                  ({PERIODS.find((p) => p.key === period)?.label})
                </span>
              </div>
              <div className="text-[11px] text-zinc-500">
                Click anywhere in a column to view traders in that badge
              </div>
            </div>
          </div>
          <div className="text-xs text-zinc-500 font-mono">{isPending ? "Loading..." : `${allRows.length} badges`}</div>
        </div>

        {/* Controls */}
        <div className="px-5 py-4 border-b border-white/5 space-y-3">
          {/* Period Toggle */}
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.key}
                type="button"
                variant="outline"
                onClick={() => loadBadgeWars(p.key, 0)}
                disabled={isPending}
                className={cn(
                  "h-9 px-4 rounded-xl border text-sm",
                  period === p.key
                    ? "bg-white text-black border-white hover:bg-zinc-200"
                    : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                )}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Sort Controls and Badge Filter */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium">Sort by:</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSortBy("pnl_desc");
                    setBadgeOffset(0);
                    updateUrl({ sortBy: "pnl_desc", badgeOffset: 0 });
                  }}
                  disabled={isPending}
                  className={cn(
                    "h-8 px-3 rounded-lg border text-xs",
                    sortBy === "pnl_desc"
                      ? "bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600"
                      : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                  )}
                >
                  PnL ↓
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSortBy("pnl_asc");
                    setBadgeOffset(0);
                    updateUrl({ sortBy: "pnl_asc", badgeOffset: 0 });
                  }}
                  disabled={isPending}
                  className={cn(
                    "h-8 px-3 rounded-lg border text-xs",
                    sortBy === "pnl_asc"
                      ? "bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600"
                      : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                  )}
                >
                  PnL ↑
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSortBy("traders_desc");
                    setBadgeOffset(0);
                    updateUrl({ sortBy: "traders_desc", badgeOffset: 0 });
                  }}
                  disabled={isPending}
                  className={cn(
                    "h-8 px-3 rounded-lg border text-xs",
                    sortBy === "traders_desc"
                      ? "bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600"
                      : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                  )}
                >
                  Traders ↓
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSortBy("traders_asc");
                    setBadgeOffset(0);
                    updateUrl({ sortBy: "traders_asc", badgeOffset: 0 });
                  }}
                  disabled={isPending}
                  className={cn(
                    "h-8 px-3 rounded-lg border text-xs",
                    sortBy === "traders_asc"
                      ? "bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600"
                      : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                  )}
                >
                  Traders ↑
                </Button>
              </div>
            </div>

            {selectedBadge ? (
              <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-white/5">
                Filtering: <span className="text-white font-bold">{selectedBadge}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Chart */}
        <div className="px-5 py-5">
          <div className="relative h-[360px] w-full rounded-2xl overflow-hidden cursor-pointer">
            <div className="absolute -top-24 -right-24 w-[320px] h-[320px] bg-indigo-500/10 blur-[90px] pointer-events-none" />
            
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={chartData} 
                margin={{ top: 16, right: 16, left: 0, bottom: 72 }}
                /* 
                  Using 'any' for the state parameter is often necessary with Recharts events 
                  to access activeLabel or activePayload without TS fighting you.
                */
                onClick={(state: any) => {
                  // 1. Get the badge label from the active category
                  const label = state?.activeLabel;
                  
                  // 2. Safety checks
                  if (!label) return;

                  // 3. Handle the Toggle / Selection logic
                  if (selectedBadge === label) {
                    setSelectedBadge(null);
                    setTraderRows([]);
                    setTraderTotal(0);
                    setTraderOffset(0);
                    updateUrl({ selectedBadge: null, traderOffset: 0 });
                  } else {
                    loadBadgeTraders(label, 0);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                <XAxis
                  dataKey="badge_label"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={78}
                  tick={{ fill: "rgba(161,161,170,0.9)", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "rgba(161,161,170,0.9)", fontSize: 11 }} tickFormatter={(v) => fmtMoney(v)} />
                
                {/* FIX: The cursor fill provides visual feedback that the entire column is clickable */}
                <Tooltip 
                  content={<TooltipContent />} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                />

                <Bar dataKey="value" radius={[10, 10, 4, 4]}>
                  {chartData.map((d: any) => (
                    <Cell
                      key={d.badge_label}
                      fill={d.color}
                      opacity={selectedBadge && selectedBadge !== d.badge_label ? 0.25 : 1}
                      stroke={selectedBadge === d.badge_label ? "white" : "none"}
                      strokeWidth={2}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Badge Wars Pagination */}
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-xs text-zinc-500">
              Page <span className="text-zinc-300 font-mono">{Math.floor(badgeOffset / badgeLimit) + 1}</span>
              {" of "}
              <span className="text-zinc-300 font-mono">{Math.ceil(allRows.length / badgeLimit)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => changeBadgePage(Math.max(0, badgeOffset - badgeLimit))}
                disabled={isPending || !canPrevBadges}
                className="h-9 px-3 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => changeBadgePage(badgeOffset + badgeLimit)}
                disabled={isPending || !canNextBadges}
                className="h-9 px-3 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Traders table */}
          {selectedBadge ? (
            <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                   <span>Traders in</span>

                    {selectedBadgeIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedBadgeIcon}
                        alt=""
                        className="w-4 h-4 rounded-sm border border-white/10"
                      />
                    ) : null}

                    <span className="text-indigo-400">{selectedBadge}</span>
                  </div>
                  <div className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-zinc-500 font-mono">
                    Page {Math.floor(traderOffset / traderLimit) + 1} of {Math.ceil(traderTotal / traderLimit)} • {traderTotal} total
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || !canPrevTraders}
                    onClick={() => loadBadgeTraders(selectedBadge, Math.max(0, traderOffset - traderLimit))}
                    className="h-8 px-3 rounded-lg bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || !canNextTraders}
                    onClick={() => loadBadgeTraders(selectedBadge, traderOffset + traderLimit)}
                    className="h-8 px-3 rounded-lg bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>

              {/* Table rendering... (same as your original code) */}
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/30">
                <table className="w-full text-left">
                  {/* ... (rest of your table code) */}
                  <thead className="sticky top-0 bg-zinc-950/60 backdrop-blur">
                    <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5">
                      <th className="px-5 py-3 w-[90px]">Rank</th>
                      <th className="px-5 py-3 min-w-[280px]">Trader</th>
                      <th className="px-5 py-3 text-right min-w-[160px]">PnL</th>
                      {showDailyDeltas && (
                        <>
                          <th className="px-5 py-3 text-right min-w-[160px]">Δ PnL (24h)</th>
                          <th className="px-5 py-3 text-right min-w-[140px]">Δ Rank (24h)</th>
                        </>
                      )}
                      <th className="px-5 py-3 text-right min-w-[160px]">Followers</th>
                      <th className="px-5 py-3 text-right min-w-[220px]">Wallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traderRows.map((r: any) => {
                       const pnl = period === "daily" ? r.pnl_daily : period === "weekly" ? r.pnl_weekly : period === "monthly" ? r.pnl_monthly : r.pnl_all;
                       const avatar = proxifyImg(r.x_profile_image_url, cacheKey);
                       const wallet = r.polymarket_address ?? "";
                       const walletShort = wallet && wallet.length > 12 ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : wallet || "—";
                       const addressUrl = `/address/${encodeURIComponent(r.polymarket_address ?? "")}`;
                       const display = r.x_display_name || `@${r.x_username}`;

                       return (
                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 text-sm text-zinc-500 font-mono">{r.global_rank ?? "—"}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                               <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10">
                                  {avatar && <img src={avatar} alt="" className="h-full w-full object-cover" />}
                               </div>
                               <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="font-semibold text-zinc-200 text-sm truncate">
                                      <Link href={addressUrl} className="hover:underline">
                                        {display}
                                      </Link>
                                    </div>
                                    
                                    {r.x_username && (
                                      <Link 
                                        href={`https://x.com/${r.x_username}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 transition-colors group"
                                      >
                                        <Image 
                                          src="/x.svg" 
                                          alt="X" 
                                          width={14}
                                          height={14}
                                          className="w-3.5 h-3.5 brightness-0 invert opacity-50 group-hover:opacity-100 transition-opacity" 
                                        />
                                      </Link>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-zinc-500 truncate">@{r.x_username}</div>
                               </div>
                            </div>
                          </td>
                          <td className={cn("px-5 py-4 text-right font-mono font-bold", pnlClass(pnl))}>{fmtMoney(pnl)}</td>
                          {showDailyDeltas && (
                            <>
                              <td className={cn("px-5 py-4 text-right font-mono font-bold", pnlClass(r.pnl_change_24h))}>{fmtMoney(r.pnl_change_24h)}</td>
                              <td className={cn("px-5 py-4 text-right font-mono font-bold", rankDeltaClass(r.rank_change_24h))}>{fmtRankDelta(r.rank_change_24h)}</td>
                            </>
                          )}
                          <td className="px-5 py-4 text-right text-sm text-zinc-300 font-mono">{fmtNumber(r.x_followers)}</td>
                          <td className="px-5 py-4 text-right text-xs text-zinc-500 font-mono">{walletShort}</td>
                        </tr>
                       )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-10 mb-10 text-center">
               <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm">
                  <MousePointerClick className="w-4 h-4" />
                  Select a badge above to see its top traders
               </div>
            </div>
          )}
        </div>

        {/* Loading overlay */}
        {isPending ? (
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-zinc-300 text-sm font-medium">Updating...</div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}