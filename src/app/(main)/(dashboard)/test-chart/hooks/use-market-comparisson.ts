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

// You can expand this later (generate HSL colors, etc.)
export const LINE_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#14b8a6",
  "#f43f5e",
];

export type ChartPoint = { time: Time; value: number };

export type RenderedSeriesItem = {
  market: any;
  ref: React.RefObject<SeriesApiRef<"Line"> | null>;
  color: string;
  data: ChartPoint[];
};

type TooltipRow = { color: string; label: string; value: number };

export type ChartTooltipState = {
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

function getLastValueAtOrBefore(data: ChartPoint[], t: Time) {
  if (!data?.length) return null;
  const target = typeof t === "number" ? t : NaN;
  if (!Number.isFinite(target)) return null;

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

function uniqueIds(ids: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function useMarketComparison(params: {
  eventData: UnifiedEvent | null;
  selectedRange: TimeRange;
  marketIds: string[];
}) {
  const { eventData, selectedRange } = params;
  const marketIds = React.useMemo(() => uniqueIds(params.marketIds), [params.marketIds]);

  const chartRef = React.useRef<HTMLDivElement>(null);

  // Keep stable refs; supports up to 10 lines by default
  const seriesRefs = React.useMemo(
    () =>
      Array.from({ length: Math.max(10, marketIds.length) }, () =>
        React.createRef<SeriesApiRef<"Line"> | null>()
      ),
    // Only re-create the pool if we need more slots
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketIds.length > 10 ? marketIds.length : 10]
  );

  const [loading, setLoading] = React.useState(false);
  const [historyMap, setHistoryMap] = React.useState<Record<string, ChartPoint[]>>({});

  const [tooltip, setTooltip] = React.useState<ChartTooltipState>({
    show: false,
    x: 0,
    y: 0,
    timeLabel: "",
    rows: [],
  });

  const lastTooltipKeyRef = React.useRef("");
  const rafPendingRef = React.useRef(false);
  const latestParamRef = React.useRef<any>(null);

  const selectedMarkets = React.useMemo(() => {
    if (!eventData) return [];
    const map = new Map(eventData.markets.map((m) => [m.id, m]));
    return marketIds.map((id) => map.get(id)).filter(Boolean) as any[];
  }, [eventData, marketIds]);

  const renderedSeries: RenderedSeriesItem[] = React.useMemo(() => {
    if (!eventData) return [];

    return selectedMarkets
      .map((market, i) => {
        const raw = historyMap[market.id];
        const hasData = Array.isArray(raw) && raw.length > 0;

        return {
          market,
          hasData,
          color: LINE_COLORS[i % LINE_COLORS.length],
          ref: seriesRefs[i],
          data: hasData ? [...raw].sort((a, b) => (a.time as number) - (b.time as number)) : [],
        };
      })
      .filter((x: any) => x.hasData) as RenderedSeriesItem[];
  }, [eventData, selectedMarkets, historyMap, seriesRefs]);

  const onCrosshairMove = React.useCallback(
    (param: any) => {
      latestParamRef.current = param;
      if (rafPendingRef.current) return;
      rafPendingRef.current = true;

      requestAnimationFrame(() => {
        rafPendingRef.current = false;

        const p = latestParamRef.current;
        const container = chartRef.current;
        if (!container) return;

        if (!p?.point || p.point.x == null || p.point.y == null || p.time == null) {
          lastTooltipKeyRef.current = "";
          setTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
          return;
        }

        const timeLabel = fmtTime(p.time);
        const rows: TooltipRow[] = [];

        for (let i = 0; i < renderedSeries.length; i++) {
          const { market, ref, color } = renderedSeries[i];
          const api = ref.current?.api();
          if (!api) continue;

          const sd = p.seriesData?.get(api) as LineData | undefined;

          let v: number | null = null;
          if (typeof sd?.value === "number" && Number.isFinite(sd.value)) {
            v = sd.value;
          } else {
            const seriesData = historyMap[market.id];
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
          lastTooltipKeyRef.current = "";
          setTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
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

        if (lastTooltipKeyRef.current === key) return;
        lastTooltipKeyRef.current = key;

        setTooltip({ show: true, x, y, timeLabel, rows });
      });
    },
    [renderedSeries, historyMap]
  );

  // Fetch histories for current selected markets
  React.useEffect(() => {
    if (!eventData) return;
    if (!marketIds.length) {
      setHistoryMap({});
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);
      setHistoryMap({}); // clear old immediately

      const { interval, fidelity } = RANGE_CONFIG[selectedRange];

      try {
        const results = await Promise.all(
          selectedMarkets.map(async (m) => {
            const hist = await fetchMarketHistory(m.mainOutcome.tokenId, interval, fidelity);
            return { id: m.id, data: processChartData(hist) };
          })
        );

        if (cancelled) return;

        const map: Record<string, ChartPoint[]> = {};
        for (const r of results) map[r.id] = r.data || [];
        setHistoryMap(map);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [eventData, selectedRange, marketIds.join("|")]); // join is fine here; ids are small

  const fitDep = React.useMemo(() => {
    return marketIds.reduce((sum, id) => sum + (historyMap[id]?.length || 0), 0);
  }, [marketIds, historyMap]);

  return {
    loading,
    renderedSeries,
    tooltip,
    onCrosshairMove,
    chartRef,
    fitDep,
  };
}