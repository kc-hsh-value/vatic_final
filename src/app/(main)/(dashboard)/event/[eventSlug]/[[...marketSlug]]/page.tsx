"use client";

import React from "react";
import {
  Chart,
  LineSeries,
  Markers,
  TimeScale,
  TimeScaleFitContentTrigger
} from "lightweight-charts-react-components"; // Using the wrapper you have
import {ColorType, Time} from "lightweight-charts";

// 1. FAKE DATA
const MOCK_PRICE_DATA = Array.from({ length: 100 }, (_, i) => ({
  time: (1642425322 + i * 3600) as Time, // Unix Seconds
  value: 50 + Math.sin(i / 10) * 10 + (Math.random() - 0.5) * 5,
}));

// 2. FAKE MARKER (Must match one of the timestamps above exactly)
const MOCK_MARKERS = [
  {
    time: (1642425322 + 50 * 3600) as Time, // Matches the 50th data point
    position: "aboveBar" as const,
    color: "#f68410",
    shape: "arrowDown" as const,
    text: "NEWS DETECTED",
    size: 2,
  }
];

export default function TestPage() {
  return (
    <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center">
      <h1 className="text-2xl font-bold mb-4">Step 1: The Dot on the Line</h1>
      
      <div className="w-full h-[500px] border border-gray-800 rounded-xl overflow-hidden bg-gray-900">
        <Chart
          options={{
            layout: { 
              background: { type: "solid" as ColorType, color: "#000000" }, 
              textColor: "white" 
            },
            grid: { 
              vertLines: { color: "#333" }, 
              horzLines: { color: "#333" } 
            },
            timeScale: {
              timeVisible: true,
              secondsVisible: false,
            }
          }}
          containerProps={{
             style: { width: "100%", height: "100%" }
          }}
        >
          <LineSeries
            data={MOCK_PRICE_DATA}
            options={{ color: "#2962FF", lineWidth: 2 }}
          >
             {/* THIS IS THE MAGIC COMPONENT */}
             <Markers markers={MOCK_MARKERS} />
          </LineSeries>

          <TimeScale>
             <TimeScaleFitContentTrigger deps={[MOCK_PRICE_DATA]} />
          </TimeScale>
        </Chart>
      </div>
    </div>
  );
}