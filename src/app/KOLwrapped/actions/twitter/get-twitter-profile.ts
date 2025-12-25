"use server"

import { twitterUserAbout, twitterUserInfo } from "../../clients/twitter-api-io";
import { TwitterBadge, TwitterProfile } from "../../types";

function parseAffiliateFromUrl(url?: string): string | null {
  if (!url) return null;
  // handles https://twitter.com/PolymarketTrade or https://x.com/zscdao
  const m = url.match(/https?:\/\/(x|twitter)\.com\/([^/?#]+)/i);
  return m?.[2] ? String(m[2]) : null;
}

function pickBadge(from: any): TwitterBadge {
  // Try all known shapes you showed
  const candidates = [
    from?.data?.affiliates_highlighted_label?.label,
    from?.data?.identity_profile_labels_highlighted_label?.label,
    from?.data?.affiliatesHighlightedLabel?.label,
    from?.data?.affiliatesHighlightedLabel?.label?.label, // sometimes nested
  ];

  for (const c of candidates) {
    const desc = c?.description;
    const img = c?.badge?.url;
    const link = c?.url?.url;
    if (desc && img) {
      return {
        description: String(desc),
        imageUrl: String(img),
        linkUrl: link ? String(link) : undefined,
      };
    }
  }
  return null;
}

function pickAffiliateUsername(from: any, badge?: TwitterBadge): string | null {
  const direct =
    from?.data?.about_profile?.affiliate_username ??
    from?.data?.aboutProfile?.affiliateUsername ??
    null;

  if (direct) return String(direct);

  const linkUser = parseAffiliateFromUrl(badge?.linkUrl);
  return linkUser ?? null;
}

function pickBio(dataInfo: any, dataAbout: any): string {
  // Prefer clean "bio" if your info endpoint already maps it
  const candidates = [
    dataInfo?.bio,
    dataInfo?.description,
    dataInfo?.profile_bio?.description,
    dataAbout?.bio,
    dataAbout?.description,
    dataAbout?.profile_bio?.description,
  ].filter(Boolean);

  return candidates.length ? String(candidates[0]) : "";
}

export async function getTwitterProfile(userName: string): Promise<TwitterProfile> {
  // Call both: info usually has counts/pics; about often has badge / affiliate info.
  const [about, info] = await Promise.all([
    twitterUserAbout(userName),
    twitterUserInfo(userName),
  ]);

  const dataInfo = info?.data || {};
  const dataAbout = about?.data || {};

  const badge = pickBadge(about) ?? pickBadge(info);
  const affiliateUsername =
    pickAffiliateUsername(about, badge) ??
    pickAffiliateUsername(info, badge);

  return {
    id: String(dataInfo.id ?? dataAbout.id ?? ""),
    name: String(dataInfo.name ?? dataAbout.name ?? userName),
    userName: String(dataInfo.userName ?? dataAbout.userName ?? userName),
    createdAt: String(dataInfo.createdAt ?? dataAbout.createdAt ?? ""),
    followers: Number(dataInfo.followers ?? 0),
    following: Number(dataInfo.following ?? 0),
    statusesCount: Number(dataInfo.statusesCount ?? 0),
    isBlueVerified: Boolean(dataInfo.isBlueVerified ?? dataAbout.isBlueVerified ?? false),
    protected: Boolean(dataInfo.protected ?? dataAbout.protected ?? false),
    profilePicture: dataInfo.profilePicture ?? dataAbout.profilePicture,
    coverPicture: dataInfo.coverPicture ?? dataAbout.coverPicture,
    bio: pickBio(dataInfo, dataAbout),

    // ✅ important: pass both
    badge,
    affiliateUsername,
  };
}