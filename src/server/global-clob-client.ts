// src/server/global-clob-client.ts
"use server";

import { JsonRpcProvider } from "ethers";
import { createEthersSigner } from "@privy-io/server-auth/ethers";
import { privy } from "@/server/privy";
import supabaseAdmin from "@/lib/supabase/server";
import { ClobClient } from "@polymarket/clob-client";

const host = process.env.POLYMARKET_CLOB_HOST ?? "https://clob.polymarket.com";
const rpc = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";
const chainId = 137;

declare global {
  var __VATIC_CLOB_CLIENTS__: Map<string, any> | undefined;
}

const cache = globalThis.__VATIC_CLOB_CLIENTS__ ?? new Map();
if (!globalThis.__VATIC_CLOB_CLIENTS__) globalThis.__VATIC_CLOB_CLIENTS__ = cache;

async function loadUserClobCreds(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("polymarket_api_keys")
    .select("user_id, address, key, secret, passphrase")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Missing CLOB credentials");
  return data;
}

/**
 * Returns a ready-to-use ClobClient with the signer shim.
 * Now also takes `walletId` since it’s not stored in DB.
 */
export async function getGlobalClobClient(userId: string, walletId: string) {
  const cacheKey = `${userId}-${walletId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const creds = await loadUserClobCreds(userId);
  const provider = new JsonRpcProvider(rpc);

  const signer = createEthersSigner({
    walletId, // ✅ passed explicitly now
    address: creds.address,
    provider,
    privyClient: privy as any,
  });

  const shim: any = {
    _signTypedData: (domain: any, types: any, value: any) =>
      (signer as any)._signTypedData?.(domain, types, value) ??
      (signer as any).signTypedData(domain, types, value),
    getAddress: () => signer.getAddress(),
    signMessage: (m: string | Uint8Array) => signer.signMessage(m),
    provider: null,
  };

  const base = new ClobClient(host, chainId, shim);
  const credsRes = await base.createOrDeriveApiKey();
  const client = new ClobClient(host, chainId, shim, credsRes, 0, creds.address);

  cache.set(cacheKey, { client, address: creds.address });
  return { client, address: creds.address };
}