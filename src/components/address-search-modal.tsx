"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, User, X as XIcon, Command, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type KOLResult = {
  polymarket_address: string;
  x_username: string | null;
  x_display_name: string | null;
  x_profile_image_url: string | null;
  x_badge_label: string | null;
  x_badge_icon_url: string | null;
  x_followers: number | null;
  source?: "kol" | "polymarket";
};

type MarketResult = {
  id: string;
  question: string;
  slug: string;
  image?: string | null;
  icon?: string | null;
  outcomes?: string[];
  outcomePrices?: number[];
  volume?: number;
  liquidity?: number;
  endDate?: string | null;
  event?: {
    title?: string;
    slug?: string;
  };
};

type SearchTab = "traders" | "markets";

function isWalletAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s.trim());
}

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function proxifyImg(url?: string | null): string | null {
  if (!url) return null;
  return `/KOLwrapped/api/image?url=${encodeURIComponent(url)}`;
}

export default function AddressSearchModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("traders");
  const [traderResults, setTraderResults] = useState<KOLResult[]>([]);
  const [marketResults, setMarketResults] = useState<MarketResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveTab("traders");
      setTraderResults([]);
      setMarketResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    
    // If empty, clear results
    if (!trimmed) {
      setTraderResults([]);
      setMarketResults([]);
      setLoading(false);
      return;
    }

    // If it's a valid wallet address, show it as a direct option in traders
    if (isWalletAddress(trimmed)) {
      setTraderResults([
        {
          polymarket_address: trimmed.toLowerCase(),
          x_username: null,
          x_display_name: "Direct Address",
          x_profile_image_url: null,
          x_badge_label: null,
          x_badge_icon_url: null,
          x_followers: null,
        },
      ]);
      setMarketResults([]);
      setLoading(false);
      return;
    }

    // Otherwise search both traders and markets
    try {
      setLoading(true);
      const response = await fetch(
        `/api/search-addresses?q=${encodeURIComponent(trimmed)}`
      );
      if (response.ok) {
        const data = await response.json();
        setTraderResults(Array.isArray(data.traders) ? data.traders : []);
        setMarketResults(Array.isArray(data.markets) ? data.markets : []);
      } else {
        setTraderResults([]);
        setMarketResults([]);
      }
    } catch (err) {
      console.error("Search error:", err);
      setTraderResults([]);
      setMarketResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setTraderResults([]);
      setMarketResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Get current results based on active tab
  const currentResults = activeTab === "traders" ? traderResults : marketResults;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, currentResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && currentResults[selectedIndex]) {
        e.preventDefault();
        if (activeTab === "traders") {
          handleSelectTrader(currentResults[selectedIndex] as KOLResult);
        } else {
          handleSelectMarket(currentResults[selectedIndex] as MarketResult);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentResults, selectedIndex, activeTab]);

  // Reset selected index when results change or tab changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [currentResults, activeTab]);

  const handleSelectTrader = (result: KOLResult) => {
    router.push(`/address/${result.polymarket_address}`);
    onOpenChange(false);
  };

  const handleSelectMarket = (result: MarketResult) => {
    // Navigate to Polymarket event or market page
    if (result.event?.slug) {
      window.open(`https://polymarket.com/event/${result.event.slug}`, "_blank");
    } else if (result.slug) {
      window.open(`https://polymarket.com/${result.slug}`, "_blank");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 bg-zinc-950 border-white/10 text-zinc-100 gap-0">
        <VisuallyHidden>
          <DialogTitle>Search Polymarket</DialogTitle>
        </VisuallyHidden>

        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
          <Search className="w-5 h-5 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search traders, markets, events..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-base placeholder:text-zinc-500"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin shrink-0" />
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-zinc-950/50">
          <button
            onClick={() => setActiveTab("traders")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "traders"
                ? "bg-indigo-500/15 text-indigo-200 border border-indigo-500/25"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Traders
            {traderResults.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px]">
                {traderResults.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("markets")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "markets"
                ? "bg-indigo-500/15 text-indigo-200 border border-indigo-500/25"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Markets
            {marketResults.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px]">
                {marketResults.length}
              </span>
            )}
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {currentResults.length === 0 && query.trim() && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No results found. Try {activeTab === "traders" ? "pasting a full wallet address" : "a different search term"}.
            </div>
          ) : currentResults.length === 0 && !query.trim() ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Search for traders, markets, or events
            </div>
          ) : (
            <div className="py-2">
              {activeTab === "traders" ? (
                traderResults.map((result, idx) => (
                <button
                  key={result.polymarket_address}
                  onClick={() => handleSelectTrader(result)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                    selectedIndex === idx
                      ? "bg-indigo-500/10 border-l-2 border-indigo-500"
                      : "hover:bg-white/5"
                  }`}
                >
                  {/* Profile Image */}
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                    {result.x_profile_image_url ? (
                      <img
                        src={proxifyImg(result.x_profile_image_url) ?? undefined}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-5 h-5 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-sm text-zinc-100 truncate">
                        {result.x_display_name || result.x_username || "Unknown"}
                      </div>
                      {result.x_badge_icon_url && (
                        <img
                          src={proxifyImg(result.x_badge_icon_url) ?? undefined}
                          alt={result.x_badge_label ?? ""}
                          className="w-4 h-4 shrink-0"
                          title={result.x_badge_label ?? undefined}
                        />
                      )}
                      {/* Source Badge */}
                      {result.source === "kol" && result.x_username && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 uppercase tracking-wide">
                          KOL
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                      {result.x_username && (
                        <span className="truncate">@{result.x_username}</span>
                      )}
                      {result.x_username && (
                        <span className="opacity-40">•</span>
                      )}
                      <span className="font-mono truncate">
                        {shortAddr(result.polymarket_address)}
                      </span>
                    </div>
                  </div>

                  {/* Follower count or source indicator */}
                  <div className="text-xs shrink-0 text-right">
                    {result.x_followers !== null ? (
                      <div className="text-zinc-500">
                        {new Intl.NumberFormat("en-US", {
                          notation: "compact",
                        }).format(result.x_followers)}{" "}
                        followers
                      </div>
                    ) : result.source === "polymarket" ? (
                      <div className="px-2 py-1 rounded-md bg-zinc-800/50 border border-white/5 text-zinc-400 text-[10px] font-medium">
                        Polymarket
                      </div>
                    ) : null}
                  </div>
                </button>
              ))
              ) : (
                // Markets results
                marketResults.map((result, idx) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectMarket(result)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${
                      selectedIndex === idx
                        ? "bg-indigo-500/10 border-l-2 border-indigo-500"
                        : "hover:bg-white/5"
                    }`}
                  >
                    {/* Market Image */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 shrink-0">
                      {result.image || result.icon ? (
                        <img
                          src={result.image || result.icon || ""}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-zinc-600" />
                        </div>
                      )}
                    </div>

                    {/* Market Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-semibold text-sm text-zinc-100 truncate">
                        {result.question}
                      </div>
                      <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                        {result.event?.title && (
                          <>
                            <span className="truncate">{result.event.title}</span>
                            <span className="opacity-40">•</span>
                          </>
                        )}
                        {result.volume && (
                          <span>
                            ${new Intl.NumberFormat("en-US", {
                              notation: "compact",
                            }).format(result.volume)} vol
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Market Stats */}
                    {result.outcomePrices && result.outcomePrices.length > 0 && (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          {result.outcomes?.map((outcome, i) => (
                            <div
                              key={i}
                              className="px-2 py-1 rounded-md bg-zinc-800/50 border border-white/5 text-[10px] font-medium text-zinc-300"
                            >
                              {outcome}: {Math.round((result.outcomePrices![i] || 0) * 100)}¢
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px]">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px]">
                ↵
              </kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-[10px]">
                esc
              </kbd>
              <span>Close</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
