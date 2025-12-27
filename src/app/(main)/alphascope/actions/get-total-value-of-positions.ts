// src/actions/get-polymarket-total-value.ts
"use server";

export async function getPolymarketTotalValue(address: `0x${string}`) {
  const url = `https://data-api.polymarket.com/value?user=${address}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch portfolio value: ${res.status}`);
  }

  const data = await res.json();
  return {
    totalValue: Number(data?.totalValue ?? 0),
    raw: data, // optional, for per-market details
  };
}

