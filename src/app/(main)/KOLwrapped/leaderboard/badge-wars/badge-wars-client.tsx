"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BarChart3, X, MousePointerClick } from "lucide-react";

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
  LabelList,
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

export default function BadgeWarsClient({
  initialPeriod = "all",
  initialRows = [],
}: {
  initialPeriod?: LeaderboardPeriod;
  initialRows?: BadgeWarRow[];
}) {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);
  const [rows, setRows] = useState<BadgeWarRow[]>(initialRows);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);
  const [traderRows, setTraderRows] = useState<any[]>([]);
  const [traderTotal, setTraderTotal] = useState(0);
  const [traderOffset, setTraderOffset] = useState(0);
  const traderLimit = 25;
  const [isPending, startTransition] = useTransition();

  const cacheKey = useMemo(
    () => `badgewars-${period}-${selectedBadge ?? "none"}-${traderOffset}`,
    [period, selectedBadge, traderOffset]
  );

  // Initial load: logic to pick the leading badge
  // useEffect(() => {
  //   if (rows.length > 0 && !selectedBadge) {
  //     const topBadge = rows.sort((a, b) => (b.pnl_sum ?? 0) - (a.pnl_sum ?? 0))[0];
  //     if (topBadge) loadBadgeTraders(topBadge.badge_label, 0);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);
  useEffect(() => {
    if (rows.length > 0 && !selectedBadge) {
      const topBadge = [...rows].sort((a, b) => (b.pnl_sum ?? 0) - (a.pnl_sum ?? 0))[0];
      if (topBadge) loadBadgeTraders(topBadge.badge_label, 0, period);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBadgeWars(nextPeriod: LeaderboardPeriod) {
    startTransition(async () => {
      const data = await getBadgeWars({ period: nextPeriod, limit: 48, offset: 0 });
      setRows(data ?? []);
      setPeriod(nextPeriod);

      // Auto-select the new leading badge for the new period
      if (data && data.length > 0) {
        const topBadge = data.sort((a, b) => (b.pnl_sum ?? 0) - (a.pnl_sum ?? 0))[0];
        loadBadgeTraders(topBadge.badge_label, 0, nextPeriod);
      } else {
        setSelectedBadge(null);
        setTraderRows([]);
      }
    });
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
    });
  }

  const chartData = useMemo(() => {
    const mapped = (rows ?? []).map((r) => ({
      ...r,
      value: r.pnl_sum ?? 0,
      badge_icon: proxifyImg((r as any).badge_icon_url, cacheKey),
      color: colorForBadge(r.badge_label),
    }));

    const sorted = [...mapped].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const TOP_N = 14;
    const top = sorted.slice(0, TOP_N);
    const rest = sorted.slice(TOP_N);

    if (!rest.length) return top;

    const otherSum = rest.reduce((s, r) => s + (r.value ?? 0), 0);
    const otherTraders = rest.reduce((s, r) => s + (Number(r.traders_count) || 0), 0);

    return [
      ...top,
      {
        badge_label: "Other",
        traders_count: otherTraders,
        pnl_sum: otherSum,
        value: otherSum,
        badge_icon: null,
        color: "hsl(0 0% 45%)",
      } as any,
    ];
  }, [rows, cacheKey]);

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
  const canPrev = traderOffset > 0;
  const canNext = traderOffset + traderLimit < traderTotal;

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
          <div className="text-xs text-zinc-500 font-mono">{isPending ? "Loading..." : `${rows.length} badges`}</div>
        </div>

        {/* Controls */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.key}
                type="button"
                variant="outline"
                onClick={() => loadBadgeWars(p.key)}
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

          {selectedBadge ? (
            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-white/5">
              Filtering: <span className="text-white font-bold">{selectedBadge}</span>
            </div>
          ) : null}
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
                  if (!label || label === "Other") return;

                  // 3. Handle the Toggle / Selection logic
                  if (selectedBadge === label) {
                    setSelectedBadge(null);
                    setTraderRows([]);
                    setTraderTotal(0);
                    setTraderOffset(0);
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
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(v: any) => {
                      const n = Number(v);
                      if (!Number.isFinite(n) || n === 0) return "";
                      return Math.abs(n) < 5000 ? fmtMoney(n) : "";
                    }}
                    style={{
                      fontSize: 11,
                      fill: "rgba(244,244,245,0.85)",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
                    {traderTotal} total
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || !canPrev}
                    onClick={() => loadBadgeTraders(selectedBadge, Math.max(0, traderOffset - traderLimit))}
                    className="h-8 px-3 rounded-lg bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || !canNext}
                    onClick={() => loadBadgeTraders(selectedBadge, traderOffset + traderLimit)}
                    className="h-8 px-3 rounded-lg bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Next
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

                       return (
                        <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 text-sm text-zinc-500 font-mono">{r.global_rank ?? "—"}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                               <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10">
                                  {avatar && <img src={avatar} alt="" className="h-full w-full object-cover" />}
                               </div>
                               <div className="min-w-0">
                                  <div className="font-semibold text-zinc-200 text-sm truncate">{r.x_display_name || `@${r.x_username}`}</div>
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