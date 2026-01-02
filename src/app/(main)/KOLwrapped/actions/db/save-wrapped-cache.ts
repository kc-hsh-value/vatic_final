"use server";

import supabaseAdmin from "@/lib/supabase/server";

function normX(u: string) {
  return u.trim().replace(/^@/, "").toLowerCase();
}

export async function saveWrappedCache(args: {
  xUsername: string;
  wrapped: any; // jsonb
  ttlSeconds: number;
}) {
  const x = normX(args.xUsername);

  if (!args.wrapped) {
    throw new Error("saveWrappedCache: wrapped is null/undefined");
  }

  const nowIso = new Date().toISOString();

  // Upsert:
  // - First time: creates row with wrapped + hit_count=1 + last_hit_at
  // - Subsequent: updates wrapped + fetched_at + ttl + increments hit_count
  const { error } = await supabaseAdmin
    .from("kol_wrapped_cache")
    .upsert(
      {
        x_username: x,
        wrapped: args.wrapped,
        fetched_at: nowIso,
        ttl_seconds: args.ttlSeconds,
        updated_at: nowIso,
        // on insert these will be used; on conflict we override with update below via "merge" rules
        // hit_count: 1,
        last_hit_at: nowIso,
      },
      { onConflict: "x_username" }
    );

  if (error) throw new Error(error.message);

  // IMPORTANT:
  // Supabase upsert does NOT let us do "hit_count = hit_count + 1" inline.
  // So after upsert, we do an atomic increment with a single SQL RPC.
  // (If you don't want a second call, skip this, but then hit_count won't increment on refresh writes.)
  const { error: incErr } = await supabaseAdmin.rpc("bump_kol_cache_hit", { p_x: x });
  if (incErr) {
    // best-effort; don’t break wrapped generation
    console.warn("bump_kol_cache_hit failed:", incErr.message);
  }
}