// KOLwrapped/leaderboard/actions.ts
"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all";

export async function getLeaderboard({
  period = "all",
  limit = 50,
  offset = 0,
  q,
}: {
  period?: LeaderboardPeriod;
  limit?: number;
  offset?: number;
  q?: string;
}): Promise<{ rows: any[]; count: number }> {
  const { data, error } = await supabase.rpc("get_kol_leaderboard", {
    p_period: period,
    p_limit: limit,
    p_offset: offset,
    p_query: q ?? null,
  });

  if (error) {
    console.error("Leaderboard fetch failed:", error);
    throw new Error("Failed to load leaderboard");
  }

  const rows = (data ?? []) as any[];

  // total_count is repeated on every row; grab it once
  const count =
    rows.length > 0 && rows[0]?.total_count != null
      ? Number(rows[0].total_count)
      : 0;

  return { rows, count };
}