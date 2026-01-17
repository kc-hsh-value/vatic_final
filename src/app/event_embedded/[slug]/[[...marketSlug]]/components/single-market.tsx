"use client";

import { PolymarketMarket } from "../../../actions/event";
import { Orderbook } from "./orderbook";

interface SingleMarketProps {
  market: PolymarketMarket;
}

export function SingleMarketView({ market }: SingleMarketProps) {
  // Parse outcomes and token IDs
  const outcomes: string[] = JSON.parse(market.outcomes);
  const clobTokenIds: string[] = JSON.parse(market.clobTokenIds);

  return (
    <div className="space-y-6">
      {/* Chart Placeholder */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Price Chart</h3>
          <span className="text-xs text-gray-500 font-mono">Coming Soon</span>
        </div>
        
        {/* Placeholder Chart Area */}
        <div className="relative h-[400px] bg-gray-800/30 rounded-lg border border-gray-700/50 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-5xl">📈</div>
            <div className="text-gray-400 text-sm">
              Chart implementation coming next
            </div>
            <div className="text-xs text-gray-500 font-mono">
              Will display: {outcomes.join(" vs ")} prices over time
            </div>
          </div>
        </div>
      </div>

      {/* Orderbook */}
      <Orderbook outcomes={outcomes} clobTokenIds={clobTokenIds} market={market} />

      {/* Debug Info */}
      <details className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
          Market Debug Info
        </summary>
        <pre className="text-xs text-gray-300 overflow-auto mt-4">
          {JSON.stringify(market, null, 2)}
        </pre>
      </details>
    </div>
  );
}
