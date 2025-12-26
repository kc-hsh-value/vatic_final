"use client";

import { useMemo, useRef, useState } from "react";
import type { WrappedResult } from "./types";
import type { WrappedVibes } from "./actions/llm/vibes";
import { toPng } from "html-to-image";
import { getOrGenerateWrapped } from "./actions/db/get-or-generate-cache";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Utility for cleaner Tailwind classes ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

  const avgLen = tweets.length
    ? tweets.reduce((s, t) => s + (t.text?.length ?? 0), 0) / tweets.length
    : 0;

  const mentionsMarkets = tweets.some((t) =>
    /polymarket|kalshi|odds|probabilit|yes\s*\/\s*no|market|ev\b|edge\b/i.test(t.text ?? "")
  );

  const hasLinksRate = tweets.length
    ? tweets.filter((t) => /https?:\/\//i.test(t.text ?? "")).length / tweets.length
    : 0;

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

// --- Components ---

function BellCurve({
  percentile,
  avatarUrl,
  logoUrl,
}: {
  percentile: number;
  avatarUrl?: string | null;
  logoUrl?: string | null;
}) {
  const x = (percentile / 100) * 320;

  return (
    <div className="relative w-full select-none" style={{ height: 100 }}>
      {/* Watermark Logo */}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-10 grayscale pointer-events-none z-0"
        />
      )}

      <svg
        width="100%"
        height="100"
        viewBox="0 0 320 90"
        className="relative z-10 block overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="curveGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.2)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0)" />
          </linearGradient>
        </defs>

        {/* Base Line */}
        <path d="M0 80 H320" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
        
        {/* The Curve */}
        <path
          d="M0 80 C40 80, 60 76, 80 62 C100 50, 120 28, 160 12 C200 28, 220 50, 240 62 C260 76, 280 80, 320 80"
          stroke="#38bdf8"
          strokeWidth="2"
          fill="url(#curveGradient)"
          style={{ filter: "drop-shadow(0 0 8px rgba(56, 189, 248, 0.3))" }}
        />
        
        {/* The Vertical Indicator Line */}
        <line 
          x1={x} y1="12" x2={x} y2="80" 
          stroke="rgba(255,255,255,0.6)" 
          strokeWidth="1.5" 
          strokeDasharray="4 2"
        />
      </svg>

      {/* Avatar Pin */}
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
          border: "1px solid #38bdf8",
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={avatarUrl} 
            alt="" 
            className="w-full h-full object-cover rounded-full bg-zinc-800"
          />
        ) : null}
      </div>

      <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mt-[-6px] px-1 relative z-10">
        <span>Noise</span>
        <span>Signal</span>
      </div>
    </div>
  );
}

