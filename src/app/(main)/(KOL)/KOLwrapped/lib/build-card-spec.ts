import type { CardSpec } from "../types";

function clampStr(s: any, max: number) {
  const str = String(s ?? "");
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function formatCompact(n: number): string {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function formatUsd(n: number): string {
  if (!isFinite(n)) return "$0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  // big numbers => compact
  if (abs >= 1_000_000) return `${sign}$${formatCompact(abs)}`;

  // normal => commas
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

function safeIsoFromTwitterCreatedAt(createdAt?: string): string | undefined {
  if (!createdAt) return undefined;
  const d = new Date(createdAt);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function yearOf(createdAt?: string): number | null {
  const iso = safeIsoFromTwitterCreatedAt(createdAt);
  if (!iso) return null;
  return new Date(iso).getUTCFullYear();
}

function pickTopTweet(tweets: any[]) {
  const in2025 = (tweets || []).filter((t) => yearOf(t.createdAt) === 2025);

  const bestByViews = [...in2025].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))[0];
  if (bestByViews && (bestByViews.viewCount ?? 0) > 0) {
    return {
      text: clampStr(bestByViews.text, 240),
      url: bestByViews.url,
      metricLabel: "Views" as const,
      metricValue: formatCompact(Number(bestByViews.viewCount ?? 0)),
      createdAtIso: safeIsoFromTwitterCreatedAt(bestByViews.createdAt),
    };
  }

  const bestByLikes = [...in2025].sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0];
  if (bestByLikes && (bestByLikes.likeCount ?? 0) > 0) {
    return {
      text: clampStr(bestByLikes.text, 240),
      url: bestByLikes.url,
      metricLabel: "Likes" as const,
      metricValue: formatCompact(Number(bestByLikes.likeCount ?? 0)),
      createdAtIso: safeIsoFromTwitterCreatedAt(bestByLikes.createdAt),
    };
  }

  return undefined;
}

// ultra simple “themes” bucketing (good enough for v1)
const THEME_RULES: Array<{ label: string; rx: RegExp }> = [
  { label: "Polymarket", rx: /\bpolymarket\b|\buma\b|\bmarket\b|\bodds?\b|\bshares?\b/i },
  { label: "Kalshi", rx: /\bkalshi\b/i },
  { label: "Geopolitics", rx: /\bukraine\b|\brussia\b|\bisrael\b|\bhamas\b|\biran\b|\bvenezuela\b|\bchina\b/i },
  { label: "Airdrops", rx: /\bairdrop\b|\btge\b|\bpublic sale\b|\bwhitelist\b/i },
  { label: "Memecoins", rx: /\bca\b|\bcontract\b|\bpump\.fun\b|\bmemecoin\b|\bticker\b|\bsol\b/i },
  { label: "Macro", rx: /\bfed\b|\brates?\b|\binflation\b|\bjobs\b|\bcpi\b/i },
];

function extractThemes(tweets: any[], max = 6): string[] {
  const text = (tweets || []).slice(0, 80).map((t) => String(t.text ?? "")).join("\n");

  const hits = THEME_RULES.map((r) => ({
    label: r.label,
    count: (text.match(new RegExp(r.rx.source, r.rx.flags + "g")) || []).length,
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
    .map((x) => x.label);

  return hits.length ? hits : ["Markets", "CT"];
}

// cheap signal score heuristic (0..100)
function computeSignalScore(tweets: any[]): number {
  const sample = (tweets || []).slice(0, 60);
  if (!sample.length) return 50;

  let score = 50;

  const avgLen = sample.reduce((a, t) => a + String(t.text ?? "").length, 0) / sample.length;
  if (avgLen > 220) score += 20;
  else if (avgLen > 140) score += 10;
  else if (avgLen < 80) score -= 10;

  const rtCount = sample.filter((t) => String(t.text ?? "").startsWith("RT @")).length;
  const rtRatio = rtCount / sample.length;
  if (rtRatio > 0.35) score -= 20;
  else if (rtRatio > 0.2) score -= 10;

  const emojiCount = (sample.map((t) => String(t.text ?? "")).join("").match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
  if (emojiCount > 25) score -= 5;

  // clamp
  score = Math.max(0, Math.min(100, Math.round(score)));
  return score;
}

function labelForSignal(score: number): CardSpec["twitter"]["signalLabel"] {
  if (score >= 70) return "Signal";
  if (score >= 45) return "Mixed";
  return "Noise";
}

export function buildCardSpec(args: {
  fetchedAtIso: string;
  xUsername: string;
  profile: any | null;
  tweets: any[];
  polymarket: {
    linked: boolean;
    address?: string;
    overall?: any;
    topMarkets2025?: any[];
  };
}): CardSpec {
  const name = args.profile?.name ?? args.xUsername;
  const handle = `@${args.profile?.userName ?? args.xUsername}`;

  const followers = Number(args.profile?.followers ?? 0);
  const followersText = followers ? `${formatCompact(followers)} followers` : "followers";

  const badge = args.profile?.badge
    ? {
        label: clampStr(args.profile.badge.description ?? "", 40),
        imageUrl: args.profile.badge.imageUrl,
        affiliateUsername: args.profile.affiliateUsername ?? null,
        linkUrl: args.profile.badge.linkUrl,
      }
    : undefined;

  const signalScore = computeSignalScore(args.tweets);
  const themes = extractThemes(args.tweets, 6);
  const topTweet = pickTopTweet(args.tweets);

  const card: CardSpec = {
    meta: {
      year: 2025,
      generatedAtIso: args.fetchedAtIso,
    },
    header: {
      name: clampStr(name, 40),
      handle,
      followersText,
      avatarUrl: args.profile?.profilePicture,
      badge,
    },
    twitter: {
      signalScore,
      signalLabel: labelForSignal(signalScore),
      themes,
      topTweet,
    },
    footer: {
      product: "Vatic Trading",
      tagline: "Prediction Market Terminal",
    },
  };

  if (args.polymarket?.linked) {
    const overall = args.polymarket.overall;

    const tiles = [
      { label: "PnL (2025)", value: formatUsd(Number(overall?.pnl ?? 0)) },
      { label: "Rank", value: overall?.rank ? `#${overall.rank}` : "-" },
      { label: "Volume", value: formatUsd(Number(overall?.vol ?? 0)) },
      { label: "Trades", value: String(overall?.traded ?? 0) },
    ];

    const topWins = (args.polymarket.topMarkets2025 || [])
      .slice(0, 5)
      .map((m: any) => ({
        title: clampStr(m.title, 54),
        pnl: formatUsd(Number(m.realizedPnl ?? 0)),
        endDate: m.endDate,
      }))
      .slice(0, 5);

    card.polymarket = {
      linked: true,
      tiles,
      topWins,
    };
  }

  return card;
}