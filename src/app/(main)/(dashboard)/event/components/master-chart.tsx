"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Chart,
  LineSeries,
  CandlestickSeries,
  Markers,
  TimeScale,
  TimeScaleFitContentTrigger,
} from "lightweight-charts-react-components";
import { ColorType, Time, SeriesMarker } from "lightweight-charts";
import { useEventStore } from "../store/event-store";

import { RANGE_CONFIG } from "../store/event-store";
import { EnrichedCorrelation } from "@/types/polymarket";

// --- Utils ---

// Helper: Snap a specific tweet timestamp to the nearest available candle time
function snapToCandle(tweetTimeUnix: number, chartData: any[]): Time | null {
  if (!chartData || chartData.length === 0) return null;
  // Simple closest match
  const closest = chartData.reduce((prev, curr) => {
    return Math.abs((curr.time as number) - tweetTimeUnix) < Math.abs((prev.time as number) - tweetTimeUnix)
      ? curr
      : prev;
  });
  return closest.time as Time;
}

// Fetcher Function (Mocking the API call you need to implement)
async function fetchHistory(tokenId: string, interval: string, fidelity: number) {
  // Replace this with: 
  // const res = await fetch(`https://clob.polymarket.com/prices-history?market=${tokenId}&interval=${interval}&fidelity=${fidelity}`);
  // const json = await res.json();
  // return json.history.map(...)
  
  // MOCK DATA for now:
  const res = [];
  let time = Math.floor(Date.now() / 1000) - (86400 * 30); // 30 days ago
  let val = 0.50;
  for(let i=0; i<300; i++) {
    time += (interval === '1d' ? 86400 : 3600);
    val += (Math.random() - 0.5) * 0.05;
    if(val < 0.01) val = 0.01;
    if(val > 0.99) val = 0.99;
    
    res.push({
      time: time as Time,
      value: val,
      open: val, 
      high: val + 0.02, 
      low: val - 0.02, 
      close: val + (Math.random() - 0.5) * 0.01
    });
  }
  return res;
}

interface Props {
  activeTokenId?: string; 
  multiTokenIds?: { id: string, color: string, name: string }[]; 
  correlations: EnrichedCorrelation[];
}

export const MasterChart: React.FC<Props> = ({ activeTokenId, multiTokenIds, correlations }) => {
  const { timeRange, chartType, hoveredTweetId, showCorrelations } = useEventStore();
  
  // State for chart data
  const [activeSeriesData, setActiveSeriesData] = useState<any[]>([]);
  const [multiSeriesData, setMultiSeriesData] = useState<Record<string, any[]>>({});

  // 1. Fetch Data Effect
  useEffect(() => {
    const { interval, fidelity } = RANGE_CONFIG[timeRange];

    const loadData = async () => {
      if (activeTokenId) {
        const data = await fetchHistory(activeTokenId, interval, fidelity);
        setActiveSeriesData(data);
      } else if (multiTokenIds && multiTokenIds.length > 0) {
        const newMultiData: Record<string, any[]> = {};
        await Promise.all(multiTokenIds.map(async (t) => {
          const data = await fetchHistory(t.id, interval, fidelity);
          newMultiData[t.id] = data;
        }));
        setMultiSeriesData(newMultiData);
      }
    };

    loadData();
  }, [activeTokenId, multiTokenIds, timeRange]);

  // 2. Prepare Markers (Memoized)
  const markers = useMemo(() => {
    if (!showCorrelations || !activeTokenId || activeSeriesData.length === 0) return [];

    const m: SeriesMarker<Time>[] = [];
    correlations.forEach((c) => {
      const tweetTimeUnix = new Date(c.created_at_utc).getTime() / 1000;
      const snappedTime = snapToCandle(tweetTimeUnix, activeSeriesData);

      if (snappedTime) {
        const isHovered = hoveredTweetId === c.tweet_id;
        m.push({
          time: snappedTime,
          position: "aboveBar",
          color: isHovered ? "#fbbf24" : "#3b82f6", // Amber or Blue
          shape: isHovered ? "arrowDown" : "circle",
          size: isHovered ? 2 : 1,
          text: isHovered ? "View Tweet" : undefined,
        });
      }
    });
    return m;
  }, [correlations, showCorrelations, activeTokenId, activeSeriesData, hoveredTweetId]);

  // 3. Common Chart Options
  const chartOptions = {
    layout: { textColor: "#D9D9D9", background: { type: ColorType.Solid, color: "#000000" } },
    grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
    timeScale: { timeVisible: true, secondsVisible: false },
    crosshair: { mode: 1 },
  };

  return (
    <Chart options={chartOptions} containerProps={{ style: { width: "100%", height: "100%" } }}>
      
      {/* SINGLE MARKET VIEW */}
      {activeTokenId && activeSeriesData.length > 0 && (
        chartType === 'Candlestick' ? (
          <CandlestickSeries
            data={activeSeriesData}
            options={{
              upColor: '#22c55e',
              downColor: '#ef4444',
              borderVisible: false,
              wickUpColor: '#22c55e',
              wickDownColor: '#ef4444',
            }}
          >
             <Markers markers={markers} />
          </CandlestickSeries>
        ) : (
          <LineSeries
            data={activeSeriesData}
            options={{ color: '#3b82f6', lineWidth: 2 }}
          >
             <Markers markers={markers} />
          </LineSeries>
        )
      )}

      {/* MULTI MARKET VIEW */}
      {!activeTokenId && multiTokenIds && multiTokenIds.map((token) => (
        <LineSeries
          key={token.id}
          data={multiSeriesData[token.id] || []}
          options={{
            color: token.color,
            lineWidth: 2,
            title: token.name // Legend support if you add a legend component
          }}
        />
      ))}

      <TimeScale>
        <TimeScaleFitContentTrigger deps={[activeTokenId, multiTokenIds, timeRange]} />
      </TimeScale>

    </Chart>
  );
};