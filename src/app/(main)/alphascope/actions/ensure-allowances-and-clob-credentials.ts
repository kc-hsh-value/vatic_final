// src/app/alphascope/actions/ensure-onchain-and-clob.ts
"use server";

import supabase from "@/lib/supabase/server";
import { setPolymarketAllowances } from "./allowances"; // your working function
import { getContractConfig, ClobClient } from "@polymarket/clob-client";
import { createEthersSigner } from "@privy-io/server-auth/ethers";
import { JsonRpcProvider } from "ethers";
import { privy } from "@/lib/privy/authorization-privy";
import { markAllowances } from "./update-flags";

// Define a clear input type
type EnsureInput = { userId: string; walletId: string; eoaAddress: `0x${string}`; chainId: number; };

export async function ensureOnchainAndClob(input: EnsureInput) {
  const { userId, walletId, eoaAddress, chainId } = input;

  // 1. Get the user's complete profile from the DB in one go
  const { data: profile } = await supabase
    .from("profiles")
    .select("allowances, safe_wallet_address")
    .eq("id", userId)
    .single();

  const { data: existingCreds } = await supabase
    .from("polymarket_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // 2. Handle Allowances & Safe Wallet
  if (!profile?.allowances || !profile.safe_wallet_address) {
    console.log("Profile needs allowances or Safe Wallet setup.");
    const res = await setPolymarketAllowances({ 
        userId, 
        walletId, 
        eoaAddress,
        // We pass the potentially null safe_wallet_address. The function will handle it.
        currentSafeAddress: profile?.safe_wallet_address as `0x${string}` | null 
    });
    if (!res?.ok) throw new Error("Failed to set allowances and/or safe wallet.");
    await markAllowances(userId);
  }

  // 3. Handle CLOB Credentials (for the EOA)
  // the clob creds need to belong to the EOA, not the Safe because we need to be able to sign orders
  if (!existingCreds) {
    const rpc = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";
    const provider = new JsonRpcProvider(rpc);

    // Privy signer → shim for clob client (you already used this pattern)
    const signer = createEthersSigner({ walletId, address: eoaAddress, provider, privyClient: privy as any });
    const shim: any = {
      _signTypedData: (d: any, t: any, v: any) =>
        (signer as any)._signTypedData?.(d, t, v) ?? (signer as any).signTypedData(d, t, v),
      getAddress: () => signer.getAddress(),
      signMessage: (m: string | Uint8Array) => signer.signMessage(m),
      provider: null,
    };

    const host = process.env.POLYMARKET_CLOB_HOST ?? "https://clob.polymarket.com";
    const base = new ClobClient(host, chainId, shim);

    // createOrDeriveApiKey already works for you
    const creds = await base.createOrDeriveApiKey();

    const {data,error} = await supabase.from("polymarket_api_keys").upsert({
      user_id: userId,
      key: creds.key,
      secret: creds.secret,
      passphrase: creds.passphrase,
      address: eoaAddress,
    });
  }

  return { ok: true };
}

