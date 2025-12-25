import { create } from 'zustand';

export type TimeRange = '1h' | '6h' | '1d' | '1w' | '1m' | 'all';
export type ChartType = 'Line' | 'Candlestick';

interface EventStore {
  // View Configuration
  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;
  
  chartType: ChartType;
  setChartType: (t: ChartType) => void;
  
  showCorrelations: boolean;
  toggleCorrelations: () => void;

  // Interaction State
  hoveredTweetId: string | null; // From Feed -> Chart
  setHoveredTweetId: (id: string | null) => void;

  hoveredChartTime: number | null; // From Chart -> Feed (Optional)
  setHoveredChartTime: (time: number | null) => void;
}

export const useEventStore = create<EventStore>((set) => ({
  timeRange: '1d',
  setTimeRange: (r) => set({ timeRange: r }),
  
  chartType: 'Line', // Default to Line for clarity, Candle for advanced
  setChartType: (t) => set({ chartType: t }),
  
  showCorrelations: true,
  toggleCorrelations: () => set((state) => ({ showCorrelations: !state.showCorrelations })),
  
  hoveredTweetId: null,
  setHoveredTweetId: (id) => set({ hoveredTweetId: id }),
  
  hoveredChartTime: null,
  setHoveredChartTime: (time) => set({ hoveredChartTime: time }),
}));

// Helper for Polymarket API mapping
export const RANGE_CONFIG: Record<TimeRange, { interval: string, fidelity: number }> = {
  '1h': { interval: '1m', fidelity: 1 }, // High res for short term
  '6h': { interval: '15m', fidelity: 1 },
  '1d': { interval: '1h', fidelity: 1 }, // Standard
  '1w': { interval: '6h', fidelity: 5 },
  '1m': { interval: '1d', fidelity: 10 },
  'all': { interval: '1d', fidelity: 60 } // Low res for long term
};