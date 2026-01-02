// app/(main)/address/[slug]/address-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Button } from "@/components/ui/button";
import { Copy, Gift, ChevronDown, Search } from "lucide-react";
import PnlChart from "./pnl-chart";

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

// ---------- utils ----------
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function proxifyImg(url?: string | null) {
  if (!url) return null;
  return `/KOLwrapped/api/image?url=${encodeURIComponent(url)}`;
}

function fmtNumber(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtMoney(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "" : "-";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}

function shortAddr(a: string) {
  if (!a) return "—";
  return a.length > 12 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
}

async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = s;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

// ✅ Polymarket-like mapping:
// - ALL: leaderboard endpoint (official “all-time” pnl)
// - 1D/1W/1M: reduction from user-pnl timeseries
function pnlQueryForRange(r: "1D" | "1W" | "1M" | "ALL") {
  if (r === "1D") return { interval: "1d", fidelity: "1h" };
  if (r === "1W") return { interval: "1w", fidelity: "1h" };
  if (r === "1M") return { interval: "1m", fidelity: "1h" };
  return { interval: "all", fidelity: "3h" };
}

function computeDelta(points: PnlPoint[]) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const first = points[0]?.p;
  const last = points[points.length - 1]?.p;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  return Number(last) - Number(first);
}

// ✅ normalize for day/week/month so chart starts at 0
function normalizeSeriesForShortRanges(range: "1D" | "1W" | "1M" | "ALL", pts: PnlPoint[]) {
  if (range === "ALL") return pts;
  if (!Array.isArray(pts) || pts.length === 0) return pts;
  const base = pts[0]?.p;
  if (!Number.isFinite(base)) return pts;
  return pts.map((x) => ({ ...x, p: x.p - base }));
}

// ---------- styles ----------
const card = "bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden";
const subCard = "bg-zinc-950/35 border border-white/10 rounded-xl";

// ---------- Positions wiring ----------
// Active positions endpoint: /positions
// Closed positions endpoint: /closed-positions
type ActiveSortKey = "VALUE" | "PNL_USD" | "PNL_PCT" | "BET" | "ALPHA" | "AVG_PRICE" | "CURRENT_PRICE";
type ClosedSortKey = "PNL_USD" | "AVG_PRICE" | "ALPHA" | "DATE";

const ACTIVE_SORTS: Array<{ key: ActiveSortKey; label: string; sortBy: string; sortDirection: "ASC" | "DESC"; disabled?: boolean }> = [
  // Polymarket "Value" uses sortBy=INITIAL in your notes
  { key: "VALUE", label: "Value", sortBy: "INITIAL", sortDirection: "DESC" },
  { key: "PNL_USD", label: "Profit/Loss $", sortBy: "CASHPNL", sortDirection: "DESC" },
  { key: "PNL_PCT", label: "Profit/Loss %", sortBy: "PERCENTPNL", sortDirection: "DESC" },
  { key: "BET", label: "Bet", sortBy: "TOKENS", sortDirection: "DESC" },
  { key: "ALPHA", label: "Alphabetically", sortBy: "TITLE", sortDirection: "ASC" },
  { key: "AVG_PRICE", label: "Average Price", sortBy: "AVGPRICE", sortDirection: "DESC" },
  // You said it “doesn't even work” — keep it, but disabled so UI matches Polymarket without breaking.
  { key: "CURRENT_PRICE", label: "Current Price", sortBy: "CURRENT", sortDirection: "DESC", disabled: true },
];

const CLOSED_SORTS: Array<{ key: ClosedSortKey; label: string; sortBy: string; sortDirection: "ASC" | "DESC" }> = [
  { key: "PNL_USD", label: "Profit/Loss $", sortBy: "REALIZEDPNL", sortDirection: "DESC" },
  { key: "AVG_PRICE", label: "Average Price", sortBy: "AVGPRICE", sortDirection: "DESC" },
  { key: "ALPHA", label: "Alphabetically", sortBy: "TITLE", sortDirection: "ASC" },
  { key: "DATE", label: "Date", sortBy: "TIMESTAMP", sortDirection: "DESC" },
];

// We keep types flexible because Polymarket payload shape can change.
// We'll render safely using fallback keys.
type ActivePosition = any;
type ClosedPosition = any;

