"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Activity, AlertCircle, CheckSquare, ChevronDown, ChevronRight, ExternalLink, Filter, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

interface WhaleHistoryProps {
  selectedEvents: WatchedEvent[];
  tradeHistory: any[];
  setTradeHistory: (trades: any[]) => void;
  isLoadingTrades: boolean;
  setIsLoadingTrades: (loading: boolean) => void;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
}

export function WhaleHistory({ 
  selectedEvents,
  tradeHistory,
  setTradeHistory,
  isLoadingTrades,
  setIsLoadingTrades,
  currentPage,
  setCurrentPage
}: WhaleHistoryProps) {
  // Selection state: track which event IDs are selected for fetching
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  
  // Selection state for individual markets (key: "eventId-marketId")
  const [selectedMarketIds, setSelectedMarketIds] = useState<Set<string>>(new Set());
  
  // Track which events are expanded to show their markets
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Track if the selection panel is collapsed (default to collapsed for cleaner UI)
  const [isSelectionCollapsed, setIsSelectionCollapsed] = useState<boolean>(true);
  
  // Track if the filters panel is collapsed (default to collapsed for cleaner UI)
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState<boolean>(true);

  // Trade history API filters (passed from parent or defaults)
  const [takerOnly, setTakerOnly] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'cash' | 'tokens' | ''>('');
  const [filterAmount, setFilterAmount] = useState<string>('');
  const [tradeUser, setTradeUser] = useState<string>('');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell' | ''>('');

  // Pagination config (state managed by parent)
  const tradesPerPage = 20;

  // Console log to see what props we're getting
  useEffect(() => {
    console.log("🐋 WhaleHistory Props:", {
      selectedEvents,
      eventsCount: selectedEvents.length,
      totalMarkets: selectedEvents.reduce((sum, e) => sum + e.markets.length, 0),
      eventIds: selectedEvents.map(e => e.eventId),
    });
  }, [selectedEvents]);

  // Auto-select all events when they first arrive
  useEffect(() => {
    if (selectedEvents.length > 0) {
      const allEventIds = new Set(selectedEvents.map(e => e.eventId));
      setSelectedEventIds(allEventIds);
      
      // Also select all markets
      const allMarketIds = new Set<string>();
      selectedEvents.forEach(event => {
        event.markets.forEach(market => {
          allMarketIds.add(`${event.eventId}-${market.marketId}`);
        });
      });
      setSelectedMarketIds(allMarketIds);
      
      // Auto-expand first event for better UX
      setExpandedEvents(new Set([selectedEvents[0].eventId]));
    }
  }, [selectedEvents]);

  // Check if user has selected any markets to watch
  const hasSelectedMarkets = selectedEvents.length > 0;

  // Fetch trade history from Polymarket API
  const fetchTradeHistory = async () => {
    setIsLoadingTrades(true);
    setTradeHistory([]);
    setCurrentPage(1); // Reset to first page on new fetch

    try {
      console.log("🔍 Selected event IDs:", Array.from(selectedEventIds));
      console.log("🔍 Selected market IDs (keys):", Array.from(selectedMarketIds));
      
      // Get selected condition IDs
      const selectedConditionIds = selectedEvents
        .filter((event) => {
          const isEventSelected = selectedEventIds.has(event.eventId);
          console.log(`Event ${event.eventId} selected:`, isEventSelected);
          return isEventSelected;
        })
        .flatMap((event) => {
          console.log(`Processing event ${event.eventId}, markets:`, event.markets.map(m => ({
            marketId: m.marketId,
            conditionId: m.conditionId,
            key: `${event.eventId}-${m.marketId}`,
            isKeyInSet: selectedMarketIds.has(`${event.eventId}-${m.marketId}`)
          })));
          
          return event.markets
            .filter((market) => {
              const key = `${event.eventId}-${market.marketId}`;
              const isSelected = selectedMarketIds.has(key);
              console.log(`Checking market ${market.marketId}, key: ${key}, selected: ${isSelected}`);
              return isSelected;
            })
            .map((market) => {
              console.log(`Extracting conditionId from market ${market.marketId}:`, market.conditionId);
              return market.conditionId;
            });
        });

      console.log("Fetching trades for condition IDs:", selectedConditionIds);
      console.log(`Total condition IDs: ${selectedConditionIds.length}`);

      if (selectedConditionIds.length === 0) {
        setTradeHistory([]);
        setIsLoadingTrades(false);
        return;
      }

      // Batch condition IDs into chunks of 50
      const BATCH_SIZE = 50;
      const batches: string[][] = [];
      for (let i = 0; i < selectedConditionIds.length; i += BATCH_SIZE) {
        batches.push(selectedConditionIds.slice(i, i + BATCH_SIZE));
      }

      console.log(`Split into ${batches.length} batch(es) of up to ${BATCH_SIZE} condition IDs`);

      // Fetch all batches in parallel
      const batchPromises = batches.map(async (batch, index) => {
        const params = new URLSearchParams();
        params.append("limit", "100");

        // Add condition IDs for this batch as comma-separated
        params.append("market", batch.join(","));

        // Add filters
        if (takerOnly) params.append("takerOnly", "true");
        if (filterType) params.append("filterType", filterType);
        if (filterAmount) params.append("filterAmount", filterAmount);
        if (tradeUser) params.append("user", tradeUser);
        if (tradeSide) params.append("side", tradeSide);

        console.log(`Batch ${index + 1}/${batches.length}: ${batch.length} condition IDs`);

        const url = `https://data-api.polymarket.com/trades?${params.toString()}`;
        console.log("🔗 Fetch URL:", url);

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`API error in batch ${index + 1}: ${response.status}`);
        }

        return response.json();
      });

      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises);

      // Merge and sort by timestamp (most recent first)
      const allTrades = batchResults
        .flat()
        .sort((a: any, b: any) => {
          // Sort by timestamp descending (newest first)
          const timeA = a.timestamp || a.created_at || 0;
          const timeB = b.timestamp || b.created_at || 0;
          return timeB - timeA;
        });

      console.log(`Fetched ${allTrades.length} total trades from ${batches.length} batch(es)`);
      setTradeHistory(allTrades);
    } catch (error) {
      console.error("Error fetching trade history:", error);
      setTradeHistory([]);
    } finally {
      setIsLoadingTrades(false);
    }
  };

  // Toggle event selection
  const toggleEvent = (eventId: string) => {
    const event = selectedEvents.find(e => e.eventId === eventId);
    if (!event) return;
    
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      const isCurrentlySelected = newSet.has(eventId);
      
      if (isCurrentlySelected) {
        newSet.delete(eventId);
        // Deselect all markets in this event
        setSelectedMarketIds(prevMarkets => {
          const newMarkets = new Set(prevMarkets);
          event.markets.forEach(market => {
            newMarkets.delete(`${eventId}-${market.marketId}`);
          });
          return newMarkets;
        });
      } else {
        newSet.add(eventId);
        // Select all markets in this event
        setSelectedMarketIds(prevMarkets => {
          const newMarkets = new Set(prevMarkets);
          event.markets.forEach(market => {
            newMarkets.add(`${eventId}-${market.marketId}`);
          });
          return newMarkets;
        });
      }
      return newSet;
    });
  };

  // Toggle individual market selection
  const toggleMarket = (eventId: string, marketId: string) => {
    const marketKey = `${eventId}-${marketId}`;
    const event = selectedEvents.find(e => e.eventId === eventId);
    if (!event) return;
    
    setSelectedMarketIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(marketKey)) {
        newSet.delete(marketKey);
        // If no markets selected in this event, deselect the event
        const hasAnyMarketSelected = event.markets.some(m => 
          m.marketId !== marketId && newSet.has(`${eventId}-${m.marketId}`)
        );
        if (!hasAnyMarketSelected) {
          setSelectedEventIds(prevEvents => {
            const newEvents = new Set(prevEvents);
            newEvents.delete(eventId);
            return newEvents;
          });
        }
      } else {
        newSet.add(marketKey);
        // If at least one market is selected, select the event
        setSelectedEventIds(prevEvents => {
          const newEvents = new Set(prevEvents);
          newEvents.add(eventId);
          return newEvents;
        });
      }
      return newSet;
    });
  };

  // Check if an event is partially selected (some but not all markets selected)
  const isEventPartiallySelected = (eventId: string): boolean => {
    const event = selectedEvents.find(e => e.eventId === eventId);
    if (!event) return false;
    
    const selectedCount = event.markets.filter(m => 
      selectedMarketIds.has(`${eventId}-${m.marketId}`)
    ).length;
    
    return selectedCount > 0 && selectedCount < event.markets.length;
  };

  // Toggle event expansion
  const toggleExpansion = (eventId: string) => {
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // Select all events
  const selectAll = () => {
    const allEventIds = new Set(selectedEvents.map(e => e.eventId));
    setSelectedEventIds(allEventIds);
    
    // Select all markets
    const allMarketIds = new Set<string>();
    selectedEvents.forEach(event => {
      event.markets.forEach(market => {
        allMarketIds.add(`${event.eventId}-${market.marketId}`);
      });
    });
    setSelectedMarketIds(allMarketIds);
  };

  // Deselect all events
  const deselectAll = () => {
    setSelectedEventIds(new Set());
    setSelectedMarketIds(new Set());
  };

  // Check if all events are selected
  const allSelected = selectedEvents.length > 0 && selectedEventIds.size === selectedEvents.length;

  // If no markets selected, show prompt to select
  if (!hasSelectedMarkets) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertCircle className="h-12 w-12 text-yellow-400/40 mb-4" />
        <p className="text-white/60 text-sm font-medium mb-2">
          No markets selected for whale watching
        </p>
        <p className="text-white/40 text-xs max-w-md">
          Click the &ldquo;Watch Whales&rdquo; button on any tweet in the feed to track whale activity for those markets
        </p>
      </div>
    );
  }

  // If markets are selected, show the selection interface
  return (
    <div className="h-full flex flex-col p-4 gap-4">
      {/* Header with Collapse/Expand & Select All/None */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsSelectionCollapsed(!isSelectionCollapsed)}
          className="flex items-center gap-2 hover:bg-white/5 px-2 py-1 rounded transition-colors"
        >
          {isSelectionCollapsed ? (
            <ChevronRight className="h-4 w-4 text-purple-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-purple-400" />
          )}
          <CheckSquare className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">
            Select Events ({selectedEventIds.size}/{selectedEvents.length})
          </h3>
        </button>
        <div className="flex items-center gap-2">
          {allSelected ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={deselectAll}
              className="h-7 text-xs text-white/60 hover:text-white"
            >
              Deselect All
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={selectAll}
              className="h-7 text-xs text-white/60 hover:text-white"
            >
              Select All
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Events & Markets Selection */}
      {!isSelectionCollapsed && (
        <ScrollArea className="max-h-[200px] border border-white/5 rounded-lg bg-black/20">
          <div className="p-2 space-y-2">
            {selectedEvents.map((event) => {
              const isSelected = selectedEventIds.has(event.eventId);
              const isExpanded = expandedEvents.has(event.eventId);
              
              return (
                <div
                  key={event.eventId}
                  className={`border rounded-lg transition-all ${
                    isSelected
                      ? 'border-purple-500/40 bg-purple-500/5'
                      : 'border-white/10 bg-black/20'
                  }`}
                >
                  {/* Event Header */}
                  <div className="flex items-center gap-2 p-3">
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleEvent(event.eventId)}
                      className={`border-white/20 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500 ${
                        isEventPartiallySelected(event.eventId) ? 'opacity-50' : ''
                      }`}
                    />
                    
                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleExpansion(event.eventId)}
                      className="p-0.5 hover:bg-white/5 rounded transition-colors shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-white/60" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-white/60" />
                      )}
                    </button>

                    {/* Event Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-cyan-400 truncate">
                          {event.eventSlug}
                        </span>
                        <span className="text-[10px] text-white/40 font-mono shrink-0">
                          ID: {event.eventId}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/50">
                        {event.markets.filter(m => selectedMarketIds.has(`${event.eventId}-${m.marketId}`)).length}/{event.markets.length} market{event.markets.length !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                  </div>

                  {/* Markets List (Collapsible) */}
                  {isExpanded && event.markets.length > 0 && (
                    <div className="border-t border-white/5 px-3 py-2 space-y-1">
                      {event.markets.map((market, idx) => {
                        const marketKey = `${event.eventId}-${market.marketId}`;
                        const isMarketSelected = selectedMarketIds.has(marketKey);
                        
                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 pl-3 py-1.5 text-xs rounded transition-colors ${
                              isMarketSelected ? 'bg-purple-500/10' : 'bg-white/5'
                            }`}
                          >
                            {/* Market Checkbox - smaller */}
                            <Checkbox
                              checked={isMarketSelected}
                              onCheckedChange={() => toggleMarket(event.eventId, market.marketId)}
                              className="h-3 w-3 border-white/20 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500"
                            />
                            
                            <div className="h-1 w-1 rounded-full bg-yellow-400/60 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-yellow-400/80 truncate block">
                                {market.marketSlug}
                              </span>
                              <span className="text-white/20 text-[9px] font-mono block">
                                Condition: {market.conditionId}
                              </span>
                            </div>
                            <span className="text-white/30 text-[10px] font-mono shrink-0">
                              {market.marketId}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Fetch Button */}
      <Button
        size="sm"
        disabled={selectedMarketIds.size === 0 || isLoadingTrades}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={fetchTradeHistory}
      >
        {isLoadingTrades ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Activity className="h-4 w-4 mr-2" />
            Fetch History ({selectedMarketIds.size} market{selectedMarketIds.size !== 1 ? 's' : ''})
          </>
        )}
      </Button>

      {/* Filter Controls */}
      <Card className="bg-[#1a1b23] border-white/10">
        <CardContent className="p-3">
          {/* Collapsible Header */}
          <button
            onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
            className="flex items-center gap-2 hover:bg-white/5 px-2 py-1 rounded transition-colors w-full"
          >
            {isFiltersCollapsed ? (
              <ChevronRight className="h-4 w-4 text-purple-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-purple-400" />
            )}
            <Filter className="h-4 w-4 text-purple-400" />
            <h4 className="text-sm font-semibold text-white">Filters</h4>
            {(tradeSide || filterType || tradeUser || !takerOnly) && (
              <span className="ml-auto text-xs text-purple-400 font-medium">
                {[tradeSide && 'Side', filterType && 'Amount', tradeUser && 'User', !takerOnly && 'All Trades'].filter(Boolean).length} active
              </span>
            )}
          </button>
          
          {/* Collapsible Content */}
          {!isFiltersCollapsed && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Trade Side Filter */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/60 font-medium">Trade Side</label>
              <select
                value={tradeSide}
                onChange={(e) => setTradeSide(e.target.value as 'buy' | 'sell' | '')}
                className="w-full h-8 px-2 text-xs bg-black/40 border border-white/10 rounded text-white focus:border-purple-500/40 focus:outline-none"
              >
                <option value="">All Sides</option>
                <option value="buy">BUY Only</option>
                <option value="sell">SELL Only</option>
              </select>
            </div>

            {/* Filter Type (Min/Max Amount) */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/60 font-medium">Amount Filter</label>
              <div className="flex gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'cash' | 'tokens' | '')}
                  className="flex-1 h-8 px-2 text-xs bg-black/40 border border-white/10 rounded text-white focus:border-purple-500/40 focus:outline-none"
                >
                  <option value="">No Filter</option>
                  <option value="cash">Min Cash ($)</option>
                  <option value="tokens">Min Tokens</option>
                </select>
                {filterType && (
                  <Input
                    type="number"
                    placeholder={filterType === 'cash' ? 'Min $' : 'Min tokens'}
                    value={filterAmount}
                    onChange={(e) => setFilterAmount(e.target.value)}
                    className="w-24 h-8 px-2 text-xs bg-black/40 border-white/10 text-white placeholder:text-white/30"
                  />
                )}
              </div>
            </div>

            {/* Specific User Address */}
            <div className="space-y-1.5">
              <label className="text-xs text-white/60 font-medium">User Address</label>
              <Input
                type="text"
                placeholder="Filter by address..."
                value={tradeUser}
                onChange={(e) => setTradeUser(e.target.value)}
                className="w-full h-8 px-2 text-xs bg-black/40 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Taker Only Checkbox */}
            <div className="flex items-center gap-2 pt-5">
              <Checkbox
                id="taker-only"
                checked={takerOnly}
                onCheckedChange={(checked) => setTakerOnly(checked as boolean)}
              />
              <label htmlFor="taker-only" className="text-xs text-white/80 cursor-pointer">
                Taker trades only
              </label>
            </div>
              </div>

              {/* Clear Filters Button */}
              {(tradeSide || filterType || tradeUser || !takerOnly) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTradeSide('');
                    setFilterType('');
                    setFilterAmount('');
                    setTradeUser('');
                    setTakerOnly(true);
                  }}
                  className="h-7 text-xs text-white/60 hover:text-white w-full"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Area */}
      <Card className="flex-1 bg-[#1a1b23] border-white/10 overflow-hidden">
        <CardContent className="p-4 h-full">
          {isLoadingTrades ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            </div>
          ) : tradeHistory.length > 0 ? (
            <div className="h-full flex flex-col">
              {/* Pagination Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">
                  Found {tradeHistory.length} trade{tradeHistory.length === 1 ? '' : 's'}
                </h3>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-white/60">
                    Page {currentPage}/{Math.ceil(tradeHistory.length / tradesPerPage)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="h-7 text-xs text-white/60 hover:text-white disabled:opacity-30"
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={currentPage >= Math.ceil(tradeHistory.length / tradesPerPage)}
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(tradeHistory.length / tradesPerPage), p + 1))}
                      className="h-7 text-xs text-white/60 hover:text-white disabled:opacity-30"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {tradeHistory
                    .slice((currentPage - 1) * tradesPerPage, currentPage * tradesPerPage)
                    .map((trade, index) => {
                    const isBuy = trade.side === "BUY";
                    const tradeTime = formatDistanceToNow(new Date(trade.timestamp * 1000), { addSuffix: true });
                    const amount = (trade.size * trade.price).toFixed(2);
                    
                    return (
                      <Card 
                        key={index}
                        className={`bg-gradient-to-r ${
                          isBuy 
                            ? 'from-green-500/10 to-transparent border-green-500/20' 
                            : 'from-red-500/10 to-transparent border-red-500/20'
                        } border transition-all hover:scale-[1.01]`}
                      >
                        <CardContent className="p-3">
                          {/* Header: Side, User, Time */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {trade.side}
                              </span>
                              <a 
                                href={`/address/${trade.proxyWallet}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-white/80 font-medium hover:text-purple-400 transition-colors"
                              >
                                {trade.name || trade.pseudonym || 'Anonymous'}
                              </a>
                            </div>
                            <span className="text-[10px] text-white/40">
                              {tradeTime}
                            </span>
                          </div>

                          {/* Market Info */}
                          <div className="mb-2">
                            <p className="text-xs text-white font-medium mb-1 line-clamp-2">
                              {trade.title}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                trade.outcome === 'Yes' 
                                  ? 'bg-cyan-500/20 text-cyan-400' 
                                  : 'bg-purple-500/20 text-purple-400'
                              }`}>
                                {trade.outcome}
                              </span>
                              {trade.icon && (
                                <img 
                                  src={trade.icon} 
                                  alt="" 
                                  className="h-4 w-4 rounded object-cover"
                                />
                              )}
                            </div>
                          </div>

                          {/* Trade Details */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-white/40 block text-[10px]">Size</span>
                              <span className="text-white font-mono">{trade.size.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[10px]">Price</span>
                              <span className="text-white font-mono">${trade.price.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-white/40 block text-[10px]">Amount</span>
                              <span className="text-white font-mono font-semibold">${amount}</span>
                            </div>
                          </div>

                          {/* Transaction Hash */}
                          {trade.transactionHash && (
                            <div className="mt-2 pt-2 border-t border-white/5">
                              <a
                                href={`https://polygonscan.com/tx/${trade.transactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
                              >
                                <span className="font-mono truncate">{trade.transactionHash.slice(0, 10)}...{trade.transactionHash.slice(-8)}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : selectedMarketIds.size > 0 && !isLoadingTrades ? (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-white/40 text-sm">
                Click &ldquo;Fetch History&rdquo; to load recent trades
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
