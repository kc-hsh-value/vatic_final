"use server";

import { privy } from "@/lib/privy/authorization-privy";
import { Interface, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { z } from "zod";
import { getContractConfig } from "@polymarket/clob-client";
import { OperationType, RelayClient, SafeTransaction } from "@polymarket/builder-relayer-client";

import { createEthersSigner } from "@privy-io/server-auth/ethers";
import { getBuilderConfig } from "@/lib/polymarket/builder-relayer-client";
import { Account, Chain, createWalletClient, custom, http } from "viem";
import { polygon } from "viem/chains";
import { createViemAccount } from "@privy-io/server-auth/viem"; 
import supabaseAdmin from "@/lib/supabase/server";


const CHAIN_ID = 137;
const cfg = getContractConfig(CHAIN_ID);
const USDC_E   = cfg.collateral as `0x${string}`;
const EXCHANGE = cfg.exchange as `0x${string}`;
const CTF      = cfg.conditionalTokens as `0x${string}`;

const ERC20   = new Interface([ "function allowance(address owner, address spender) view returns (uint256)",
                                "function approve(address spender, uint256 value) returns (bool)" ]);
const ERC1155 = new Interface([ "function isApprovedForAll(address account, address operator) view returns (bool)",
                                "function setApprovalForAll(address operator, bool approved)" ]);

type Hex = `0x${string}`;
const asHex = (s: string) => s as Hex;
const MAX = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

type AllowancesInput = { 
  userId: string; 
  walletId: string; 
  eoaAddress: `0x${string}`; 
  currentSafeAddress: `0x${string}` | null;
};

const RPC = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";
const provider = new JsonRpcProvider(RPC);

// Simple retry helper for transient errors
async function sendWithRetry<T>(fn: () => Promise<T>, label: string, max = 3) {
  let attempt = 0;
  // jittered backoff: 500ms, 1000ms, 2000ms (+/- 200ms)
  const waits = [500, 1000, 2000];
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
        type === "client_error" ||                     // includes TIMEOUT_ERR
        status === 429 ||                              // too many requests
        /timeout|aborted|network/i.test(msg);

      if (!retryable || attempt >= max) throw e;

      const ms = waits[Math.min(attempt - 1, waits.length - 1)];
      const jitter = Math.floor(Math.random() * 200) - 100;
      await new Promise(r => setTimeout(r, ms + jitter));
    }
  }
}

