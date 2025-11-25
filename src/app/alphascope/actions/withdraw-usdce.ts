// src/actions/withdraw-usdce.ts
"use server";

import { z } from "zod";
import { Interface, JsonRpcProvider } from "ethers";
import { privy } from "@/server/privy";
import { getUSDCeBalanceByAddress } from "./get-usdce-balance";


/**
 * Chain / token config
 */
const CHAIN_ID = 137; // Polygon
const USDCe = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;

/**
 * Minimal ERC20 ABI
 */
const ERC20 = new Interface([
  "function transfer(address to, uint256 value) returns (bool)"
]);

/**
 * Inputs
 */
// const Input = z.object({
//   walletId: z.string().min(1),               // embedded walletId
//   fromAddress: z.string().startsWith("0x"),  // embedded wallet address
//   toAddress: z.string().startsWith("0x"),    // destination address
//   percent: z.number().min(0.1).max(100),     // percent of available to withdraw
//   sponsor: z.boolean().optional().default(true),
// });

/**
 * Helpers
 */
const toUnits = (amt: number) => BigInt(Math.floor(amt * 1e6)); // USDC 6 decimals
const hex = (n: bigint | number) => ("0x" + BigInt(n).toString(16)) as `0x${string}`;
const xfer = (to: string, value: bigint) =>
  ERC20.encodeFunctionData("transfer", [to, value]) as `0x${string}`;

// Simple retry for transient relayer/RPC hiccups
async function sendWithRetry<T>(fn: () => Promise<T>, label: string, max = 3) {
  let attempt = 0;
  const waits = [600, 1200, 2000];
  // @ts-ignore
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      attempt++;
      const msg = String(e?.message || e);
      const type = e?.type || "";
      const status = e?.status;
      const retryable =
        type === "client_error" ||
        status === 429 ||
        /timeout|aborted|network|Temporary/i.test(msg);
      if (!retryable || attempt >= max) {
        // surface useful context
        e.message = `[${label}] ${e.message || "send failed"}`;
        throw e;
      }
      const ms = waits[Math.min(attempt - 1, waits.length - 1)];
      await new Promise((r) => setTimeout(r, ms));
    }
  }
}

/**
 * Main action
 */
// export async function withdrawUsdce(payload: unknown) {
//   const { walletId, fromAddress, toAddress, percent, sponsor } = Input.parse(payload);

//   const FEE_BPS = 50; // 0.5%
//   const feeWallet = process.env.WITHDRAW_FEE_WALLET;
//   if (!feeWallet) throw new Error("Missing WITHDRAW_FEE_WALLET env var");

//   // 1) read on-chain USDC.e balance for the embedded wallet
//   const { balance } = await getUSDCeBalanceByAddress({ address: fromAddress as `0x${string}` });
//   if (balance <= 0) throw new Error("Insufficient USDC.e balance");

//   // 2) compute fee + net
//   const withdrawFloat = (balance * percent) / 100;
//   const feeFloat = (withdrawFloat * FEE_BPS) / 10_000;
//   const netFloat = Math.max(withdrawFloat - feeFloat, 0);

//   const feeAmt = toUnits(feeFloat);
//   const netAmt = toUnits(netFloat);
//   if (netAmt <= BigInt(0)) throw new Error("Withdrawal amount too small after fees");

//   // 3) prepare transactions (explicit gas + fees to avoid timeouts)
//   const rpc = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";
//   const provider = new JsonRpcProvider(rpc);

//   const feeData  = xfer(feeWallet, feeAmt);
//   const userData = xfer(toAddress,  netAmt);

//   // estimate gas from spender address (the embedded wallet)
//   const [feeGas, userGas] = await Promise.all([
//     provider.estimateGas({ from: fromAddress, to: USDCe, data: feeData }),
//     provider.estimateGas({ from: fromAddress, to: USDCe, data: userData }),
//   ]);

//   // EIP-1559 hints (optional but helps relayer)
//   const feeInfo = await provider.getFeeData();
//   const mfpg  = feeInfo.maxFeePerGas ? hex(feeInfo.maxFeePerGas) : undefined;
//   const mpfpg = feeInfo.maxPriorityFeePerGas ? hex(feeInfo.maxPriorityFeePerGas) : undefined;

//   // 4) fee transfer
//   const res1 = await sendWithRetry(
//     () =>
//       privy.walletApi.ethereum.sendTransaction({
//         walletId,
//         chainType: "ethereum",
//         caip2: "eip155:137",
//         sponsor,
//         transaction: {
//           to: USDCe,
//           value: "0x0",
//           data: feeData,
//           chainId: CHAIN_ID,
//           gasLimit: hex(feeGas),
//           ...(mfpg && { maxFeePerGas: mfpg }),
//           ...(mpfpg && { maxPriorityFeePerGas: mpfpg }),
//         },
//       }),
//     "withdraw-fee"
//   );
//   if (!(res1 as any)?.hash) throw new Error("Fee transfer failed");

