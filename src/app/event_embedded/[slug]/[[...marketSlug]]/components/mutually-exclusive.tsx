"use client";

import { useState, useEffect } from "react";
import { PolymarketMarket, filterActiveMarkets } from "../../../actions/event";
import { Orderbook } from "./orderbook";

interface MutuallyExclusiveProps {
  markets: PolymarketMarket[];
}

export function MutuallyExclusiveView({ markets }: MutuallyExclusiveProps) {
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
      {/* Summary View */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8">
        <h3 className="text-lg font-bold text-white mb-4">Mutually Exclusive Markets</h3>
        <p className="text-sm text-gray-400 mb-4">
          🎯 Multiple choice - exactly one option wins (probabilities sum to ~100%)
        </p>
        
        {activeMarkets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No active markets available</p>
          </div>
        )}
        
        <div className="space-y-2">
          {activeMarkets.map((market, idx) => {
            const price = market.outcomePrices ? parseFloat(JSON.parse(market.outcomePrices)[0]) : 0;
            
            return (
              <button
                key={market.id}
                onClick={() => setSelectedMarketId(market.id)}
                className={`w-full p-3 rounded-lg flex justify-between items-center transition-all ${
                  selectedMarketId === market.id
                    ? "bg-blue-900/40 border-2 border-blue-500"
                    : "bg-gray-800/50 hover:bg-gray-800/70 border-2 border-transparent"
                }`}
              >
                <span className="text-sm text-gray-300">{market.groupItemTitle || `Option ${idx + 1}`}</span>
                <span className="text-sm font-bold text-white">
                  {(price * 100).toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
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
