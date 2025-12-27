// app/actions/get-erc20-balance.ts
"use server";

import { JsonRpcProvider, Interface } from "ethers";
import { getContractConfig } from "@polymarket/clob-client";
import privyClient from '@/lib/privy/server';

import { privy } from "@/server/privy";
import { getEmbeddedEvmForUser } from "./get-embedded-evm-wallet";


const RPC = process.env.POLYGON_RPC_URL!;
const provider = new JsonRpcProvider(RPC);
const ERC20 = new Interface([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export async function getUSDCeBalance({ accessToken }: { accessToken: string }) {
  const claims = await privyClient.verifyAuthToken(accessToken);
  const userId = claims.userId;

  // Resolve the embedded wallet server-side (don’t trust client address)
  const { address } = await getEmbeddedEvmForUser(userId); // implement using Privy server SDK
  const { collateral } = getContractConfig(137);
  const [balData, decData] = await Promise.all([
    provider.call({ to: collateral, data: ERC20.encodeFunctionData("balanceOf", [address]) }),
    provider.call({ to: collateral, data: ERC20.encodeFunctionData("decimals", []) }),
  ]);

  const raw = ERC20.decodeFunctionResult("balanceOf", balData)[0];
  const decimals: number = ERC20.decodeFunctionResult("decimals", decData)[0];
  const num = Number(raw) / 10 ** decimals; // USDC.e is 6, but don’t hardcode
  return { address, token: collateral as `0x${string}`, balance: num, decimals };
}

/**
 * Preferred: verify token → derive user → derive embedded wallet → return balance.
 */
export async function getUSDCeBalanceByAccessToken(params: { accessToken: string }) {
  const { accessToken } = params;
  const claims = await privy.verifyAuthToken(accessToken); // throws if invalid
  const { address } = await getEmbeddedEvmForUser(claims.userId);
  return getUSDCeBalanceByAddress({ address });
}

/**
 * Fallback: balance by raw address (no auth). Keep for internal calls if needed.
 */
export async function getUSDCeBalanceByAddress(params: { address: `0x${string}` }) {
  const { address } = params;
  if (!address?.startsWith("0x")) throw new Error("Invalid address");

  const cfg = getContractConfig(137); // Polygon PoS
  const token = cfg.collateral as `0x${string}`;

  const [rawBalData, decData] = await Promise.all([
    provider.call({ to: token, data: ERC20.encodeFunctionData("balanceOf", [address]) }),
    provider.call({ to: token, data: ERC20.encodeFunctionData("decimals", []) }),
  ]);

  const raw = ERC20.decodeFunctionResult("balanceOf", rawBalData)[0] as bigint;
  const decimals = Number(ERC20.decodeFunctionResult("decimals", decData)[0]);
  const balance = Number(raw) / 10 ** decimals;

  return { address, token, decimals, balance };
}