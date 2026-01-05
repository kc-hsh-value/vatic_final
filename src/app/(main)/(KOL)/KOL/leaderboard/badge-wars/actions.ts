"use server";

import { createClient } from "@supabase/supabase-js";
import type { LeaderboardPeriod } from "../actions";
import { unstable_cache } from "next/cache";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type BadgeWarRow = {
  badge_label: string;
  badge_icon_url: string | null;
  traders_count: number;
  pnl_sum: number;
};

export const getBadgeWars = unstable_cache(
  async ({
    period = "all",
    limit = 24,
    offset = 0,
  }: {
    period?: LeaderboardPeriod;
    limit?: number;
    offset?: number;
  }) => {
    const { data, error } = await supabase.rpc("get_badge_wars", {
      p_period: period,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      console.error("Badge wars fetch failed:", error);
      throw new Error("Failed to load badge wars");
    }

    return (data ?? []) as BadgeWarRow[];
  },
  ["badge-wars"],
  {
    revalidate: 180, // 3 minutes
    tags: ["badge-wars"],
  }
);