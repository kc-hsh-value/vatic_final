"use server";
import { fetchJsonWithTimeout, retry } from "../utils/http";

const BASE = "https://api.twitterapi.io/twitter";

// Tight timeouts so you never block the wrapped page.
// You can tweak these slightly, but keep them bounded.
const TIMEOUT_USER_MS = 8_000;
const TIMEOUT_TWEETS_MS = 10_000;

function headers() {
  return { "X-API-Key": process.env.X_API_KEY || "" };
}

async function getJson<T>(url: string, timeoutMs: number): Promise<T> {
  return retry(
    () => fetchJsonWithTimeout<T>(url, { method: "GET", headers: headers() }, timeoutMs),
    2
  );
}

export async function twitterUserAbout(userName: string) {
  return getJson<any>(
    `${BASE}/user_about?userName=${encodeURIComponent(userName)}`,
    TIMEOUT_USER_MS
  );
}

export async function twitterUserInfo(userName: string) {
  return getJson<any>(
    `${BASE}/user/info?userName=${encodeURIComponent(userName)}`,
    TIMEOUT_USER_MS
  );
}

export async function twitterLastTweets(params: {
  userName?: string;
  userId?: string;
  includeReplies?: boolean;
  cursor?: string;
}) {
  const { userName, userId, includeReplies = false, cursor = "" } = params;

  const qp = new URLSearchParams();
  if (userId) qp.set("userId", userId);
  else if (userName) qp.set("userName", userName);
  else throw new Error("twitterLastTweets requires userId or userName");

  qp.set("includeReplies", String(includeReplies));
  qp.set("cursor", cursor);

  return getJson<any>(`${BASE}/user/last_tweets?${qp.toString()}`, TIMEOUT_TWEETS_MS);
}