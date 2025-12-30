// KOLwrapped/leaderboard/page.tsx
import LeaderboardClient from "./leaderboard-client";
import { getLeaderboard } from "./actions";
import type { LeaderboardPeriod } from "./actions";

export default async function LeaderboardPage() {
  const initialPeriod: LeaderboardPeriod = "all";
  const initialLimit = 50;
  const initialOffset = 0;
  const initialQuery = "";

  const { rows, count } = await getLeaderboard({
    period: initialPeriod,
    limit: initialLimit,
    offset: initialOffset,
    q: initialQuery,
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-[1080px]">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg opacity-90" />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-none">KOL Leaderboard</h1>
            <p className="text-zinc-500 text-sm mt-1">Ranked by Polymarket PnL (daily / weekly / monthly / all-time)</p>
          </div>
        </div>

        <LeaderboardClient
          initialPeriod={initialPeriod}
          initialLimit={initialLimit}
          initialOffset={initialOffset}
          initialQuery={initialQuery}
          initialRows={rows ?? []}
          initialCount={count ?? 0}
        />
      </div>
    </main>
  );
}