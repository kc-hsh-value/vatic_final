"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Chart,
  ChartApiRef,
  LineSeries,
  Markers,
  TimeScale,
  TimeScaleApiRef,
  TimeScaleFitContentTrigger,
  type SeriesApiRef,
} from "lightweight-charts-react-components";
import type { LineData, Time, SeriesMarker } from "lightweight-charts";
import { ColorType } from "lightweight-charts";

import { fetchEventCorrelationsPage, fetchEventData, fetchMarketHistory } from "./actions";
import { normalizeEvent, UnifiedEvent } from "./normalize-markets";
import type { Correlation } from "./types";

import { Top5ComparisonPanel } from "./components/top-5/top-5-comparisson-panel";
import { RANGE_CONFIG, type TimeRange } from "./hooks/use-top-5-comparisson";

// --- MOCK HOLDERS DATA ---
const MOCK_HOLDERS = [
  { rank: 1, user: "0x7a...8b21", name: "WhaleAlert", shares: 450000, value: 229500, side: "Yes" },
  { rank: 2, user: "0x1c...99a2", name: "PolymarketGod", shares: 120000, value: 61200, side: "Yes" },
  { rank: 3, user: "0x8f...11b0", name: "HedgeFund_X", shares: 85000, value: 43350, side: "No" },
  { rank: 4, user: "0x33...44cc", name: "Anon_User", shares: 50000, value: 25500, side: "Yes" },
  { rank: 5, user: "0x99...aa11", name: "PredictionBot", shares: 42000, value: 21420, side: "No" },
  { rank: 6, user: "0x11...22dd", name: "Sniper", shares: 15000, value: 7650, side: "Yes" },
  { rank: 7, user: "0x44...55ee", name: "RetailTrader", shares: 5000, value: 2550, side: "Yes" },
  { rank: 8, user: "0x22...11ff", name: "Momentum_Algo", shares: 4200, value: 2100, side: "No" },
];

type NewsItem = {
  tweetId: string;
  tweet: Correlation["tweet"];
  created_at_utc: string;
  best: Correlation;
  marketIds: string[];
};

// ----- helpers -----
type ChartPoint = { time: Time; value: number };

function processChartData(history: any[]): ChartPoint[] {
  if (!history || history.length === 0) return [];

  const mapped = history
    .map((p: any) => ({
      time: Number(p.t) as Time,
      value: Number(p.p),
    }))
    .filter((p) => !isNaN(Number(p.time)) && !isNaN(Number(p.value)));

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
    } else hi = mid - 1;
  }
  return ans >= 0 ? data[ans].value : null;
}

// exact match (our markers are snapped to series timestamps so this usually hits)
function getValueAtExactTime(data: ChartPoint[], tSec: number): number | null {
  if (!data?.length) return null;
  let lo = 0,
    hi = data.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const mt = data[mid].time as number;
    if (mt === tSec) return data[mid].value;
    if (mt < tSec) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

// --- marker helpers ---
function parseUtcToSec(s: string | null | undefined): number | null {
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function snapToNearestSeriesTime(series: ChartPoint[], targetSec: number): number | null {
  if (!series.length) return null;

  let lo = 0;
  let hi = series.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = series[mid].time as number;

    if (t === targetSec) return t;
    if (t < targetSec) lo = mid + 1;
    else hi = mid - 1;
  }

  const left = hi >= 0 ? (series[hi].time as number) : null;
  const right = lo < series.length ? (series[lo].time as number) : null;

  if (left == null) return right;
  if (right == null) return left;

  return Math.abs(targetSec - left) <= Math.abs(right - targetSec) ? left : right;
}

/**
 * Find nearest signal time to `target` within `maxDeltaSec`.
 * (time-axis magnetic)
 */
function nearestSignalTimeWithin(signalTimesSorted: number[], target: number, maxDeltaSec: number): number | null {
  if (!signalTimesSorted.length) return null;

  let lo = 0;
  let hi = signalTimesSorted.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = signalTimesSorted[mid];
    if (v === target) return v;
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }

  const left = hi >= 0 ? signalTimesSorted[hi] : null;
  const right = lo < signalTimesSorted.length ? signalTimesSorted[lo] : null;

  let best: number | null = null;
  let bestDelta = Infinity;

  if (left != null) {
    const d = Math.abs(target - left);
    if (d < bestDelta) {
      bestDelta = d;
      best = left;
    }
  }
  if (right != null) {
    const d = Math.abs(target - right);
    if (d < bestDelta) {
      bestDelta = d;
      best = right;
    }
  }

  return bestDelta <= maxDeltaSec ? best : null;
}

/**
 * Binary-search the index of a timestamp in the series.
 * Returns nearest index if not exact (should be exact since we snap).
 */
function indexNearestTime(series: ChartPoint[], tSec: number): number | null {
  if (!series.length) return null;

  let lo = 0;
  let hi = series.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const mt = series[mid].time as number;
    if (mt === tSec) return mid;
    if (mt < tSec) lo = mid + 1;
    else hi = mid - 1;
  }

  const left = hi >= 0 ? hi : null;
  const right = lo < series.length ? lo : null;

  if (left == null) return right;
  if (right == null) return left;

  const lsec = series[left].time as number;
  const rsec = series[right].time as number;

  return Math.abs(tSec - lsec) <= Math.abs(rsec - tSec) ? left : right;
}

/**
 * Measure the actual drawable x-span for the chart by grabbing its canvas.
 * This avoids including price-scale widths / internal padding.
 */
function getCanvasSpan(container: HTMLDivElement): { left: number; width: number } | null {
  const containerRect = container.getBoundingClientRect();
  const canvas = container.querySelector("canvas");
  if (!canvas) return null;

  const canvasRect = canvas.getBoundingClientRect();
  const left = canvasRect.left - containerRect.left;
  const width = canvasRect.width;

  if (!Number.isFinite(left) || !Number.isFinite(width) || width <= 10) return null;
  return { left, width };
}

type MainChartMode = "TOP5" | "COMPARE";

