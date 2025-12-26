"use server";

import { getWrappedCache } from "../../db/kol-wrapped-cache";
import { generateWrapped } from "../../lib/generate-wrapped";
import { judgeVibes } from "../llm/vibes";
import { saveWrappedCache } from "./save-wrapped-cache";

function pickTopTweetsByLikes(tweets: any[], n = 3) {
  const year = (createdAt?: string) => {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
  };
  const in2025 = (tweets ?? []).filter((t: any) => year(t.createdAt) === 2025);
  const pool = in2025.length ? in2025 : (tweets ?? []);
  return [...pool].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0)).slice(0, n);
}

export async function getOrGenerateWrapped(xUsername: string) {
  const cached = await getWrappedCache(xUsername);

  // ✅ cached and not time/force refresh
  if (cached?.wrapped && !cached.shouldRefresh) {
    return cached.wrapped;
  }

  // ✅ regenerate (covers: first time, missing wrapped, every 10th hit, >2 days, ttl)
  const fresh = await generateWrapped(xUsername);

  const profile = fresh.result.twitter.profile;
  const tweets = fresh.result.twitter.tweets ?? [];
  const top3 = pickTopTweetsByLikes(tweets, 3).map((t: any) => ({
    text: String(t.text ?? "").slice(0, 420),
    likeCount: t.likeCount ?? 0,
    createdAt: t.createdAt ?? "",
  }));

  const vibes = await judgeVibes({
    xUsername,
    twitter: {
      name: profile?.name,
      bio: profile?.bio,
      followers: profile?.followers,
      badgeLabel: profile?.badge?.description ?? null,
    },
    polymarket: fresh.result.polymarket,
    topTweets: top3,
  });

  const final = { ...fresh.result, vibes };

  await saveWrappedCache({ xUsername, wrapped: final, ttlSeconds: 86400 });

  return final;
}