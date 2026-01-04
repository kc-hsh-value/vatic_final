// KOLwrapped/leaderboard/types.ts
export type LeaderboardRow = {
  id: number;
  polymarket_address: string | null;
  x_username: string | null;
  x_display_name: string | null;
  x_profile_image_url: string | null;
  x_badge_label: string | null;
  x_badge_icon_url: string | null;
  x_followers: number | null;

  pnl_daily: number | null;
  pnl_weekly: number | null;
  pnl_monthly: number | null;
  pnl_all: number | null;

  pnl_change_24h: number | null;
  rank_change_24h: number | null;

  // returned by RPC
  global_rank: number | null;
  total_count?: number | null;
};