function safeStr(x: any) {
  return typeof x === "string" ? x : "";
}
function safeNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function includesQuery(hay: string, q: string) {
  if (!q) return true;
  return hay.toLowerCase().includes(q.toLowerCase());
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

  const pnlRangeLabel = useMemo(() => {
    switch (pnlRange) {
      case "1D":
        return "1 day";
      case "1W":
        return "1 week";
      case "1M":
        return "1 month";
      default:
        return "All-time";
    }
  }, [pnlRange]);

  const title = useMemo(() => profile.name ?? profile.pseudonym ?? "Unknown", [profile.name, profile.pseudonym]);
  const wallet = useMemo(() => (profile?.proxyWallet || address).toLowerCase(), [profile?.proxyWallet, address]);

  // ---- PnL state ----
  const [pnlPoints, setPnlPoints] = useState<PnlPoint[]>([]);
  const [pnlLoading, setPnlLoading] = useState(false);
  const [pnlErr, setPnlErr] = useState<string | null>(null);

  // All-time pnl from leaderboard
  const [allTimePnl, setAllTimePnl] = useState<number | null>(null);
  const [allTimeVol, setAllTimeVol] = useState<number | null>(null);

  // ✅ fetch ALL-time pnl from leaderboard (only)
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const url = `https://data-api.polymarket.com/v1/leaderboard?timePeriod=all&user=${wallet}&category=overall`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Leaderboard fetch failed (${res.status})`);

        const json: any = await res.json();
        const row: LeaderboardRow | null = Array.isArray(json) ? json?.[0] ?? null : null;

        setAllTimePnl(typeof row?.pnl === "number" ? row.pnl : null);
        setAllTimeVol(typeof row?.vol === "number" ? row.vol : null);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setAllTimePnl(null);
        setAllTimeVol(null);
      }
    })();

    return () => controller.abort();
  }, [wallet]);

  // ✅ fetch pnl timeseries
  useEffect(() => {
    const { interval, fidelity } = pnlQueryForRange(pnlRange);
    const controller = new AbortController();

    (async () => {
      try {
        setPnlErr(null);
        setPnlLoading(true);

        const url = `https://user-pnl-api.polymarket.com/user-pnl?user_address=${wallet}&interval=${interval}&fidelity=${fidelity}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`PnL fetch failed (${res.status})`);

        const json: any = await res.json();
        const arr: PnlPoint[] = Array.isArray(json)
          ? json
              .filter((x) => Number.isFinite(x?.t) && Number.isFinite(x?.p))
              .map((x) => ({ t: Number(x.t), p: Number(x.p) }))
          : [];

        setPnlPoints(arr);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setPnlErr(e?.message ? String(e.message) : "Failed to load PnL");
        setPnlPoints([]);
      } finally {
        setPnlLoading(false);
      }
    })();

    return () => controller.abort();
  }, [pnlRange, wallet]);

  // ✅ Display PnL number rule:
  // - ALL => leaderboard pnl
  // - 1D/1W/1M => last-first reduction
  const pnlDisplayValue = useMemo(() => {
    if (pnlRange === "ALL") return allTimePnl;
    return computeDelta(pnlPoints);
  }, [pnlRange, allTimePnl, pnlPoints]);

  // ✅ Chart points rule:
  // - normalize 1D/1W/1M so chart starts at 0
  const chartPoints = useMemo(() => normalizeSeriesForShortRanges(pnlRange, pnlPoints), [pnlRange, pnlPoints]);

  // ---- Positions state ----
  const [positionsTab, setPositionsTab] = useState<"active" | "closed">("active");
  const [search, setSearch] = useState("");

  const [activeSort, setActiveSort] = useState<ActiveSortKey>("VALUE");
  const [closedSort, setClosedSort] = useState<ClosedSortKey>("PNL_USD");

  const [activeRows, setActiveRows] = useState<ActivePosition[]>([]);
  const [closedRows, setClosedRows] = useState<ClosedPosition[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [posErr, setPosErr] = useState<string | null>(null);

  const activeSortMeta = useMemo(() => ACTIVE_SORTS.find((s) => s.key === activeSort)!, [activeSort]);
  const closedSortMeta = useMemo(() => CLOSED_SORTS.find((s) => s.key === closedSort)!, [closedSort]);

  // fetch ACTIVE
  useEffect(() => {
    if (tab !== "positions" || positionsTab !== "active") return;

    const controller = new AbortController();
    (async () => {
      try {
        setPosErr(null);
        setPosLoading(true);

        const url =
          `https://data-api.polymarket.com/positions?` +
          `sizeThreshold=0&limit=500&offset=0&user=${wallet}` +
          `&sortBy=${encodeURIComponent(activeSortMeta.sortBy)}` +
          `&sortDirection=${encodeURIComponent(activeSortMeta.sortDirection)}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Active positions failed (${res.status})`);
        const json: any = await res.json();

        setActiveRows(Array.isArray(json) ? json : []);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setPosErr(e?.message ? String(e.message) : "Failed to load active positions");
        setActiveRows([]);
      } finally {
        setPosLoading(false);
      }
    })();

    return () => controller.abort();
  }, [tab, positionsTab, wallet, activeSortMeta.sortBy, activeSortMeta.sortDirection]);

  // fetch CLOSED
  useEffect(() => {
    if (tab !== "positions" || positionsTab !== "closed") return;

    const controller = new AbortController();
    (async () => {
      try {
        setPosErr(null);
        setPosLoading(true);

        const url =
          `https://data-api.polymarket.com/closed-positions?` +
          `limit=50&user=${wallet}` +
          `&sortBy=${encodeURIComponent(closedSortMeta.sortBy)}` +
          `&sortDirection=${encodeURIComponent(closedSortMeta.sortDirection)}`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Closed positions failed (${res.status})`);
        const json: any = await res.json();

        setClosedRows(Array.isArray(json) ? json : []);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setPosErr(e?.message ? String(e.message) : "Failed to load closed positions");
        setClosedRows([]);
      } finally {
        setPosLoading(false);
      }
    })();

    return () => controller.abort();
  }, [tab, positionsTab, wallet, closedSortMeta.sortBy, closedSortMeta.sortDirection]);

  // client-side search filter
  const filteredActive = useMemo(() => {
    const q = search.trim();
    if (!q) return activeRows;

    return activeRows.filter((r) => {
      const title = safeStr(r?.title ?? r?.marketTitle ?? r?.conditionTitle ?? r?.eventTitle);
      const outcome = safeStr(r?.outcome ?? r?.side ?? r?.positionSide);
      return includesQuery(`${title} ${outcome}`, q);
    });
  }, [activeRows, search]);

  const filteredClosed = useMemo(() => {
    const q = search.trim();
    if (!q) return closedRows;

    return closedRows.filter((r) => {
      const title = safeStr(r?.title ?? r?.marketTitle ?? r?.conditionTitle ?? r?.eventTitle);
      const outcome = safeStr(r?.outcome ?? r?.side ?? r?.positionSide);
      return includesQuery(`${title} ${outcome}`, q);
    });
  }, [closedRows, search]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-10 px-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-[1180px]">
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg opacity-90" />
          <div className="min-w-0">
            <div className="text-lg font-semibold text-zinc-200 truncate">Account</div>
            <div className="text-xs text-zinc-500 font-mono truncate">{address}</div>
          </div>
        </div>

        {/* Top grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Profile card */}
          <div className={cn(card, "p-6")}>
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                {profile.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profileImage} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold tracking-tight truncate">{title}</div>
                  {profile.verifiedBadge ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/20 text-indigo-300">
                      Verified
                    </span>
                  ) : null}
                </div>

                <div className="text-sm text-zinc-400 mt-1 flex flex-wrap gap-x-2 gap-y-1">
                  <span>Joined {topLeftStats.joinDate ?? "—"}</span>
                  <span className="opacity-40">·</span>
                  <span className="text-zinc-500">
                    {topLeftStats.views != null ? `${fmtNumber(topLeftStats.views)} views` : "Views —"}
                  </span>
                </div>

                {/* Linked X accounts */}
                {linkedKols.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {linkedKols.map((k) => (
                      <div
                        key={k.x_username}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/40 border border-white/10"
                        title={`@${k.x_username}`}
                      >
                        <div className="h-6 w-6 rounded-lg overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                          {k.x_profile_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={proxifyImg(k.x_profile_image_url) ?? undefined} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-200 font-medium truncate">
                            {k.x_display_name ?? `@${k.x_username}`}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate">@{k.x_username}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-200"
                  onClick={() => copyText(address)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {shortAddr(address)}
                </Button>

                <Button variant="outline" className="bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-200">
                  <Gift className="w-4 h-4 mr-2" />
                  Gift
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className={cn(subCard, "p-4")}>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Positions Value</div>
                <div className="mt-1 text-xl font-bold text-zinc-100">{fmtMoney(topLeftStats.positionsValue)}</div>
              </div>

              <div className={cn(subCard, "p-4")}>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Biggest Win</div>
                <div className="mt-1 text-xl font-bold text-zinc-100">
                  {topLeftStats.largestWin != null ? fmtMoney(topLeftStats.largestWin) : "—"}
                </div>
              </div>

              <div className={cn(subCard, "p-4")}>
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Markets Traded</div>
                <div className="mt-1 text-xl font-bold text-zinc-100">
                  {topLeftStats.marketsTraded != null ? fmtNumber(topLeftStats.marketsTraded) : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: PnL card */}
          <div className={cn(card, "p-6")}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400 font-medium">Profit/Loss</div>

                <div className={cn("text-3xl font-extrabold mt-1", (pnlDisplayValue ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>
                  {pnlLoading && pnlRange !== "ALL" ? "…" : pnlDisplayValue != null ? fmtMoney(pnlDisplayValue) : "—"}
                </div>

                <div className="text-xs text-zinc-500 mt-1">{pnlRangeLabel}</div>

                {pnlRange === "ALL" && allTimeVol != null ? (
                  <div className="text-[11px] text-zinc-500 mt-1">Volume {fmtMoney(allTimeVol)}</div>
                ) : null}

                {pnlErr ? <div className="text-[11px] text-red-300 mt-1">{pnlErr}</div> : null}
              </div>

              <div className="flex items-center gap-2">
                {(["1D", "1W", "1M", "ALL"] as const).map((t) => {
                  const active = pnlRange === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPnlRange(t)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs border transition-colors cursor-pointer",
                        active
                          ? "bg-indigo-500/15 border-indigo-500/25 text-indigo-200"
                          : "bg-zinc-950/40 border-white/10 text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-300"
                      )}
                      aria-pressed={active}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6">
              <PnlChart points={chartPoints} height={150} />
            </div>
          </div>
        </div>

        {/* Tabs (Positions / Activity) */}
        <div className="mt-8">
          <div className="flex items-center gap-2 border-b border-white/10">
            <button
              type="button"
              onClick={() => setTab("positions")}
              className={cn(
                "px-4 py-3 text-sm font-semibold -mb-px border-b-2",
                tab === "positions" ? "border-indigo-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              Positions
            </button>
            <button
              type="button"
              onClick={() => setTab("activity")}
              className={cn(
                "px-4 py-3 text-sm font-semibold -mb-px border-b-2",
                tab === "activity" ? "border-indigo-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              Activity
            </button>
          </div>

          <div className={cn(card, "mt-4 p-6")}>
            {tab === "positions" ? (
              <>
                {/* sub header controls like Polymarket */}
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  {/* Active/Closed */}
                  <div className="inline-flex rounded-xl overflow-hidden border border-white/10 bg-zinc-950/35">
                    <button
                      type="button"
                      onClick={() => setPositionsTab("active")}
                      className={cn(
                        "px-4 py-2 text-sm font-semibold",
                        positionsTab === "active" ? "bg-zinc-900/60 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                      )}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setPositionsTab("closed")}
                      className={cn(
                        "px-4 py-2 text-sm font-semibold",
                        positionsTab === "closed" ? "bg-zinc-900/60 text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                      )}
                    >
                      Closed
                    </button>
                  </div>

                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search positions"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950/35 border border-white/10 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40
                                 placeholder:text-zinc-600"
                    />
                  </div>

                  {/* Sort dropdown (simple, Polymarket-like) */}
                  <div className="relative">
                    <details className="group">
                      <summary
                        className="list-none cursor-pointer select-none px-4 py-2.5 rounded-xl bg-zinc-950/35 border border-white/10 text-sm
                                   flex items-center gap-2 hover:bg-zinc-900/50"
                      >
                        <span className="text-zinc-200 font-semibold">
                          {positionsTab === "active"
                            ? ACTIVE_SORTS.find((x) => x.key === activeSort)?.label
                            : CLOSED_SORTS.find((x) => x.key === closedSort)?.label}
                        </span>
                        <ChevronDown className="w-4 h-4 text-zinc-500 group-open:rotate-180 transition-transform" />
                      </summary>

                      <div className="absolute right-0 mt-2 w-52 rounded-xl overflow-hidden border border-white/10 bg-zinc-950/95 backdrop-blur shadow-xl z-20">
                        <div className="p-1">
                          {(positionsTab === "active" ? ACTIVE_SORTS : CLOSED_SORTS).map((opt: any) => {
                            const isActive = positionsTab === "active" ? opt.key === activeSort : opt.key === closedSort;
                            const disabled = !!opt.disabled;

                            return (
                              <button
                                key={opt.key}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  if (positionsTab === "active") setActiveSort(opt.key);
                                  else setClosedSort(opt.key);
                                  // close <details>
                                  const d = (document.activeElement as HTMLElement)?.closest("details");
                                  if (d) d.removeAttribute("open");
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                                  disabled
                                    ? "text-zinc-600 cursor-not-allowed"
                                    : isActive
                                    ? "bg-indigo-500/15 text-indigo-200"
                                    : "text-zinc-300 hover:bg-white/5"
                                )}
                              >
                                {opt.label}
                                {disabled ? <span className="ml-2 text-[10px] text-zinc-600">(soon)</span> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  </div>
                </div>

                {/* table header */}
                <div className="mt-5 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  {posLoading ? "Loading…" : posErr ? "Error" : positionsTab === "active" ? "Active Positions" : "Closed Positions"}
                </div>

                {posErr ? <div className="mt-3 text-sm text-red-200">{posErr}</div> : null}

                {/* rows */}
                <div className="mt-3 divide-y divide-white/5">
                  {(positionsTab === "active" ? filteredActive : filteredClosed).slice(0, positionsTab === "active" ? 500 : 50).map((r: any, idx: number) => {
                    const title = safeStr(r?.title ?? r?.marketTitle ?? r?.conditionTitle ?? r?.eventTitle) || "Untitled";
                    const outcome = safeStr(r?.outcome ?? r?.side ?? r?.positionSide) || "";
                    const image = r?.image ?? r?.icon ?? r?.eventImage ?? r?.marketImage ?? null;

                    // These field names vary; try common ones.
                    const avg = safeNum(r?.avgPrice ?? r?.avg_price ?? r?.averagePrice);
                    const current = safeNum(r?.currentPrice ?? r?.current_price ?? r?.price);
                    const value = safeNum(r?.initial ?? r?.value ?? r?.positionValue ?? r?.position_value);

                    const cashPnl = safeNum(r?.cashPnl ?? r?.cash_pnl ?? r?.realizedPnl ?? r?.realized_pnl);
                    const pctPnl = safeNum(r?.percentPnl ?? r?.percent_pnl ?? r?.pnlPercent ?? r?.pnl_percent);

                    return (
                      <div key={r?.id ?? `${idx}-${title}`} className="py-4 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={proxifyImg(image) ?? undefined} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-zinc-100 truncate">{title}</div>
                          {outcome ? (
                            <div className="text-xs text-zinc-500 truncate">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-500/10 text-green-300 border border-green-500/15 mr-2">
                                {outcome}
                              </span>
                              {r?.tokens != null ? (
                                <span className="text-zinc-500">{fmtNumber(safeNum(r.tokens) ?? undefined)} shares</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {/* right columns */}
                        <div className="hidden md:flex items-center gap-10 text-sm">
                          <div className="w-16 text-right">
                            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Avg</div>
                            <div className="font-semibold text-zinc-200">{avg != null ? `${(avg * 100).toFixed(0)}¢` : "—"}</div>
                          </div>

                          <div className="w-20 text-right">
                            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Current</div>
                            <div className="font-semibold text-zinc-200">{current != null ? `${(current * 100).toFixed(0)}¢` : "—"}</div>
                          </div>

                          <div className="w-32 text-right">
                            <div className="text-[11px] text-zinc-500 uppercase tracking-wider">Value</div>
                            <div className="font-semibold text-zinc-200">{value != null ? fmtMoney(value) : "—"}</div>

                            {(cashPnl != null || pctPnl != null) && (
                              <div className={cn("text-xs font-medium", (cashPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>
                                {cashPnl != null ? fmtMoney(cashPnl) : ""}
                                {pctPnl != null ? ` (${pctPnl.toFixed(2)}%)` : ""}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* mobile compact */}
                        <div className="md:hidden text-right">
                          <div className="text-sm font-semibold text-zinc-200">{value != null ? fmtMoney(value) : "—"}</div>
                          {(cashPnl != null || pctPnl != null) && (
                            <div className={cn("text-xs font-medium", (cashPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400")}>
                              {cashPnl != null ? fmtMoney(cashPnl) : ""}
                              {pctPnl != null ? ` (${pctPnl.toFixed(2)}%)` : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {!posLoading &&
                  (positionsTab === "active" ? filteredActive.length === 0 : filteredClosed.length === 0) ? (
                    <div className="py-10 text-center text-sm text-zinc-500">No positions found</div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="text-sm text-zinc-400">Activity table will go here (fetch /activity). Next step.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}