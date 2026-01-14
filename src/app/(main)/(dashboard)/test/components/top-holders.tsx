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
    question?: string;
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

interface HolderPnLData {
  proxyWallet: string;
  dailyPnl: number | null;
  weeklyPnl: number | null;
  monthlyPnl: number | null;
  allTimePnl: number | null;
  marketsTraded: number | null;
  isLoading: boolean;
  error?: string;
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

  // Market dropdown and outcome tabs state
  const [selectedMarketForView, setSelectedMarketForView] = useState<string | null>(null);
  const [selectedOutcomeTab, setSelectedOutcomeTab] = useState<number>(0);

  // PnL data state - Map wallet address to PnL data
  const [holderPnLData, setHolderPnLData] = useState<Map<string, HolderPnLData>>(new Map());
  
  // Track which wallets are currently being fetched
  const [fetchingWallets, setFetchingWallets] = useState<Set<string>>(new Set());

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

  // Auto-select first market when holders data loads
  useEffect(() => {
    if (holdersData.length > 0 && !selectedMarketForView) {
      const firstMarketSlug = holdersData[0]?.outcomeInfo?.marketSlug;
      if (firstMarketSlug) {
        setSelectedMarketForView(firstMarketSlug);
        setSelectedOutcomeTab(0);
      }
    }
  }, [holdersData, selectedMarketForView]);

  // Fetch PnL data ONLY for the selected market's holders (on-demand)
  useEffect(() => {
    if (!selectedMarketForView || holdersData.length === 0) return;

    // Get holders only from the selected market
    const selectedMarketHolders = holdersData
      .filter(t => t.outcomeInfo?.marketSlug === selectedMarketForView)
      .flatMap(t => t.holders);

    // Extract unique wallets from selected market only
    const selectedWallets = new Set<string>();
    selectedMarketHolders.forEach(holder => {
      selectedWallets.add(holder.proxyWallet.toLowerCase());
    });

    // Filter out wallets we already have data for or are currently fetching
    const walletsToFetch = Array.from(selectedWallets).filter(wallet => {
      const existing = holderPnLData.get(wallet);
      return !existing && !fetchingWallets.has(wallet);
    });

    if (walletsToFetch.length === 0) return;

    console.log(`💰 Fetching PnL for ${walletsToFetch.length} wallets from selected market (concurrency: 25)...`);
    
    // Fetch PnL only for selected market holders
    fetchPnLConcurrently(walletsToFetch, 25).then(() => {
      console.log(`✅ PnL fetch complete for ${walletsToFetch.length} wallets`);
    });
  }, [selectedMarketForView, holdersData, holderPnLData, fetchingWallets]);


  // Check if user has selected any markets to watch
  const hasSelectedMarkets = selectedEvents.length > 0;

  // ===== PnL Fetching Utilities =====
  
  // Fetch PnL series for a wallet with specific interval and fidelity (with retry logic)
  const fetchPnlSeries = async (wallet: string, interval: string, fidelity: string, retries = 2) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(
          `https://user-pnl-api.polymarket.com/user-pnl?user_address=${wallet.toLowerCase()}&interval=${interval}&fidelity=${fidelity}`
        );
        
