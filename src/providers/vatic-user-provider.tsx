"use client";

import { PropsWithChildren, useEffect, useMemo, useRef } from "react";
import { getAccessToken, usePrivy } from "@privy-io/react-auth";
import { isEmbeddedEvmWallet, isTwitterAccount } from "@/types/polymarket"; // your guards

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";



import { ensureOnchainAndClob } from "@/app/alphascope/actions/ensure-allowances-and-clob-credentials";
import { getProvisioningStatus } from "@/app/alphascope/actions/get-provisioning-status";
import { useVaticUserStore } from "@/state/use-vatic-store";
import { getUSDCeBalanceByAddress } from "@/app/alphascope/actions/get-usdce-balance";
import { getClobBalancesByAccessToken } from "@/app/alphascope/actions/get-clob-balances";
import { getPolymarketTotalValue } from "@/app/alphascope/actions/get-total-value-of-positions";
import { getSafeWallet } from "@/app/alphascope/actions/get-safe-wallet";

/** TODO: implement these server actions to return numbers in USDC (6 decimals) */
async function getUSDCBalance(_address: string): Promise<number> {
  // e.g., call a server action that uses Alchemy/QuickNode, return float in USDC units
  console.log("getUSDCBalance called for ", _address);
  const { balance } = await getUSDCeBalanceByAddress({ address: _address as `0x${string}` });
  console.log("balance", balance);
  return balance;
}
async function getClobBalances(_address: string, walletId: string): Promise<{ available: number; locked: number }> {

  console.log("getClobBalances called for ", _address);
  // e.g., call Polymarket CLOB endpoint for account balances; return numbers in USDC
  const accessToken = await getAccessToken();
  const clob = await getClobBalancesByAccessToken({ accessToken: accessToken!, walletId });
  console.log("clob", clob);

  return {
    available: clob.available,
    locked: clob.locked,
  };
}

const bc = typeof window !== "undefined" ? new BroadcastChannel("vatic-user") : null;

