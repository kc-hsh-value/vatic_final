"use server";

import supabaseAdmin from "@/lib/supabase/server";

function normX(u: string) {
  return u.trim().replace(/^@/, "").toLowerCase();
}

export async function getWrappedCache(xUsername: string) {
  const key = xUsername.trim().replace(/^@/, "").toLowerCase();

  const { data, error } = await supabaseAdmin.rpc("kol_wrapped_cache_bump_and_get", {
    p_x_username: key,
    p_force_every_n: 10,
    p_refresh_after_seconds: 2 * 24 * 60 * 60,
  });

  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row) return null;

  return {
    wrapped: row.wrapped,
    shouldRefresh: !!row.should_refresh,
    hitCount: row.hit_count,
    fetchedAt: row.fetched_at,
    ttlSeconds: row.ttl_seconds,
  };
}

export async function bumpWrappedCacheHit(xUsername: string) {
  const x = normX(xUsername);


  // best-effort; ignore failures
  await supabaseAdmin
    .from("kol_wrapped_cache")
    .update({
      last_hit_at: new Date().toISOString(),
    })
    .eq("x_username", x);
    
    
    
    await supabaseAdmin.rpc("bump_kol_cache_hit", { p_x: xUsername });

  // If you want atomic hit_count increment, use RPC below (optional).
}