//   // 5) net to user
//   const res2 = await sendWithRetry(
//     () =>
//       privy.walletApi.ethereum.sendTransaction({
//         walletId,
//         chainType: "ethereum",
//         caip2: "eip155:137",
//         sponsor,
//         transaction: {
//           to: USDCe,
//           value: "0x0",
//           data: userData,
//           chainId: CHAIN_ID,
//           gasLimit: hex(userGas),
//           ...(mfpg && { maxFeePerGas: mfpg }),
//           ...(mpfpg && { maxPriorityFeePerGas: mpfpg }),
//         },
//       }),
//     "withdraw-net"
//   );
//   if (!(res2 as any)?.hash) throw new Error("User transfer failed");

//   return {
//     ok: true,
//     feeTx: (res1 as any).hash,
//     userTx: (res2 as any).hash,
//     summary: {
//       balance,
//       requestedPercent: percent,
//       fee: Number(feeAmt) / 1e6,
//       net: Number(netAmt) / 1e6,
//     },
//   };
// }

import { getBuilderConfig } from "@/lib/polymarket/builder-relayer-client"; // Your helper
import { createViemAccount } from "@privy-io/server-auth/viem"; 
import { createWalletClient, http } from "viem";
import { polygon } from "viem/chains";
import { OperationType, RelayClient, SafeTransaction } from "@polymarket/builder-relayer-client";

const Input = z.object({
  walletId: z.string().min(1),
  eoaAddress: z.string().startsWith("0x"),
  fromAddress: z.string().startsWith("0x"), // This will be the Safe Wallet address
  toAddress: z.string().startsWith("0x"),
  percent: z.number().min(0.1).max(100),
});

type Hex = `0x${string}`;
const RPC = process.env.POLYGON_RPC_URL!;


export async function withdrawUsdce(payload: unknown) {
  const { walletId, eoaAddress, fromAddress: safeWalletAddress, toAddress, percent } = Input.parse(payload);

  const FEE_BPS = 50; // 0.5%
  const feeWallet = process.env.WITHDRAW_FEE_WALLET;
  if (!feeWallet) throw new Error("Missing WITHDRAW_FEE_WALLET env var");

  // 1. Read on-chain USDC.e balance for the SAFE WALLET
  const { balance } = await getUSDCeBalanceByAddress({ address: safeWalletAddress as `0x${string}` });
  if (balance <= 0) throw new Error("Insufficient USDC.e balance");

  // 2. Compute fee + net amounts
  const withdrawFloat = (balance * percent) / 100;
  const feeFloat = (withdrawFloat * FEE_BPS) / 10_000;
  const netFloat = Math.max(withdrawFloat - feeFloat, 0);

  const feeAmt = toUnits(feeFloat);
  const netAmt = toUnits(netFloat);
  if (netAmt <= BigInt(0)) throw new Error("Withdrawal amount too small after fees");

  // 3. Initialize the Relayer Client (using the EOA as the signer)
  const relayerUrl = process.env.POLYMARKET_RELAYER_URL!;
  const builderConfig = getBuilderConfig();

  const viemAccount = await createViemAccount({
    walletId,
    address: eoaAddress as Hex,
    privy: privy as any,
  });

  const viemWalletClient = createWalletClient({
    account: viemAccount,
    chain: polygon,
    transport: http(RPC),
  });
  
  const client = new RelayClient(relayerUrl, polygon.id, viemWalletClient, builderConfig);

  // 4. Prepare the Safe Transactions
  const transactionsToExecute: SafeTransaction[] = [];

  // Transaction for your fee
  transactionsToExecute.push({
      to: USDCe,
      operation: OperationType.Call,
      data: ERC20.encodeFunctionData("transfer", [feeWallet, feeAmt]) as Hex,
      value: "0",
  });

  // Transaction for the user's withdrawal
  transactionsToExecute.push({
      to: USDCe,
      operation: OperationType.Call,
      data: ERC20.encodeFunctionData("transfer", [toAddress, netAmt]) as Hex,
      value: "0",
  });

  // 5. Execute the batch transaction via the Relayer
  console.log(`Submitting withdrawal from ${safeWalletAddress} for ${netFloat.toFixed(2)} USDC.e`);
  const response = await client.execute(transactionsToExecute, "Vatic User Withdrawal");
  const result = await response.wait();

  if (!result?.transactionHash) {
    throw new Error("Withdrawal transaction failed to execute via the relayer.");
  }

  console.log(`Withdrawal successful. Tx Hash: ${result.transactionHash}`);
  
  return {
    ok: true,
    txHash: result.transactionHash,
    summary: {
      balance,
      requestedPercent: percent,
      fee: feeFloat,
      net: netFloat,
    },
  };
}