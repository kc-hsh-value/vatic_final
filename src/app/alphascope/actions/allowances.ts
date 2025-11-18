// "use server";

// import { privy } from "@/lib/privy/authorization-privy";
// import { Interface, JsonRpcProvider, JsonRpcSigner } from "ethers";
// import { z } from "zod";
// import { getContractConfig } from "@polymarket/clob-client";
// import { OperationType, RelayClient } from "@polymarket/builder-relayer-client";
// import { createEthersSigner } from "@privy-io/server-auth/ethers";
// import { getBuilderConfig } from "@/lib/polymarket/builder-relayer-client";
// import { Account, Chain, createWalletClient, custom, http } from "viem";
// import { polygon } from "viem/chains";
// import { createViemAccount } from "@privy-io/server-auth/viem"; 


// const CHAIN_ID = 137;
// const cfg = getContractConfig(CHAIN_ID);
// const USDC_E   = cfg.collateral as `0x${string}`;
// const EXCHANGE = cfg.exchange as `0x${string}`;
// const CTF      = cfg.conditionalTokens as `0x${string}`;

// const ERC20   = new Interface([ "function allowance(address owner, address spender) view returns (uint256)",
//                                 "function approve(address spender, uint256 value) returns (bool)" ]);
// const ERC1155 = new Interface([ "function isApprovedForAll(address account, address operator) view returns (bool)",
//                                 "function setApprovalForAll(address operator, bool approved)" ]);

// type Hex = `0x${string}`;
// const asHex = (s: string) => s as Hex;
// const MAX = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

// const Input = z.object({
//   walletId: z.string().min(1),
//   owner: z.string().startsWith("0x").min(42),
//   sponsor: z.boolean().optional().default(true),
//   address: z.string().startsWith("0x").min(42),
// });

// const RPC = process.env.POLYGON_RPC_URL ?? "https://polygon-rpc.com";
// const provider = new JsonRpcProvider(RPC);

// // Simple retry helper for transient errors
// async function sendWithRetry<T>(fn: () => Promise<T>, label: string, max = 3) {
//   let attempt = 0;
//   // jittered backoff: 500ms, 1000ms, 2000ms (+/- 200ms)
//   const waits = [500, 1000, 2000];
//   // @ts-ignore
//   while (true) {
//     try {
//       return await fn();
//     } catch (e: any) {
//       attempt++;
//       const msg = String(e?.message || e);
//       const type = e?.type || "";
//       const status = e?.status;

//       const retryable =
//         type === "client_error" ||                     // includes TIMEOUT_ERR
//         status === 429 ||                              // too many requests
//         /timeout|aborted|network/i.test(msg);

//       if (!retryable || attempt >= max) throw e;

//       const ms = waits[Math.min(attempt - 1, waits.length - 1)];
//       const jitter = Math.floor(Math.random() * 200) - 100;
//       await new Promise(r => setTimeout(r, ms + jitter));
//     }
//   }
// }

// export async function setPolymarketAllowances(payload: unknown) {
//   const { walletId, owner, address, sponsor } = Input.parse(payload);

//   // 0) Read current approvals (free)
//   const [usdcAllowCTF, usdcAllowExchange, ctfApproved] = await Promise.all([
//     provider.call({ to: USDC_E, data: ERC20.encodeFunctionData("allowance", [owner, CTF]) }),
//     provider.call({ to: USDC_E, data: ERC20.encodeFunctionData("allowance", [owner, EXCHANGE]) }),
//     provider.call({ to: CTF,    data: ERC1155.encodeFunctionData("isApprovedForAll", [owner, EXCHANGE]) }),
//   ]);

//   const allowCtf      = BigInt(ERC20.decodeFunctionResult("allowance", usdcAllowCTF as Hex)[0].toString());
//   const allowExchange = BigInt(ERC20.decodeFunctionResult("allowance", usdcAllowExchange as Hex)[0].toString());
//   const isCtfApproved = Boolean(ERC1155.decodeFunctionResult("isApprovedForAll", ctfApproved as Hex)[0]);

//   const needs = {
//     usdcToCTF:      allowCtf === BigInt(0),
//     usdcToExchange: allowExchange === BigInt(0),
//     ctfForAll:      !isCtfApproved,
//   };

//   // creating builder relayer client 

//   const relayerUrl = process.env.POLYMARKET_RELAYER_URL!;
//   const builderConfig = getBuilderConfig()
//   console.log("builderConfig", builderConfig)
//   console.log("chainid: ", CHAIN_ID)
//   console.log("relayerUrl: ", relayerUrl)
//   // 1. Use the correct function `createViemAccount` with the required parameters.
//     // const viemAccount = await createViemAccount({
//     //     walletId,
//     //     address: address as Hex,
//     //     privy: privy as any,
//     // });