        // Retry on rate limit or server errors
        if (res.status === 429 || res.status >= 500) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
            continue;
          }
          return null;
        }
        
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) ? data : null;
      } catch (error) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        return null;
      }
    }
    return null;
  };

  // Compute all-time PnL (last point's value)
  const computeAllTimePnl = (series: any[] | null): number | null => {
    if (!series || series.length === 0) return null;
    const sorted = series
      .filter(x => Number.isFinite(x?.t) && Number.isFinite(x?.p))
      .sort((a, b) => a.t - b.t);
    if (sorted.length === 0) return null;
    return sorted[sorted.length - 1].p;
  };

  // Compute delta PnL (last - first)
  const computeDeltaPnl = (series: any[] | null): number | null => {
    if (!series || series.length < 2) return null;
    const sorted = series
      .filter(x => Number.isFinite(x?.t) && Number.isFinite(x?.p))
      .sort((a, b) => a.t - b.t);
    if (sorted.length < 2) return null;
    return sorted[sorted.length - 1].p - sorted[0].p;
  };

  // Fetch markets traded for a wallet (with retry logic)
  const fetchMarketsTraded = async (wallet: string, retries = 2): Promise<number | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(`https://data-api.polymarket.com/traded?user=${wallet.toLowerCase()}`);
        
        if (res.status === 429 || res.status >= 500) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
            continue;
          }
          return null;
        }
        
        if (!res.ok) return null;
        const json = await res.json();
        return typeof json?.traded === 'number' ? json.traded : null;
      } catch (error) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        }
        return null;
      }
    }
    return null;
  };

  // Fetch complete PnL data for a single wallet
  const fetchWalletPnL = async (wallet: string): Promise<HolderPnLData> => {
    try {
      const [daily, weekly, monthly, allTime, marketsTraded] = await Promise.all([
        fetchPnlSeries(wallet, '1d', '1h'),
        fetchPnlSeries(wallet, '1w', '1h'),
        fetchPnlSeries(wallet, '1m', '1h'),
        fetchPnlSeries(wallet, 'all', '12h'),
        fetchMarketsTraded(wallet)
      ]);

      return {
        proxyWallet: wallet,
        dailyPnl: computeDeltaPnl(daily),
        weeklyPnl: computeDeltaPnl(weekly),
        monthlyPnl: computeDeltaPnl(monthly),
        allTimePnl: computeAllTimePnl(allTime),
        marketsTraded,
        isLoading: false
      };
    } catch (error) {
      return {
        proxyWallet: wallet,
        dailyPnl: null,
        weeklyPnl: null,
        monthlyPnl: null,
        allTimePnl: null,
        marketsTraded: null,
        isLoading: false,
        error: 'Failed to fetch PnL'
      };
    }
  };

  // Fetch PnL for multiple wallets with concurrency control
  const fetchPnLConcurrently = async (wallets: string[], concurrency = 25) => {
    const results: HolderPnLData[] = [];
    const active = new Set<Promise<void>>();
    const queue = [...wallets];
    let processedCount = 0;

    const processNext = async () => {
      while (queue.length > 0) {
        const wallet = queue.shift()!;

        // Wait if at max concurrency
        while (active.size >= concurrency) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Add small delay every 25 requests to reduce load
        if (processedCount > 0 && processedCount % 25 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const promise = (async () => {
          try {
            const result = await fetchWalletPnL(wallet);
            results.push(result);
            processedCount++;
            
            // Update state immediately as each wallet completes
            setHolderPnLData(prev => {
              const newMap = new Map(prev);
              newMap.set(wallet.toLowerCase(), result);
              return newMap;
            });
          } catch (error) {
            console.error(`Failed to fetch PnL for ${wallet}:`, error);
            processedCount++;
          }
        })();
        
        promise.finally(() => {
          active.delete(promise);
          setFetchingWallets(prev => {
            const newSet = new Set(prev);
            newSet.delete(wallet.toLowerCase());
            return newSet;
          });
        });

        active.add(promise);
        setFetchingWallets(prev => new Set(prev).add(wallet.toLowerCase()));
      }

      // Wait for remaining requests
      await Promise.all(active);
    };

    await processNext();
    return results;
  };

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
                        <span className="text-sm font-semibold text-white truncate">
                          {event.eventSlug}
                        </span>
                        <span className="text-xs text-white/50 font-mono shrink-0">
                          ID: {event.eventId}
                        </span>
                      </div>
                      <span className="text-xs text-white/60 font-medium">
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
                            
                            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-white/90 font-medium truncate block">
                                {market.marketSlug}
                              </span>
                            </div>
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
            <div className="h-full flex flex-col gap-4">
              {/* Market Dropdown Selector */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Select Market</label>
                <select
                  value={selectedMarketForView || ''}
                  onChange={(e) => {
                    setSelectedMarketForView(e.target.value);
                    setSelectedOutcomeTab(0); // Reset to first outcome when market changes
                  }}
                  className="w-full px-3 py-2 text-sm bg-black/40 border border-white/10 rounded-lg text-white focus:border-purple-500/40 focus:outline-none"
                >
                  <option value="">-- Choose a market --</option>
                  {/* Group tokens by market slug */}
                  {Array.from(new Set(holdersData.map(t => t.outcomeInfo?.marketSlug).filter(Boolean))).map((marketSlug) => {
                    // Find the market with this slug to get its question
                    const market = selectedEvents.flatMap(e => e.markets).find(m => m.marketSlug === marketSlug);
                    const displayText = market?.question || marketSlug;
                    return (
                      <option key={marketSlug} value={marketSlug}>
                        {displayText}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Show outcomes as tabs when market is selected */}
              {selectedMarketForView && (() => {
                const marketTokens = holdersData.filter(t => t.outcomeInfo?.marketSlug === selectedMarketForView);
                const totalHolders = marketTokens.reduce((sum, t) => sum + t.holders.length, 0);
                
                return (
                  <>
                    {/* Header with total holders count */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white">
                        {totalHolders} Holder{totalHolders !== 1 ? 's' : ''} • {marketTokens.length} Outcome{marketTokens.length !== 1 ? 's' : ''}
                      </h3>
                    </div>

                    {/* Outcome Tabs */}
                    <div className="flex gap-2 border-b border-white/10 pb-2">
                      {marketTokens.map((tokenGroup, index) => (
                        <button
                          key={tokenGroup.token}
                          onClick={() => setSelectedOutcomeTab(index)}
                          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-all ${
                            selectedOutcomeTab === index
                              ? tokenGroup.outcomeInfo?.outcome.toLowerCase() === 'yes'
                                ? 'bg-green-500/30 text-green-300 border-b-2 border-green-500'
                                : tokenGroup.outcomeInfo?.outcome.toLowerCase() === 'no'
                                ? 'bg-red-500/30 text-red-300 border-b-2 border-red-500'
                                : 'bg-purple-500/30 text-purple-300 border-b-2 border-purple-500'
                              : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                          }`}
                        >
                          {tokenGroup.outcomeInfo?.outcome || `Outcome ${index + 1}`}
                        </button>
                      ))}
                    </div>

                    {/* Cumulative PnL Summary for selected outcome */}
                    {(() => {
                      const outcomeHolders = marketTokens[selectedOutcomeTab]?.holders || [];
                      const holdersWithPnL = outcomeHolders.filter(h => {
                        const pnl = holderPnLData.get(h.proxyWallet.toLowerCase());
                        return pnl && !pnl.isLoading;
                      });
                      
                      if (holdersWithPnL.length > 0) {
                        const cumulative = {
                          allTime: 0,
                          monthly: 0,
                          weekly: 0,
                          daily: 0,
                          count: 0
                        };
                        
                        holdersWithPnL.forEach(h => {
                          const pnl = holderPnLData.get(h.proxyWallet.toLowerCase());
                          if (pnl) {
                            if (pnl.allTimePnl !== null) cumulative.allTime += pnl.allTimePnl;
                            if (pnl.monthlyPnl !== null) cumulative.monthly += pnl.monthlyPnl;
                            if (pnl.weeklyPnl !== null) cumulative.weekly += pnl.weeklyPnl;
                            if (pnl.dailyPnl !== null) cumulative.daily += pnl.dailyPnl;
                            cumulative.count++;
                          }
                        });
                        
                        return (
                          <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-white">
                                📊 Cumulative PnL ({cumulative.count}/{outcomeHolders.length} holders)
                              </h4>
                              {holdersWithPnL.length < outcomeHolders.length && (
                                <div className="flex items-center gap-1">
                                  <Loader2 className="h-3 w-3 text-purple-400 animate-spin" />
                                  <span className="text-xs text-white/40">Loading...</span>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-black/20 p-2 rounded">
                                <div className="text-xs text-white/50 mb-1">All-Time</div>
                                <div className={`text-base font-bold font-mono ${
                                  cumulative.allTime >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  ${cumulative.allTime.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                              </div>
                              <div className="bg-black/20 p-2 rounded">
                                <div className="text-xs text-white/50 mb-1">Monthly</div>
                                <div className={`text-base font-bold font-mono ${
                                  cumulative.monthly >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  ${cumulative.monthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                              </div>
                              <div className="bg-black/20 p-2 rounded">
                                <div className="text-xs text-white/50 mb-1">Weekly</div>
                                <div className={`text-base font-bold font-mono ${
                                  cumulative.weekly >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  ${cumulative.weekly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                              </div>
                              <div className="bg-black/20 p-2 rounded">
                                <div className="text-xs text-white/50 mb-1">Daily</div>
                                <div className={`text-base font-bold font-mono ${
                                  cumulative.daily >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  ${cumulative.daily.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Holders for selected outcome */}
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="space-y-3 pr-4">
                        {marketTokens[selectedOutcomeTab]?.holders.map((holder: any, holderIndex: number) => {
                          const pnlData = holderPnLData.get(holder.proxyWallet.toLowerCase());
                          const isLoadingPnL = fetchingWallets.has(holder.proxyWallet.toLowerCase()) || !pnlData;
                          
                          return (
                          <Card 
                            key={`${holder.proxyWallet}-${holderIndex}`}
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
                                      className="text-sm text-white font-semibold hover:text-purple-300 transition-colors"
                                    >
                                      {holder.name || holder.pseudonym || 'Anonymous'}
                                    </a>
                                    {holder.verified && (
                                      <span className="text-xs text-cyan-400 font-medium">✓ Verified</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-base font-bold text-white font-mono">
                                    {holder.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                  <div className="text-xs text-white/50 font-medium">shares</div>
                                </div>
                              </div>

                              {/* PnL Stats */}
                              {isLoadingPnL ? (
                                <div className="flex items-center gap-2 mb-2 p-2 rounded bg-black/20">
                                  <Loader2 className="h-3 w-3 text-purple-400 animate-spin" />
                                  <span className="text-xs text-white/40">Loading PnL...</span>
                                </div>
                              ) : pnlData && (
                                <div className="mb-2 p-2 rounded bg-black/20 space-y-1">
                                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    {/* All-Time PnL */}
                                    <div>
                                      <span className="text-white/40">All-Time: </span>
                                      <span className={`font-mono font-bold ${
                                        pnlData.allTimePnl === null ? 'text-white/30' :
                                        pnlData.allTimePnl >= 0 ? 'text-green-400' : 'text-red-400'
                                      }`}>
                                        {pnlData.allTimePnl === null ? 'N/A' : 
                                          `$${pnlData.allTimePnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                      </span>
                                    </div>
                                    {/* Monthly PnL */}
                                    <div>
                                      <span className="text-white/40">Monthly: </span>
                                      <span className={`font-mono font-bold ${
                                        pnlData.monthlyPnl === null ? 'text-white/30' :
                                        pnlData.monthlyPnl >= 0 ? 'text-green-400' : 'text-red-400'
                                      }`}>
                                        {pnlData.monthlyPnl === null ? 'N/A' : 
                                          `$${pnlData.monthlyPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                      </span>
                                    </div>
                                    {/* Weekly PnL */}
                                    <div>
                                      <span className="text-white/40">Weekly: </span>
                                      <span className={`font-mono font-bold ${
                                        pnlData.weeklyPnl === null ? 'text-white/30' :
                                        pnlData.weeklyPnl >= 0 ? 'text-green-400' : 'text-red-400'
                                      }`}>
                                        {pnlData.weeklyPnl === null ? 'N/A' : 
                                          `$${pnlData.weeklyPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                      </span>
                                    </div>
                                    {/* Daily PnL */}
                                    <div>
                                      <span className="text-white/40">Daily: </span>
                                      <span className={`font-mono font-bold ${
                                        pnlData.dailyPnl === null ? 'text-white/30' :
                                        pnlData.dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'
                                      }`}>
                                        {pnlData.dailyPnl === null ? 'N/A' : 
                                          `$${pnlData.dailyPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                      </span>
                                    </div>
                                  </div>
                                  {/* Markets Traded */}
                                  {pnlData.marketsTraded !== null && (
                                    <div className="text-[10px] pt-1 border-t border-white/5">
                                      <span className="text-white/40">Markets Traded: </span>
                                      <span className="text-purple-400 font-mono font-bold">{pnlData.marketsTraded}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Bio if available */}
                              {holder.bio && (
                                <p className="text-xs text-white/60 mb-2 line-clamp-2">
                                  {holder.bio}
                                </p>
                              )}

                              {/* Footer: Wallet */}
                              <div className="flex items-center justify-end pt-2 border-t border-white/5">
                                <a
                                  href={`https://polygonscan.com/address/${holder.proxyWallet}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium"
                                >
                                  <span className="font-mono">{holder.proxyWallet.slice(0, 8)}...{holder.proxyWallet.slice(-6)}</span>
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                </a>
                              </div>
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </>
                );
              })()}

              {/* Prompt to select a market */}
              {!selectedMarketForView && (
                <div className="flex items-center justify-center flex-1">
                  <p className="text-white/50 text-sm">Select a market from the dropdown above</p>
                </div>
              )}
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
