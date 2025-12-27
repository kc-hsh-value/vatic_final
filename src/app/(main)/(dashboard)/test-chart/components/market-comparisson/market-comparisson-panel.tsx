"use client";

import React from "react";
import { UnifiedEvent } from "../../normalize-markets";
import { LINE_COLORS, TimeRange, useMarketComparison } from "../../hooks/use-market-comparisson";
import { MarketComparisonChart } from "./market-comparisson-chart";
import { MarketComparisonTooltip } from "./market-comparisson-tooltip";

export function MarketComparisonPanel(props: {
  eventData: UnifiedEvent;
  selectedRange: TimeRange;
  marketIds: string[];
  title?: string;
}) {
  const { eventData, selectedRange, marketIds, title } = props;

  const { loading, renderedSeries, tooltip, onCrosshairMove, chartRef, fitDep } = useMarketComparison({
    eventData,
    selectedRange,
    marketIds,
  });

  const legendMarkets = React.useMemo(() => {
    const map = new Map(eventData.markets.map((m) => [m.id, m]));
    return marketIds.map((id) => map.get(id)).filter(Boolean) as any[];
  }, [eventData, marketIds]);

  return (
    <div className="h-[400px] w-full bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden mb-8 relative">
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-4 bg-black/50 p-2 rounded backdrop-blur">
        <span className="text-xs font-bold text-gray-400 uppercase">
          {title ?? `Comparison (${selectedRange})`}
        </span>

        {legendMarkets.map((m, i) => (
          <div key={m.id} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
            <span className="text-[10px] text-gray-300">{m.groupItemTitle || m.title}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 animate-pulse">
          Loading {selectedRange} data...
        </div>
      ) : (
        <MarketComparisonChart series={renderedSeries} chartRef={chartRef} onCrosshairMove={onCrosshairMove} fitDep={fitDep} />
      )}

      <MarketComparisonTooltip {...tooltip} />
    </div>
  );
}