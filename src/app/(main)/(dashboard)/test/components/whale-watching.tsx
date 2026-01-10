"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, DollarSign, TrendingUp, TrendingDown, Activity, Settings, ChevronDown, ChevronUp, Filter, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";
import { WhaleHistory } from "./whale-history";
import { TopHolders } from "./top-holders";

/**
 * Trade Message Interface based on Polymarket WebSocket API
 * Topic: "activity", Type: "trades"
 * Reference: https://github.com/Polymarket/real-time-data-client
 */
interface TradeMessage {
  topic: string;
  type: string;
  timestamp: number;
  connection_id: string;
  payload: {
    asset: string;           // ERC1155 token ID
    bio: string;             // User bio
    conditionId: string;     // Market condition ID
    eventSlug: string;       // Event slug
    icon: string;            // Market icon URL
    name: string;            // User name
    outcome: string;         // Human readable outcome (e.g., "Yes", "No")
    outcomeIndex: number;    // Outcome index
    price: number;           // Trade price (0-1)
    profileImage: string;    // User profile image URL
    proxyWallet: string;     // User wallet address
    pseudonym: string;       // User pseudonym
    side: "BUY" | "SELL";    // Trade side
    size: number;            // Trade size in tokens
    slug: string;            // Market slug
    timestamp: number;       // Trade timestamp
    title: string;           // Event title
    transactionHash: string; // Transaction hash
  };
}

/**
 * Structured event data with market relationships
 */
export interface WatchedEvent {
  eventSlug: string;
  eventId: string;
  markets: Array<{
    marketSlug: string;
    marketId: string;
    conditionId: string;
    outcomes?: string[];
    clobTokenIds?: string[];
  }>;
}

