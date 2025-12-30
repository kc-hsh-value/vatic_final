"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WrappedResult } from "./types";
import type { WrappedVibes } from "./actions/llm/vibes";
import { toPng } from "html-to-image";
import { getOrGenerateWrapped } from "./actions/db/get-or-generate-cache";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ChevronsUpDown, Check, Smartphone, Monitor, Copy, Download, Share2 } from "lucide-react";
import { getTopSearchedAccounts } from "./db/get-top-searched";

// --- Utility for cleaner Tailwind classes ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TOTAL_PM_TRADERS = 1_800_000;

/**
 * rank: 1 = best
 * returns: percentile where 100 = best (top), 0 = worst (bottom)
 */
function rankToPercentile(rank?: number | null, total = TOTAL_PM_TRADERS) {
  if (!rank || !Number.isFinite(rank) || rank <= 0) return null;
  const p = (1 - (rank - 1) / (total - 1)) * 100;
  return clamp(p);
}

// --- Logic Helpers (Unchanged) ---
function fmtNumber(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtMoney(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function yearFromCreatedAt(createdAt?: string) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

function pickTopTweetsByLikes(tweets: any[], n = 2) {
  if (!Array.isArray(tweets) || tweets.length === 0) return [];
  const in2025 = tweets.filter((t) => yearFromCreatedAt(t.createdAt) === 2025);
  const pool = in2025.length ? in2025 : tweets;
  const noRts = pool.filter((t) => !/^RT\s+@/i.test(String(t.text ?? "")));
  return [...noRts].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0)).slice(0, n);
}

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

function computeSignalScore(args: {
  tweets: Array<{ text?: string; likeCount?: number; retweetCount?: number; replyCount?: number; viewCount?: number }>;
  polymarket?: { linked: boolean; overall?: { traded?: number; vol?: number } };
}) {
  const tweets = args.tweets ?? [];
  const pm = args.polymarket;

  const avgLen = tweets.length ? tweets.reduce((s, t) => s + (t.text?.length ?? 0), 0) / tweets.length : 0;

  const mentionsMarkets = tweets.some((t) =>
    /polymarket|kalshi|odds|probabilit|yes\s*\/\s*no|market|ev\b|edge\b/i.test(t.text ?? "")
  );

  const hasLinksRate = tweets.length ? tweets.filter((t) => /https?:\/\//i.test(t.text ?? "")).length / tweets.length : 0;

  let score = 35;
  score += clamp((avgLen - 80) / 4, 0, 25);
  if (mentionsMarkets) score += 12;
  score -= clamp((hasLinksRate - 0.35) * 30, 0, 12);

  if (pm?.linked) score += 18;
  if (pm?.overall?.traded && pm.overall.traded > 25) score += 6;

  return clamp(Math.round(score));
}


function proxifyImg(url?: string | null, cacheKey?: string | null) {
  if (!url) return null;
  const v = cacheKey ? `&v=${encodeURIComponent(cacheKey)}` : "";
  return `/KOLwrapped/api/image?url=${encodeURIComponent(url)}${v}`;
}

// --- Visual Components ---

function BellCurve({
  percentile,
  avatarUrl,
  logoUrl,
  leftLabel = "Noise",
  rightLabel = "Signal",
  accent = "#38bdf8", // default cyan
  fillTop = "rgba(56, 189, 248, 0.20)",
  fillBottom = "rgba(56, 189, 248, 0)",
  markerBorder = "#38bdf8",
}: {
  percentile: number;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  leftLabel?: string;
  rightLabel?: string;
  accent?: string;
  fillTop?: string;
  fillBottom?: string;
  markerBorder?: string;
}) {
  const x = (percentile / 100) * 320;
  const gradId = useMemo(() => `curveGradient-${Math.random().toString(16).slice(2)}`, []);

  return (
    <div className="relative w-full select-none" style={{ height: 100 }}>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-10 grayscale pointer-events-none z-0"
        />
      )}

      <svg width="100%" height="100" viewBox="0 0 320 90" className="relative z-10 block overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fillTop} />
            <stop offset="100%" stopColor={fillBottom} />
          </linearGradient>
        </defs>

        <path d="M0 80 H320" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
        <path
          d="M0 80 C40 80, 60 76, 80 62 C100 50, 120 28, 160 12 C200 28, 220 50, 240 62 C260 76, 280 80, 320 80"
          stroke={accent}
          strokeWidth="2"
          fill={`url(#${gradId})`}
          style={{ filter: `drop-shadow(0 0 8px ${accent}55)` }}
        />
        <line x1={x} y1="12" x2={x} y2="80" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeDasharray="4 2" />
      </svg>

      <div
        className="absolute z-20 shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        style={{
          left: `calc(${percentile}% - 20px)`,
          top: -4,
          width: 40,
          height: 40,
          borderRadius: 999,
          padding: 2,
          background: "#09090b",
          border: `1px solid ${markerBorder}`,
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover rounded-full bg-zinc-800" />
        ) : null}
      </div>

      <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mt-[-6px] px-1 relative z-10">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

