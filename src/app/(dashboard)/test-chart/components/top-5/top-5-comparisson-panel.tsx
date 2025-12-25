"use client";

import React from "react";
import { UnifiedEvent } from "../../normalize-markets";
import { LINE_COLORS, TimeRange, useTop5Comparison } from "../../hooks/use-top-5-comparisson";
import { Top5Chart } from "./top-5-chart";
import { Top5Tooltip } from "./top-5-tooltip";


export function Top5ComparisonPanel(props: { eventData: UnifiedEvent; selectedRange: TimeRange }) {
  const { eventData, selectedRange } = props;

  const { loadingTop5, top5Rendered, topTooltip, onTopCrosshairMove, topChartRef, fitDep } =
    useTop5Comparison({ eventData, selectedRange });

  return (
    <div className="h-[400px] w-full bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden mb-8 relative">
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-4 bg-black/50 p-2 rounded backdrop-blur">
        <span className="text-xs font-bold text-gray-400 uppercase">Top 5 Comparison ({selectedRange})</span>
        {eventData.markets.slice(0, 5).map((m, i) => (
          <div key={m.id} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LINE_COLORS[i] }} />
            <span className="text-[10px] text-gray-300">{m.groupItemTitle || m.title}</span>
          </div>
        ))}
      </div>

      {loadingTop5 ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 animate-pulse">
          Loading {selectedRange} data...
        </div>
      ) : (
        <Top5Chart
          top5Rendered={top5Rendered}
          topChartRef={topChartRef}
          onTopCrosshairMove={onTopCrosshairMove}
          fitDep={fitDep}
        />
      )}

      <Top5Tooltip {...topTooltip} />
    </div>
  );
}