export function WhaleWatching({ 
  selectedEvents = []
}: { 
  selectedEvents?: WatchedEvent[];
}) {
  console.log("selectedEvents:", selectedEvents);
  // --- State Management ---
  const [trades, setTrades] = useState<TradeMessage[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("live");
  
  // History tab state (persisted across tab switches)
  const [historyTrades, setHistoryTrades] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historyCurrentPage, setHistoryCurrentPage] = useState<number>(1);
  
  // Holders tab state (persisted across tab switches)
  const [holdersData, setHoldersData] = useState<any[]>([]);
  const [isLoadingHolders, setIsLoadingHolders] = useState<boolean>(false);
  const [holdersCurrentPage, setHoldersCurrentPage] = useState<number>(1);
  
  // Filter states
  const [minValue, setMinValue] = useState<number>(1000); // Minimum trade value
  const [maxValue, setMaxValue] = useState<number | null>(null); // Maximum trade value
  const [minPrice, setMinPrice] = useState<number | null>(null); // Minimum share price (0-1)
  const [maxPrice, setMaxPrice] = useState<number | null>(null); // Maximum share price (0-1)
  const [traderAddress, setTraderAddress] = useState<string>(""); // Filter by trader wallet
  const [eventSlug, setEventSlug] = useState<string>(""); // Filter by event slug
  const [marketSlug, setMarketSlug] = useState<string>(""); // Filter by market slug
  const [tradeSide, setTradeSide] = useState<string>(""); // "BUY", "SELL", or ""
  const [outcome, setOutcome] = useState<string>(""); // "Yes", "No", or ""
  
  // Temp input values
  const [tempMinValue, setTempMinValue] = useState<string>("1000");
  const [tempMaxValue, setTempMaxValue] = useState<string>("");
  const [tempMinPrice, setTempMinPrice] = useState<string>("");
  const [tempMaxPrice, setTempMaxPrice] = useState<string>("");
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  
  // Refs to always access current filter values in WebSocket callbacks
  // This solves the stale closure problem
  const filtersRef = useRef({
    minValue,
    maxValue,
    minPrice,
    maxPrice,
    traderAddress,
    eventSlug,
    marketSlug,
    tradeSide,
    outcome
  });
  
  // Scroll container reference for maintaining scroll position
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Previous scroll height to detect when new content is added
  const prevScrollHeightRef = useRef<number>(0);

  // Keep filtersRef in sync with filter states
  useEffect(() => {
    filtersRef.current = {
      minValue,
      maxValue,
      minPrice,
      maxPrice,
      traderAddress,
      eventSlug,
      marketSlug,
      tradeSide,
      outcome
    };
    // console.log(`💰 Filters updated:`, filtersRef.current);
  }, [minValue, maxValue, minPrice, maxPrice, traderAddress, eventSlug, marketSlug, tradeSide, outcome]);

  /**
   * Connect to Polymarket WebSocket
   * Subscribes to "activity" topic with "trades" type
   */
  const connectWebSocket = () => {
    // Prevent multiple connections
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    setIsConnecting(true);
    
    try {
      // Create WebSocket connection
      const ws = new WebSocket("wss://ws-live-data.polymarket.com");
      
      // --- WebSocket Event Handlers ---
      
      ws.onopen = () => {
        console.log("✅ WebSocket connected to Polymarket");
        setIsConnected(true);
        setIsConnecting(false);
        
        // Subscribe to trades activity
        const subscribeMessage = {
          action: "subscribe",
          subscriptions: [
            {
              topic: "activity",
              type: "trades",
              // No filters - receive all trades, filter client-side by size
            }
          ]
        };
        
        ws.send(JSON.stringify(subscribeMessage));
        console.log("📡 Subscribed to activity:trades");
      };
      
      ws.onmessage = (event: MessageEvent) => {
        // --- Handle WebSocket messages safely ---
        // The WebSocket may send: ping/pong messages, connection confirmations, or actual data
        // Skip empty messages
        if (!event.data || event.data.length === 0) {
          return;
        }
        // Skip non-string messages (binary data, etc.)
        if (typeof event.data !== "string") {
          return;
        }
        
        // Skip ping/pong and other control messages
        if (event.data === "ping" || event.data === "pong") {
          return;
        }
        
        try {
          const message: TradeMessage = JSON.parse(event.data);
          
          // Only process trade messages with payload
          if (message.topic === "activity" && message.type === "trades" && message.payload) {
            const tradeValue = message.payload.size * message.payload.price;
            const filters = filtersRef.current;
            
            // Apply all filters
            let passesFilters = true;
            
            // Filter by trade value (min/max)
            if (tradeValue < filters.minValue) {
              passesFilters = false;
            }
            if (filters.maxValue !== null && tradeValue > filters.maxValue) {
              passesFilters = false;
            }
            
            // Filter by share price (min/max)
            if (filters.minPrice !== null && message.payload.price < filters.minPrice) {
              passesFilters = false;
            }
            if (filters.maxPrice !== null && message.payload.price > filters.maxPrice) {
              passesFilters = false;
            }
            
            // Filter by trader address (supports multiple, comma-separated)
            if (filters.traderAddress) {
              const traderAddresses = filters.traderAddress.split(',').map(a => a.trim().toLowerCase()).filter(a => a);
              if (traderAddresses.length > 0) {
                const matches = traderAddresses.some(addr => 
                  message.payload.proxyWallet.toLowerCase().includes(addr)
                );
                if (!matches) {
                  passesFilters = false;
                }
              }
            }
            
            // Filter by event slug (supports multiple, comma-separated)
            if (filters.eventSlug) {
              const eventSlugs = filters.eventSlug.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
              if (eventSlugs.length > 0) {
                const matches = eventSlugs.some(slug => 
                  message.payload.eventSlug.toLowerCase().includes(slug)
                );
                if (!matches) {
                  passesFilters = false;
                }
              }
            }
            
            // Filter by market slug (supports multiple, comma-separated)
            if (filters.marketSlug) {
              const marketSlugs = filters.marketSlug.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
              if (marketSlugs.length > 0) {
                const matches = marketSlugs.some(slug => 
                  message.payload.slug.toLowerCase().includes(slug)
                );
                if (!matches) {
                  passesFilters = false;
                }
              }
            }
            
            // Filter by trade side (BUY/SELL)
            if (filters.tradeSide && message.payload.side !== filters.tradeSide) {
              passesFilters = false;
            }
            
            // Filter by outcome (Yes/No)
            if (filters.outcome && message.payload.outcome !== filters.outcome) {
              passesFilters = false;
            }
            
            // 🔍 DEBUG: Log filtering decision
            // console.log(`📊 Trade: $${tradeValue.toFixed(2)} | ${message.payload.side} ${message.payload.outcome} @ ${(message.payload.price * 100).toFixed(1)}¢ | Pass: ${passesFilters}`);
            
            if (passesFilters) {
              setTrades(prev => [message, ...prev].slice(0, 50)); // Keep last 50 trades
              // console.log(`🐋 Whale trade ACCEPTED: $${tradeValue.toFixed(2)} - ${message.payload.outcome} @ ${(message.payload.price * 100).toFixed(1)}¢`);
            } else {
              // console.log(`🚫 Trade REJECTED by filters`);
            }
          }
        } catch (error) {
          // Silently ignore non-JSON messages (subscription confirmations, etc.)
          // Only log if it looks like it should have been JSON
          if (event.data.includes("{") || event.data.includes("payload")) {
            console.warn("Failed to parse WebSocket message:", event.data);
          }
        }
      };
      
      ws.onerror = (error) => {
        // --- Handle WebSocket errors ---
        // Note: Browser WebSocket API doesn't provide detailed error info in the error event
        // This is normal browser security behavior
        console.warn("⚠️ WebSocket connection issue (will auto-reconnect)");
        setIsConnecting(false);
      };
      
      ws.onclose = (event) => {
        console.log("🔌 WebSocket disconnected", event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          console.log("🔄 Attempting to reconnect...");
          connectWebSocket();
        }, 5000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect from WebSocket
   */
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
      setTrades([]);
    }
  };

  /**
   * Update filters and clear trades
   */
  const applyFilters = () => {
    // Parse and validate min value
    const minVal = parseFloat(tempMinValue);
    if (!isNaN(minVal) && minVal >= 0) {
      setMinValue(minVal);
    }
    
    // Parse and validate max value
    const maxVal = tempMaxValue ? parseFloat(tempMaxValue) : null;
    if (maxVal === null || (!isNaN(maxVal) && maxVal >= 0)) {
      setMaxValue(maxVal);
    }
    
    // Parse and validate min price (0-1 range)
    const minPr = tempMinPrice ? parseFloat(tempMinPrice) : null;
    if (minPr === null || (!isNaN(minPr) && minPr >= 0 && minPr <= 1)) {
      setMinPrice(minPr);
    }
    
    // Parse and validate max price (0-1 range)
    const maxPr = tempMaxPrice ? parseFloat(tempMaxPrice) : null;
    if (maxPr === null || (!isNaN(maxPr) && maxPr >= 0 && maxPr <= 1)) {
      setMaxPrice(maxPr);
    }
    
    // Clear existing trades when filters change
    setTrades([]);
  };
  
  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setMinValue(1000);
    setMaxValue(null);
    setMinPrice(null);
    setMaxPrice(null);
    setTraderAddress("");
    setEventSlug("");
    setMarketSlug("");
    setTradeSide("");
    setOutcome("");
    
    setTempMinValue("1000");
    setTempMaxValue("");
    setTempMinPrice("");
    setTempMaxPrice("");
    
    setTrades([]);
  };

  // Auto-connect on component mount
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply external filters when they change (from parent component)
  useEffect(() => {
    if (selectedEvents.length > 0) {
      // Extract all event and market slugs from the structured data
      const eventSlugs = selectedEvents.map(e => e.eventSlug).join(', ');
      const marketSlugs = selectedEvents.flatMap(e => e.markets.map(m => m.marketSlug)).join(', ');
      
      setEventSlug(eventSlugs);
      setMarketSlug(marketSlugs);
      setShowFilters(true); // Auto-expand filters to show what was applied
      setTrades([]); // Clear existing trades
    }
  }, [selectedEvents]);

  // Maintain scroll position when new trades are added at the top
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    // Get the current scroll position
    const currentScrollTop = scrollContainer.scrollTop;
    const currentScrollHeight = scrollContainer.scrollHeight;
    
    // Check if user is at the very top (within 10px threshold)
    const isAtTop = currentScrollTop < 10;
    
    // If not at top and scroll height changed (new content added)
    if (!isAtTop && prevScrollHeightRef.current > 0 && currentScrollHeight !== prevScrollHeightRef.current) {
      // Calculate the difference in scroll height
      const heightDifference = currentScrollHeight - prevScrollHeightRef.current;
      
      // Adjust scroll position to maintain view of same content
      scrollContainer.scrollTop = currentScrollTop + heightDifference;
    }
    
    // Update previous scroll height
    prevScrollHeightRef.current = currentScrollHeight;
  }, [trades]); // Run when trades change

  return (
    <Card className="border border-white/10 bg-[#0F1115] shadow-lg h-full flex flex-col overflow-hidden">
      {/* --- Header Section --- */}
      <CardHeader className="border-b border-white/10 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Eye className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                Whale Watching
                {isConnected && (
                  <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-400 text-xs">
                    <Activity className="h-3 w-3 mr-1 animate-pulse" />
                    LIVE
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Real-time large trades on Polymarket
              </p>
            </div>
          </div>
        </div>

        {/* --- Filter Controls (Only for Live Trades tab) --- */}
        {activeTab === "live" && (
        <div className="space-y-3 mt-4">
          {/* Quick Filters Row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-white/40 flex-shrink-0" />
              <Input
                type="number"
                value={tempMinValue}
                onChange={(e) => setTempMinValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="Min value"
                className="bg-black/40 border-white/10 text-white h-8 text-sm"
              />
              <Input
                type="number"
                value={tempMaxValue}
                onChange={(e) => setTempMaxValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="Max value"
                className="bg-black/40 border-white/10 text-white h-8 text-sm"
              />
            </div>
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="h-8 border-white/10 hover:bg-white/5"
            >
              <Filter className="h-3 w-3 mr-1" />
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={applyFilters}
              className="h-8 border-white/10 hover:bg-white/5"
            >
              Apply
            </Button>
            
            {/* Connection Status */}
            {isConnecting && (
              <span className="text-xs text-yellow-400 whitespace-nowrap">Connecting...</span>
            )}
            {!isConnected && !isConnecting && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={connectWebSocket}
                className="h-8 text-xs border-white/10 hover:bg-white/5 whitespace-nowrap"
              >
                Reconnect
              </Button>
            )}
          </div>

          {/* Advanced Filters (Collapsible) */}
          {showFilters && (
            <div className="space-y-2 p-3 bg-black/20 rounded-lg border border-white/5">
              {/* Share Price Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Min Share Price (0-1)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={tempMinPrice}
                    onChange={(e) => setTempMinPrice(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    placeholder="e.g. 0.5"
                    className="bg-black/40 border-white/10 text-white h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Max Share Price (0-1)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={tempMaxPrice}
                    onChange={(e) => setTempMaxPrice(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    placeholder="e.g. 0.8"
                    className="bg-black/40 border-white/10 text-white h-8 text-sm"
                  />
                </div>
              </div>

              {/* Trader & Event */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Trader Address(es)</label>
                  <Input
                    type="text"
                    value={traderAddress}
                    onChange={(e) => setTraderAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    placeholder="0x..., 0x... (comma-separated)"
                    className="bg-black/40 border-white/10 text-white h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Event Slug(s)</label>
                  <Input
                    type="text"
                    value={eventSlug}
                    onChange={(e) => setEventSlug(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    placeholder="event-1, event-2"
                    className="bg-black/40 border-white/10 text-white h-8 text-sm"
                  />
                </div>
              </div>

              {/* Market Slug (Full Width) */}
              <div>
                <label className="text-xs text-white/60 mb-1 block">Market Slug(s) - Specific</label>
                <Input
                  type="text"
                  value={marketSlug}
                  onChange={(e) => setMarketSlug(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                  placeholder="market-1, market-2, market-3 (comma-separated)"
                  className="bg-black/40 border-white/10 text-white h-8 text-sm"
                />
              </div>

              {/* Trade Type & Outcome */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Trade Side</label>
                  <select
                    value={tradeSide}
                    onChange={(e) => setTradeSide(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white h-8 text-sm rounded-md px-2"
                  >
                    <option value="">All</option>
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Outcome</label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-white h-8 text-sm rounded-md px-2"
                  >
                    <option value="">All</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={clearFilters}
                  className="h-8 text-xs border-white/10 hover:bg-white/5 flex-1"
                >
                  Clear All
                </Button>
                <Button 
                  size="sm" 
                  variant="default"
                  onClick={applyFilters}
                  className="h-8 text-xs flex-1"
                >
                  Apply Filters
                </Button>
              </div>

              {/* Active Filters Display */}
              <div className="flex flex-wrap gap-1 pt-2 border-t border-white/5">
                {minValue > 0 && (
                  <Badge className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                    Min: ${minValue.toLocaleString()}
                  </Badge>
                )}
                {maxValue !== null && (
                  <Badge className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
                    Max: ${maxValue.toLocaleString()}
                  </Badge>
                )}
                {minPrice !== null && (
                  <Badge className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                    Min Price: {(minPrice * 100).toFixed(0)}¢
                  </Badge>
                )}
                {maxPrice !== null && (
                  <Badge className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                    Max Price: {(maxPrice * 100).toFixed(0)}¢
                  </Badge>
                )}
                {traderAddress && (
                  <Badge className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                    Trader{traderAddress.split(',').filter(a => a.trim()).length > 1 ? 's' : ''}: {
                      traderAddress.split(',').length > 1 
                        ? `${traderAddress.split(',').filter(a => a.trim()).length} addresses`
                        : traderAddress.slice(0, 6) + '...'
                    }
                  </Badge>
                )}
                {eventSlug && (
                  <Badge className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                    Event{eventSlug.split(',').filter(s => s.trim()).length > 1 ? 's' : ''}: {
                      eventSlug.split(',').length > 1
                        ? `${eventSlug.split(',').filter(s => s.trim()).length} events`
                        : eventSlug
                    }
                  </Badge>
                )}
                {marketSlug && (
                  <Badge className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                    Market{marketSlug.split(',').filter(s => s.trim()).length > 1 ? 's' : ''}: {
                      marketSlug.split(',').length > 1
                        ? `${marketSlug.split(',').filter(s => s.trim()).length} markets`
                        : marketSlug
                    }
                  </Badge>
                )}
                {tradeSide && (
                  <Badge className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/20">
                    {tradeSide}
                  </Badge>
                )}
                {outcome && (
                  <Badge className="text-xs bg-pink-500/10 text-pink-400 border-pink-500/20">
                    {outcome}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
        )}
      </CardHeader>

      {/* --- Tabs Section --- */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start border-b border-white/10 bg-transparent rounded-none h-12 px-4">
          <TabsTrigger value="live" className="gap-2">
            <Activity className="h-4 w-4" />
            Live Trades
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Activity className="h-4 w-4" />
            Recent History
          </TabsTrigger>
          <TabsTrigger value="holders" className="gap-2">
            <Users className="h-4 w-4" />
            Top Holders
          </TabsTrigger>
        </TabsList>

        {/* Live Trades Tab */}
        <TabsContent value="live" className="flex-1 overflow-hidden m-0">
          <CardContent ref={scrollContainerRef} className="h-full overflow-y-auto p-0">
            {trades.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <Eye className="h-12 w-12 text-white/20 mb-4" />
                <p className="text-white/40 text-sm">
                  {isConnected 
                    ? `Waiting for trades ≥ $${minValue.toLocaleString()}...` 
                    : "Connecting to Polymarket..."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {trades.map((trade, idx) => {
                  const tradeValue = trade.payload.size * trade.payload.price;
                  const isBuy = trade.payload.side === "BUY";
                  
                  return (
                    <div 
                      key={`${trade.payload.transactionHash}-${idx}`}
                      className="p-4 hover:bg-white/5 transition-colors"
                    >
                      {/* Trade Header: User & Time */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {trade.payload.profileImage ? (
                            <Image 
                              src={trade.payload.profileImage} 
                              alt={trade.payload.name}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full border border-white/10"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-purple-500/20 border border-purple-500/20" />
                          )}
                          {/* Clickable username - links to user's address page */}
                          <Link
                            target="_blank"
                            href={`/address/${trade.payload.proxyWallet}`}
                            className="text-sm font-medium text-white/90 hover:text-purple-400 transition-colors"
                          >
                            {trade.payload.pseudonym || trade.payload.name || "Anonymous"}
                          </Link>
                        </div>
                        <span className="text-xs text-white/40">
                          {/* Convert Unix timestamp (seconds) to milliseconds for date-fns */}
                          {formatDistanceToNow(trade.payload.timestamp * 1000)} ago
                        </span>
                      </div>

                      {/* Trade Details */}
                      <div className="space-y-2">
                        {/* Market Title */}
                        <Link
                          href={`https://polymarket.com/event/${trade.payload.eventSlug}/${trade.payload.slug}`}
                          target="_blank"
                          className="text-sm text-white/80 hover:text-blue-400 transition-colors line-clamp-2 block"
                        >
                          {trade.payload.title}
                        </Link>

                        {/* Trade Info Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Side & Outcome */}
                          <div className="flex items-center gap-2">
                            {isBuy ? (
                              <TrendingUp className="h-4 w-4 text-green-400" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-400" />
                            )}
                            <span className={`text-xs font-bold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.payload.side}
                            </span>
                            <span className="text-xs text-white/60">
                              {trade.payload.outcome}
                            </span>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            <span className="text-xs text-white/40">Price: </span>
                            <span className="text-xs font-mono font-bold text-white/90">
                              {(trade.payload.price * 100).toFixed(1)}¢
                            </span>
                          </div>

                          {/* Size */}
                          <div>
                            <span className="text-xs text-white/40">Size: </span>
                            <span className="text-xs font-mono text-white/80">
                              {trade.payload.size.toLocaleString()} shares
                            </span>
                          </div>

                          {/* Total Value - Highlighted */}
                          <div className="text-right">
                            <span className="text-xs text-white/40">Value: </span>
                            <span className="text-sm font-mono font-bold text-purple-400">
                              ${tradeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </TabsContent>

        {/* Historical Trades Tab - Placeholder */}
        <TabsContent value="history" className="flex-1 overflow-hidden m-0">
          <CardContent className="h-full overflow-y-auto p-0">
            <WhaleHistory 
              selectedEvents={selectedEvents}
              tradeHistory={historyTrades}
              setTradeHistory={setHistoryTrades}
              isLoadingTrades={isLoadingHistory}
              setIsLoadingTrades={setIsLoadingHistory}
              currentPage={historyCurrentPage}
              setCurrentPage={setHistoryCurrentPage}
            />
          </CardContent>
        </TabsContent>

        {/* Top Holders Tab */}
        <TabsContent value="holders" className="flex-1 overflow-hidden m-0">
          <CardContent className="h-full overflow-y-auto p-0">
            <TopHolders
              selectedEvents={selectedEvents}
              holdersData={holdersData}
              setHoldersData={setHoldersData}
              isLoadingHolders={isLoadingHolders}
              setIsLoadingHolders={setIsLoadingHolders}
              currentPage={holdersCurrentPage}
              setCurrentPage={setHoldersCurrentPage}
            />
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