export async function setPolymarketAllowances(payload: AllowancesInput) {
  // This function is designed to be idempotent. It can be run multiple times,
  // and it will only perform the actions that are actually missing.
  
  const { walletId, eoaAddress, userId, currentSafeAddress } = payload;

  // --- 1. Initialize Clients ---
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
  
  const client = new RelayClient(relayerUrl, CHAIN_ID, viemWalletClient, builderConfig);
  
  // --- 2. Determine Final Safe Address ---
  // This is the core of the idempotent design. We can calculate the user's
  // Safe address before it's ever deployed.
  let safeAddress: string;
  if(currentSafeAddress){
    safeAddress = currentSafeAddress;
    console.log(`Using provided Safe address from profile: ${safeAddress}`);
  }else{
    // predict, then save to the database 
    try {
        // HACK: Calling a private method on the RelayClient.
        // This is necessary because the SDK doesn't expose a public method.
        // If this breaks in a future update, we'll need to replicate the logic manually.
        safeAddress = await (client as any).getExpectedSafe();
        if (!safeAddress) throw new Error("getExpectedSafe returned undefined.");
        
        console.log(`Successfully predicted Safe address: ${safeAddress}`);

    } catch (e) {
        console.error("CRITICAL: Could not determine the user's Safe address.", e);
        return { ok: false, error: "Failed to determine Safe wallet address." };
    }

    // --- 3. Persist the Safe Address ---
    // Save the address to our database immediately. We'll never have to guess again.
    await supabaseAdmin
        .from("profiles")
        .update({ safe_wallet_address: safeAddress })
        .eq("id", userId);

    // --- 4. Deploy Safe Wallet (if it doesn't exist on-chain) ---
    const safeCode = await provider.getCode(safeAddress);
    const isDeployed = safeCode !== '0x';

    if (!isDeployed) {
      console.log(`Safe wallet not found on-chain. Deploying for ${eoaAddress}...`);
      try {
        const deployResponse = await client.deploy();
        const receipt = await deployResponse.wait();
        console.log(`Safe wallet deployed successfully. Tx Hash: ${receipt?.transactionHash}`);
      } catch (error: any) {
        // This is a critical failure. If deployment fails, we cannot proceed.
        // The error might be "safe already deployed!" which is a harmless race condition.
        if (error.message?.includes("safe already deployed")) {
          console.warn("Deployment failed because Safe was already deployed (race condition). Continuing...");
        } else {
          console.error("FATAL: Error deploying Safe wallet:", error);
          return { ok: false, error: "Failed to deploy the Safe wallet." };
        }
      }
    } else {
      console.log(`Safe wallet ${safeAddress} already deployed.`);
    } 
  }

  // --- 5. Check Current Allowances for the Safe Wallet ---
  console.log(`Reading current allowances for Safe: ${safeAddress}`);
  const [usdcAllowCTF, usdcAllowExchange, ctfApproved] = await Promise.all([
    provider.call({ to: USDC_E, data: ERC20.encodeFunctionData("allowance", [safeAddress, CTF]) }),
    provider.call({ to: USDC_E, data: ERC20.encodeFunctionData("allowance", [safeAddress, EXCHANGE]) }),
    provider.call({ to: CTF,    data: ERC1155.encodeFunctionData("isApprovedForAll", [safeAddress, EXCHANGE]) }),
  ]);

  const allowCtf      = BigInt(ERC20.decodeFunctionResult("allowance", usdcAllowCTF as Hex)[0].toString());
  const allowExchange = BigInt(ERC20.decodeFunctionResult("allowance", usdcAllowExchange as Hex)[0].toString());
  const isCtfApproved = Boolean(ERC1155.decodeFunctionResult("isApprovedForAll", ctfApproved as Hex)[0]);

  const needs = {
    usdcToCTF:      allowCtf < BigInt(MAX), // Check for less than max, not just 0
    usdcToExchange: allowExchange < BigInt(MAX),
    ctfForAll:      !isCtfApproved,
  };
  
  // --- 6. Set Missing Allowances via Relayer ---
  const transactionsToExecute: SafeTransaction[] = [];

  if (needs.usdcToCTF) {
    console.log("Approval needed: USDC -> CTF");
    transactionsToExecute.push({
      to: USDC_E,
      operation: OperationType.Call,
      data: asHex(ERC20.encodeFunctionData("approve", [CTF, MAX])),
      value: "0",
    });
  }

  if (needs.usdcToExchange) {
    console.log("Approval needed: USDC -> Exchange");
    transactionsToExecute.push({
      to: USDC_E,
      operation: OperationType.Call,
      data: asHex(ERC20.encodeFunctionData("approve", [EXCHANGE, MAX])),
      value: "0",
    });
  }

  if (needs.ctfForAll) {
    console.log("Approval needed: CTF -> Exchange (setApprovalForAll)");
    transactionsToExecute.push({
      to: CTF,
      operation: OperationType.Call,
      data: asHex(ERC1155.encodeFunctionData("setApprovalForAll", [EXCHANGE, true])),
      value: "0",
    });
  }

  if (transactionsToExecute.length > 0) {
    console.log(`Executing ${transactionsToExecute.length} approval transaction(s)...`);
    const response = await client.execute(transactionsToExecute, "Set Polymarket Trading Allowances");
    const result = await response.wait();
    if (!result?.transactionHash) {
      console.error("Failed to set allowances via relayer.");
      return { ok: false, error: "Failed to set allowances." };
    }
    console.log(`Allowances set successfully. Tx Hash: ${result.transactionHash}`);
  } else {
    console.log("All required allowances are already set.");
  }

  // --- 7. Finalize ---
  // The 'markAllowances' function in your 'ensureOnchainAndClob' will now be called,
  // marking this user as fully onboarded.
  return { ok: true, skipped: !Object.values(needs).some(Boolean) };
}