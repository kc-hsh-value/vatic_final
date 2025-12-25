"use client";

import { getTwitterProfile } from "../actions/twitter/get-twitter-profile";
import { fetchUserTweetsPaged } from "../services/twitter-tweet-service";
import { findPolymarketAddressByXUsername } from "../db/polymarket-kols";
import { getOverallStats, getTopClosedMarkets2025 } from "../services/polymarket-services";
import type { WrappedResult } from "../types";
import { buildCardSpec } from "./build-card-spec";

export async function generateWrapped(xUsername: string): Promise<WrappedResult> {
  const fetchedAtIso = new Date().toISOString();

  const profile = await getTwitterProfile(xUsername);

  if (!profile?.id) {
    const result = {
      input: { xUsername },
      twitter: { profile: profile ?? null, tweets: [] },
      polymarket: { linked: false as const },
      debug: { fetchedAtIso },
    };

    return {
      result,
      card: buildCardSpec({
        fetchedAtIso,
        xUsername,
        profile: profile ?? null,
        tweets: [],
        polymarket: { linked: false },
      }),
    };
  }

  const tweetsPromise = fetchUserTweetsPaged({
    userId: profile.id,
    includeReplies: false,
    maxTweets: 120,
    maxPages: 10,
    pageTimeoutMs: 9000,
  });

  const addressPromise = findPolymarketAddressByXUsername(xUsername);

  const [tweets, address] = await Promise.all([tweetsPromise, addressPromise]);

  if (!address) {
    const result = {
      input: { xUsername },
      twitter: { profile, tweets },
      polymarket: { linked: false as const },
      debug: { fetchedAtIso },
    };

    return {
      result,
      card: buildCardSpec({
        fetchedAtIso,
        xUsername,
        profile,
        tweets,
        polymarket: { linked: false },
      }),
    };
  }

    const [overallRaw, topMarkets2025] = await Promise.all([
    getOverallStats(address),
    getTopClosedMarkets2025(address, 5),
    ]);

    const overall = overallRaw ?? undefined;
  const result = {
    input: { xUsername },
    twitter: { profile, tweets },
    polymarket: { linked: true as const, address, overall, topMarkets2025 },
    debug: { fetchedAtIso },
  };

  return {
    result,
    card: buildCardSpec({
      fetchedAtIso,
      xUsername,
      profile,
      tweets,
      polymarket: { linked: true, address, overall, topMarkets2025 },
    }),
  };
}