// src/app/alphascope/actions/get-provisioning-status.ts
"use server";

import supabase from "@/lib/supabase/server";

export type ProvisioningStatus = {
  exists: boolean;
  signers_added: boolean;
  hasAllowances: boolean;
  hasClobCreds: boolean;
  hasSafeWallet: boolean;
};

export async function getProvisioningStatus(userId: string): Promise<ProvisioningStatus> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, signers_added, allowances, safe_wallet_address")
    .eq("id", userId)
    .maybeSingle();

  const { data: creds } = await supabase
    .from("polymarket_api_keys")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    exists: !!profile,
    signers_added: !!profile?.signers_added,
    hasAllowances: !!profile?.allowances,
    hasClobCreds: !!creds,
    hasSafeWallet: !!profile?.safe_wallet_address,
  };
}