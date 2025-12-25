// lib/types.ts

export interface Tweet {
  id: string;
  text: string;
  author_name: string;
  tweet_url: string;
  published_at: string;
  x_account?: {
    profile_picture: string;
    handle: string;
    followers_count: number;
  };
}

export interface Correlation {
  id: string;
  market_id: string; // The link to the specific market
  tweet_id: string;
  relevance_score: number;
  relevance_reason: string;
  urgency_score: number;
  created_at_utc: string; // Time of correlation (when our system detected it)
  tweet: Tweet;
}

// The Data Structure for fast lookups
export type CorrelationsMap = Record<string, Correlation[]>;