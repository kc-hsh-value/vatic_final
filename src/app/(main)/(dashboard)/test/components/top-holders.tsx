"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, AlertCircle, CheckSquare, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";

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

interface HolderData {
  proxyWallet: string;
  bio: string;
  asset: string;
  pseudonym: string;
  amount: number;
  displayUsernamePublic: boolean;
  outcomeIndex: number;
  name: string;
  profileImage: string;
  profileImageOptimized: string;
  verified: boolean;
}

interface TokenHolders {
  token: string;
  holders: HolderData[];
  outcomeInfo?: {
    marketSlug: string;
    outcome: string;
    outcomeIndex: number;
  } | null;
}

interface TopHoldersProps {
  selectedEvents: WatchedEvent[];
  holdersData: TokenHolders[];
  setHoldersData: (data: TokenHolders[]) => void;
  isLoadingHolders: boolean;
  setIsLoadingHolders: (loading: boolean) => void;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
}

export function TopHolders({
  selectedEvents,
  holdersData,
  setHoldersData,
  isLoadingHolders,
  setIsLoadingHolders,
  currentPage,
  setCurrentPage
}: TopHoldersProps) {
  // Selection state: track which event IDs are selected for fetching
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  
  // Selection state for individual markets (key: "eventId-marketId")
  const [selectedMarketIds, setSelectedMarketIds] = useState<Set<string>>(new Set());
  
  // Track which events are expanded to show their markets
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  // Track if the selection panel is collapsed (default to collapsed for cleaner UI)
  const [isSelectionCollapsed, setIsSelectionCollapsed] = useState<boolean>(true);

  // Pagination config (state managed by parent)
  const holdersPerPage = 20;

  // Console log to see what props we're getting
  useEffect(() => {
    console.log("👥 TopHolders Props:", {
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

  // Fetch top holders from Polymarket API
  const fetchTopHolders = async () => {
    setIsLoadingHolders(true);
    setHoldersData([]);
    setCurrentPage(1); // Reset to first page on new fetch

    try {
      console.log("🔍 Selected event IDs:", Array.from(selectedEventIds));
      console.log("🔍 Selected market IDs (keys):", Array.from(selectedMarketIds));
      
      // Build token-to-outcome mapping
      const tokenToOutcomeMap: Record<string, { marketSlug: string; outcome: string; outcomeIndex: number }> = {};
      
      // Get selected condition IDs and build mapping
      const selectedConditionIds = selectedEvents
        .filter((event) => selectedEventIds.has(event.eventId))
        .flatMap((event) => 
          event.markets
            .filter((market) => selectedMarketIds.has(`${event.eventId}-${market.marketId}`))
            .map((market) => {
              // Map each clobTokenId to its outcome name
              if (market.clobTokenIds && market.outcomes) {
                market.clobTokenIds.forEach((tokenId, idx) => {
                  tokenToOutcomeMap[tokenId] = {
                    marketSlug: market.marketSlug,
                    outcome: market.outcomes![idx] || `Outcome ${idx}`,
                    outcomeIndex: idx
                  };
                });
              }
              return market.conditionId;
            })
        );

      console.log("Token to outcome mapping:", tokenToOutcomeMap);

      console.log("Fetching holders for condition IDs:", selectedConditionIds);
      console.log(`Total condition IDs: ${selectedConditionIds.length}`);

      if (selectedConditionIds.length === 0) {
        setHoldersData([]);
        setIsLoadingHolders(false);
        return;
      }

      // Batch condition IDs into chunks of 70 (Polymarket holders API limit)
      const BATCH_SIZE = 70;
      const batches: string[][] = [];
      for (let i = 0; i < selectedConditionIds.length; i += BATCH_SIZE) {
        batches.push(selectedConditionIds.slice(i, i + BATCH_SIZE));
      }

      console.log(`Split into ${batches.length} batch(es) of up to ${BATCH_SIZE} condition IDs`);

      // Fetch all batches in parallel
      const batchPromises = batches.map(async (batch, index) => {
        const params = new URLSearchParams();
        params.append("limit", "20");
        params.append("minBalance", "1");
        
        // Add condition IDs for this batch as comma-separated (NOT &market=&market= format!)
        params.append("market", batch.join(","));

        console.log(`Batch ${index + 1}/${batches.length}: ${batch.length} condition IDs`);

        const url = `https://data-api.polymarket.com/holders?${params.toString()}`;
        console.log("🔗 Fetch URL:", url);

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`API error in batch ${index + 1}: ${response.status}`);
        }

        return response.json();
      });

      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises);

      // Merge all results and attach outcome metadata
      const allHolders = batchResults.flat().map(tokenGroup => ({
        ...tokenGroup,
        outcomeInfo: tokenToOutcomeMap[tokenGroup.token] || null
      }));

      console.log(`Fetched ${allHolders.length} token groups from ${batches.length} batch(es)`);
      setHoldersData(allHolders);
    } catch (error) {
      console.error("Error fetching top holders:", error);
      setHoldersData([]);
    } finally {
      setIsLoadingHolders(false);
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

  // Calculate total holders across all tokens for pagination
  const totalHolders = holdersData.reduce((sum, tokenGroup) => sum + tokenGroup.holders.length, 0);

  // If no markets selected, show prompt to select
  if (!hasSelectedMarkets) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertCircle className="h-12 w-12 text-yellow-400/40 mb-4" />
        <p className="text-white/60 text-sm font-medium mb-2">
          No markets selected for whale watching
        </p>
        <p className="text-white/40 text-xs max-w-md">
          Click the &ldquo;Watch Whales&rdquo; button on any tweet in the feed to track top holders for those markets
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
        disabled={selectedMarketIds.size === 0 || isLoadingHolders}
        className="w-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={fetchTopHolders}
      >
        {isLoadingHolders ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Users className="h-4 w-4 mr-2" />
            Fetch Top Holders ({selectedMarketIds.size} market{selectedMarketIds.size !== 1 ? 's' : ''})
          </>
        )}
      </Button>

      {/* Results Area */}
      <Card className="flex-1 bg-[#1a1b23] border-white/10 overflow-hidden">
        <CardContent className="p-4 h-full">
          {isLoadingHolders ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 text-purple-400 animate-spin" />
            </div>
          ) : holdersData.length > 0 ? (
            <div className="h-full flex flex-col">
              {/* Header - No Pagination Needed, Show All Tokens */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-white/60">
                  Found {totalHolders} holders across {holdersData.length} outcome{holdersData.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {/* Show ALL token groups (No pagination at this level) */}
                  {holdersData.map((tokenGroup, groupIndex) => (
                      <div key={`${tokenGroup.token}-${groupIndex}`} className="space-y-2">
                        {/* Outcome Header */}
                        {tokenGroup.outcomeInfo && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg border border-white/10">
                            <div className={`text-xs font-bold px-2 py-0.5 rounded ${
                              tokenGroup.outcomeInfo.outcome.toLowerCase() === 'yes' 
                                ? 'bg-green-500/20 text-green-400' 
                                : tokenGroup.outcomeInfo.outcome.toLowerCase() === 'no'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {tokenGroup.outcomeInfo.outcome}
                            </div>
                            <span className="text-xs text-white/50">•</span>
                            <span className="text-xs text-white/60 truncate">{tokenGroup.outcomeInfo.marketSlug}</span>
                          </div>
                        )}
                        
                        {/* Holders for this token */}
                        {tokenGroup.holders.map((holder: any, holderIndex: number) => (
                      <Card 
                        key={`${holder.proxyWallet}-${tokenGroup.token}-${holderIndex}`}
                        className="bg-gradient-to-r from-purple-500/10 to-transparent border-purple-500/20 border transition-all hover:scale-[1.01]"
                      >
                        <CardContent className="p-3">
                          {/* Header: User Info */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {holder.profileImageOptimized || holder.profileImage ? (
                                <img 
                                  src={holder.profileImageOptimized || holder.profileImage} 
                                  alt={holder.name}
                                  className="h-8 w-8 rounded-full border border-white/10"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-purple-500/20 border border-purple-500/20 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-purple-400" />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <a 
                                  href={`/address/${holder.proxyWallet}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-white/90 font-medium hover:text-purple-400 transition-colors"
                                >
                                  {holder.name || holder.pseudonym || 'Anonymous'}
                                </a>
                                {holder.verified && (
                                  <span className="text-[9px] text-cyan-400">✓ Verified</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-white font-mono">
                                {holder.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <div className="text-[9px] text-white/40">shares</div>
                            </div>
                          </div>

                          {/* Bio if available */}
                          {holder.bio && (
                            <p className="text-xs text-white/60 mb-2 line-clamp-2">
                              {holder.bio}
                            </p>
                          )}

                          {/* Footer: Token & Wallet */}
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[9px] text-white/30 font-mono">
                              Outcome: {holder.outcomeIndex}
                            </span>
                            <a
                              href={`https://polygonscan.com/address/${holder.proxyWallet}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 transition-colors"
                            >
                              <span className="font-mono">{holder.proxyWallet.slice(0, 6)}...{holder.proxyWallet.slice(-4)}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                        ))}
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          ) : selectedMarketIds.size > 0 && !isLoadingHolders ? (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-white/40 text-sm">
                Click &ldquo;Fetch Top Holders&rdquo; to load data
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
