"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVaticUser } from "@/app/(main)/hooks/use-vatic-user";
import type { PolymarketMarket, ClobReward } from "../../../actions/event";

interface OrderbookOrder {
  price: string;
  size: string;
}

interface OrderbookData {
  bids: OrderbookOrder[];
  asks: OrderbookOrder[];
  hash?: string;
}

interface OutcomeData {
  name: string;
  tokenId: string;
  orderbook: OrderbookData;
}

interface OrderbookProps {
  outcomes: string[]; // ["Yes", "No"] or ["Up", "Down"]
  clobTokenIds: string[]; // Matching token IDs
  market: PolymarketMarket; // Full market data including rewards
}

export function Orderbook({ outcomes, clobTokenIds, market }: OrderbookProps) {
  console.log("inside orderbook component", { outcomes, clobTokenIds, market });
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [outcomesData, setOutcomesData] = useState<OutcomeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [showRewardsTooltip, setShowRewardsTooltip] = useState(false);
  const [bestBid, setBestBid] = useState<number | null>(null);
  const [bestAsk, setBestAsk] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const credentialsLoadedRef = useRef(false);
  const reconnectDelayRef = useRef(1000);
  const isCleanedUpRef = useRef(false); // Track if component/market is being cleaned up
  const currentTokenIdsRef = useRef<string[]>(clobTokenIds); // Track current market's token IDs
  
  // Get CLOB credentials for WebSocket authentication
  const { clobCredentials, loadClobCredentials, auth } = useVaticUser();
  
  // Check if market is closed/resolved
  const isMarketClosed = market.closed || !market.acceptingOrders;
  
  // Extract rewards info
  const hasRewards = market.clobRewards && market.clobRewards.length > 0;
  const rewardsDailyRate = hasRewards ? market.clobRewards![0].rewardsDailyRate : 0;
  const rewardsMinSize = market.rewardsMinSize || 0;
  const rewardsMaxSpread = market.rewardsMaxSpread || 0;

  // Calculate midpoint from best bid/ask
  const midpoint = bestBid && bestAsk && bestBid > 0 && bestAsk > 0 ? (bestBid + bestAsk) / 2 : 0;

  // Load CLOB credentials on mount if not already loaded
  useEffect(() => {
    // Only load once
    if (credentialsLoadedRef.current) return;
    
    if (auth.authenticated && !clobCredentials?.apiKey) {
      credentialsLoadedRef.current = true;
      console.log("Loading CLOB credentials for orderbook WebSocket...");
      loadClobCredentials().then((creds) => {
        if (creds) {
          console.log("CLOB credentials loaded:", {
            address: creds.address,
            apiKey: creds.apiKey?.substring(0, 8) + "...",
            hasSecret: !!creds.secret,
            hasPassphrase: !!creds.passphrase,
          });
        } else {
          console.warn("No CLOB credentials found for user");
        }
      });
    } else if (clobCredentials?.apiKey && !credentialsLoadedRef.current) {
      credentialsLoadedRef.current = true;
      console.log("CLOB credentials already available:", {
        address: clobCredentials.address,
        apiKey: clobCredentials.apiKey?.substring(0, 8) + "...",
        hasSecret: !!clobCredentials.secret,
        hasPassphrase: !!clobCredentials.passphrase,
      });
    }
  }, [auth.authenticated, clobCredentials?.apiKey]); // Only depend on auth status and whether credentials exist

  // Initialize orderbook data for each outcome
  useEffect(() => {
    // Reset cleanup flag for new market
    isCleanedUpRef.current = false;
    // Update current token IDs
    currentTokenIdsRef.current = clobTokenIds;
    
    // Clear previous orderbook data immediately when markets change
    setOutcomesData([]);
    setLoading(true);
    setBestBid(null);
    setBestAsk(null);
    
    const initialData: OutcomeData[] = outcomes.map((name, index) => ({
      name,
      tokenId: clobTokenIds[index],
      orderbook: { bids: [], asks: [] },
    }));
    setOutcomesData(initialData);

    // Fetch initial orderbook snapshots
    Promise.all(
      initialData.map(async (outcome) => {
        try {
          const response = await fetch(
            `https://clob.polymarket.com/book?token_id=${outcome.tokenId}`
          );
          if (!response.ok) throw new Error("Failed to fetch orderbook");
          const data = await response.json();
          return {
            ...outcome,
            orderbook: {
              bids: data.bids || [],
              asks: data.asks || [],
              hash: data.hash,
            },
          };
        } catch (error) {
          console.error(`Error fetching orderbook for ${outcome.name}:`, error);
          return outcome;
        }
      })
    ).then((data) => {
      setOutcomesData(data);
      setLoading(false);
    });

    // Initialize WebSocket connection for real-time updates
    const initWebSocket = () => {
      // Only connect if we have credentials
      if (!clobCredentials?.apiKey || !clobCredentials?.secret || !clobCredentials?.passphrase) {
        console.log("Waiting for CLOB credentials before connecting WebSocket...");
        return;
      }

      console.log("Initializing WebSocket connection for orderbook...");
      const ws = new WebSocket("wss://ws-subscriptions-clob.polymarket.com/ws/market");
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelayRef.current = 1000; // Reset on successful connect
        setWsStatus('connected');
        console.log("WebSocket connected! Subscribing to markets...");
        
        // Subscribe to all token IDs
        const subscriptionMessage = {
          type: "market",
          assets_ids: clobTokenIds, // Note: assets_ids with underscore!
          auth: {
            apiKey: clobCredentials.apiKey,
            secret: clobCredentials.secret,
            passphrase: clobCredentials.passphrase,
          },
        };

        ws.send(JSON.stringify(subscriptionMessage));
        console.log("Subscription sent for token IDs:", clobTokenIds);

        // Start PING/PONG keep-alive (every 10 seconds)
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("PING");
          }
        }, 10000);

        // Store interval for cleanup
        (ws as any).pingInterval = pingInterval;
      };

      ws.onmessage = (event) => {
        try {
          // Handle PONG response
          if (event.data === "PONG") {
            console.log("Received PONG");
            return;
          }

          const parsed = JSON.parse(event.data);
          // Messages always come as arrays
          const messages = Array.isArray(parsed) ? parsed : [parsed];

          messages.forEach((message) => {
            handleWebSocketMessage(message);
          });
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        // Silently ignore errors if component/market is being cleaned up
        // Also ignore if this is not the current websocket (rapid market switching)
        if (isCleanedUpRef.current || wsRef.current !== ws) {
          return;
        }
        console.log("WebSocket connection issue (non-critical):", error);
      };

      ws.onclose = (event) => {
        // Silently handle close if component/market is being cleaned up
        if (isCleanedUpRef.current) {
          return;
        }
        
        setWsStatus('disconnected');
        console.log("WebSocket closed:", event.code, event.reason);
        // Clear ping interval
        if ((ws as any).pingInterval) {
          clearInterval((ws as any).pingInterval);
        }
        
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        setTimeout(() => {
          if (clobCredentials?.apiKey && !isCleanedUpRef.current) {
            console.log(`Reconnecting in ${reconnectDelayRef.current}ms...`);
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
            initWebSocket();
          }
        }, reconnectDelayRef.current);
      };
    };

    // Helper function to handle different message types
    const handleWebSocketMessage = (message: any) => {
      // Ignore messages if we're in cleanup or if the market has changed
      if (isCleanedUpRef.current) {
        console.log("Ignoring message - component is cleaned up");
        return;
      }
      
      const { event_type } = message;

      switch (event_type) {
        case "book":
          // Full orderbook snapshot - has asset_id at top level
          const bookAssetId = message.asset_id;
          
          // Verify this asset_id belongs to the current market
          if (!currentTokenIdsRef.current.includes(bookAssetId)) {
            console.warn("Ignoring 'book' for asset_id not in current market:", bookAssetId);
            return;
          }
          
          const bookOutcomeIndex = currentTokenIdsRef.current.indexOf(bookAssetId);
          
          if (bookOutcomeIndex === -1) {
            console.warn("Received 'book' for unknown asset_id:", bookAssetId);
            return;
          }

          console.log(`Received 'book' message for ${outcomes[bookOutcomeIndex]}`);
          setOutcomesData((prev) => {
            const updated = [...prev];
            updated[bookOutcomeIndex] = {
              ...updated[bookOutcomeIndex],
              orderbook: {
                bids: message.bids || [],
                asks: message.asks || [],
                hash: message.hash,
              },
            };
            return updated;
          });
          break;

        case "price_change":
          // Incremental updates - price_changes is an array, each with its own asset_id
          console.log(`Received 'price_change' with ${message.price_changes?.length || 0} changes`);
          
          if (message.price_changes && message.price_changes.length > 0) {
            message.price_changes.forEach((change: any) => {
              const changeAssetId = change.asset_id;
              
              // Verify this asset_id belongs to the current market
              if (!currentTokenIdsRef.current.includes(changeAssetId)) {
                console.warn("Ignoring price change for asset_id not in current market:", changeAssetId);
                return;
              }
              
              const outcomeIndex = currentTokenIdsRef.current.indexOf(changeAssetId);

              if (outcomeIndex === -1) {
                console.warn("Price change for unknown asset_id:", changeAssetId);
                return;
              }

              console.log(`  - Updating ${outcomes[outcomeIndex]}: ${change.side} ${change.size} @ ${change.price}`);

              setOutcomesData((prev) => {
                const updated = [...prev];
                const currentBook = { ...updated[outcomeIndex].orderbook };
                const side = change.side === "BUY" ? "bids" : "asks";
                const orders = [...currentBook[side]];
                const existingIndex = orders.findIndex((o) => o.price === change.price);

                if (parseFloat(change.size) === 0) {
                  // Remove order
                  if (existingIndex !== -1) {
                    orders.splice(existingIndex, 1);
                  }
                } else if (existingIndex !== -1) {
                  // Update existing order
                  orders[existingIndex].size = change.size;
                } else {
                  // Add new order
                  orders.push({ price: change.price, size: change.size });
                }

                currentBook[side] = orders;
                updated[outcomeIndex].orderbook = currentBook;
                return updated;
              });
            });
          }
          break;

        case "last_trade_price":
          // Has asset_id at top level (if present, or market-level)
          console.log(`Last trade price: ${message.price} at ${message.timestamp}`);
          break;

        case "best_bid_ask":
          // Has asset_id at top level - update best bid/ask state
          const bbaAssetId = message.asset_id;
          
          // Verify this asset_id belongs to the current market
          if (!currentTokenIdsRef.current.includes(bbaAssetId)) {
            console.warn("Ignoring best_bid_ask for asset_id not in current market:", bbaAssetId);
            return;
          }
          
          const bbaOutcomeIndex = currentTokenIdsRef.current.indexOf(bbaAssetId);
          if (bbaOutcomeIndex !== -1) {
            console.log(`Best bid/ask updated for ${outcomes[bbaOutcomeIndex]}: ${message.best_bid}/${message.best_ask}`);
            // Update best bid/ask for rewards calculations (using first outcome)
            if (bbaOutcomeIndex === 0) {
              setBestBid(parseFloat(message.best_bid));
              setBestAsk(parseFloat(message.best_ask));
            }
          }
          break;

        case "tick_size_change":
          console.log(`Tick size changed: ${message.tick_size}`);
          break;

        default:
          console.log("Unknown message type:", event_type, message);
      }
    };

    // Initialize WebSocket when credentials are available
    if (clobCredentials?.apiKey) {
      initWebSocket();
    }

    // Cleanup function
    return () => {
      console.log("Cleaning up orderbook for market change...");
      
      // Mark as cleaned up to ignore any incoming messages
      isCleanedUpRef.current = true;
      
      // Close WebSocket connection
      if (wsRef.current) {
        // Clear ping interval
        if ((wsRef.current as any).pingInterval) {
          clearInterval((wsRef.current as any).pingInterval);
        }
        wsRef.current.close();
        wsRef.current = null;
        console.log("WebSocket connection closed (cleanup)");
      }
      
      // Clear all orderbook state
      setOutcomesData([]);
      setBestBid(null);
      setBestAsk(null);
      setWsStatus('disconnected');
    };
  }, [outcomes, clobTokenIds, clobCredentials]);

  // Manual reconnect function
  const reconnectWebSocket = useCallback(() => {
    console.log("Manual reconnect triggered...");
    
    // Close existing connection
    if (wsRef.current) {
      if ((wsRef.current as any).pingInterval) {
        clearInterval((wsRef.current as any).pingInterval);
      }
      wsRef.current.close();
    }
    
    // Reset reconnect delay
    reconnectDelayRef.current = 1000;
    
    // Trigger reconnection
    setWsStatus('connecting');
    
    // Re-fetch orderbook data and reconnect
    const initialData: OutcomeData[] = outcomes.map((name, index) => ({
      name,
      tokenId: clobTokenIds[index],
      orderbook: { bids: [], asks: [] },
    }));
    
    setLoading(true);
    Promise.all(
      initialData.map(async (outcome) => {
        try {
          const response = await fetch(
            `https://clob.polymarket.com/book?token_id=${outcome.tokenId}`
          );
          if (!response.ok) throw new Error("Failed to fetch orderbook");
          const data = await response.json();
          return {
            ...outcome,
            orderbook: {
              bids: data.bids || [],
              asks: data.asks || [],
              hash: data.hash,
            },
          };
        } catch (error) {
          console.error(`Error fetching orderbook for ${outcome.name}:`, error);
          return outcome;
        }
      })
    ).then((data) => {
      setOutcomesData(data);
      setLoading(false);
    });
  }, [outcomes, clobTokenIds]);

  // RENDER LOGIC - ALL HOOKS MUST BE ABOVE THIS LINE
  
  // If market is closed, show resolved state instead of orderbook
  if (isMarketClosed) {
    const outcomes_parsed = market.outcomes ? JSON.parse(market.outcomes) : outcomes;
    const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [];
    const winningOutcome = prices[0] > prices[1] ? outcomes_parsed[0] : outcomes_parsed[1];
    const winningPrice = Math.max(parseFloat(prices[0] || "0"), parseFloat(prices[1] || "0"));
    
    return (
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8">
        <div className="text-center space-y-4">
          <div className="text-4xl">🏁</div>
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Market Resolved</h3>
            <p className="text-sm text-gray-400 mb-4">This market has closed and been resolved</p>
          </div>
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-900/20 border border-green-700/50 rounded-xl">
            <span className="text-sm text-gray-400">Winning Outcome:</span>
            <span className="text-lg font-bold text-green-400">{winningOutcome}</span>
            <span className="text-sm text-green-300">@ {(winningPrice * 100).toFixed(1)}¢</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-800 rounded w-1/3"></div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
        <h3 className="text-lg font-bold text-white">Order Book</h3>
        <div className="flex items-center gap-3">
          {hasRewards && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowRewardsTooltip(true)}
                onMouseLeave={() => setShowRewardsTooltip(false)}
                className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded hover:bg-yellow-500/30 transition-colors"
                title="Liquidity Rewards"
              >
                💰 Rewards
              </button>
              {showRewardsTooltip && (
                <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Daily Rate:</span>
                      <span className="text-white font-semibold">${rewardsDailyRate.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Min Size:</span>
                      <span className="text-white font-semibold">{rewardsMinSize} shares</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Spread:</span>
                      <span className="text-white font-semibold">{(rewardsMaxSpread * 100).toFixed(1)}¢</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-400">
                      Highlighted orders are eligible for liquidity rewards
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              wsStatus === 'connected' ? 'bg-green-500' : 
              wsStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`} />
            <span className="text-xs text-gray-400 capitalize">{wsStatus}</span>
          </div>
          <button
            onClick={reconnectWebSocket}
            disabled={wsStatus === 'connecting'}
            className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reconnect WebSocket"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
      
      <Tabs defaultValue={outcomes[0]} className="w-full">
        <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${outcomes.length}, 1fr)` }}>
          {outcomes.map((outcome) => (
            <TabsTrigger key={outcome} value={outcome}>
              Trade {outcome}
            </TabsTrigger>
          ))}
        </TabsList>

        {outcomesData.map((outcomeData) => (
          <TabsContent key={outcomeData.name} value={outcomeData.name} className="mt-4">
            <OrderbookDisplay 
              orderbook={outcomeData.orderbook} 
              outcomeName={outcomeData.name}
              midpoint={midpoint}
              rewardsMaxSpread={rewardsMaxSpread}
              hasRewards={hasRewards ?? false}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function OrderbookDisplay({ 
  orderbook, 
  outcomeName,
  midpoint,
  rewardsMaxSpread,
  hasRewards,
}: { 
  orderbook: OrderbookData; 
  outcomeName: string;
  midpoint: number;
  rewardsMaxSpread: number;
  hasRewards: boolean;
}) {
  const { bids, asks } = orderbook;
  const asksScrollRef = useRef<HTMLDivElement>(null);

  // Sort correctly:
  // - Asks: ASCENDING (lowest/best price first)
  // - Bids: DESCENDING (highest/best price first)
  const sortedAsks = [...asks].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  const sortedBids = [...bids].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

  // Best prices are now simple:
  const bestAsk = sortedAsks.length > 0 ? parseFloat(sortedAsks[0].price) : 0;
  const bestBid = sortedBids.length > 0 ? parseFloat(sortedBids[0].price) : 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPercent = bestAsk > 0 ? ((spread / bestAsk) * 100).toFixed(2) : "0.00";
  
  // Last trade price (using best bid for now, ideally from WebSocket)
  const lastPrice = bestBid;

  // Helper function to check if price is within rewards range
  const isEligibleForRewards = (price: number): boolean => {
    if (!hasRewards || !bestBid || !bestAsk || midpoint === 0) return false;
    const distanceFromMidpoint = Math.abs(price - midpoint);
    return distanceFromMidpoint <= rewardsMaxSpread;
  };

  // Calculate cumulative totals and sizes from best price outward
  const asksWithTotal = sortedAsks.map((ask, idx) => {
    const cumulativeSize = sortedAsks
      .slice(0, idx + 1)
      .reduce((sum, a) => sum + parseFloat(a.size), 0);
    return {
      ...ask,
      cumulativeSize,
      total: (cumulativeSize * parseFloat(ask.price)).toFixed(2),
    };
  });

  const bidsWithTotal = sortedBids.map((bid, idx) => {
    const cumulativeSize = sortedBids
      .slice(0, idx + 1)
      .reduce((sum, b) => sum + parseFloat(b.size), 0);
    return {
      ...bid,
      cumulativeSize,
      total: (cumulativeSize * parseFloat(bid.price)).toFixed(2),
    };
  });

  // Calculate max cumulative size for depth visualization
  const maxCumulativeSize = Math.max(
    asksWithTotal.length > 0 ? asksWithTotal[asksWithTotal.length - 1].cumulativeSize : 0,
    bidsWithTotal.length > 0 ? bidsWithTotal[bidsWithTotal.length - 1].cumulativeSize : 0,
    1
  );

  // Scroll asks to bottom on mount/update
  useEffect(() => {
    if (asksScrollRef.current) {
      asksScrollRef.current.scrollTop = asksScrollRef.current.scrollHeight;
    }
  }, [asksWithTotal]);

  return (
    <div className="space-y-0">
      {/* Header with Trade Type */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Trade {outcomeName}
          </span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pb-2">
        <div className="text-right">Price</div>
        <div className="text-right">Shares</div>
        <div className="text-right">Total</div>
      </div>

      {/* Asks Section (Sell Orders - Red) - Display in REVERSE so best ask is at bottom */}
      <div ref={asksScrollRef} className="space-y-0 mb-1 max-h-[300px] overflow-y-auto">
        {asksWithTotal.slice(0, 20).reverse().map((ask, index) => {
          const isBestAsk = parseFloat(ask.price) === bestAsk;
          const isRewardEligible = isEligibleForRewards(parseFloat(ask.price));
          return (
            <OrderRowEnhanced
              key={`ask-${index}`}
              price={ask.price}
              size={ask.size}
              total={ask.total}
              cumulativeSize={ask.cumulativeSize}
              maxCumulativeSize={maxCumulativeSize}
              type="ask"
              isBest={isBestAsk}
              isRewardEligible={isRewardEligible}
            />
          );
        })}
      </div>

      {/* Last Price & Spread */}
      <div className="my-2 py-2.5 px-3 bg-gray-800/40 rounded flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Last:</span>
            <span className="text-white font-semibold">{(lastPrice * 100).toFixed(0)}¢</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Spread:</span>
            <span className="text-white font-semibold">{(spread * 100).toFixed(0)}¢</span>
          </div>
        </div>
      </div>

      {/* Bids Section (Buy Orders - Green) */}
      <div className="space-y-0 mt-1 max-h-[300px] overflow-y-auto">
        {bidsWithTotal.slice(0, 20).map((bid, index) => {
          const isBestBid = parseFloat(bid.price) === bestBid;
          const isRewardEligible = isEligibleForRewards(parseFloat(bid.price));
          return (
            <OrderRowEnhanced
              key={`bid-${index}`}
              price={bid.price}
              size={bid.size}
              total={bid.total}
              cumulativeSize={bid.cumulativeSize}
              maxCumulativeSize={maxCumulativeSize}
              type="bid"
              isBest={isBestBid}
              isRewardEligible={isRewardEligible}
            />
          );
        })}
      </div>

      {sortedBids.length === 0 && sortedAsks.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No orders available
        </div>
      )}

      {/* Debug Info */}
      <details className="mt-4 pt-4 border-t border-gray-800">
        <summary className="text-xs text-gray-500 cursor-pointer">Debug Info</summary>
        <div className="mt-2 p-2 bg-gray-900 rounded text-xs font-mono text-gray-400 space-y-1">
          <div>Best Bid: ${bestBid.toFixed(3)} ({(bestBid * 100).toFixed(0)}¢)</div>
          <div>Best Ask: ${bestAsk.toFixed(3)} ({(bestAsk * 100).toFixed(0)}¢)</div>
          <div>Spread: ${spread.toFixed(3)} ({(spread * 100).toFixed(0)}¢ / {spreadPercent}%)</div>
          <div>Total Bids: {bids.length}</div>
          <div>Total Asks: {asks.length}</div>
          <div>Hash: {orderbook.hash}</div>
        </div>
      </details>
    </div>
  );
}

function OrderRowEnhanced({
  price,
  size,
  total,
  cumulativeSize,
  maxCumulativeSize,
  type,
  isBest,
  isRewardEligible = false,
}: {
  price: string;
  size: string;
  total: string;
  cumulativeSize: number;
  maxCumulativeSize: number;
  type: "bid" | "ask";
  isBest: boolean;
  isRewardEligible?: boolean;
}) {
  // Use cumulative size for depth visualization
  const cumulativePercent = (cumulativeSize / maxCumulativeSize) * 100;
  const bgColor = type === "bid" ? "bg-emerald-500/15" : "bg-red-500/15";
  const priceColor = type === "bid" ? "text-emerald-400" : "text-red-400";
  
  // Convert price from decimal to cents
  const priceInCents = (parseFloat(price) * 100).toFixed(0);

  return (
    <div className={`relative px-3 py-2 text-sm hover:bg-gray-800/60 transition-colors cursor-pointer ${isBest ? 'bg-gray-800/40' : ''} ${isRewardEligible ? 'border-l-2 border-yellow-500/50' : ''}`}>
      {/* Depth visualization - cumulative */}
      <div
        className={`absolute right-0 top-0 bottom-0 ${bgColor}`}
        style={{ width: `${cumulativePercent}%` }}
      />
      
      {/* Reward indicator */}
      {isRewardEligible && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500/30" />
      )}
      
      {/* Content - 3 column grid */}
      <div className="relative grid grid-cols-3 gap-4">
        <span className={`${priceColor} font-semibold text-right ${isRewardEligible ? 'flex items-center gap-1' : ''}`}>
          {isRewardEligible && <span className="text-[10px]">💰</span>}
          {priceInCents}¢
        </span>
        <span className="text-gray-300 text-right">
          {parseFloat(size).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-gray-400 text-right">
          ${parseFloat(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