export default function KolWrappedPage() {
  const [xUsername, setXUsername] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WrappedResult["result"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vibes, setVibes] = useState<WrappedVibes | null>(null);
  const [stage, setStage] = useState<string>("");

  const exportRef = useRef<HTMLDivElement | null>(null);

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

  async function exportPngDataUrl() {
    if (!exportRef.current) throw new Error("Nothing to export");
    const root = exportRef.current;

    const restore = await inlineImagesFresh(root);
    try {
      return await toPng(root, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#09090b", // zinc-950
      });
    } finally {
      restore();
    }
  }

  async function downloadPng() {
    try {
      setError(null);
      setStage("Preparing image...");
      const dataUrl = await exportPngDataUrl();
      setStage("");

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `vatic-kol-wrapped-${submitted ?? "user"}.png`;
      a.click();
    } catch (e: any) {
      setStage("");
      setError(e?.message ? String(e.message) : "PNG export failed.");
    }
  }

  async function copyPng() {
    try {
      setError(null);
      setStage("Preparing image...");
      const dataUrl = await exportPngDataUrl();

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

  const profile = data?.twitter?.profile;
  const tweets = data?.twitter?.tweets ?? [];
  const pm = data?.polymarket;

  const topTweets = useMemo(() => pickTopTweetsByLikes(tweets, 2), [tweets]);
  const signal = useMemo(() => computeSignalScore({ tweets, polymarket: pm }), [tweets, pm]);

  const imgCacheKey = data ? `${data.input.xUsername}-${data.debug.fetchedAtIso}` : "";

  // -- Component Styles --
  const cardBaseClass = "relative bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden";
  const miniStatClass = "flex flex-col p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4 font-sans selection:bg-indigo-500/30">
      
      {/* --- UI Controls (Not Exported) --- */}
      <div className="w-full max-w-2xl mb-12">
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg opacity-90" />
          <h1 className="text-2xl font-bold tracking-tight">KOL Wrapped</h1>
        </div>

        <form onSubmit={onSubmit} className="flex gap-3 mb-4">
          <input
            value={xUsername}
            onChange={(e) => setXUsername(e.target.value)}
            placeholder="Enter X username (e.g. tenad0me)"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-zinc-600"
          />

          <button
            type="submit"
            disabled={!normalized || loading}
            className={cn(
              "px-6 py-3 rounded-xl font-medium text-sm transition-all min-w-[120px]",
              !normalized || loading
                ? "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed"
                : "bg-white text-black border border-white hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            )}
          >
            {loading ? "Working..." : "Generate"}
          </button>
        </form>

        <div className="h-6 text-sm text-zinc-500 flex items-center">
            {submitted && <span>Target: <strong className="text-zinc-300">@{submitted}</strong></span>}
            {stage && (
                <>
                <span className="mx-2 opacity-30">/</span>
                <span className="text-indigo-400 animate-pulse">{stage}</span>
                </>
            )}
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm">
            {error}
          </div>
        )}
      </div>

      {data && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 w-full max-w-[1080px]">
          
          {/* --- EXPORT AREA START --- */}
          <div
            ref={exportRef}
            // Strict width for consistent PNG export
            style={{ width: 1080, margin: '0 auto', background: '#09090b' }} 
            className="p-12 text-zinc-100 box-border rounded-none overflow-hidden"
          >
            {/* Header Section */}
            <div className="grid grid-cols-[88px_1fr] gap-6 items-start mb-10">
              <div className="w-[88px] h-[88px] rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 shadow-2xl">
                {profile?.profilePicture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                    src={proxifyImg(profile.profilePicture, imgCacheKey) ?? undefined}
                    alt=""
                    className="w-full h-full object-cover"
                    />
                ) : null}
              </div>

              <div className="flex flex-col h-full justify-center">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-4xl font-extrabold tracking-tight leading-none mb-1">
                            {profile?.name ?? `@${data.input.xUsername}`}
                        </h2>
                        <p className="text-zinc-500 text-lg font-medium">@{data.input.xUsername}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-1">Generated by</div>
                            <div className="flex items-center justify-end gap-2 text-zinc-300 font-medium">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo.png" alt="" className="w-5 h-5 opacity-80" />
                                Vatic Trading
                            </div>
                        </div>
                    </div>
                </div>

                {/* Badges */}
                <div className="flex gap-2 mt-4">
                    {profile?.isBlueVerified && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#1d9bf0]/10 border border-[#1d9bf0]/20 text-[#1d9bf0]">
                            Verified
                        </span>
                    )}
                    {profile?.badge?.description && (
                         <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800/50 border border-white/10 text-zinc-300">
                             {profile?.badge?.imageUrl && (
                                 // eslint-disable-next-line @next/next/no-img-element
                                 <img src={proxifyImg(profile.badge.imageUrl, imgCacheKey) ?? undefined} alt="" className="w-3 h-3" />
                             )}
                             {profile.badge.description}
                         </span>
                    )}
                </div>
              </div>
            </div>

            {/* Vibe Check */}
            {vibes && (
                <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-white/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/10 blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Vibe Check 2025</span>
                            <div className="h-[1px] flex-1 bg-gradient-to-r from-indigo-500/50 to-transparent" />
                        </div>
                        
                        <h3 className="text-2xl font-serif italic text-white/90 mb-2">{"'"}{vibes.tagline}{"'"}</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">{vibes.summary}</p>

                        <div className="flex flex-wrap gap-2 mt-5">
                            <span className="px-3 py-1 rounded-md text-xs font-semibold bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                                {vibes.archetype}
                            </span>
                            {vibes.vibe.map((v) => (
                                <span key={v} className="px-3 py-1 rounded-md text-xs font-medium bg-white/5 border border-white/10 text-zinc-400">
                                    {v}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Stats Grid */}
            <div className={cn("grid gap-6", pm?.linked ? "grid-cols-2" : "grid-cols-1")}>
                
                {/* Twitter Column */}
                <div className={cn(cardBaseClass, "p-6 flex flex-col gap-6")}>
                    <div className="flex items-center justify-between pb-4 border-b border-white/5">
                        <div className="flex items-center gap-2">
                             <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                             <span className="text-sm font-semibold text-zinc-300">X / Twitter</span>
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">{fmtNumber(profile?.followers)} Followers</div>
                    </div>

                    {/* Signal/Noise Visualization */}
                    <div>
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">Signal / Noise Ratio</div>
                        <BellCurve
                            percentile={signal}
                            avatarUrl={proxifyImg(profile?.profilePicture ?? null, imgCacheKey)}
                            logoUrl="/logo.png"
                        />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: "Posts", value: fmtNumber(profile?.statusesCount) },
                            { label: "Following", value: fmtNumber(profile?.following) },
                            { label: "Created", value: yearFromCreatedAt(profile?.createdAt) },
                        ].map((s) => (
                            <div key={s.label} className={miniStatClass}>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">{s.label}</div>
                                <div className="text-lg font-bold text-zinc-200 mt-1">{s.value}</div>
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
                                        <span className="flex items-center gap-1"><span className="text-red-400/80">♥</span> {fmtNumber(t.likeCount)}</span>
                                        <span className="flex items-center gap-1"><span className="text-blue-400/80">👁</span> {fmtNumber(t.viewCount)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Polymarket Column (Conditional) */}
                {pm?.linked && (
                    <div className={cn(cardBaseClass, "p-6 flex flex-col gap-6")}>
                        <div className="flex items-center justify-between pb-4 border-b border-white/5">
                             <div className="flex items-center gap-2">
                                <span className="text-xl">📈</span>
                                <span className="text-sm font-semibold text-zinc-300">Polymarket</span>
                             </div>
                             <div className="text-xs font-mono px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                                Rank #{pm.overall?.rank ?? "—"}
                             </div>
                        </div>

                        {/* Financial Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: "Total Volume", value: fmtMoney(pm.overall?.vol) },
                                { label: "Markets Traded", value: fmtNumber(pm.overall?.traded) },
                            ].map((s) => (
                                <div key={s.label} className={miniStatClass}>
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">{s.label}</div>
                                    <div className="text-lg font-bold text-zinc-200 mt-1">{s.value}</div>
                                </div>
                            ))}
                            <div className="col-span-2 p-4 rounded-xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/10 flex items-center justify-between">
                                <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">Net PnL</div>
                                <div className={cn(
                                    "text-2xl font-mono font-bold",
                                    (pm.overall?.pnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                                )}>
                                    {(pm.overall?.pnl ?? 0) >= 0 ? "+" : ""}{fmtMoney(pm.overall?.pnl)}
                                </div>
                            </div>
                        </div>

                        {/* Top Markets List */}
                        {Array.isArray(pm.topMarkets2025) && pm.topMarkets2025.length > 0 && (
                            <div className="flex-1 flex flex-col gap-3">
                                <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Top Markets (2025)</div>
                                <div className="flex flex-col gap-2">
                                    {pm.topMarkets2025.slice(0, 4).map((m: any) => {
                                        const pnl = Number(m.realizedPnl ?? 0);
                                        return (
                                            <div key={`${m.conditionId}-${m.realizedPnl}`} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                                <div className="text-xs text-zinc-300 truncate pr-4 font-medium">{m.title}</div>
                                                <div className={cn(
                                                    "text-xs font-mono font-bold whitespace-nowrap",
                                                    pnl >= 0 ? "text-green-400" : "text-red-400"
                                                )}>
                                                    {pnl >= 0 ? "+" : ""}{fmtMoney(pnl)}
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

            {/* Footer */}
            <div className="mt-8 flex items-center justify-between text-[10px] text-zinc-600 uppercase tracking-widest font-medium border-t border-white/5 pt-4">
                <span>Vatic Trading Analytics</span>
                <span>{new Date(data.debug.fetchedAtIso).toUTCString()}</span>
            </div>

          </div>
          {/* --- EXPORT AREA END --- */}

          {/* Action Buttons */}
          <div data-no-export className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              onClick={downloadPng}
              disabled={!data}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <span>↓</span> Download PNG
            </button>
            <button
              onClick={copyPng}
              disabled={!data}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <span>❐</span> Copy to Clipboard
            </button>
            <a
              href={tweetIntentUrl()}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1da1f2] text-white border border-[#1a91da] text-sm font-medium hover:bg-[#1a91da] transition-colors shadow-lg shadow-blue-900/20"
            >
              <span>🐦</span> Tweet Results
            </a>
          </div>
          <p className="text-center mt-4 text-xs text-zinc-500 max-w-md mx-auto">
             Note: Twitter API does not support auto-attaching images via link. Please download or copy the image first, then paste it into your tweet.
          </p>

        </div>
      )}
    </main>
  );
}