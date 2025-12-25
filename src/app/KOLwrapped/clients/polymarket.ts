import { ClosedPosition, PolymarketLeaderboardRow } from "../types";

const BASE = "https://data-api.polymarket.com";
const GAMMA = "https://gamma-api.polymarket.com";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`Polymarket HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function fetchTradedCount(address: string) {
  return getJson<{ user: string; traded: number }>(
    `${BASE}/traded?user=${encodeURIComponent(address)}`
  );
}

export async function fetchLeaderboardOverallAll(address: string) {
  return getJson<PolymarketLeaderboardRow[]>(
    `${BASE}/v1/leaderboard?category=OVERALL&timePeriod=ALL&orderBy=PNL&limit=25&user=${encodeURIComponent(
      address
    )}`
  );
}

export async function fetchClosedPositions(params: {
  address: string;
  limit?: number;
  offset?: number;
  sortBy?: "REALIZEDPNL" | "TITLE" | "PRICE" | "AVGPRICE" | "TIMESTAMP";
  sortDirection?: "ASC" | "DESC";
}) {
  const {
    address,
    limit = 50,
    offset = 0,
    sortBy = "REALIZEDPNL",
    sortDirection = "DESC",
  } = params;

  return getJson<ClosedPosition[]>(
    `${BASE}/closed-positions?user=${encodeURIComponent(address)}&limit=${limit}&offset=${offset}&sortBy=${sortBy}&sortDirection=${sortDirection}`
  );
}

export async function fetchPublicProfile(address: string) {
  return getJson<any>(`${GAMMA}/public-profile?address=${encodeURIComponent(address)}`);
}