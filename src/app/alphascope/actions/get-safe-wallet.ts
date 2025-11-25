"use server"

import supabaseAdmin from "@/lib/supabase/server";


export async function getSafeWallet(userId: string): Promise<{ address: `0x${string}` } | null> {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("safe_wallet_address")
      .eq("id", userId)
      .maybeSingle();
  
    if (profile?.safe_wallet_address) {
      return { address: profile.safe_wallet_address as `0x${string}` };
    }
  
    return null;

}