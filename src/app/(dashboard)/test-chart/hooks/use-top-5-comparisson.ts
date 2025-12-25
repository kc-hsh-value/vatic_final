"use client";

import * as React from "react";

import type { SeriesApiRef } from "lightweight-charts-react-components";
import type { LineData, Time } from "lightweight-charts";
import { UnifiedEvent } from "../normalize-markets";
import { fetchMarketHistory } from "../actions";


export type TimeRange = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

export const RANGE_CONFIG: Record<TimeRange, { interval: string; fidelity: number }> = {
  "1H": { interval: "1h", fidelity: 0.016666 },
  "6H": { interval: "6h", fidelity: 0.016666 },
  "1D": { interval: "1d", fidelity: 0.016666 },
  "1W": { interval: "1w", fidelity: 5 },
  "1M": { interval: "1m", fidelity: 10 },
  "ALL": { interval: "max", fidelity: 720 },
};

export const LINE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7"];

export type ChartPoint = { time: Time; value: number };

export type Top5RenderedItem = {
  market: any;
  ref: React.RefObject<SeriesApiRef<"Line"> | null>;
  color: string;
  data: ChartPoint[];
};

type TooltipRow = { color: string; label: string; value: number };

export type TopTooltipState = {
  show: boolean;
  x: number;
  y: number;
  timeLabel: string;
  rows: TooltipRow[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtTime(t: any) {
  if (!t) return "";
  if (typeof t === "number") return new Date(t * 1000).toLocaleString();
  if (typeof t === "object" && "year" in t) {
    const d = new Date(t.year, t.month - 1, t.day);
    return d.toLocaleDateString();
  }
  return String(t);
}

// last value at or before time (binary search)
function getLastValueAtOrBefore(data: ChartPoint[], t: Time) {
  if (!data?.length) return null;
  const target = typeof t === "number" ? t : NaN;
  if (typeof target !== "number" || !Number.isFinite(target)) return null;

  let lo = 0,
    hi = data.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const mt = data[mid].time as number;
    if (mt <= target) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? data[ans].value : null;
}

function processChartData(history: any[]): ChartPoint[] {
  if (!history || history.length === 0) return [];

  const mapped = history
    .map((p: any) => ({
      time: Number(p.t) as Time,
      value: Number(p.p),
    }))
    .filter((p) => !isNaN(Number(p.time)) && !isNaN(p.value));

  mapped.sort((a, b) => (a.time as number) - (b.time as number));

  const unique: ChartPoint[] = [];
  let lastTime: number | null = null;

  for (const point of mapped) {
    const t = point.time as number;
    if (t !== lastTime) {
      unique.push(point);
      lastTime = t;
    } else {
      unique[unique.length - 1] = point;
    }
  }

  return unique;
}

export function useTop5Comparison(params: {
  eventData: UnifiedEvent | null;
  selectedRange: TimeRange;
}) {
  const { eventData, selectedRange } = params;

  const topChartRef = React.useRef<HTMLDivElement>(null);
  const topSeriesRefs: Array<React.RefObject<SeriesApiRef<"Line"> | null>> = [
    React.useRef(null),
    React.useRef(null),
    React.useRef(null),
    React.useRef(null),
    React.useRef(null),
  ];

  const [loadingTop5, setLoadingTop5] = React.useState(false);
  const [top5History, setTop5History] = React.useState<Record<string, ChartPoint[]>>({});

  const [topTooltip, setTopTooltip] = React.useState<TopTooltipState>({
    show: false,
    x: 0,
    y: 0,
    timeLabel: "",
    rows: [],
  });

  // RAF coalescing + dedupe
  const lastTopTooltipKeyRef = React.useRef("");
  const rafPendingRef = React.useRef(false);
  const latestParamRef = React.useRef<any>(null);

  const top5Rendered: Top5RenderedItem[] = React.useMemo(() => {
    if (!eventData) return [];
    const top5 = eventData.markets.slice(0, 5);

    return top5
      .map((market, i) => {
        const raw = top5History[market.id];
        const hasData = Array.isArray(raw) && raw.length > 0;

        return {
          market,
          hasData,
          color: LINE_COLORS[i],
          ref: topSeriesRefs[i],
          data: hasData ? [...raw].sort((a, b) => (a.time as number) - (b.time as number)) : [],
        };
      })
      .filter((x) => x.hasData) as Top5RenderedItem[];
  }, [eventData, top5History]);

  const onTopCrosshairMove = React.useCallback(
    (param: any) => {
      latestParamRef.current = param;
      if (rafPendingRef.current) return;
      rafPendingRef.current = true;

      requestAnimationFrame(() => {
        rafPendingRef.current = false;

        const p = latestParamRef.current;
        const container = topChartRef.current;
        if (!container) return;

        if (!p?.point || p.point.x == null || p.point.y == null || p.time == null) {
          lastTopTooltipKeyRef.current = "";
          setTopTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
          return;
        }

        const timeLabel = fmtTime(p.time);
        const rows: TooltipRow[] = [];

        for (let i = 0; i < top5Rendered.length; i++) {
          const { market, ref, color } = top5Rendered[i];
          const api = ref.current?.api();
          if (!api) continue;

          const sd = p.seriesData?.get(api) as LineData | undefined;

          let v: number | null = null;
          if (typeof sd?.value === "number" && Number.isFinite(sd.value)) {
            v = sd.value;
          } else {
            const seriesData = top5History[market.id];
            if (Array.isArray(seriesData) && seriesData.length) {
              v = getLastValueAtOrBefore(seriesData, p.time);
            }
          }
          if (v == null) continue;

          rows.push({
            color,
            label: market.groupItemTitle || market.title || market.id,
            value: v,
          });
        }

        if (rows.length === 0) {
          lastTopTooltipKeyRef.current = "";
          setTopTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
          return;
        }

        rows.sort((a, b) => b.value - a.value);

        const rect = container.getBoundingClientRect();
        const tooltipW = 260;
        const tooltipH = 30 + rows.length * 18;

        const x = clamp(p.point.x + 12, 0, rect.width - tooltipW);
        const y = clamp(p.point.y + 12, 0, rect.height - tooltipH);

        const key =
          `${timeLabel}|${Math.round(x)}|${Math.round(y)}|` +
          rows.map((r) => `${r.label}:${r.value.toFixed(4)}`).join(",");

        if (lastTopTooltipKeyRef.current === key) return;
        lastTopTooltipKeyRef.current = key;

        setTopTooltip({ show: true, x, y, timeLabel, rows });
      });
    },
    [top5Rendered, top5History]
  );

  // fetch top 5 history when range/event changes
  React.useEffect(() => {
    if (!eventData || eventData.markets.length === 0) return;
    let cancelled = false;

    async function fetchTop5() {
      setLoadingTop5(true);
      setTop5History({});
      if(!eventData || eventData.markets.length === 0) {
        setLoadingTop5(false);
        return;
      }
      const top5 = eventData.markets.slice(0, 5);
      const { interval, fidelity } = RANGE_CONFIG[selectedRange];

      try {
        const results = await Promise.all(
          top5.map(async (m) => {
            const hist = await fetchMarketHistory(m.mainOutcome.tokenId, interval, fidelity);
            return { id: m.id, data: processChartData(hist) };
          })
        );

        if (cancelled) return;

        const historyMap: Record<string, ChartPoint[]> = {};
        for (const r of results) historyMap[r.id] = r.data || [];
        setTop5History(historyMap);
      } finally {
        if (!cancelled) setLoadingTop5(false);
      }
    }

    fetchTop5();
    return () => {
      cancelled = true;
    };
  }, [eventData, selectedRange]);

  const fitDep = React.useMemo(() => {
    if (!eventData) return 0;
    return eventData.markets.slice(0, 5).reduce((sum, m) => sum + (top5History[m.id]?.length || 0), 0);
  }, [eventData, top5History]);

  return {
    loadingTop5,
    top5Rendered,
    topTooltip,
    onTopCrosshairMove,
    topChartRef,
    fitDep,
  };
}