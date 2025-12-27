
import { fetchClosedPositions, fetchLeaderboardOverallAll, fetchTradedCount } from "../clients/polymarket";
import { ClosedPosition } from "../types";

const START_2025 = 1735689600; // 2025-01-01 UTC
const END_2025 = 1767225599;   // 2025-12-31 UTC

export async function getOverallStats(address: string) {
  const [rows, tradedRes] = await Promise.all([
    fetchLeaderboardOverallAll(address),
    fetchTradedCount(address),
  ]);

  const row = rows?.[0];
  if (!row) return null;

  return {
    pnl: Number(row.pnl),
    rank: String(row.rank),
    vol: Number(row.vol ?? 0),
    traded: Number(tradedRes?.traded ?? 0),
    verifiedBadge: Boolean(row.verifiedBadge),
    userName: String(row.userName),
    xUsername: String(row.xUsername),
  };
}

async function fetchAllClosed(address: string) {
  const limit = 50;
  let offset = 0;
  const all: ClosedPosition[] = [];

  for (let i = 0; i < 5000; i++) {
    const batch = await fetchClosedPositions({
      address,
      limit,
      offset,
      sortBy: "TIMESTAMP",
      sortDirection: "ASC",
    });

    if (!batch || batch.length === 0) break;

    all.push(...batch);
    offset += batch.length;

    if (batch.length < limit) break;
    if (offset >= 100000) break;
  }

  return all;
}

export async function getTopClosedMarkets2025(address: string, topN = 5) {
  const all = await fetchAllClosed(address);

  const closed2025 = all.filter((x) => x.timestamp >= START_2025 && x.timestamp <= END_2025);

  // top wins by realizedPnl
  closed2025.sort((a, b) => (b.realizedPnl || 0) - (a.realizedPnl || 0));

  return closed2025.slice(0, topN).map((x) => ({
    title: x.title,
    eventSlug: x.eventSlug,
    endDate: x.endDate,
    realizedPnl: Number(x.realizedPnl || 0),
    conditionId: x.conditionId,
  }));
}