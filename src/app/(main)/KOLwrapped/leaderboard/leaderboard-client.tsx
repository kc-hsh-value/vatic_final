// KOLwrapped/leaderboard/LeaderboardClient.tsx (your file)
"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getLeaderboard, type LeaderboardPeriod } from "./actions";
import type { LeaderboardRow } from "./types";

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

const PERIODS: Array<{ key: LeaderboardPeriod; label: string }> = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all", label: "All-time" },
];

export default function LeaderboardClient({
  initialRows,
  initialPeriod,
  initialLimit,
  initialOffset,
  initialCount,
  initialQuery = "",
}: {
  initialRows: LeaderboardRow[];
  initialPeriod: LeaderboardPeriod;
  initialLimit: number;
  initialOffset: number;
  initialCount: number;
  initialQuery?: string;
}) {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows);
  const [limit] = useState(initialLimit);
  const [offset, setOffset] = useState(initialOffset);
  const [total, setTotal] = useState(initialCount);

  const [q, setQ] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const cacheKey = useMemo(() => `${period}-${offset}-${q}`, [period, offset, q]);

  const periodColumn = useMemo(() => {
    switch (period) {
      case "daily":
        return "pnl_daily";
      case "weekly":
        return "pnl_weekly";
      case "monthly":
        return "pnl_monthly";
      default:
        return "pnl_all";
    }
  }, [period]);

  function valueForPeriod(r: LeaderboardRow) {
    const v = (r as any)[periodColumn] as number | null | undefined;
    return v ?? null;
  }

  const showDailyDeltas = period === "daily";

  async function load(next: { period?: LeaderboardPeriod; offset?: number; q?: string }) {
    const nextPeriod = next.period ?? period;
    const nextOffset = next.offset ?? offset;
    const nextQ = next.q ?? q;

    startTransition(async () => {
        const res = await getLeaderboard({
        period: nextPeriod,
        limit,
        offset: nextOffset,
        q: nextQ,
        });

        const nextRows = (res?.rows ?? []) as LeaderboardRow[];

        setRows(nextRows);
        setTotal(res?.count ?? 0);

        setPeriod(nextPeriod);
        setOffset(nextOffset);
        setQ(nextQ);
    });
    }

  // Optional: debounce search so you don't spam queries
  useEffect(() => {
    const t = setTimeout(() => {
      // when q changes, restart at page 1
      load({ q, offset: 0 });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, period]); // searching should respect the current period ordering


// 🔥 sync query from parent (badge hover/pin)
useEffect(() => {
  setQ(initialQuery);
  load({ q: initialQuery, offset: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialQuery]);

// 🔥 sync period from parent (badge wars period buttons)
useEffect(() => {
  setPeriod(initialPeriod);
  load({ period: initialPeriod, offset: 0, q });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialPeriod]);
//   const canPrev = offset > 0;
//   const canNext = offset + limit < total;
const canPrev = offset > 0;
const canNext = offset + limit < total;

  const colCount = showDailyDeltas ? 6 : 4;

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-5">
        {/* Period Toggle */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => {
            const active = period === p.key;
            return (
              <Button
                key={p.key}
                type="button"
                variant="outline"
                onClick={() => load({ period: p.key, offset: 0 })}
                disabled={isPending}
                className={cn(
                  "h-10 px-4 rounded-xl border text-sm",
                  active
                    ? "bg-white text-black border-white hover:bg-zinc-200"
                    : "bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                )}
              >
                {p.label}
              </Button>
            );
          })}
        </div>

        {/* Search */}
        <div className="md:ml-auto w-full md:w-[360px]">
          <div className="flex items-center gap-2 px-3 h-10 rounded-xl bg-zinc-900 border border-zinc-800 focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-500/50 transition-all">
            <Search className="w-4 h-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search username or name..."
              className="w-full bg-transparent outline-none text-sm placeholder:text-zinc-600"
            />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="relative bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-200">
            Leaderboard{" "}
            <span className="text-zinc-500 font-medium">
              ({PERIODS.find((p) => p.key === period)?.label})
            </span>
          </div>

          <div className="text-xs text-zinc-500 font-mono">
            {isPending ? "Loading..." : `${rows.length} of ${total}`}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-zinc-950/40 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/30">
              <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5">
                <th className="px-5 py-3 w-[80px]">Rank</th>
                <th className="px-5 py-3 min-w-[280px]">KOL</th>
                <th className="px-5 py-3 text-right min-w-[160px]">PnL</th>

                {showDailyDeltas ? (
                  <>
                    <th className="px-5 py-3 text-right min-w-[160px]">Δ PnL (24h)</th>
                    <th className="px-5 py-3 text-right min-w-[140px]">Δ Rank (24h)</th>
                  </>
                ) : null}

                <th className="px-5 py-3 text-right min-w-[160px]">Followers</th>
                <th className="px-5 py-3 text-right min-w-[220px]">Wallet</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-10 text-center text-sm text-zinc-500">
                    No results.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const pnl = valueForPeriod(r);
                //   const rank = offset + idx + 1;
                    const rank = r.global_rank ?? (offset + idx + 1);

                  const pnlDelta = showDailyDeltas ? (r.pnl_change_24h ?? null) : null;

                  const rankDelta = showDailyDeltas ? (r.rank_change_24h ?? null) : null;

                  const avatar = proxifyImg(r.x_profile_image_url, cacheKey);
                  const badgeIcon = proxifyImg(r.x_badge_icon_url, cacheKey);

                  const display = r.x_display_name || (r.x_username ? `@${r.x_username}` : "Unknown");
                  const handle = r.x_username ? `@${r.x_username}` : "—";

                  const wallet = r.polymarket_address ?? "";
                  const walletShort =
                    wallet && wallet.length > 12 ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : wallet || "—";

                  return (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4 text-sm text-zinc-500 font-mono">{rank}</td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                            {avatar ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={avatar} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="truncate font-semibold text-zinc-200 text-sm">{display}</div>

                              {r.x_badge_label ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/10 text-zinc-300 max-w-[240px]">
                                  {badgeIcon ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={badgeIcon} alt="" className="w-3 h-3 shrink-0" />
                                  ) : null}
                                  <span className="truncate">{r.x_badge_label}</span>
                                </span>
                              ) : null}
                            </div>

                            <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{handle}</div>
                          </div>
                        </div>
                      </td>

                      <td className={cn("px-5 py-4 text-right font-mono font-bold", pnlClass(pnl))}>
                        {fmtMoney(pnl)}
                      </td>

                      {showDailyDeltas ? (
                        <>
                          <td className={cn("px-5 py-4 text-right font-mono font-bold", pnlClass(pnlDelta))}>
                            {fmtMoney(pnlDelta)}
                          </td>

                          <td className={cn("px-5 py-4 text-right font-mono font-bold", rankDeltaClass(rankDelta))}>
                            {fmtRankDelta(rankDelta)}
                          </td>
                        </>
                      ) : null}

                      <td className="px-5 py-4 text-right text-sm text-zinc-300 font-mono">
                        {fmtNumber(r.x_followers)}
                      </td>

                      <td className="px-5 py-4 text-right text-xs text-zinc-500 font-mono">{walletShort}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            Page <span className="text-zinc-300 font-mono">{Math.floor(offset / limit) + 1}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => load({ offset: Math.max(0, offset - limit) })}
              disabled={isPending || !canPrev}
              className="h-9 px-3 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => load({ offset: offset + limit })}
              disabled={isPending || !canNext}
              className="h-9 px-3 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Loading overlay */}
        {isPending ? (
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center">
            <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 text-sm">
              Loading…
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}