const COMPARE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7", "#06b6d4", "#f97316", "#14b8a6"];

type TooltipRow = { color: string; label: string; value: number };
type CompareTooltipState = {
  show: boolean;
  x: number;
  y: number;
  timeLabel: string;
  rows: TooltipRow[];
};

type ExpandedSignalTooltipState = {
  show: boolean;
  x: number;
  y: number;
  timeLabel: string;
  header: string;
  body: string;
  meta?: string;
};

export default function TestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [eventData, setEventData] = useState<UnifiedEvent | null>(null);

  // UI State
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1D");
  const [activeTab, setActiveTab] = useState<"CHART" | "ORDERBOOK" | "HOLDERS">("CHART");
  const [expandedMarketId, setExpandedMarketId] = useState<string | null>(null);

  // toggle signals
  const [showExpandedSignals, setShowExpandedSignals] = useState(true);

  // hovering a tweet highlights time on expanded chart
  const [hoveredNewsTimeSec, setHoveredNewsTimeSec] = useState<number | null>(null);

  // Keep chart mounted briefly after closing to avoid "disposed" resize/draw races
  const [expandedMountedId, setExpandedMountedId] = useState<string | null>(null);
  useEffect(() => {
    if (expandedMarketId) setExpandedMountedId(expandedMarketId);
  }, [expandedMarketId]);

  // Main chart (URL-driven)
  const [mainChartMode, setMainChartMode] = useState<MainChartMode>("TOP5");
  const [mainChartMarketIds, setMainChartMarketIds] = useState<string[]>([]);
  const [loadingMainChart, setLoadingMainChart] = useState(false);

  // Multi-series main chart data
  const [mainChartHistoryMap, setMainChartHistoryMap] = useState<Record<string, ChartPoint[]>>({});

  // Main chart tooltip (for COMPARE)
  const [compareTooltip, setCompareTooltip] = useState<CompareTooltipState>({
    show: false,
    x: 0,
    y: 0,
    timeLabel: "",
    rows: [],
  });

  // chart ref + series refs for crosshair reads
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const seriesRefMap = useRef<Record<string, React.RefObject<SeriesApiRef<"Line"> | null>>>({});

  function getSeriesRef(id: string) {
    if (!seriesRefMap.current[id]) {
      seriesRefMap.current[id] = React.createRef<SeriesApiRef<"Line">>();
    }
    return seriesRefMap.current[id]!;
  }

  // Expanded chart container (for tooltip placement + hover line overlay)
  const expandedChartContainerRef = useRef<HTMLDivElement>(null);

  // Expanded LINE series ref (priceToCoordinate)
  const expandedLineSeriesRef = useRef<SeriesApiRef<"Line"> | null>(null);

  // Expanded chart lifecycle guard + RAF cancel
  const expandedAliveRef = React.useRef(false);
  const expandedRafRef = React.useRef<number | null>(null);

  useEffect(() => {
    expandedAliveRef.current = Boolean(expandedMarketId && activeTab === "CHART");
    return () => {
      expandedAliveRef.current = false;
      if (expandedRafRef.current != null) {
        cancelAnimationFrame(expandedRafRef.current);
        expandedRafRef.current = null;
      }
    };
  }, [expandedMarketId, activeTab]);

  // Expanded tooltip state (ONLY shows on tweet timestamps)
  const [expandedSignalTooltip, setExpandedSignalTooltip] = useState<ExpandedSignalTooltipState>({
    show: false,
    x: 0,
    y: 0,
    timeLabel: "",
    header: "",
    body: "",
    meta: "",
  });

  // Data State
  const [expandedHistory, setExpandedHistory] = useState<any[]>([]);

  // -------------------------
  // URL <-> State Sync
  // -------------------------
  const lastAppliedFromUrlRef = useRef<string>("");
  const lastPushedToUrlRef = useRef<string>("");

  function normalizeRange(raw: string | null): TimeRange {
    const allowed = Object.keys(RANGE_CONFIG) as TimeRange[];
    return raw && (allowed as string[]).includes(raw) ? (raw as TimeRange) : "1D";
  }

  function parseCompare(raw: string | null): string[] {
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // URL -> state
  useEffect(() => {
    const r = normalizeRange(searchParams.get("r"));
    const compare = parseCompare(searchParams.get("compare"));

    const key = `r=${r}&compare=${compare.join(",")}`;
    if (lastAppliedFromUrlRef.current === key) return;
    lastAppliedFromUrlRef.current = key;

    setSelectedRange(r);
    setMainChartMarketIds(compare);
    setMainChartMode(compare.length ? "COMPARE" : "TOP5");
  }, [searchParams]);

  // state -> URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("r", selectedRange);

    if (mainChartMarketIds.length) params.set("compare", mainChartMarketIds.join(","));
    else params.delete("compare");

    const next = params.toString();
    if (lastPushedToUrlRef.current === next) return;
    lastPushedToUrlRef.current = next;

    router.replace(`?${next}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRange, mainChartMarketIds, router]);

  const top5MarketIds = useMemo(() => {
    if (!eventData) return [];
    return eventData.markets.slice(0, 5).map((m) => m.id);
  }, [eventData]);

  const newsMarketIds = useMemo(() => {
    if (expandedMarketId) return [expandedMarketId];
    if (mainChartMarketIds.length) return mainChartMarketIds;
    return top5MarketIds;
  }, [expandedMarketId, mainChartMarketIds, top5MarketIds]);

  const PAGE_SIZE = 50;

  const [newsRows, setNewsRows] = useState<Correlation[]>([]);
  const [newsPage, setNewsPage] = useState(0);
  const [newsHasMore, setNewsHasMore] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingMoreNews, setLoadingMoreNews] = useState(false);

  const newsScopeKey = useMemo(() => newsMarketIds.slice().sort().join(","), [newsMarketIds]);

  useEffect(() => {
    if (!eventData) return;
    if (newsMarketIds.length === 0) {
      setNewsRows([]);
      setNewsHasMore(false);
      return;
    }

    let cancelled = false;

    async function loadFirstPage() {
      setLoadingNews(true);
      setNewsPage(0);
      setNewsRows([]);

      const { rows, hasMore } = await fetchEventCorrelationsPage(newsMarketIds, 0, PAGE_SIZE);

      if (cancelled) return;
      setNewsRows(rows);
      setNewsHasMore(hasMore);
      setLoadingNews(false);
    }

    loadFirstPage();
    return () => {
      cancelled = true;
    };
  }, [newsScopeKey, eventData, newsMarketIds]);

  const loadMoreNews = async () => {
    if (loadingMoreNews || loadingNews || !newsHasMore) return;

    setLoadingMoreNews(true);
    const nextPage = newsPage + 1;

    const { rows, hasMore } = await fetchEventCorrelationsPage(newsMarketIds, nextPage, PAGE_SIZE);

    setNewsRows((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      const merged = [...prev];
      for (const r of rows) if (!seen.has(r.id)) merged.push(r);
      return merged;
    });

    setNewsPage(nextPage);
    setNewsHasMore(hasMore);
    setLoadingMoreNews(false);
  };

  // -------------------------
  // Fetch: event only
  // -------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // const raw = await fetchEventData("who-will-trump-nominate-as-fed-chair");
      const raw = await fetchEventData("who-will-be-the-first-to-leave-the-trump-cabinet");
      if (!raw || cancelled) return;

      const clean = normalizeEvent([raw]);
      if (!cancelled) setEventData(clean);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------
  // Fetch: expanded row chart
  // -------------------------
  useEffect(() => {
    if (!expandedMarketId || !eventData) return;

    let cancelled = false;

    async function fetchIndividual() {
      setExpandedHistory([]);
      if(!eventData) return;
      const market = eventData.markets.find((m) => m.id === expandedMarketId);
      if (!market) return;

      const { interval, fidelity } = RANGE_CONFIG[selectedRange];
      const hist = await fetchMarketHistory(market.mainOutcome.tokenId, interval, fidelity);

      if (cancelled) return;
      setExpandedHistory(processChartData(hist));
      setExpandedSignalTooltip((t) => (t.show ? { ...t, show: false } : t));
      setHoveredNewsTimeSec(null);
    }

    fetchIndividual();
    return () => {
      cancelled = true;
    };
  }, [expandedMarketId, eventData, selectedRange]);

  // -------------------------
  // Fetch: main COMPARE chart histories (1..N)
  // -------------------------
  useEffect(() => {
    if (mainChartMode !== "COMPARE" || !eventData || mainChartMarketIds.length === 0) {
      setMainChartHistoryMap({});
      setLoadingMainChart(false);
      return;
    }

    let cancelled = false;

    async function fetchCompare() {
      setLoadingMainChart(true);
      setMainChartHistoryMap({});
      setCompareTooltip((t) => (t.show ? { ...t, show: false } : t));

      const { interval, fidelity } = RANGE_CONFIG[selectedRange];
      if(!eventData) return;
      const selectedMarkets = mainChartMarketIds
        .map((id) => eventData.markets.find((m) => m.id === id))
        .filter(Boolean) as NonNullable<(typeof eventData.markets)[number]>[];

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
        setMainChartHistoryMap(map);
      } finally {
        if (!cancelled) setLoadingMainChart(false);
      }
    }

    fetchCompare();
    return () => {
      cancelled = true;
    };
  }, [mainChartMode, mainChartMarketIds, eventData, selectedRange]);

  // Renderable compare series
  const compareRendered = useMemo(() => {
    if (!eventData || mainChartMode !== "COMPARE") return [];

    return mainChartMarketIds
      .map((id, idx) => {
        const market = eventData.markets.find((m) => m.id === id);
        if (!market) return null;

        const data = mainChartHistoryMap[id] || [];
        const color = COMPARE_COLORS[idx % COMPARE_COLORS.length];
        const ref = getSeriesRef(id);

        return { id, market, data, color, ref };
      })
      .filter(Boolean) as Array<{
      id: string;
      market: any;
      data: ChartPoint[];
      color: string;
      ref: React.RefObject<SeriesApiRef<"Line"> | null>;
    }>;
  }, [eventData, mainChartMode, mainChartMarketIds, mainChartHistoryMap]);

  // -------------------------
  // Main chart tooltip (COMPARE)
  // -------------------------
  const lastTooltipKeyRef = useRef("");
  const rafPendingRef = useRef(false);
  const latestParamRef = useRef<any>(null);

  const onCompareCrosshairMove = React.useCallback(
    (param: any) => {
      latestParamRef.current = param;
      if (rafPendingRef.current) return;
      rafPendingRef.current = true;

      requestAnimationFrame(() => {
        rafPendingRef.current = false;

        const p = latestParamRef.current;
        const container = mainChartContainerRef.current;
        if (!container) return;

        if (!p?.point || p.point.x == null || p.point.y == null || p.time == null) {
          lastTooltipKeyRef.current = "";
          setCompareTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
          return;
        }

        const timeLabel = fmtTime(p.time);
        const rows: TooltipRow[] = [];

        for (const s of compareRendered) {
          const api = s.ref.current?.api();
          if (!api) continue;

          const sd = p.seriesData?.get(api) as LineData | undefined;

          let v: number | null = null;
          if (typeof sd?.value === "number" && Number.isFinite(sd.value)) v = sd.value;
          else v = getLastValueAtOrBefore(s.data, p.time);

          if (v == null) continue;

          rows.push({
            color: s.color,
            label: s.market.groupItemTitle || s.market.title || s.id,
            value: v,
          });
        }

        if (!rows.length) {
          lastTooltipKeyRef.current = "";
          setCompareTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
          return;
        }

        rows.sort((a, b) => b.value - a.value);

        const rect = container.getBoundingClientRect();
        const tooltipW = 280;
        const tooltipH = 30 + rows.length * 18;

        const x = clamp(p.point.x + 12, 0, rect.width - tooltipW);
        const y = clamp(p.point.y + 12, 0, rect.height - tooltipH);

        const key =
          `${timeLabel}|${Math.round(x)}|${Math.round(y)}|` + rows.map((r) => `${r.label}:${r.value.toFixed(4)}`).join(",");

        if (lastTooltipKeyRef.current === key) return;
        lastTooltipKeyRef.current = key;

        setCompareTooltip({ show: true, x, y, timeLabel, rows });
      });
    },
    [compareRendered]
  );

  // -------------------------
  // UI actions
  // -------------------------
  const killExpandedChartNow = () => {
    expandedAliveRef.current = false;
    if (expandedRafRef.current != null) {
      cancelAnimationFrame(expandedRafRef.current);
      expandedRafRef.current = null;
    }
  };

  const closeExpanded = () => {
    killExpandedChartNow();
    setExpandedSignalTooltip((t) => (t.show ? { ...t, show: false } : t));
    setHoveredNewsTimeSec(null);

    setExpandedMarketId(null);

    requestAnimationFrame(() => {
      setExpandedMountedId(null);
      setExpandedHistory([]);
    });
  };

  const toggleExpand = (id: string) => {
    if (expandedMarketId === id) {
      closeExpanded();
      return;
    }

    setExpandedHistory([]);
    setExpandedMarketId(id);
    setActiveTab("CHART");
    setHoveredNewsTimeSec(null);
  };

  const toggleMarketOnMainChart = (id: string) => {
    setMainChartMarketIds((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];

      if (next.length === 0) setMainChartMode("TOP5");
      else setMainChartMode("COMPARE");

      const MAX = 8;
      return next.slice(0, MAX);
    });
  };

  const backToTop5 = () => {
    setMainChartMode("TOP5");
    setMainChartMarketIds([]);
    setMainChartHistoryMap({});
    setCompareTooltip((t) => (t.show ? { ...t, show: false } : t));
  };

  const pinnedLabels = useMemo(() => {
    if (!eventData) return [];
    return mainChartMarketIds
      .map((id) => eventData.markets.find((m) => m.id === id))
      .filter(Boolean)
      .map((m, idx) => ({
        id: (m as any).id as string,
        label: (m as any).groupItemTitle || (m as any).title || (m as any).id,
        color: COMPARE_COLORS[idx % COMPARE_COLORS.length],
      }));
  }, [eventData, mainChartMarketIds]);

  const marketTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    if (!eventData) return map;

    for (const m of eventData.markets) {
      map[m.id] = m.groupItemTitle || m.title || m.id;
    }
    return map;
  }, [eventData]);

  // Dedup tweets across multiple correlations
  const newsItems = useMemo<NewsItem[]>(() => {
    const map = new Map<string, NewsItem>();

    for (const c of newsRows) {
      const tweetId = c.tweet?.id;
      if (!tweetId) continue;

      const existing = map.get(tweetId);

      if (!existing) {
        map.set(tweetId, {
          tweetId,
          tweet: c.tweet,
          created_at_utc: c.created_at_utc,
          best: c,
          marketIds: [c.market_id],
        });
        continue;
      }

      if (!existing.marketIds.includes(c.market_id)) existing.marketIds.push(c.market_id);

      if (new Date(c.created_at_utc).getTime() > new Date(existing.created_at_utc).getTime()) {
        existing.created_at_utc = c.created_at_utc;
      }

      if ((c.relevance_score ?? 0) > (existing.best.relevance_score ?? 0)) {
        existing.best = c;
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at_utc).getTime() - new Date(a.created_at_utc).getTime()
    );
  }, [newsRows]);

  const newsHeaderLabel = useMemo(() => {
    if (!eventData) return "";

    if (expandedMarketId) return marketTitleById[expandedMarketId] ?? "Selected Market";

    if (mainChartMarketIds.length) {
      if (mainChartMarketIds.length === 1) {
        return marketTitleById[mainChartMarketIds[0]] ?? "Pinned Market";
      }
      return `Pinned Markets (${mainChartMarketIds.length})`;
    }

    return "Top 5 Markets";
  }, [eventData, expandedMarketId, mainChartMarketIds, marketTitleById]);

  // =========================
  // EXPANDED: markers + conditional tooltip index
  // =========================
  const expandedSignalIndex = useMemo(() => {
    if (!expandedMarketId) return new Map<number, { count: number; top: NewsItem }>();
    if (activeTab !== "CHART") return new Map<number, { count: number; top: NewsItem }>();
    if (!expandedHistory.length) return new Map<number, { count: number; top: NewsItem }>();
    if (!newsItems.length) return new Map<number, { count: number; top: NewsItem }>();

    const byTime = new Map<number, { count: number; top: NewsItem }>();

    for (const item of newsItems) {
      const tSec = parseUtcToSec(item.created_at_utc);
      if (tSec == null) continue;

      const snapped = snapToNearestSeriesTime(expandedHistory, tSec);
      if (snapped == null) continue;

      const existing = byTime.get(snapped);
      if (!existing) {
        byTime.set(snapped, { count: 1, top: item });
      } else {
        existing.count += 1;
        if ((item.best.relevance_score ?? 0) > (existing.top.best.relevance_score ?? 0)) {
          existing.top = item;
        }
      }
    }

    return byTime;
  }, [expandedMarketId, activeTab, expandedHistory, newsItems]);

  // sorted signal times for fuzzy matching
  const expandedSignalTimesSorted = useMemo(
    () => Array.from(expandedSignalIndex.keys()).sort((a, b) => a - b),
    [expandedSignalIndex]
  );

  const expandedSignalIndexRef = useRef(expandedSignalIndex);
  const expandedSignalTimesSortedRef = useRef<number[]>(expandedSignalTimesSorted);

  useEffect(() => {
    expandedSignalIndexRef.current = expandedSignalIndex;
    expandedSignalTimesSortedRef.current = expandedSignalTimesSorted;
  }, [expandedSignalIndex, expandedSignalTimesSorted]);

  // MARKERS
  const expandedMarkers = useMemo<SeriesMarker<Time>[]>(() => {
    if (!showExpandedSignals) return [];
    return Array.from(expandedSignalIndex.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timeSec, { top, count }]) => {
        const rel = top.best.relevance_score ?? 0;
        const isHigh = rel >= 80;

        const size = isHigh ? 3 : rel >= 60 ? 2 : 1;
        const text = count > 1 ? `𝕏+${count}` : "𝕏";
        const color = isHigh ? "#22c55e" : "#38bdf8";

        return {
          time: timeSec as Time,
          position: "inBar",
          shape: "circle",
          color,
          text,
          size,
        } satisfies SeriesMarker<Time>;
      });
  }, [expandedSignalIndex, showExpandedSignals]);

  // if signals are turned off, kill the tooltip
  useEffect(() => {
    if (!showExpandedSignals) {
      setExpandedSignalTooltip((t) => (t.show ? { ...t, show: false } : t));
    }
  }, [showExpandedSignals]);

  const expandedTooltipKeyRef = useRef<string>("");

  // =========================
  // EXPANDED crosshair:
  // time-magnetic + y-band gating
  // =========================
  const onExpandedCrosshairMove = React.useCallback(
    (param: any) => {
      console.log("onExpandedCrosshairMove called with param: ", param);
      if (!expandedAliveRef.current) return;
      if (!showExpandedSignals) return;
      if (expandedRafRef.current != null) return;

      expandedRafRef.current = requestAnimationFrame(() => {
        expandedRafRef.current = null;
        if (!expandedAliveRef.current) return;

        try {
          const container = expandedChartContainerRef.current;
          if (!container) return;

          if (!param?.point || param.point.x == null || param.point.y == null || param.time == null) {
            setExpandedSignalTooltip((t) => (t.show ? { ...t, show: false } : t));
            return;
          }

          const t = param.time as number;

          const maxDeltaSec =
            selectedRange === "1D"
              ? 60 * 30
              : selectedRange === "1W"
                ? 60 * 60 * 6
                : selectedRange === "1M"
                  ? 60 * 60 * 24
                  : 60 * 60 * 6;

          const snappedSignalTime = nearestSignalTimeWithin(expandedSignalTimesSortedRef.current, t, maxDeltaSec);
          if (snappedSignalTime == null) {
            setExpandedSignalTooltip((tt) => (tt.show ? { ...tt, show: false } : tt));
            return;
          }

          const hit = expandedSignalIndexRef.current.get(snappedSignalTime);
          if (!hit) {
            setExpandedSignalTooltip((tt) => (tt.show ? { ...tt, show: false } : tt));
            return;
          }

          // Y-band gating (only show tooltip when near marker's Y)
          const seriesApi = expandedLineSeriesRef.current?.api?.();
          const markerPrice =
            getValueAtExactTime(expandedHistory, snappedSignalTime) ??
            getLastValueAtOrBefore(expandedHistory, snappedSignalTime as Time);

          if (seriesApi && markerPrice != null) {
            const markerY = seriesApi.priceToCoordinate(markerPrice);
            if (typeof markerY === "number" && Number.isFinite(markerY)) {
              const yTolPx =
                selectedRange === "1D" ? 28 : selectedRange === "1W" ? 34 : selectedRange === "1M" ? 42 : 34;

              if (Math.abs(param.point.y - markerY) > yTolPx) {
                setExpandedSignalTooltip((tt) => (tt.show ? { ...tt, show: false } : tt));
                return;
              }
            }
          }

          const rect = container.getBoundingClientRect();
          const tooltipW = 340;
          const tooltipH = 120;

          const x = clamp(param.point.x + 12, 0, rect.width - tooltipW);
          const y = clamp(param.point.y + 12, 0, rect.height - tooltipH);

          const top = hit.top;
          const rel = top.best.relevance_score ?? 0;

          const meta =
            hit.count === 1 ? `REL ${rel.toFixed(0)} • 1 tweet` : `REL ${rel.toFixed(0)} • ${hit.count} tweets (top)`;

          const key = `${snappedSignalTime}|${Math.round(x)}|${Math.round(y)}|${top.tweet?.id ?? ""}|${rel.toFixed(0)}`;
          if (expandedTooltipKeyRef.current === key) return;
          expandedTooltipKeyRef.current = key;

          setExpandedSignalTooltip({
            show: true,
            x,
            y,
            timeLabel: fmtTime(snappedSignalTime),
            header: top.tweet?.author_name ?? "tweet",
            body: top.tweet?.text ?? "",
            meta,
          });
        } catch {
          // swallow disposal-time internal errors
        }
      });
    },
    [selectedRange, expandedHistory, showExpandedSignals]
  );

  // =========================
  // ✅ Hover tweet -> vertical time cursor on expanded chart
  // SNAP is already done in onEnter (hoveredNewsTimeSec = snapped)
  // We now map snappedTime -> index -> CANVAS coordinate (not container).
  // =========================
  const [expandedMeasureTick, setExpandedMeasureTick] = useState(0);

  useEffect(() => {
    const el = expandedChartContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => setExpandedMeasureTick((x) => x + 1));
    ro.observe(el);

    return () => ro.disconnect();
  }, [expandedMarketId, activeTab]);

  const expandedChartRef = useRef<any>(null);

  // const expandedHoverLineX = useMemo(() => {

  //   console.log("edxpanded chart ref: ", expandedChartRef.current);
  //   const t = hoveredNewsTimeSec;
  //   if (t == null) return null;
  //   if (!expandedHistory?.length) return null;

  //   const container = expandedChartContainerRef.current;
  //   if (!container) return null;

  //   // Use canvas span to avoid price-scale offsets
  //   const span = getCanvasSpan(container);
  //   if (!span) return null;

  //   const idx = indexNearestTime(expandedHistory, t);
  //   if (idx == null) return null;

  //   const denom = Math.max(1, expandedHistory.length - 1);
  //   const ratio = clamp(idx / denom, 0, 1);

  //   return Math.round(span.left + ratio * span.width);
  // }, [hoveredNewsTimeSec, expandedHistory, expandedMarketId, selectedRange, expandedMeasureTick]);
  
    // 2. State for the line position
  const [expandedHoverLineX, setExpandedHoverLineX] = useState<number | null>(null);
  const expandedTimeScaleRef = useRef<any>(null);
  useEffect(() => {
    if (!expandedTimeScaleRef.current || hoveredNewsTimeSec === null) {
      setExpandedHoverLineX(null);
      return;
    }

    const timeScaleApi = expandedTimeScaleRef.current.api();
    if (!timeScaleApi) return;

    const updatePosition = () => {
      // ✅ This is the magic method. It converts time -> pixel X (Zoom aware)
      const x = timeScaleApi.timeToCoordinate(hoveredNewsTimeSec);
      setExpandedHoverLineX(x ?? null);
    };

    // Run once immediately
    updatePosition();

    // ✅ Subscribe to changes: If you zoom/pan while hovering, the line stays attached
    timeScaleApi.subscribeVisibleTimeRangeChange(updatePosition);
    
    return () => {
      timeScaleApi.unsubscribeVisibleTimeRangeChange(updatePosition);
    };
  }, [hoveredNewsTimeSec, expandedHistory]);
  const compareFitDep = useMemo(() => {
    return mainChartMarketIds.reduce((sum, id) => sum + (mainChartHistoryMap[id]?.length || 0), 0);
  }, [mainChartMarketIds, mainChartHistoryMap]);
  
  const markersTweetTotal = useMemo(() => {
    let sum = 0;
    for (const v of expandedSignalIndex.values()) sum += v.count;
    return sum;
  }, [expandedSignalIndex]);

  

  if (!eventData) return <div className="p-10 text-white animate-pulse">Loading Terminal...</div>;
  
  return (
    <div className="min-h-screen bg-black text-white p-6 font-sans">
      {/* HEADER & RANGE SELECTOR */}
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold">{eventData.title}</h1>
          <div className="flex gap-4 text-xs text-gray-400 mt-2">
            <span>Vol: ${(eventData.totalVolume / 1000000).toFixed(3)}M</span>
            <span>Liq: ${(eventData.totalLiquidity / 1000000).toFixed(3)}M</span>
          </div>
        </div>

        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          {(Object.keys(RANGE_CONFIG) as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setSelectedRange(r)}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                selectedRange === r ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN TOP CHART AREA */}
      <div className="relative">
        {mainChartMode === "COMPARE" ? (
          <div
            ref={mainChartContainerRef}
            className="h-[400px] w-full bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden mb-8 relative"
          >
            {/* top-left legend */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-3 bg-black/50 p-2 rounded backdrop-blur">
              <span className="text-xs font-bold text-gray-400 uppercase">Compare ({selectedRange})</span>

              {pinnedLabels.map((x) => (
                <div key={x.id} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: x.color }} />
                  <span className="text-[10px] text-gray-300">{x.label}</span>
                </div>
              ))}
            </div>

            {/* top-right back */}
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={backToTop5}
                className="px-3 py-1 text-xs font-bold rounded bg-gray-900 border border-gray-800 text-gray-200 hover:bg-gray-800"
              >
                ← Back to Top 5
              </button>
            </div>

            {loadingMainChart ? (
              <div className="w-full h-full flex items-center justify-center text-gray-500 animate-pulse">
                Loading {selectedRange} data...
              </div>
            ) : compareRendered.length ? (
              <>
                <Chart
                  options={{
                    layout: { background: { type: "solid" as ColorType, color: "transparent" }, textColor: "#6b7280" },
                    grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
                    timeScale: { timeVisible: true, secondsVisible: false, minBarSpacing: 0.01 },
                    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
                    crosshair: { mode: 1 },
                  }}
                  containerProps={{ style: { width: "100%", height: "100%" } }}
                  onCrosshairMove={onCompareCrosshairMove}
                >
                  {compareRendered.map((s) => (
                    <LineSeries
                      key={s.id}
                      ref={s.ref}
                      data={s.data}
                      options={{
                        color: s.color,
                        lineWidth: 2,
                        crosshairMarkerVisible: true,
                        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 1 } }),
                      }}
                    />
                  ))}

                  <TimeScale>
                    <TimeScaleFitContentTrigger deps={[compareFitDep, selectedRange, mainChartMarketIds.join(",")]} />
                  </TimeScale>
                </Chart>

                {compareTooltip.show && (
                  <div
                    className="absolute z-20 pointer-events-none bg-black/80 border border-gray-700 rounded-lg shadow-lg px-3 py-2"
                    style={{ left: compareTooltip.x, top: compareTooltip.y, width: 280 }}
                  >
                    <div className="text-[10px] text-gray-300 mb-2">{compareTooltip.timeLabel}</div>
                    <div className="space-y-1">
                      {compareTooltip.rows.map((r, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                          <span className="text-[11px] text-gray-200 truncate flex-1">{r.label}</span>
                          <span className="text-[11px] font-mono text-white tabular-nums">{(r.value * 100).toFixed(1)}¢</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600">
                No pinned markets. (Press 📌 on any market below.)
              </div>
            )}
          </div>
        ) : (
          <Top5ComparisonPanel eventData={eventData} selectedRange={selectedRange} />
        )}
      </div>

      {/* SPLIT VIEW (MARKETS & NEWS) */}
      <div className="grid grid-cols-12 gap-6 h-[600px]">
        {/* LEFT COL: MARKETS */}
        <div className="col-span-12 lg:col-span-7 flex flex-col bg-gray-900/20 border border-gray-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-3 bg-gray-900 border-b border-gray-800 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">Market</div>
            <div className="col-span-2 text-right">% Chance</div>
            <div className="col-span-6 text-right">Actions</div>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-gray-800 scrollbar-thin scrollbar-thumb-gray-800">
            {eventData.markets.map((market) => {
              const isExpanded = expandedMarketId === market.id;
              const keepMounted = expandedMountedId === market.id;
              const yesPrice = market.mainOutcome.price;
              const noPrice = 1 - yesPrice;

              const isPinned = mainChartMarketIds.includes(market.id);

              return (
                <div key={market.id} className="group">
                  <div
                    className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors cursor-pointer ${
                      isExpanded ? "bg-gray-800/60" : "hover:bg-gray-800/30 bg-black"
                    }`}
                    onClick={() => toggleExpand(market.id)}
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <img src={market.image} className="w-8 h-8 rounded-full bg-gray-800 object-cover" />
                      <span className={`font-medium ${isExpanded ? "text-blue-400" : "text-gray-200"}`}>
                        {market.groupItemTitle || market.title}
                      </span>
                    </div>

                    <div className="col-span-2 text-right">
                      <span className="text-lg font-bold text-white">{(yesPrice * 100).toFixed(1)}%</span>
                    </div>

                    <div className="col-span-6 flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleMarketOnMainChart(market.id)}
                        className={`flex items-center justify-center px-3 py-1 rounded border text-xs font-bold transition-all ${
                          isPinned
                            ? "bg-blue-900/40 border-blue-700 text-blue-200 hover:bg-blue-900/60"
                            : "bg-gray-900 hover:bg-gray-800 border-gray-800 text-gray-200"
                        }`}
                        title={isPinned ? "Remove from compare" : "Add to compare"}
                      >
                        📌
                      </button>

                      <button className="flex flex-col items-center justify-center w-24 py-1 rounded bg-[#0E2822] hover:bg-[#133D32] border border-[#195945] text-[#22C55E] transition-all">
                        <span className="text-xs font-bold">Yes</span>
                        <span className="text-[10px] opacity-80">{(yesPrice * 100).toFixed(1)}¢</span>
                      </button>

                      <button className="flex flex-col items-center justify-center w-24 py-1 rounded bg-[#2D181E] hover:bg-[#3D1D25] border border-[#591C27] text-[#EF4444] transition-all">
                        <span className="text-xs font-bold">No</span>
                        <span className="text-[10px] opacity-80">{(noPrice * 100).toFixed(1)}¢</span>
                      </button>
                    </div>
                  </div>

                  {(isExpanded || keepMounted) && (
                    <div className={`bg-gray-950 border-y border-gray-800 p-4 ${isExpanded ? "block" : "hidden"}`}>
                      {/* === TABS + SIGNAL TOGGLE === */}
                      <div className="flex items-center justify-between gap-4 border-b border-gray-800 mb-4 pb-2">
                        <div className="flex gap-4">
                          <button
                            onClick={() => setActiveTab("CHART")}
                            className={`text-xs font-bold pb-2 border-b-2 transition-colors ${
                              activeTab === "CHART"
                                ? "text-white border-blue-500"
                                : "text-gray-500 border-transparent hover:text-gray-300"
                            }`}
                          >
                            Price Chart
                          </button>
                          <button
                            onClick={() => setActiveTab("ORDERBOOK")}
                            className={`text-xs font-bold pb-2 border-b-2 transition-colors ${
                              activeTab === "ORDERBOOK"
                                ? "text-white border-blue-500"
                                : "text-gray-500 border-transparent hover:text-gray-300"
                            }`}
                          >
                            Order Book
                          </button>
                          <button
                            onClick={() => setActiveTab("HOLDERS")}
                            className={`text-xs font-bold pb-2 border-b-2 transition-colors ${
                              activeTab === "HOLDERS"
                                ? "text-white border-blue-500"
                                : "text-gray-500 border-transparent hover:text-gray-300"
                            }`}
                          >
                            Holders
                          </button>
                        </div>

                        {activeTab === "CHART" && (
                          <button
                            onClick={() => setShowExpandedSignals((v) => !v)}
                            className={`px-2.5 py-1 rounded border text-xs font-bold transition-colors ${
                              showExpandedSignals
                                ? "bg-sky-900/30 border-sky-700 text-sky-200 hover:bg-sky-900/50"
                                : "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800"
                            }`}
                            title={showExpandedSignals ? "Hide signal markers" : "Show signal markers"}
                          >
                            Signals: {showExpandedSignals ? "ON" : "OFF"}
                          </button>
                        )}
                      </div>

                      {/* === TAB CONTENT === */}
                      <div className="h-[250px]">
                        {activeTab === "CHART" ? (
                          <div className="h-full w-full">
                            {expandedHistory.length > 0 ? (
                              <div ref={expandedChartContainerRef} className="relative h-full w-full">
                                <Chart
                                  ref={expandedChartRef} 
                                  options={{
                                    layout: { background: { type: "solid" as ColorType, color: "transparent" }, textColor: "#9ca3af" },
                                    grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
                                    timeScale: { timeVisible: true, secondsVisible: false, minBarSpacing: 0.01 },
                                    crosshair: { mode: 1 },
                                  }}
                                  containerProps={{ style: { width: "100%", height: "100%" } }}
                                  onCrosshairMove={onExpandedCrosshairMove}
                                  
                                >
                                  <LineSeries
                                    ref={expandedLineSeriesRef}
                                    data={expandedHistory}
                                    options={{
                                      color: "#3b82f6",
                                      lineWidth: 2,
                                      crosshairMarkerVisible: true,
                                      priceLineVisible: false,
                                    }}
                                  >
                                    {showExpandedSignals ? <Markers markers={expandedMarkers} /> : null}
                                  </LineSeries>

                                  <TimeScale ref={expandedTimeScaleRef}>
                                    <TimeScaleFitContentTrigger deps={[expandedMarketId, selectedRange, expandedHistory.length]} />
                                  </TimeScale>
                                </Chart>

                                {/* ✅ Hover line from news feed (NOW canvas-aligned) */}
                                {expandedHoverLineX != null && (
                                  <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: expandedHoverLineX }}>
                                    <div className="h-full w-[2px] bg-green-400/70 shadow-[0_0_12px_rgba(56,189,248,0.55)]" />
                                    here
                                  </div>
                                )}

                                {/* CONDITIONAL TOOLTIP (only on signal timestamps) */}
                                {expandedSignalTooltip.show && (
                                  <div
                                    className="absolute z-20 pointer-events-none bg-black/85 border border-gray-700 rounded-lg shadow-lg px-3 py-2"
                                    style={{ left: expandedSignalTooltip.x, top: expandedSignalTooltip.y, width: 340 }}
                                  >
                                    <div className="text-[10px] text-gray-400 mb-1">{expandedSignalTooltip.timeLabel}</div>

                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-[11px] font-bold text-gray-200 truncate">{expandedSignalTooltip.header}</div>
                                      <div className="text-[10px] font-mono text-gray-400">{expandedSignalTooltip.meta}</div>
                                    </div>

                                    <div className="mt-1 text-[11px] text-gray-300 leading-snug line-clamp-3">
                                      {expandedSignalTooltip.body}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="h-full flex items-center justify-center text-gray-600 animate-pulse">Loading Chart...</div>
                            )}
                          </div>
                        ) : activeTab === "ORDERBOOK" ? (
                          <div className="h-full w-full flex items-center justify-center text-gray-500 border border-dashed border-gray-800 rounded">
                            Orderbook Placeholder
                          </div>
                        ) : (
                          <div className="h-full w-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
                            <table className="w-full text-xs text-left">
                              <thead className="text-gray-500 sticky top-0 bg-gray-950">
                                <tr className="border-b border-gray-800">
                                  <th className="py-2 pl-2">Rank</th>
                                  <th className="py-2">Holder</th>
                                  <th className="py-2 text-right">Shares</th>
                                  <th className="py-2 text-right pr-2">Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-900">
                                {MOCK_HOLDERS.map((h) => (
                                  <tr key={h.rank} className="hover:bg-gray-900/50">
                                    <td className="py-2 pl-2 text-gray-500">#{h.rank}</td>
                                    <td className="py-2">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-gray-300">{h.name}</span>
                                        <span className="text-[10px] text-gray-600 font-mono">{h.user}</span>
                                      </div>
                                    </td>
                                    <td className="py-2 text-right font-mono text-gray-300">
                                      {h.shares.toLocaleString()}{" "}
                                      <span className={`text-[10px] ${h.side === "Yes" ? "text-green-500" : "text-red-500"}`}>
                                        ({h.side})
                                      </span>
                                    </td>
                                    <td className="py-2 text-right pr-2 font-mono text-green-400">${h.value.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {activeTab === "CHART" && showExpandedSignals && expandedMarkers.length > 0 && (
                        <div className="mt-3 text-[10px] text-gray-500">
                          • {expandedMarkers.length} tweet markers plotted (time-magnetic + y-band near price)
                        </div>
                      )}
                      {activeTab === "CHART" && !showExpandedSignals && (
                        <div className="mt-3 text-[10px] text-gray-600">• Signals hidden</div>
                      )}

                      {activeTab === "CHART" && (
                        <div className="mt-2 text-[10px] text-gray-500 flex gap-3 flex-wrap">
                          <span>tweets (newsItems): {newsItems.length}</span>
                          <span>markers: {expandedMarkers.length}</span>
                          <span>tweets represented by markers (sum counts): {markersTweetTotal}</span>
                          <span>raw correlation rows loaded: {newsRows.length}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COL: NEWS FEED */}
        <div className="col-span-12 lg:col-span-5 flex flex-col bg-gray-900/20 border border-gray-800 rounded-xl overflow-hidden">
          <div className="p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">News Stream</span>
            {newsHeaderLabel && (
              <span className="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                {newsHeaderLabel}
              </span>
            )}
          </div>

          <div className="overflow-y-auto flex-1 p-4 scrollbar-thin scrollbar-thumb-gray-800">
            {loadingNews ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-800/50 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : newsItems.length > 0 ? (
              <div className="space-y-4">
                {newsItems.map((item) => {
                  const c = item.best;

                  const onEnter = () => {
                    console.log("hover news item: ", item);
                    if (!expandedMarketId || activeTab !== "CHART") return;
                    const tSec = parseUtcToSec(item.created_at_utc);
                    if (tSec == null) return;

                    // ✅ critical: snap tweet time to actual series time
                    const snapped = snapToNearestSeriesTime(expandedHistory, tSec);
                    if (snapped == null) return;

                    setHoveredNewsTimeSec(snapped);
                  };

                  const onLeave = () => {
                    setHoveredNewsTimeSec(null);
                  };

                  return (
                    <div
                      key={item.tweetId}
                      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-gray-800/30"
                      onMouseEnter={onEnter}
                      onMouseLeave={onLeave}
                    >
                      <div className="flex-shrink-0">
                        <img
                          src={
                            c.tweet.x_account?.profile_picture ||
                            "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png"
                          }
                          className="w-8 h-8 rounded-full border border-gray-700"
                          onError={(e) =>
                            (e.currentTarget.src =
                              "https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png")
                          }
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-gray-300">{c.tweet.author_name}</p>
                            <p className="text-[10px] text-gray-600">{new Date(c.created_at_utc).toLocaleString()}</p>
                          </div>

                          <div
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                              c.relevance_score > 80
                                ? "bg-green-900/30 text-green-400 border-green-800"
                                : "bg-gray-800 text-gray-400 border-gray-700"
                            }`}
                          >
                            REL: {c.relevance_score.toFixed(0)}
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{c.tweet.text}</p>

                        {c.relevance_reason && (
                          <div className="mt-2 p-1.5 bg-blue-900/10 border-l-2 border-blue-600 rounded-r text-[10px] text-blue-300/80 italic">
                            {"'"}{c.relevance_reason}{"'"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {newsHasMore && (
                  <div className="pt-4">
                    <button
                      onClick={loadMoreNews}
                      disabled={loadingMoreNews}
                      className="w-full px-3 py-2 text-xs font-bold rounded bg-gray-900 border border-gray-800 text-gray-200 hover:bg-gray-800 disabled:opacity-50"
                    >
                      {loadingMoreNews ? "Loading..." : "Load more"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
                <span className="text-2xl">📭</span>
                <p className="text-xs">No specific news found for this market.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}