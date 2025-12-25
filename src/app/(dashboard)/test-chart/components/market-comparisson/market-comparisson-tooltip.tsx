"use client";

import React from "react";
import { ChartTooltipState } from "../../hooks/use-market-comparisson";

export function MarketComparisonTooltip(props: ChartTooltipState) {
  const { show, x, y, timeLabel, rows } = props;
  if (!show) return null;

  return (
    <div
      className="absolute z-20 pointer-events-none bg-black/80 border border-gray-700 rounded-lg shadow-lg px-3 py-2"
      style={{ left: x, top: y, width: 260 }}
    >
      <div className="text-[10px] text-gray-300 mb-2">{timeLabel}</div>

      <div className="space-y-1">
        {rows.map((r, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />
            <span className="text-[11px] text-gray-200 truncate flex-1">{r.label}</span>
            <span className="text-[11px] font-mono text-white tabular-nums">{(r.value * 100).toFixed(1)}¢</span>
          </div>
        ))}
      </div>
    </div>
  );
}