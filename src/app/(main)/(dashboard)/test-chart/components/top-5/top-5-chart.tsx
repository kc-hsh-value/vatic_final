"use client";

import React from "react";
import { Chart, LineSeries, TimeScale, TimeScaleFitContentTrigger } from "lightweight-charts-react-components";
import { ColorType } from "lightweight-charts";
import { Top5RenderedItem } from "../../hooks/use-top-5-comparisson";

export const Top5Chart = React.memo(function Top5Chart(props: {
  top5Rendered: Top5RenderedItem[];
  topChartRef: React.RefObject<HTMLDivElement | null>;
  onTopCrosshairMove: (param: any) => void;
  fitDep: number;
}) {
  const { top5Rendered, topChartRef, onTopCrosshairMove, fitDep } = props;

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
      ref={topChartRef}
      onCrosshairMove={onTopCrosshairMove}
    >
      {top5Rendered.map(({ market, ref, color, data }) => (
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