//     // // 2. Create the viem WalletClient instance. This part was already correct.
//     // const viemWalletClient = createWalletClient({
//     //     account: viemAccount,
//     //     chain: polygon,
//     //     transport: http(RPC),
//     // });
//   // Privy signer → shim for clob client (you already used this pattern)
//   const signer = createEthersSigner({ walletId, address, provider, privyClient: privy as any });
//   const shim: any = {
//     _signTypedData: (d: any, t: any, v: any) =>
//       (signer as any)._signTypedData?.(d, t, v) ?? (signer as any).signTypedData(d, t, v),
//     getAddress: () => signer.getAddress(),
//     signMessage: (m: string | Uint8Array) => signer.signMessage(m),
//     provider: provider,
//   };
//   console.log("shim: ", shim)
//   const client = new RelayClient(relayerUrl, CHAIN_ID, shim, builderConfig)
//   // const client = new RelayClient(relayerUrl, CHAIN_ID, viemWalletClient, builderConfig)
//   // 1) USDC -> CTF (max) if needed
//   console.log("client: ",client)
//   if (needs.usdcToCTF) {
//     // const res1 = await sendWithRetry(() =>
//     //   privy.walletApi.ethereum.sendTransaction({
//     //     walletId,
//     //     caip2: "eip155:137",
//     //     chainType: "ethereum",
//     //     sponsor,
//     //     transaction: {
//     //       to: USDC_E,
//     //       data: asHex(ERC20.encodeFunctionData("approve", [CTF, MAX])),
//     //       chainId: CHAIN_ID,
//     //     },
//     //   }), "approve USDC->CTF");
//     const approvalTx = {
//       to: USDC_E,
//       operation: OperationType.Call,
//       data: asHex(ERC20.encodeFunctionData("approve", [CTF, MAX])),
//       value: "0",
//     }
//     const response = await client.execute([approvalTx],"approve USDC->CTF")
//     const res1 = await response.wait()
//     if (!(res1 as any).hash) return { ok: false };
//   }

//   // 2) USDC -> Exchange (max) if needed
//   if (needs.usdcToExchange) {
//     // const res2 = await sendWithRetry(() =>
//     //   privy.walletApi.ethereum.sendTransaction({
//     //     walletId,
//     //     caip2: "eip155:137",
//     //     chainType: "ethereum",
//     //     sponsor,
//     //     transaction: {
//     //       to: USDC_E,
//     //       data: asHex(ERC20.encodeFunctionData("approve", [EXCHANGE, MAX])),
//     //       chainId: CHAIN_ID,
//     //     },
//     //   }), "approve USDC->Exchange");
//     const approvalTx = {
//       to: USDC_E,
//       operation: OperationType.Call,
//       data: asHex(ERC20.encodeFunctionData("approve", [EXCHANGE, MAX])),
//       value: "0",
//     }
//     const response = await client.execute([approvalTx],"approve USDC->Exchange")
//     const res2 = await response.wait()
//     if (!(res2 as any).hash) return { ok: false };
//   }

//   // 3) CTF (ERC1155) setApprovalForAll -> Exchange if needed
//   if (needs.ctfForAll) {
//     // const res3 = await sendWithRetry(() =>
//     //   privy.walletApi.ethereum.sendTransaction({
//     //     walletId,
//     //     caip2: "eip155:137",
//     //     chainType: "ethereum",
//     //     sponsor,
//     //     transaction: {
//     //       to: CTF,
//     //       data: asHex(ERC1155.encodeFunctionData("setApprovalForAll", [EXCHANGE, true])),
//     //       chainId: CHAIN_ID,
//     //     },
//     //   }), "setApprovalForAll CTF->Exchange");
//     const approvalTx = {
//       to: CTF,
//       operation: OperationType.Call,
//       data: asHex(ERC1155.encodeFunctionData("setApprovalForAll", [EXCHANGE, true])),
//       value: "0",
//     }
//     const response = await client.execute([approvalTx],"setApprovalForAll CTF->Exchange")
//     const res3 = await response.wait()
//     if (!(res3 as any).hash) return { ok: false };
//   }

//   return { ok: true, skipped: needs };
// }

"use server";

