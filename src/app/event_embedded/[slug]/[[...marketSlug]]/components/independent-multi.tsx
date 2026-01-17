"use client";

import { useState, useEffect } from "react";
import { PolymarketMarket, filterActiveMarkets } from "../../../actions/event";
import { Orderbook } from "./orderbook";

interface IndependentMultiProps {
  markets: PolymarketMarket[];
}

export function IndependentMultiView({ markets }: IndependentMultiProps) {
  // Separate active vs resolved markets
  const [activeMarkets, setActiveMarkets] = useState<PolymarketMarket[]>([]);
  const [resolvedMarkets, setResolvedMarkets] = useState<PolymarketMarket[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string | undefined>();
  const [showResolved, setShowResolved] = useState(false);
  
  useEffect(() => {
    // Sort by groupItemThreshold for chronological order
    const sortedMarkets = [...markets].sort((a, b) => 
      Number(a.groupItemThreshold || 0) - Number(b.groupItemThreshold || 0)
    );
    
    // Separate active from resolved
    const active = sortedMarkets.filter(m => !m.closed && m.active);
    const resolved = sortedMarkets.filter(m => m.closed);
    
    setActiveMarkets(active);
    setResolvedMarkets(resolved);
    
    if (active.length > 0 && !selectedMarketId) {
      setSelectedMarketId(active[0].id);
    }
  }, [markets]);
  
  const selectedMarket = activeMarkets.find(m => m.id === selectedMarketId) || activeMarkets[0];
  
  const outcomes: string[] = selectedMarket ? JSON.parse(selectedMarket.outcomes) : [];
  const clobTokenIds: string[] = selectedMarket ? JSON.parse(selectedMarket.clobTokenIds) : [];

  return (
    <div className="space-y-6">
      {/* Active Markets Timeline */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8">
        <h3 className="text-lg font-bold text-white mb-2">Independent Multi-Market (Timeline)</h3>
        <p className="text-sm text-gray-400 mb-4">
          📅 Timeline events - multiple or none can resolve to Yes (cascade resolution)
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
                  <span className="text-sm font-bold text-white">{market.groupItemTitle || "Date"}</span>
                  <span className="text-sm text-emerald-400">
                    {(price * 100).toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 truncate text-left">{market.question}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resolved Markets - Collapsible */}
      {resolvedMarkets.length > 0 && (
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Resolved Markets
              </h3>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                {resolvedMarkets.length}
              </span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${
                showResolved ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          
          {showResolved && (
            <div className="p-4 pt-0 border-t border-gray-800/50">
              <div className="space-y-2">
                {resolvedMarkets.map((market) => {
                  const price = market.outcomePrices ? parseFloat(JSON.parse(market.outcomePrices)[0]) : 0;
                  const resolvedYes = price > 0.5;
                  
                  return (
                    <div
                      key={market.id}
                      className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-400">
                              {market.groupItemTitle || "Date"}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              resolvedYes 
                                ? "bg-green-900/30 text-green-400 border border-green-700"
                                : "bg-red-900/30 text-red-400 border border-red-700"
                            }`}>
                              {resolvedYes ? "✓ YES" : "✗ NO"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{market.question}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Orderbook for selected ACTIVE market only */}
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
