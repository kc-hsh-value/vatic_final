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

// ✅ central predicate so you can tweak later
function isRetweetLike(t: any): boolean {
  const text = String(t?.text ?? "");
  // classic RT
  if (/^RT\s+@/i.test(text)) return true;

  // providers sometimes expose explicit fields (keep these checks loose)
  if (t?.isRetweet === true) return true;
  if (t?.retweeted_tweet || t?.retweetedTweet || t?.retweeted_status) return true;

  return false;
}

export async function fetchUserTweetsPaged(params: {
  userId: string;
  includeReplies?: boolean;

  maxTweets?: number;
  maxPages?: number;

  pageTimeoutMs?: number;
  minTweetsPerPage?: number;

  // ✅ add a switch (default false)
  includeRetweets?: boolean;
}): Promise<Tweet[]> {
  const {
    userId,
    includeReplies = false,
    includeRetweets = false,
    maxTweets = 40,
    maxPages = 2,
    pageTimeoutMs = 9000,
    minTweetsPerPage = 5,
  } = params;

  const out: Tweet[] = [];
  let cursor = "";

  for (let page = 0; page < maxPages; page++) {
    const res = await withBudget(
      twitterLastTweets({ userId, includeReplies, cursor }),
      pageTimeoutMs
    );

    if (!res) break;

    const tweets: any[] = res?.data?.tweets ?? res?.tweets ?? [];
    const hasNext: boolean = Boolean(res?.data?.has_next_page ?? res?.has_next_page);
    const nextCursor: string = String(res?.data?.next_cursor ?? res?.next_cursor ?? "");

    if (!tweets.length) break;

    for (const t of tweets) {
      // ✅ drop RTs early
      if (!includeRetweets && isRetweetLike(t)) continue;

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

    if (tweets.length < minTweetsPerPage) break;
    if (!hasNext || !nextCursor) break;

    cursor = nextCursor;
    await sleep(100);
  }

  return out;
}