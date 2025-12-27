"use client";

import React from "react";
import { Chart, LineSeries, TimeScale, TimeScaleFitContentTrigger } from "lightweight-charts-react-components";
import { ColorType } from "lightweight-charts";
import { RenderedSeriesItem } from "../../hooks/use-market-comparisson";


export const MarketComparisonChart = React.memo(function MarketComparisonChart(props: {
  series: RenderedSeriesItem[];
  chartRef: React.RefObject<HTMLDivElement | null>;
  onCrosshairMove: (param: any) => void;
  fitDep: number;
}) {
  const { series, chartRef, onCrosshairMove, fitDep } = props;

  return (
    <Chart
      options={{
        layout: { background: { type: "solid" as ColorType, color: "transparent" }, textColor: "#6b7280" },
        grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderVisible: false,
          fixLeftEdge: false,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: false,
          rightBarStaysOnScroll: false,
          shiftVisibleRangeOnNewBar: true,
          minBarSpacing: 0.01,
        },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        crosshair: { mode: 1 },
      }}
      containerProps={{ style: { width: "100%", height: "100%", position: "relative" } }}
      ref={chartRef}
      onCrosshairMove={onCrosshairMove}
    >
      {series.map(({ market, ref, color, data }) => (
        <LineSeries
          key={market.id}
          ref={ref}
          data={data}
          options={{
            color,
            lineWidth: 2,
            crosshairMarkerVisible: true,
            autoscaleInfoProvider: () => ({
              priceRange: { minValue: 0, maxValue: 1 },
            }),
          }}
        />
      ))}

      <TimeScale>
        <TimeScaleFitContentTrigger deps={[fitDep]} />
      </TimeScale>
    </Chart>
  );
});