// --- Reusable Content Renderer ---
function WrappedView({
  data,
  vibes,
  signal,
  topTweets,
  imgCacheKey,
  mode, // "responsive" | "desktop" | "mobile"
}: {
  data: WrappedResult["result"];
  vibes: WrappedVibes | null;
  signal: number;
  topTweets: any[];
  imgCacheKey: string;
  mode: "responsive" | "desktop" | "mobile";
}) {
  const profile = data.twitter.profile;
  const pm = data.polymarket;

  const isMobileExport = mode === "mobile";
  const isDesktopExport = mode === "desktop";
  
  
  // Base classes
  const cardBaseClass = "relative bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden";
  const miniStatClass = "flex flex-col p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]";
  
  const containerClass = cn(
    "text-zinc-100 bg-[#09090b] overflow-hidden box-border",
    // Layout and sizing:
    // - Mobile Export: Fixed width controlled by parent, tighter padding
    // - Desktop Export: Fixed width controlled by parent, larger padding
    // - Responsive: Flexible width, adaptive padding
    isMobileExport ? "w-full p-8" : "", 
    isDesktopExport ? "w-full p-12" : "",
    mode === "responsive" ? "w-full max-w-[1080px] p-4 md:p-8 lg:p-12 rounded-3xl border border-white/5" : ""
  );

  const traderPercentile = useMemo(() => {
    const rank = pm?.overall?.rank;
    return rankToPercentile(rank != null ? Number(rank) : null);
  }, [pm?.overall?.rank]);

  return (
    <div className={containerClass}>
      {/* Header Section */}
      <div className="grid grid-cols-[auto_1fr] gap-4 md:gap-6 items-start mb-8 md:mb-10">
        <div className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl shrink-0">
          {profile?.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxifyImg(profile.profilePicture, imgCacheKey) ?? undefined} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>

        <div className="flex flex-col h-full justify-center min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight leading-none mb-1 truncate">
                {profile?.name ?? `@${data.input.xUsername}`}
              </h2>
              <p className="text-zinc-500 text-base md:text-lg font-medium">@{data.input.xUsername}</p>
            </div>

            <div className={cn("flex items-center gap-3", isMobileExport ? "mt-2" : "")}>
              <div className="md:text-right">
                <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-1">Generated by</div>
                <div className="flex items-center md:justify-end gap-2 text-zinc-300 font-medium text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="" className="w-5 h-5 opacity-80" />
                  Vatic Trading
                </div>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3 md:mt-4">
            {profile?.isBlueVerified && (
              <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-semibold bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 text-[#1d9bf0]">
                Verified
              </span>
            )}
            {profile?.badge?.description && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] md:text-xs font-medium bg-zinc-800/50 border border-white/10 text-zinc-300 max-w-full">
                {profile?.badge?.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proxifyImg(profile.badge.imageUrl, imgCacheKey) ?? undefined} alt="" className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">{profile.badge.description}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Vibe Check */}
      {vibes && (
        <div className="mb-6 md:mb-8 p-5 md:p-6 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-white/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[200px] md:w-[300px] h-[300px] bg-indigo-500/10 blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Vibe Check 2025</span>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-indigo-500/50 to-transparent" />
            </div>

            <h3 className="text-xl md:text-2xl font-serif italic text-white/90 mb-2">
              {"'"}
              {vibes.tagline}
              {"'"}
            </h3>
            <p className="text-zinc-400 text-xs md:text-sm leading-relaxed max-w-2xl">{vibes.summary}</p>

            <div className="flex flex-wrap gap-2 mt-4 md:mt-5">
              <span className="px-3 py-1 rounded-md text-[10px] md:text-xs font-semibold bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                {vibes.archetype}
              </span>
              {vibes.vibe.map((v) => (
                <span key={v} className="px-3 py-1 rounded-md text-[10px] md:text-xs font-medium bg-white/5 border border-white/10 text-zinc-400">
                  {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div
        className={cn(
          "grid gap-6",
          // Layout switching based on mode
          isMobileExport
            ? "grid-cols-1" // Mobile export is ALWAYS stacked
            : isDesktopExport
            ? pm?.linked ? "grid-cols-2" : "grid-cols-1" // Desktop export is grid if linked
            : pm?.linked ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1" // Responsive view switches based on screen
        )}
      >
        {/* Twitter Column */}
        <div className={cn(cardBaseClass, "p-5 md:p-6 flex flex-col gap-5 md:gap-6")}>
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span className="text-sm font-semibold text-zinc-300">X / Twitter</span>
            </div>
            <div className="text-xs text-zinc-500 font-mono">{fmtNumber(profile?.followers)} Followers</div>
          </div>

          {/* Signal/Noise Visualization */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">Signal / Noise Ratio</div>
            <BellCurve percentile={signal} avatarUrl={proxifyImg(profile?.profilePicture ?? null, imgCacheKey)} logoUrl="/logo.png" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Posts", value: fmtNumber(profile?.statusesCount) },
              { label: "Following", value: fmtNumber(profile?.following) },
              { label: "Followers", value: fmtNumber(profile?.followers) },
            ].map((s) => (
              <div key={s.label} className={miniStatClass}>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">{s.label}</div>
                <div className="text-base md:text-lg font-bold text-zinc-200 mt-1">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Top Tweets */}
          {topTweets.length > 0 && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Top Tweets (2025)</div>

              {topTweets.map((t) => (
                <div key={t.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-sm relative">
                  <div className="text-zinc-300 leading-snug line-clamp-3 mb-3 font-medium">
                    {String(t.text ?? "").replace(/^RT\s+@[^:]+:\s*/i, "")}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
                    <span className="flex items-center gap-1">
                      <span className="text-red-400/80">♥</span> {fmtNumber(t.likeCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-blue-400/80">👁</span> {fmtNumber(t.viewCount)}
                    </span>
                    
                    {!isDesktopExport && !isMobileExport && t.url ? (
                      <button
                        type="button"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                        className="ml-auto text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10"
                      >
                        View
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Polymarket Column */}
        {pm?.linked && (
          <div className={cn(cardBaseClass, "p-5 md:p-6 flex flex-col gap-5 md:gap-6")}>
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xl">📈</span>
                <span className="text-sm font-semibold text-zinc-300">Polymarket</span>
              </div>
              <div className="text-xs font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">Rank #{pm.overall?.rank ?? "—"}</div>
            </div>

            
            {/* Trader Percentile */}
            {traderPercentile != null && traderPercentile>65 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">
                  Trader Percentile (Rank-based)
                </div>
                <BellCurve
                  percentile={traderPercentile}
                  avatarUrl={proxifyImg(profile?.profilePicture ?? null, imgCacheKey)}
                  logoUrl="/logo.png"
                  leftLabel="Retail"
                  rightLabel="Whale"
                  accent="#22c55e"
                  markerBorder="#22c55e"
                  fillTop="rgba(34, 197, 94, 0.18)"
                  fillBottom="rgba(34, 197, 94, 0)"
                />
                {/* <div className="mt-2 text-[11px] text-zinc-500 font-mono">
                  Rank #{pm.overall?.rank ?? "—"} / {TOTAL_PM_TRADERS.toLocaleString()}
                </div> */}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Volume", value: fmtMoney(pm.overall?.vol) },
                { label: "Markets Traded", value: fmtNumber(pm.overall?.traded) },
              ].map((s) => (
                <div key={s.label} className={miniStatClass}>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">{s.label}</div>
                  <div className="text-base md:text-lg font-bold text-zinc-200 mt-1">{s.value}</div>
                </div>
              ))}

              <div className="col-span-2 p-4 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 flex items-center justify-between">
                <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Net PnL</div>
                <div
                  className={cn(
                    "text-xl md:text-2xl font-mono font-bold",
                    (pm.overall?.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {(pm.overall?.pnl ?? 0) >= 0 ? "+" : ""}
                  {fmtMoney(pm.overall?.pnl)}
                </div>
              </div>
            </div>

            {Array.isArray(pm.topMarkets2025) && pm.topMarkets2025.length > 0 && (
              <div className="flex-1 flex flex-col gap-3">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Top Markets (2025)</div>
                <div className="flex flex-col gap-2">
                  {pm.topMarkets2025.slice(0, 4).map((m: any) => {
                    const pnl = Number(m.realizedPnl ?? 0);
                    return (
                      <div
                        key={`${m.conditionId}-${m.realizedPnl}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                      >
                        <div className="text-xs text-zinc-300 truncate pr-4 font-medium">{m.title}</div>
                        <div className={cn("text-xs font-mono font-bold whitespace-nowrap", pnl >= 0 ? "text-green-400" : "text-red-400")}>
                          {pnl >= 0 ? "+" : ""}
                          {fmtMoney(pnl)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between text-[10px] text-zinc-600 uppercase tracking-widest font-medium border-t border-white/5 pt-4">
        <span>Vatic Trading Analytics</span>
        <span>{new Date(data.debug.fetchedAtIso).toUTCString()}</span>
      </div>
    </div>
  );
}

// --- Types for Top Accounts ---
type TopAccount = {
  x_username: string;
  hit_count: number;
  profilePicture: string | null;
  name: string | null;
  handle: string;
  isBlueVerified: boolean;
  badge: { description: string; imageUrl: string | null } | null;
};

// --- Main Page Component ---
export default function KolWrappedPage() {
  const [xUsername, setXUsername] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WrappedResult["result"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vibes, setVibes] = useState<WrappedVibes | null>(null);
  const [stage, setStage] = useState<string>("");

  // Refs for exporting
  const desktopExportRef = useRef<HTMLDivElement | null>(null);
  const mobileExportRef = useRef<HTMLDivElement | null>(null);

  // --- Top searched dropdown state ---
  const [openTop, setOpenTop] = useState(false);
  const [topAccounts, setTopAccounts] = useState<TopAccount[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoadingTop(true);
        const res = (await getTopSearchedAccounts(10)) as any;
        setTopAccounts(res ?? []);
      } catch {
        // ignore
      } finally {
        setLoadingTop(false);
      }
    })();
  }, []);

  const normalized = useMemo(() => {
    const s = xUsername.trim();
    if (!s) return "";
    return s.startsWith("@") ? s.slice(1).trim() : s;
  }, [xUsername]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) return;

    setSubmitted(normalized);
    setLoading(true);
    setError(null);
    setData(null);
    setVibes(null);

    setStage("Checking cache...");
    const slowTimer = setTimeout(() => setStage("Generating (may take ~30s)..."), 1500);

    try {
      setStage("Fetching data...");
      const final: any = await getOrGenerateWrapped(normalized);

      clearTimeout(slowTimer);
      setStage("Rendering...");

      setData(final);
      setVibes(final.vibes ?? null);

      setStage("");
    } catch (err: any) {
      clearTimeout(slowTimer);
      setError(err?.message ? String(err.message) : "Failed to generate wrapped.");
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  async function copyPngToClipboard(dataUrl: string) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const item = new ClipboardItem({ [blob.type]: blob });
    await navigator.clipboard.write([item]);
  }

  async function inlineImagesFresh(root: HTMLElement) {
    const imgs = Array.from(root.querySelectorAll("img"));
    const originals = imgs.map((img) => img.getAttribute("src") || "");

    const toDataUrl = async (src: string) => {
      const busted = src.includes("?") ? `${src}&cb=${Date.now()}` : `${src}?cb=${Date.now()}`;
      const res = await fetch(busted, { cache: "no-store" });
      if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    };

    await Promise.all(
      imgs.map(async (img, i) => {
        const src = originals[i];
        if (!src) return;
        const dataUrl = await toDataUrl(src);
        img.setAttribute("src", dataUrl);
        try {
          if ("decode" in img) await (img as any).decode();
        } catch {}
      })
    );

    return () => {
      imgs.forEach((img, i) => {
        const src = originals[i];
        if (src) img.setAttribute("src", src);
      });
    };
  }

  async function exportPngDataUrl(type: "desktop" | "mobile") {
    // IMPORTANT: Target the ref directly which has the width/height set
    const root = type === "mobile" ? mobileExportRef.current : desktopExportRef.current;
    if (!root) throw new Error("Export container not found");

    const restore = await inlineImagesFresh(root);
    try {
      return await toPng(root, {
        cacheBust: true,
        pixelRatio: 2, // High resolution
        backgroundColor: "#09090b",
      });
    } finally {
      restore();
    }
  }

  async function downloadPng(type: "desktop" | "mobile") {
    try {
      setError(null);
      setStage(type === "mobile" ? "Preparing mobile image..." : "Preparing desktop image...");
      const dataUrl = await exportPngDataUrl(type);
      setStage("");

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `vatic-kol-wrapped-${submitted ?? "user"}-${type}.png`;
      a.click();
    } catch (e: any) {
      setStage("");
      setError(e?.message ? String(e.message) : "PNG export failed.");
    }
  }

  async function copyPng(type: "desktop" | "mobile") {
    try {
      setError(null);
      setStage("Preparing image...");
      const dataUrl = await exportPngDataUrl(type);

      setStage("Copying to clipboard...");
      await copyPngToClipboard(dataUrl);

      setStage("Copied ✅");
      setTimeout(() => setStage(""), 1200);
    } catch (e: any) {
      setStage("");
      setError(e?.message ? String(e.message) : "Copy failed.");
    }
  }

  function tweetIntentUrl() {
    const text = `Vatic Trading KOL Wrapped 2025 — @${submitted ?? ""}\n\nvatic.trading`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }

  const tweets = data?.twitter?.tweets ?? [];
  const pm = data?.polymarket;

  const topTweets = useMemo(() => pickTopTweetsByLikes(tweets, 2), [tweets]);
  // const signal = useMemo(() => computeSignalScore({ tweets, polymarket: pm }), [tweets, pm]);
  const signal = useMemo(
    () => computeSignalScore({ tweets, polymarket: pm }),
    [tweets, pm]
  );
  
  const imgCacheKey = data ? `${data.input.xUsername}-${data.debug.fetchedAtIso}` : "";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4 font-sans selection:bg-indigo-500/30">
      {/* --- UI Controls --- */}
      <div className="w-full max-w-2xl mb-12">
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg opacity-90" />
          <h1 className="text-2xl font-bold tracking-tight">KOL Wrapped 2025</h1>
        </div>

        <form onSubmit={onSubmit} className="flex gap-3 mb-4">
          <input
            value={xUsername}
            onChange={(e) => setXUsername(e.target.value)}
            placeholder="Enter X username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-zinc-600"
          />

          <Popover open={openTop} onOpenChange={setOpenTop}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-[48px] px-3 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
              >
                Top
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-70" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[300px] sm:w-[380px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Search top accounts..." />
                <CommandEmpty>{loadingTop ? "Loading..." : "No results."}</CommandEmpty>

                <CommandGroup heading="Most searched">
                  {topAccounts.map((a) => (
                    <CommandItem
                      key={a.x_username}
                      value={`${a.x_username} ${a.name ?? ""} ${a.handle}`}
                      onSelect={() => {
                        setXUsername(a.x_username);
                        setOpenTop(false);
                      }}
                      className="flex items-center gap-3"
                    >
                      <div className="h-8 w-8 rounded-lg overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                        {a.profilePicture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={proxifyImg(a.profilePicture, "top") ?? undefined} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-medium text-zinc-200 text-xs">{a.name ?? a.handle}</div>
                        </div>
                        <div className="text-[10px] text-zinc-500 flex items-center justify-between">
                          <span className="truncate">{a.handle}</span>
                        </div>
                      </div>

                      {normalized === a.x_username ? <Check className="h-4 w-4 opacity-80" /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          <button
            type="submit"
            disabled={!normalized || loading}
            className={cn(
              "px-4 sm:px-6 py-3 rounded-xl font-medium text-sm transition-all min-w-[100px] sm:min-w-[120px]",
              !normalized || loading
                ? "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                : "bg-white text-black border border-white hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            )}
          >
            {loading ? "..." : "Generate"}
          </button>
        </form>

        <div className="h-6 text-sm text-zinc-500 flex items-center">
          {submitted && (
            <span>
              Target: <strong className="text-zinc-300">@{submitted}</strong>
            </span>
          )}
          {stage && (
            <>
              <span className="mx-2 opacity-30">/</span>
              <span className="text-indigo-400 animate-pulse">{stage}</span>
            </>
          )}
        </div>

        {error && <div className="mt-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">{error}</div>}
      </div>

      {data && (
        <div className="w-full flex flex-col items-center">
          
          {/* 
            --- RENDER VISIBLE RESPONSIVE UI ---
            This component scales for mobile/desktop viewing.
          */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-[1080px] mb-8">
            <WrappedView
              mode="responsive"
              data={data}
              vibes={vibes}
              signal={signal}
              topTweets={topTweets}
              imgCacheKey={imgCacheKey}
            />
          </div>

          {/* 
            --- HIDDEN EXPORT CONTAINERS ---
            These are positioned off-screen.
            IMPORTANT: The 'ref' goes on the wrapper DIV which has the EXPLICIT dimensions.
            The WrappedView inside takes w-full to fill that wrapper.
          */}
          <div className="absolute top-0 left-[-9999px] pointer-events-none opacity-0 flex flex-col">
             {/* Desktop: Fixed 1080px width */}
             <div ref={desktopExportRef} style={{ width: 1080, backgroundColor: "#09090b" }}>
                <WrappedView mode="desktop" data={data} vibes={vibes} signal={signal} topTweets={topTweets} imgCacheKey={imgCacheKey} />
             </div>
             {/* Mobile: Fixed 600px width (Perfect for phones) */}
             <div ref={mobileExportRef} style={{ width: 600, backgroundColor: "#09090b" }}>
                <WrappedView mode="mobile" data={data} vibes={vibes} signal={signal} topTweets={topTweets} imgCacheKey={imgCacheKey} />
             </div>
          </div>

          {/* --- ACTION BUTTONS --- */}
          <div className="w-full max-w-[1080px] grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pb-12">
            
            {/* Desktop Actions */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-3">
               <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
                  <Monitor className="w-4 h-4" /> Desktop Image
               </div>
               <div className="flex gap-2 w-full">
                  <Button onClick={() => downloadPng("desktop")} variant="outline" className="flex-1 bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-300">
                    <Download className="w-4 h-4 mr-2" /> Save
                  </Button>
                  <Button onClick={() => copyPng("desktop")} variant="outline" className="flex-1 bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-300">
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </Button>
               </div>
            </div>

            {/* Mobile Actions */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-3">
               <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium uppercase tracking-wider">
                  <Smartphone className="w-4 h-4" /> Mobile Image
               </div>
               <div className="flex gap-2 w-full">
                  <Button onClick={() => downloadPng("mobile")} variant="outline" className="flex-1 bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-300">
                    <Download className="w-4 h-4 mr-2" /> Save
                  </Button>
                  <Button onClick={() => copyPng("mobile")} variant="outline" className="flex-1 bg-zinc-950 border-white/10 hover:bg-zinc-800 text-zinc-300">
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </Button>
               </div>
            </div>

            {/* Tweet Action */}
            <div className="md:col-span-2 flex justify-center mt-2">
                <a
                  href={tweetIntentUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1da1f2] text-white font-medium hover:bg-[#1a91da] transition-all shadow-lg shadow-blue-900/20 text-sm"
                >
                  <Share2 className="w-4 h-4" /> Share on X / Twitter
                </a>
            </div>
            
             <p className="md:col-span-2 text-center text-xs text-zinc-600 max-w-md mx-auto">
               Tip: Save the image first, then paste it into your tweet.
             </p>

          </div>
        </div>
      )}
    </main>
  );
}