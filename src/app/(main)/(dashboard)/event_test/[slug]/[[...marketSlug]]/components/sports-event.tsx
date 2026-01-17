"use client";

import { useState, useEffect } from "react";
import { PolymarketMarket, filterActiveMarkets } from "../../../actions/event";
import { Orderbook } from "./orderbook";

interface SportsEventProps {
  markets: PolymarketMarket[];
}

export function SportsEventView({ markets }: SportsEventProps) {
  const [activeMarkets, setActiveMarkets] = useState<PolymarketMarket[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string | undefined>();
  
  useEffect(() => {
    filterActiveMarkets(markets).then(filtered => {
      setActiveMarkets(filtered);
      if (filtered.length > 0 && !selectedMarketId) {
        setSelectedMarketId(filtered[0].id);
      }
    });
  }, [markets]);
  
  const selectedMarket = activeMarkets.find(m => m.id === selectedMarketId) || activeMarkets[0];
  
  const outcomes: string[] = selectedMarket ? JSON.parse(selectedMarket.outcomes) : [];
  const clobTokenIds: string[] = selectedMarket ? JSON.parse(selectedMarket.clobTokenIds) : [];

  return (
    <div className="space-y-6">
      {/* Sports Markets Grid */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8">
        <h3 className="text-lg font-bold text-white mb-4">Sports Event Markets</h3>
        <p className="text-sm text-gray-400 mb-4">
          🏆 Multiple bet types (winner, handicaps, over/under, maps)
        </p>
        
        {activeMarkets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No active markets available</p>
          </div>
        )}
        
        {activeMarkets.length > 0 && (
          <>
            {/* Market Selector Dropdown */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Select Market to View Orderbook:
              </label>
              <select
                value={selectedMarketId}
                onChange={(e) => setSelectedMarketId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                {activeMarkets.map((market) => (
                  <option key={market.id} value={market.id}>
                    {market.groupItemTitle || "Bet Type"} - {market.question}
                  </option>
                ))}
              </select>
            </div>

            {/* Market Grid Overview */}
            <div className="grid grid-cols-2 gap-4">
              {activeMarkets.slice(0, 6).map((market) => (
                <button
                  key={market.id}
                  onClick={() => setSelectedMarketId(market.id)}
                  className={`p-3 rounded-lg text-left transition-all ${
                    selectedMarketId === market.id
                      ? "bg-blue-900/40 border-2 border-blue-500"
                      : "bg-gray-800/50 hover:bg-gray-800/70 border-2 border-transparent"
                  }`}
                >
                  <span className="text-xs text-gray-500">{market.groupItemTitle || "Bet Type"}</span>
                  <p className="text-sm text-gray-300 mt-1 truncate">{market.question}</p>
                </button>
              ))}
              {activeMarkets.length > 6 && (
                <div className="p-3 bg-gray-800/50 rounded-lg flex items-center justify-center">
                  <span className="text-sm text-gray-400">+{activeMarkets.length - 6} more</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Orderbook for selected market */}
      {selectedMarket && (
        <Orderbook 
          outcomes={outcomes} 
          clobTokenIds={clobTokenIds} 
          market={selectedMarket}
        />
      )}
    </div>
  );
}
