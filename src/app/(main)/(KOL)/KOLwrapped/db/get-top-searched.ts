"use server";

import supabaseAdmin from "@/lib/supabase/server";

function pickProfileSummary(row: any) {
  const wrapped = row?.wrapped ?? {};
  const profile = wrapped?.twitter?.profile ?? {};

  return {
    x_username: row.x_username,
    hit_count: Number(row.hit_count ?? 0),
    profilePicture: profile.profilePicture ?? null,
    name: profile.name ?? null,
    handle: profile.username ? `@${profile.username}` : `@${row.x_username}`,
    isBlueVerified: !!profile.isBlueVerified,
    badge: profile.badge?.description
      ? {
          description: profile.badge.description,
          imageUrl: profile.badge.imageUrl ?? null,
        }
      : null,
  };
}

export async function getTopSearchedAccounts(limit = 8) {
  const { data, error } = await supabaseAdmin
    .from("kol_wrapped_cache")
    .select("x_username, hit_count, wrapped")
    .not("wrapped", "is", null)
    .order("hit_count", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map(pickProfileSummary);
}