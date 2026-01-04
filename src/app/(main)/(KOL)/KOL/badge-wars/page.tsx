// KOLwrapped/leaderboard/page.tsx

import { Suspense } from "react";
import { getLeaderboard, LeaderboardPeriod } from "../../KOL/leaderboard/actions";
import { getBadgeWars } from "../../KOL/leaderboard/badge-wars/actions";
import BadgeWarsClient from "../../KOL/leaderboard/badge-wars/badge-wars-client";

export default async function LeaderboardPage() {
  const initialPeriod: LeaderboardPeriod = "all";
  const initialLimit = 50;
  const initialOffset = 0;
  const initialQuery = "";

  const badgeWarsInitial = await getBadgeWars({ period: initialPeriod, limit: 24, offset: 0 });


  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-[1080px]">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg opacity-90" />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-none">KOL Badge Wars</h1>
            <p className="text-zinc-500 text-sm mt-1">Cumulative PnL of badge traders</p>
          </div>
        </div>
        <Suspense fallback={null}>
          <BadgeWarsClient initialPeriod={initialPeriod} initialRows={badgeWarsInitial ?? []} />
        </Suspense>
      </div>
    </main>
  );
}