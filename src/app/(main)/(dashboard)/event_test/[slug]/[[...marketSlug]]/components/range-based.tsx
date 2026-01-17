"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PolymarketMarket, filterActiveMarkets } from "../../../actions/event";
import { Orderbook } from "./orderbook";

interface RangeBasedProps {
  markets: PolymarketMarket[];
}

export function RangeBasedView({ markets }: RangeBasedProps) {
  const [activeMarkets, setActiveMarkets] = useState<PolymarketMarket[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string | undefined>();
  const [showResolved, setShowResolved] = useState(false);
  
  // Separate active and resolved markets
  const active = markets.filter(m => !m.closed && m.active);
  const resolved = markets.filter(m => m.closed);
  
  useEffect(() => {
    filterActiveMarkets(active).then(filtered => {
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
      {/* Range Distribution View - Active Markets */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8">
        <h3 className="text-lg font-bold text-white mb-4">Range-Based Series</h3>
        <p className="text-sm text-gray-400 mb-4">
          📊 Range/bucket prediction - exactly one range wins
        </p>
        
        {activeMarkets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No active markets available</p>
          </div>
        )}
        
        <div className="space-y-2">
          {activeMarkets.map((market) => {
            const price = market.outcomePrices ? parseFloat(JSON.parse(market.outcomePrices)[0]) : 0;
            
            return (
              <button
                key={market.id}
                onClick={() => setSelectedMarketId(market.id)}
                className={`w-full p-3 rounded-lg transition-all ${
                  selectedMarketId === market.id
                    ? "bg-blue-900/40 border-2 border-blue-500"
                    : "bg-gray-800/50 hover:bg-gray-800/70 border-2 border-transparent"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">{market.groupItemTitle || "Range"}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${price * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-blue-400 w-12 text-right">
                      {(price * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resolved Markets Section */}
      {resolved.length > 0 && (
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="w-full flex items-center justify-between text-white hover:text-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Resolved Markets</span>
              <span className="text-xs text-gray-500">({resolved.length})</span>
            </div>
            {showResolved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showResolved && (
            <div className="mt-4 space-y-2">
              {resolved.map((market) => {
                const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [];
                const outcomes = market.outcomes ? JSON.parse(market.outcomes) : [];
                const yesPrice = parseFloat(prices[0] || "0");
                const noPrice = parseFloat(prices[1] || "0");
                const isYesWinner = yesPrice > noPrice;

                return (
                  <div
                    key={market.id}
                    className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/50"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-300">{market.groupItemTitle || "Range"}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            isYesWinner
                              ? "bg-green-900/30 text-green-400 border border-green-700/50"
                              : "bg-red-900/30 text-red-400 border border-red-700/50"
                          }`}
                        >
                          {isYesWinner ? "YES" : "NO"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Orderbook for selected active market only */}
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
