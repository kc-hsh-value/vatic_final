"use server";
import supabaseAdmin from "@/lib/supabase/server";


type PolymarketKolRow = {
  x_username: string;
  polymarket_address: string;
};

export async function findPolymarketAddressByXUsername(xUsername: string) {
  // prefer exact-ish case-insensitive match
  const { data, error } = await supabaseAdmin
    .from("polymarket_kols")
    .select("x_username, polymarket_address")
    .ilike("x_username", xUsername) // case-insensitive exact match
    .limit(1);

  if (error) throw new Error(`Supabase error: ${error.message}`);

  const row = (data?.[0] as PolymarketKolRow | undefined) ?? null;
  return row?.polymarket_address ?? null;
}