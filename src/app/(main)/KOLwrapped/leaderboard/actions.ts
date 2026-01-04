// // KOLwrapped/leaderboard/actions.ts
// "use server";

// import { createClient } from "@supabase/supabase-js";
// import { unstable_cache } from "next/cache";

// const supabase = createClient(
//   process.env.NEXT_PUBLIC_SUPABASE_URL!,
//   process.env.SUPABASE_SERVICE_ROLE_KEY!
// );

// export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all";

// export async function getLeaderboard({
//   period = "all",
//   limit = 50,
//   offset = 0,
//   q,
// }: {
//   period?: LeaderboardPeriod;
//   limit?: number;
//   offset?: number;
//   q?: string;
// }): Promise<{ rows: any[]; count: number }> {
//   const { data, error } = await supabase.rpc("get_kol_leaderboard", {
//     p_period: period,
//     p_limit: limit,
//     p_offset: offset,
//     p_query: q ?? null,
//   });

//   if (error) {
//     console.error("Leaderboard fetch failed:", error);
//     throw new Error("Failed to load leaderboard");
//   }

//   const rows = (data ?? []) as any[];

//   // total_count is repeated on every row; grab it once
//   const count =
//     rows.length > 0 && rows[0]?.total_count != null
//       ? Number(rows[0].total_count)
//       : 0;

//   return { rows, count };
// }

// KOLwrapped/leaderboard/actions.ts
"use server";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all";

type GetLeaderboardArgs = {
  period?: LeaderboardPeriod;
  limit?: number;
  offset?: number;
  q?: string;
};

type GetLeaderboardResult = { rows: any[]; count: number };

// --- normalize inputs so cache keys are stable ---
function normalizeArgs(args: GetLeaderboardArgs) {
  const period: LeaderboardPeriod = args.period ?? "all";
  const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 50)));
  const offset = Math.max(0, Math.floor(args.offset ?? 0));
  const q = (args.q ?? "").trim();
  return { period, limit, offset, q: q.length ? q : "" };
}

// --- the REAL DB call (uncached) ---
async function _getLeaderboard(args: GetLeaderboardArgs): Promise<GetLeaderboardResult> {
  const { period, limit, offset, q } = normalizeArgs(args);

  const { data, error } = await supabase.rpc("get_kol_leaderboard", {
    p_period: period,
    p_limit: limit,
    p_offset: offset,
    p_query: q.length ? q : null,
  });

  if (error) {
    console.error("Leaderboard fetch failed:", error);
    throw new Error("Failed to load leaderboard");
  }

  const rows = (data ?? []) as any[];

  // total_count is repeated on every row; grab it once
  const count = rows.length > 0 && rows[0]?.total_count != null ? Number(rows[0].total_count) : 0;

  return { rows, count };
}

// --- cached wrapper ---
// ✅ revalidate every 60s (tweak to 30/120/etc)
export async function getLeaderboard(args: GetLeaderboardArgs): Promise<GetLeaderboardResult> {
  const n = normalizeArgs(args);
  
  const cachedFn = unstable_cache(
    async () => _getLeaderboard(args),
    [
      "getLeaderboard:v1",
      n.period,
      String(n.limit),
      String(n.offset),
      n.q.toLowerCase(),
    ],
    { revalidate: 180 }
  );
  
  return cachedFn();
}