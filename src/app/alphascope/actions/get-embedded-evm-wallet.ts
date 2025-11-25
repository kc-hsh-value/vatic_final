"use server";

import { privy } from "@/server/privy";

/**
 * Resolves the user's embedded EVM wallet from Privy (server-side).
 * Never trust a client-passed walletId/address; always derive here.
 */
export async function getEmbeddedEvmForUser(userId: string): Promise<{
  userId: string;
  walletId: string;
  address: `0x${string}`;
}> {
  if (!userId) throw new Error("getEmbeddedEvmForUser: missing userId");

  // Fetch the authoritative user object from Privy
  const user = await privy.getUserById(userId);
  if (!user) throw new Error(`Privy user not found: ${userId}`);

  // Robust guard: Privy has slightly different shapes across SDK versions.
  // We look for an embedded *EVM* wallet by checking several indicative fields.
  const accounts = (user.linkedAccounts  || []) as any[];

  const isEmbeddedEvm = (a: any) => {
    const type = (a?.type || a?.accountType || "").toLowerCase();
    const walletType = (a?.walletType || a?.kind || "").toLowerCase();
    const clientType = (a?.walletClientType || "").toLowerCase();
    const chainType = (a?.chainType || a?.chain || "").toLowerCase();

    const embedded =
      type.includes("embedded") ||
      walletType.includes("embedded") ||
      clientType.includes("embedded");

    const evm =
      chainType === "ethereum" ||
      chainType === "evm" ||
      (typeof a?.address === "string" && a.address.startsWith("0x"));

    return embedded && evm && typeof a?.address === "string" && a.address.startsWith("0x");
  };

  const embedded = accounts.find(isEmbeddedEvm);
  if (!embedded) {
    throw new Error(`No embedded EVM wallet found for user ${userId}`);
  }

  // Normalize fields across shapes
  const walletId: string =
    embedded.id ||
    embedded.walletId ||
    embedded.accountId ||
    embedded.providerId ||
    (() => {
      throw new Error("Embedded EVM wallet missing id");
    })();

  const address = embedded.address as `0x${string}`;
  if (!address || !address.startsWith("0x")) {
    throw new Error("Embedded EVM wallet missing a valid address");
  }

  return { userId, walletId, address };
}