import { twitterLastTweets } from "../clients/twitter-api-io";

type Tweet = {
  id: string;
  text: string;
  createdAt: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  viewCount?: number;
  url?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withBudget<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export async function fetchUserTweetsPaged(params: {
  userId: string; // ✅ Prefer userId: more stable/faster than userName
  includeReplies?: boolean;

  // target amount
  maxTweets?: number; // default 40
  maxPages?: number; // default 2

  // safety
  pageTimeoutMs?: number; // default 9000
  minTweetsPerPage?: number; // default 5
}): Promise<Tweet[]> {
  const {
    userId,
    includeReplies = false,
    maxTweets = 40,
    maxPages = 2,
    pageTimeoutMs = 9000,
    minTweetsPerPage = 5,
  } = params;

  const out: Tweet[] = [];
  let cursor = ""; // first page

  for (let page = 0; page < maxPages; page++) {
    const res = await withBudget(
      twitterLastTweets({ userId, includeReplies, cursor }),
      pageTimeoutMs
    );

    // timed out => stop cleanly
    if (!res) break;

    const tweets: any[] = res?.data?.tweets ?? res?.tweets ?? [];
    const hasNext: boolean = Boolean(res?.data?.has_next_page ?? res?.has_next_page);
    const nextCursor: string = String(res?.data?.next_cursor ?? res?.next_cursor ?? "");

    if (!tweets.length) break;

    for (const t of tweets) {
      out.push({
        id: String(t.id),
        text: String(t.text ?? ""),
        createdAt: String(t.createdAt ?? ""),
        likeCount: t.likeCount,
        replyCount: t.replyCount,
        retweetCount: t.retweetCount,
        quoteCount: t.quoteCount,
        viewCount: t.viewCount,
        url: t.url,
      });

      if (out.length >= maxTweets) return out.slice(0, maxTweets);
    }

    // If API returns tiny pages (sometimes happens), stop early
    if (tweets.length < minTweetsPerPage) break;

    if (!hasNext || !nextCursor) break;
    cursor = nextCursor;

    // tiny pacing to reduce provider weirdness/throttling
    await sleep(100);
  }

  return out;
}