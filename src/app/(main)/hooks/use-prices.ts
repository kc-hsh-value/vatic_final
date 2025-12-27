"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBatchPrices, PriceMap } from "@/lib/polymarket/fetch-batch-prices";

export function usePolymarketPrices(tokenIds: string[]) {
  return useQuery({
    queryKey: ["polymarket-prices", tokenIds.sort().join(",")], // Unique key based on IDs
    queryFn: () => fetchBatchPrices(tokenIds),
    enabled: tokenIds.length > 0,
    refetchInterval: 15000, // Poll every 15 seconds
    staleTime: 5000,
  });
}