import { privy } from "@/lib/privy/authorization-privy";
import { Interface, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { z } from "zod";
import { getContractConfig } from "@polymarket/clob-client";
import { OperationType, RelayClient } from "@polymarket/builder-relayer-client";

import { createEthersSigner } from "@privy-io/server-auth/ethers";
import { getBuilderConfig } from "@/lib/polymarket/builder-relayer-client";
import { Account, Chain, createWalletClient, custom, http } from "viem";
import { polygon } from "viem/chains";
import { createViemAccount } from "@privy-io/server-auth/viem"; 


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

const Input = z.object({
  walletId: z.string().min(1),
  owner: z.string().startsWith("0x").min(42),
  sponsor: z.boolean().optional().default(true),
  address: z.string().startsWith("0x").min(42),
});

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

export async function setPolymarketAllowances(payload: unknown) {
  const { walletId, owner, address, sponsor } = Input.parse(payload);

  // 0) Read current approvals (free)
  const [usdcAllowCTF, usdcAllowExchange, ctfApproved] = await Promise.all([
    provider.call({ to: USDC_E, data: ERC20.encodeFunctionData("allowance", [owner, CTF]) }),
    provider.call({ to: USDC_E, data: ERC20.encodeFunctionData("allowance", [owner, EXCHANGE]) }),
    provider.call({ to: CTF,    data: ERC1155.encodeFunctionData("isApprovedForAll", [owner, EXCHANGE]) }),
  ]);

  const allowCtf      = BigInt(ERC20.decodeFunctionResult("allowance", usdcAllowCTF as Hex)[0].toString());
  const allowExchange = BigInt(ERC20.decodeFunctionResult("allowance", usdcAllowExchange as Hex)[0].toString());
  const isCtfApproved = Boolean(ERC1155.decodeFunctionResult("isApprovedForAll", ctfApproved as Hex)[0]);

  const needs = {
    usdcToCTF:      allowCtf === BigInt(0),
    usdcToExchange: allowExchange === BigInt(0),
    ctfForAll:      !isCtfApproved,
  };

  // creating builder relayer client 
  const relayerUrl = process.env.POLYMARKET_RELAYER_URL!;
  const builderConfig = getBuilderConfig()
  console.log("builderConfig", builderConfig)
  console.log("chainid: ", CHAIN_ID)
  console.log("relayerUrl: ", relayerUrl)

  // Use viem account and wallet client - RelayClient expects viem, not ethers
  const viemAccount = await createViemAccount({
    walletId,
    address: address as Hex,
    privy: privy as any,
  });

  const viemWalletClient = createWalletClient({
    account: viemAccount,
    chain: polygon,
    transport: http(RPC),
  });
  
  console.log("viemWalletClient created")
  const client = new RelayClient(relayerUrl, CHAIN_ID, viemWalletClient, builderConfig)
  
  let safeAddress: string;

  try {
      // Tell TypeScript to treat 'client' as 'any' to bypass the private check
      safeAddress = await (client as any).getExpectedSafe();

      if (!safeAddress) {
          throw new Error("getExpectedSafe did not return an address.");
      }
      
      console.log("Successfully predicted Safe address:", safeAddress);

  } catch (e) {
      console.error("Could not call the private getExpectedSafe method. The SDK may have changed.", e);
      // You must handle this error, as you cannot proceed without the address
      return { ok: false, error: "Failed to determine Safe address." };
  }

  if(!safeAddress){
    // 2. Save the Safe address to our database so we always have it
    await supabase
        .from("profiles")
        .update({ safe_wallet_address: safeAddress })
        .eq("id", userId); // Assuming you pass userId into this function
  }

  // 3. Check if the Safe is actually deployed on-chain
  const safeCode = await provider.getCode(safeAddress);
  const isDeployed = safeCode !== '0x';
  // Deploy Safe if not already deployed
  // if (!client.__deployed) {
  if(!isDeployed) {
    console.log("Deploying Safe wallet...")
    console.log("clinet._deployed: ", client.__deployed)
    let response;
    try {
      
      response = await client.deploy();
      const res = await response.wait()
      response = res;
      console.log("Safe wallet deployed successfully, tx hash:", res);
    } catch (error) {
      response = error;
      console.log("Error deploying Safe wallet:", error);
    }
    console.log("Deploy response:", response);
  }
  
  // 1) USDC -> CTF (max) if needed
  console.log("client signer: ",client.signer?.getAddress())
  if (needs.usdcToCTF) {
    const approvalTx = {
      to: USDC_E,
      operation: OperationType.Call,
      data: asHex(ERC20.encodeFunctionData("approve", [CTF, MAX])),
      value: "0",
    }
    const response = await client.execute([approvalTx],"approve USDC->CTF")
    const res1 = await response.wait()
    console.log("USDC to CTF approval tx response:", res1)
    if (!(res1 as any).transactionHash) return { ok: false };
  }

  // 2) USDC -> Exchange (max) if needed
  if (needs.usdcToExchange) {
    const approvalTx = {
      to: USDC_E,
      operation: OperationType.Call,
      data: asHex(ERC20.encodeFunctionData("approve", [EXCHANGE, MAX])),
      value: "0",
    }
    const response = await client.execute([approvalTx],"approve USDC->Exchange")
    const res2 = await response.wait()
    if (!(res2 as any).transactionHash) return { ok: false };
  }

  // 3) CTF (ERC1155) setApprovalForAll -> Exchange if needed
  if (needs.ctfForAll) {
    const approvalTx = {
      to: CTF,
      operation: OperationType.Call,
      data: asHex(ERC1155.encodeFunctionData("setApprovalForAll", [EXCHANGE, true])),
      value: "0",
    }
    const response = await client.execute([approvalTx],"setApprovalForAll CTF->Exchange")
    const res3 = await response.wait()
    if (!(res3 as any).transactionHash) return { ok: false };
  }

  return { ok: true, skipped: needs };
}