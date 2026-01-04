"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { BarChart3, ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LeaderboardPeriod } from "../actions";
import { getBadgeWars, type BadgeWarRow } from "./actions";

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
          // eslint-disable-next-line @next/next/no-img-element
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
      <div className="text-[11px] text-zinc-500 mt-1">Hover previews • Click pins</div>
    </div>
  );
}

export default function BadgeWarsPanel({
  initialOpen = true,
  initialPeriod = "all",
  initialRows = [],
  period: controlledPeriod,
  onPeriodChange,
  selectedBadge,
  onBadgeHover,
  onBadgeSelect,
}: {
  initialOpen?: boolean;
  initialPeriod?: LeaderboardPeriod;
  initialRows?: BadgeWarRow[];

  period?: LeaderboardPeriod;
  onPeriodChange?: (p: LeaderboardPeriod) => void;

  selectedBadge: string | null;
  onBadgeHover: (badge: string | null) => void;
  onBadgeSelect: (badge: string | null) => void;
}) {
  const [open, setOpen] = useState(initialOpen);

  const [localPeriod, setLocalPeriod] = useState<LeaderboardPeriod>(initialPeriod);
  const period = controlledPeriod ?? localPeriod;

  const [rows, setRows] = useState<BadgeWarRow[]>(initialRows);
  const [isPending, startTransition] = useTransition();

  const cacheKey = useMemo(() => `badgewars-${period}`, [period]);

  async function load(nextPeriod: LeaderboardPeriod) {
    startTransition(async () => {
      const data = await getBadgeWars({ period: nextPeriod, limit: 48, offset: 0 });
      setRows(data ?? []);

      if (onPeriodChange) onPeriodChange(nextPeriod);
      else setLocalPeriod(nextPeriod);

      onBadgeHover(null);
      onBadgeSelect(null);
    });
  }

  const chartData = useMemo(() => {
    const mapped = (rows ?? []).map((r) => ({
      ...r,
      value: r.pnl_sum ?? 0,
      badge_icon: proxifyImg((r as any).badge_icon_url, cacheKey),
      color: colorForBadge(r.badge_label),
    }));

    // Top-N + Other for readability
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

  function isClickable(label: string) {
    return label !== "Other";
  }

  function handleHover(label: string | null) {
    if (!label || !isClickable(label)) {
      onBadgeHover(null);
      return;
    }
    if (selectedBadge) return; // pinned wins
    onBadgeHover(label);
  }

  function handleClick(label: string | null) {
    if (!label || !isClickable(label)) return;

    if (selectedBadge === label) {
      onBadgeSelect(null);
      onBadgeHover(null);
      return;
    }
    onBadgeSelect(label);
    onBadgeHover(null);
  }

  return (
    <section className="w-full">
      <div className="relative bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden">
        {/* Header (dropdown) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full px-5 py-4 border-b border-white/5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
        >
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
                Hover to preview leaderboard • Click to pin • “No badge” included
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedBadge ? (
              <span className="text-xs text-zinc-300 font-mono px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10">
                pinned: {selectedBadge}
              </span>
            ) : null}

            <div className="text-xs text-zinc-500 font-mono">{isPending ? "Loading..." : `${rows.length} badges`}</div>
            <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", open ? "rotate-180" : "")} />
          </div>
        </button>

        {open ? (
          <>
            {/* Controls */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((p) => {
                  const active = period === p.key;
                  return (
                    <Button
                      key={p.key}
                      type="button"
                      variant="outline"
                      onClick={() => load(p.key)}
                      disabled={isPending}
                      className={cn(
                        "h-9 px-4 rounded-xl border text-sm",
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

              {selectedBadge ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    onBadgeSelect(null);
                    onBadgeHover(null);
                  }}
                  className="h-9 px-3 rounded-xl bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              ) : null}
            </div>

            {/* Chart */}
            <div className="px-5 py-5">
              <div className="relative h-[360px] w-full rounded-2xl overflow-hidden">
                <div className="absolute -top-24 -right-24 w-[320px] h-[320px] bg-indigo-500/10 blur-[90px] pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-[320px] h-[320px] bg-cyan-400/10 blur-[90px] pointer-events-none" />

                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 16, right: 16, left: 0, bottom: 72 }}
                    onMouseMove={(state: any) => handleHover(state?.activeLabel ?? null)}
                    onMouseLeave={() => handleHover(null)}
                    onClick={(state: any) => handleClick(state?.activeLabel ?? null)}
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
                    <YAxis
                      tick={{ fill: "rgba(161,161,170,0.9)", fontSize: 11 }}
                      tickFormatter={(v) => fmtMoney(v)}
                    />
                    <Tooltip content={<TooltipContent />} />

                    <Bar
                      dataKey="value"
                      radius={[10, 10, 4, 4]}
                      minPointSize={6} // helps visibility for tiny bars, but click works anywhere now anyway
                      isAnimationActive={false}
                    >
                      {chartData.map((d: any) => (
                        <Cell
                          key={d.badge_label}
                          fill={d.color}
                          opacity={selectedBadge && selectedBadge !== d.badge_label ? 0.25 : 1}
                          style={{ cursor: isClickable(d.badge_label) ? "pointer" : "default" }}
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
            </div>
          </>
        ) : null}

        {/* Loading overlay */}
        {isPending ? (
          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center">
            <div className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 text-sm">
              Loading…
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}