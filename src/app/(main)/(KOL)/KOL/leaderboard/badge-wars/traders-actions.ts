"use server";

import { createClient } from "@supabase/supabase-js";
import type { LeaderboardPeriod } from "../actions";
import { unstable_cache } from "next/cache";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getBadgeTradersUncached({
  period,
  badgeLabel,
  limit = 25,
  offset = 0,
}: {
  period: LeaderboardPeriod;
  badgeLabel: string;
  limit?: number;
  offset?: number;
}) {
  const { data, error } = await supabase.rpc("get_badge_traders", {
    p_period: period,
    p_badge_label: badgeLabel,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("Badge traders fetch failed:", error);
    throw new Error("Failed to load badge traders");
  }

  const rows = (data ?? []) as any[];
  const total = rows.length ? Number(rows[0]?.total_count ?? rows.length) : 0;

  return { rows, total };
}

export async function getBadgeTraders({
  period,
  badgeLabel,
  limit = 25,
  offset = 0,
}: {
  period: LeaderboardPeriod;
  badgeLabel: string;
  limit?: number;
  offset?: number;
}) {
  const getCached = unstable_cache(
    async () => getBadgeTradersUncached({ period, badgeLabel, limit, offset }),
    [`badge-traders-${period}-${badgeLabel}-${limit}-${offset}`],
    {
      revalidate: 180, // 3 minutes
      tags: ["badge-traders", `badge-traders-${period}`, `badge-traders-${badgeLabel}`],
    }
  );

  return getCached();
}