export default function VaticUserProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { ready, authenticated, user, logout } = usePrivy();
  const initFromPrivy = useVaticUserStore((s) => s.initFromPrivy);
  const setProvision = useVaticUserStore((s) => s.setProvision);
  const setEOAWallet = useVaticUserStore((s) => s.setEOAWallet);
  const setSafeWallet = useVaticUserStore((s) => s.setSafeWallet);
  const setLoading = useVaticUserStore((s) => s.setLoading);
  const setError = useVaticUserStore((s) => s.setError);
  const reset = useVaticUserStore((s) => s.reset);

  // derive identity & wallet basics from Privy user
  const basics = useMemo(() => {
    if (!user) return {};
    const tw = user.linkedAccounts.find(isTwitterAccount);
    const embedded = user.linkedAccounts.find(isEmbeddedEvmWallet) as any;
    return {
      userId: user.id,
      username: tw?.username ?? null,
      avatarUrl: tw?.profilePictureUrl ?? null,
      eoaAddress: embedded?.address as `0x${string}` | undefined,
      walletId: embedded?.id as string | undefined,
    };
  }, [user]);

  useEffect(() => {
    initFromPrivy({
      ready,
      authenticated,
      userId: (basics as any)?.userId,
      username: (basics as any)?.username ?? null,
      avatarUrl: (basics as any)?.avatarUrl ?? null,
      eoaAddress: (basics as any)?.eoaAddress,
      walletId: (basics as any)?.walletId,
    });
  }, [ready, authenticated, basics, initFromPrivy]);

  const userId = (basics as any)?.userId as string | undefined;
  const eoaAddress = (basics as any)?.eoaAddress as `0x${string}` | undefined;
  const walletId = (basics as any)?.walletId as string | undefined;

  // fetch provisioning flags
  const { data: provisioningData } = useQuery({
    enabled: Boolean(authenticated && userId),
    queryKey: ["profile", userId],
    queryFn: async () => getProvisioningStatus(userId!),
  });

  useEffect(() => {
    if (provisioningData) {
      setProvision({
        signersAdded: !!provisioningData.signers_added,
        hasAllowances: !!provisioningData.hasAllowances,
        hasClobCreds: !!provisioningData.hasClobCreds,
        safeWalletDeployed: !!provisioningData.hasSafeWallet,
      });
    }
  }, [provisioningData, setProvision]);


  // sync safe wallet address
  const {data: safeWalletAddress} = useQuery({
    enabled: Boolean(authenticated && userId && eoaAddress && walletId),
    queryKey: ['safe-wallet', userId],
    queryFn: async () => {
      // fetch safe wallet details from server
      // for now, just mock it
      return (getSafeWallet(userId!) as Promise<{ address: `0x${string}` } | null>);
    }
  })
  useEffect(() => {
    if(safeWalletAddress?.address) {
      setSafeWallet({ address: safeWalletAddress.address });
    }
  }, [safeWalletAddress, setSafeWallet])

  const safeWalletAddressStr = safeWalletAddress?.address;
  // balance poller (pause when hidden)
  const timerRef = useRef<number | null>(null);
  const pollBalances = async () => {
    console.log("pollBalances");
    if (!safeWalletAddressStr) return;
    try {
      const walletId = user?.linkedAccounts.find(isEmbeddedEvmWallet)?.id;
      const [usdc, clob, value] = await Promise.all([
        getUSDCBalance(safeWalletAddressStr),
        getClobBalances(safeWalletAddressStr, walletId as string),
        getPolymarketTotalValue(safeWalletAddressStr),
      ]);
      console.log("usdc", usdc);
      console.log("clob", clob);
      console.log("value", value);
      setSafeWallet({
        balanceUSDC: usdc,
        lockedUSDC: clob.locked,
        positionsValue: value.totalValue,
        lastSyncAt: Date.now(),
      })
    } catch (e: any) {
      setError(e?.message || "Failed to refresh balances");
    }
  };

  useEffect(() => {
    const start = () => {
      if (timerRef.current) return;
      pollBalances();
      timerRef.current = window.setInterval(pollBalances, 15000);
    };
    const stop = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    if (authenticated && safeWalletAddressStr) start();
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, safeWalletAddressStr]);

  // 🔔 listen for one-shot refresh requests (from the navbar)
  useEffect(() => {
    const handler = () => { pollBalances(); };
    console.log("handler, calling force refresh");
    window.addEventListener("vatic:force-refresh", handler);
    return () => window.removeEventListener("vatic:force-refresh", handler);
  }, [pollBalances]);

  // expose a global "resume setup" action via BroadcastChannel
  useEffect(() => {
    if (!bc) return;
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === "provision-changed") {
        queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      }
      if (ev.data?.type === "logout") {
        reset();
      }
    };
    bc.addEventListener("message", onMsg);
    return () => bc.removeEventListener("message", onMsg);
  }, [queryClient, reset, userId]);

  // helper exposed on window for deep components (optional)
  (globalThis as any).__vatic_resume_setup__ = async () => {
    if (!authenticated || !userId) return;
    try {
      console.log("ensureOnchainAndClob");
      setLoading(true);
      await ensureOnchainAndClob({
        userId,            // server should resolve wallet internally for safety
        walletId: walletId!, // (server should ignore and fetch its own)
        eoaAddress: eoaAddress!,   // (server should ignore and fetch its own)
        // safeWalletAddress: safeWalletAddressStr,
        chainId: 137,
      });
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      bc?.postMessage({ type: "provision-changed" });
      toast.success("Trading credentials ready.");
    } catch (e: any) {
      setError(e?.message || "Failed to finish setup");
      toast.error("Failed to finish setup");
    } finally {
      setLoading(false);
    }
  };

  // logout sync
  useEffect(() => {
    if (!authenticated && ready) {
      reset();
      bc?.postMessage({ type: "logout" });
    }
  }, [authenticated, ready, reset]);

  return <>{children}</>;
}
