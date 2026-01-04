"use client";

import { useMemo, useState } from "react";
import type { LeaderboardPeriod } from "./actions";
import type { LeaderboardRow } from "./types";

import LeaderboardClient from "./leaderboard-client";
import BadgeWarsPanel from "./badge-wars/badge-wars-panel";
import type { BadgeWarRow } from "./badge-wars/actions";

export default function LeaderboardShell({
  initialPeriod,
  initialRows,
  initialCount,
  initialBadgeRows,
}: {
  initialPeriod: LeaderboardPeriod;
  initialRows: LeaderboardRow[];
  initialCount: number;
  initialBadgeRows: BadgeWarRow[];
}) {
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);

  const [badgePinned, setBadgePinned] = useState<string | null>(null);
  const [badgeHover, setBadgeHover] = useState<string | null>(null);

  const effectiveBadge = useMemo(() => badgePinned ?? badgeHover, [badgePinned, badgeHover]);

  // We feed the leaderboard "q" as the badge label.
  // Your existing RPC currently searches username/display_name.
  // So: you MUST update your leaderboard RPC OR create a new param (best).
  // For now: we'll pass it via `initialQuery` and your server action can interpret it as badge mode.
  const leaderboardQuery = effectiveBadge ? `badge:${effectiveBadge}` : "";

  return (
    <div className="w-full max-w-[1080px]">
      {/* Badge Wars dropdown ABOVE leaderboard */}
      <BadgeWarsPanel
        initialOpen
        period={period}
        onPeriodChange={setPeriod}
        initialPeriod={period}
        initialRows={initialBadgeRows}
        selectedBadge={badgePinned}
        onBadgeHover={setBadgeHover}
        onBadgeSelect={setBadgePinned}
      />

      {/* Leaderboard */}
      <div className="mt-8">
        <LeaderboardClient
          initialPeriod={period}
          initialLimit={50}
          initialOffset={0}
          initialRows={initialRows}
          initialCount={initialCount}
          initialQuery={leaderboardQuery}
        />
      </div>
    </div>
  );
}