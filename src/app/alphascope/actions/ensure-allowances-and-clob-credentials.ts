// src/app/alphascope/actions/ensure-onchain-and-clob.ts
"use server";

import supabase from "@/lib/supabase/server";
import { setPolymarketAllowances } from "./allowances"; // your working function
import { getContractConfig, ClobClient } from "@polymarket/clob-client";
import { createEthersSigner } from "@privy-io/server-auth/ethers";
import { JsonRpcProvider } from "ethers";
import { privy } from "@/lib/privy/authorization-privy";
import { markAllowances } from "./update-flags";

type Input = {
  userId: string;
  walletId: string;            // Privy wallet id
  address: `0x${string}`;
  chainId: number;             // 137
};

export async function ensureOnchainAndClob(input: Input) {
  const { userId, walletId, address, chainId } = input;

  // Read current flags & creds
  const { data: profile } = await supabase
    .from("profiles")
    .select("allowances")
    .eq("id", userId)
    .maybeSingle();

  const { data: existingCreds } = await supabase
    .from("polymarket_api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // 1) Allowances (only if missing)
  if (!profile?.allowances) {
    const res = await setPolymarketAllowances({ walletId, owner: address, sponsor:true, address });
    if (!res?.ok) throw new Error("Failed to set allowances");
    await markAllowances(userId);
  }

  // 2) CLOB creds (only if missing)
  if (!existingCreds) {
    const rpc = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";
    const provider = new JsonRpcProvider(rpc);

    // Privy signer → shim for clob client (you already used this pattern)
    const signer = createEthersSigner({ walletId, address, provider, privyClient: privy as any });
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
      address
    });
  }

  return { ok: true };
}

