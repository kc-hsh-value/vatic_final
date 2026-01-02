// app/(main)/address/[slug]/pnl-chart.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  AreaSeries,
  Chart,
  TimeScale,
  TimeScaleFitContentTrigger,
} from "lightweight-charts-react-components";

import type {
  AreaSeriesOptions,
  DeepPartial,
  MouseEventParams,
  Time,
} from "lightweight-charts";

// ---------- utils ----------
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function fmtMoney(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "" : "-";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtDateTimeFromSec(tSec?: number | null) {
  if (!tSec) return "—";
  const d = new Date(tSec * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PnlPoint = { t: number; p: number };

type TooltipState = {
  show: boolean;
  x: number;
  y: number;
  timeSec: number | null;
  value: number | null;
};

function sameTooltip(a: TooltipState, b: TooltipState) {
  return (
    a.show === b.show &&
    a.x === b.x &&
    a.y === b.y &&
    a.timeSec === b.timeSec &&
    a.value === b.value
  );
}

// ---------- chart options ----------
const areaOptions: DeepPartial<AreaSeriesOptions> = {
  lineWidth: 2,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: false,
  topColor: "rgba(99, 102, 241, 0.22)", // indigo-ish
  bottomColor: "rgba(99, 102, 241, 0.00)",
  lineColor: "rgba(129, 140, 248, 0.95)",
};

export default function PnlChart({
  points,
  height = 150,
  className,
}: {
  points: PnlPoint[];
  height?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const series = useMemo(() => {
    const arr = Array.isArray(points) ? points : [];
    // lightweight-charts expects UTCTimestamp in seconds.
    return arr
      .filter((x) => Number.isFinite(x?.t) && Number.isFinite(x?.p))
      .map((x) => ({
        time: x.t as Time,
        value: Number(x.p),
      }));
  }, [points]);

  const [tt, setTt] = useState<TooltipState>({
    show: false,
    x: 0,
    y: 0,
    timeSec: null,
    value: null,
  });

  // RAF throttle (prevents infinite update depth / excessive updates on hover)
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<TooltipState | null>(null);

  const flushTooltip = useCallback(() => {
    rafRef.current = null;
    const next = pendingRef.current;
    if (!next) return;
    setTt((prev) => (sameTooltip(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onCrosshairMove = useCallback(
    (param: MouseEventParams<Time>) => {
      const container = containerRef.current;
      if (!container) return;

      const point = param.point;

      // Hide tooltip when leaving chart / invalid
      if (!param.time || !point || point.x < 0 || point.y < 0) {
        pendingRef.current = { show: false, x: 0, y: 0, timeSec: null, value: null };
        if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushTooltip);
        return;
      }

      // Single-series: pick the first numeric value from the seriesData map
      let v: number | null = null;
      for (const [, datum] of param.seriesData) {
        const anyDatum = datum as any;
        if (anyDatum?.value != null && Number.isFinite(Number(anyDatum.value))) {
          v = Number(anyDatum.value);
          break;
        }
      }

      const timeSec = typeof param.time === "number" ? param.time : null;

      // Tooltip positioning
      const padding = 12;
      const w = 200;
      const h = 64;

      const x = Math.min(
        Math.max(point.x + padding, padding),
        container.clientWidth - w - padding
      );
      const y = Math.min(
        Math.max(point.y - h - padding, padding),
        container.clientHeight - h - padding
      );

      pendingRef.current = { show: true, x, y, timeSec, value: v };
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushTooltip);
    },
    [flushTooltip]
  );

  const chartOptions = useMemo(
    () => ({
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(161,161,170,0.9)", // zinc-400-ish
        fontSize: 11,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.18, bottom: 0.12 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false,
        secondsVisible: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: {
        vertLine: {
          visible: true,
          labelVisible: false,
          width: 1,
          style: 0,
          color: "rgba(255,255,255,0.15)",
        },
        horzLine: {
          visible: false,
          labelVisible: false,
        },
      },
      handleScroll: false,
      handleScale: false,
    }),
    []
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full rounded-xl bg-zinc-950/35 border border-white/10 overflow-hidden",
        className
      )}
      style={{ height }}
    >
      {series.length === 0 ? (
        <div className="h-full w-full flex items-center justify-center text-sm text-zinc-500">
          No PnL data
        </div>
      ) : (
        <>
          <Chart
            options={chartOptions as any}
            containerProps={{ style: { width: "100%", height: "100%", position: "relative" } }}
            onCrosshairMove={onCrosshairMove as any}
          >
            <AreaSeries data={series as any} options={areaOptions as any} />
            <TimeScale>
              <TimeScaleFitContentTrigger deps={[series.length]} />
            </TimeScale>
          </Chart>

          {/* Tooltip */}
          <div
            className={cn(
              "absolute z-20 pointer-events-none transition-opacity",
              tt.show ? "opacity-100" : "opacity-0"
            )}
            style={{ left: tt.x, top: tt.y, width: 200 }}
          >
            <div className="rounded-xl border border-white/10 bg-zinc-950/90 backdrop-blur px-3 py-2 shadow-xl">
              <div className="text-[11px] text-zinc-400">PnL</div>
              <div
                className={cn(
                  "text-sm font-mono font-bold",
                  (tt.value ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                )}
              >
                {tt.value != null ? fmtMoney(tt.value) : "—"}
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {fmtDateTimeFromSec(tt.timeSec)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}