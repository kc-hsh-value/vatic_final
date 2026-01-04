// KOLwrapped/leaderboard/page.tsx
import LeaderboardClient from "./leaderboard-client";
import { getLeaderboard, type LeaderboardPeriod } from "./actions";
// import { getBadgeWars } from "./badge-wars/actions";
// import BadgeWarsClient from "./badge-wars/badge-wars-client";
export const revalidate = 180;

function parsePeriod(p: unknown): LeaderboardPeriod {
  const v = typeof p === "string" ? p : "";
  if (v === "daily" || v === "weekly" || v === "monthly" || v === "all") return v;
  return "all";
}

function parseIntSafe(v: unknown, fallback: number) {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialPeriod: LeaderboardPeriod = parsePeriod(params?.period);

  const initialLimit = clamp(parseIntSafe(params?.limit, 50), 10, 200);
  const initialOffset = Math.max(0, parseIntSafe(params?.offset, 0));

  const initialQuery =
    typeof params?.q === "string" ? params.q : "";

  const { rows, count } = await getLeaderboard({
    period: initialPeriod,
    limit: initialLimit,
    offset: initialOffset,
    q: initialQuery,
  });

  // const badgeWarsInitial = await getBadgeWars({ period: initialPeriod, limit: 24, offset: 0 });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center py-12 px-4 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-[1080px]">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-lg opacity-90" />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-none">
              KOL Leaderboard
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Ranked by Polymarket PnL (daily / weekly / monthly / all-time)
            </p>
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

        {/* <BadgeWarsClient initialPeriod={initialPeriod} initialRows={badgeWarsInitial ?? []} /> */}
      </div>
    </main>
  );
}