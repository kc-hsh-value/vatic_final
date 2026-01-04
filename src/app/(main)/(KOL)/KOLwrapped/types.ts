export type WrappedResult = {
  result: {
    input: { xUsername: string };

    twitter: {
      profile: any | null;
      tweets: Array<{
        id: string;
        createdAt: string;
        text: string;
        likeCount?: number;
        replyCount?: number;
        retweetCount?: number;
        quoteCount?: number;
        viewCount?: number;
        url?: string;
      }>;
    };

    polymarket: {
      linked: boolean;
      address?: string;
      overall?: {
        pnl: number;
        rank: string;
        vol: number;
        traded: number;
        verifiedBadge: boolean;
        userName: string;
        xUsername: string;
      };
      topMarkets2025?: Array<{
        title: string;
        eventSlug: string;
        endDate: string;
        realizedPnl: number;
        conditionId: string;
      }>;
    };

    debug: { fetchedAtIso: string };
  };

  // ✅ deterministic render spec for UI + PNG
  card: CardSpec;
};

export type CardSpec = {
  meta: {
    year: 2025;
    generatedAtIso: string;
  };

  header: {
    name: string;
    handle: string; // "@x"
    followersText: string; // "4.5k followers"
    avatarUrl?: string;
    badge?: {
      label: string;
      imageUrl?: string;
      affiliateUsername?: string | null;
      linkUrl?: string;
    };
  };

  twitter: {
    signalScore: number; // 0-100
    signalLabel: "Noise" | "Mixed" | "Signal";
    themes: string[]; // chips (max 6)
    topTweet?: {
      text: string;
      url?: string;
      metricLabel: "Views" | "Likes";
      metricValue: string; // "12.3k"
      createdAtIso?: string;
    };
  };

  polymarket?: {
    linked: boolean;
    tiles: Array<{ label: string; value: string }>; // max 4-6
    topWins: Array<{ title: string; pnl: string; endDate?: string }>; // max 3-5
  };

  footer: {
    product: "Vatic Trading";
    tagline: string; // e.g. "Prediction Market Terminal"
  };
};

export type TwitterBadge = {
  description: string;
  imageUrl: string;
  affiliateUsername?: string;
  linkUrl?: string;
} | null;

export type TwitterProfile = {
  id: string;
  name: string;
  userName: string;
  createdAt: string;
  followers: number;
  following: number;
  statusesCount: number;
  isBlueVerified: boolean;
  protected: boolean;
  profilePicture?: string;
  coverPicture?: string;
  bio?: string;
  badge: TwitterBadge;
  // ✅ add these
  badgeLabel?: string | null;          // e.g. "zerosupercycle"
  affiliateUsername?: string | null;   // e.g. "zscdao"
};

export type TwitterApiIoUserInfoResponse = any;
export type TwitterApiIoUserAboutResponse = any;

export type PolymarketLeaderboardRow = {
  rank: string;
  proxyWallet: string;
  userName: string;
  xUsername: string;
  verifiedBadge: boolean;
  vol: number;
  pnl: number;
  profileImage: string;
};

export type ClosedPosition = {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  realizedPnl: number;
  title: string;
  eventSlug: string;
  endDate: string;   // ISO
  timestamp: number; // unix seconds
};