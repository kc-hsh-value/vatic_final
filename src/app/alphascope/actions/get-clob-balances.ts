// src/actions/get-clob-balances.ts
"use server";

import { getGlobalClobClient } from "@/server/global-clob-client";
import { privy } from "@/server/privy";

import { AssetType } from "@polymarket/clob-client";

export async function getClobBalancesByAccessToken({
  accessToken,
  walletId,
}: {
  accessToken: string;
  walletId: string;
}) {
  const claims = await privy.verifyAuthToken(accessToken);
  const userId = claims.userId as string;

  // ✅ pass walletId to global client
  const { client } = await getGlobalClobClient(userId, walletId);

  const collateral = await client.getBalanceAllowance({
    asset_type: AssetType.COLLATERAL,
  });
  const available = Number(collateral?.balance ?? 0);

  const openOrders = await client.getOpenOrders();
  const locked = openOrders
    .filter((o: any) => o.side === "BUY")
    .reduce((sum: number, o: any) => sum + o.remaining_size * o.price, 0);

  return { available, locked };
}