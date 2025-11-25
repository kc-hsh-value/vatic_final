"use client";

import { create } from "zustand";

type Provision = {
  signersAdded: boolean;
  hasAllowances: boolean;
  hasClobCreds: boolean;
  setupComplete: boolean;
  safeWalletDeployed: boolean;
};

type EOAWallet = {
  chainId: number;
  address?: `0x${string}`;
  walletId?: string;
  lastSyncAt?: number;
};

type SafeWallet = {
  address?: `0x${string}`;
  positionsValue?: number;
  balanceUSDC?: number;
  lockedUSDC?: number;
  lastSyncAt?: number;
}

type Auth = {
  ready: boolean;
  authenticated: boolean;
  userId?: string;
};

type Identity = {
  username?: string | null;
  avatarUrl?: string | null;
};

type VaticUserState = {
  auth: Auth;
  identity: Identity;
  provision: Provision;
  EOAWallet: EOAWallet;
  safeWallet?: SafeWallet;
  status: { loading: boolean; error?: string };
  // actions
  initFromPrivy: (p: {
    ready: boolean;
    authenticated: boolean;
    userId?: string;
    eoaAddress?: `0x${string}`;
    walletId?: string;
    username?: string | null;
    avatarUrl?: string | null;
    safeWalletAddress?: `0x${string}`;
  }) => void;
  setProvision: (p: Partial<Provision>) => void;
  setEOAWallet: (w: Partial<EOAWallet>) => void;
  setSafeWallet: (w: Partial<SafeWallet>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
  reset: () => void;
};

const initialState: Omit<VaticUserState, "initFromPrivy" | "setProvision" | "setEOAWallet" | "setSafeWallet" | "setLoading" | "setError" | "reset"> = {
  auth: { ready: false, authenticated: false, userId: undefined },
  identity: { username: undefined, avatarUrl: undefined },
  provision: { signersAdded: false, hasAllowances: false, hasClobCreds: false, setupComplete: false, safeWalletDeployed: false },
  EOAWallet: { chainId: 137, address: undefined, walletId: undefined, lastSyncAt: undefined },
  safeWallet: {address:undefined, positionsValue: 0, balanceUSDC: 0, lockedUSDC: 0, lastSyncAt: 0},
  status: { loading: false, error: undefined },
};

export const useVaticUserStore = create<VaticUserState>((set, get) => ({
  ...initialState,
  initFromPrivy: (p) => {
    const setupComplete = get().provision.setupComplete; // keep if already known
    set({
      auth: { ready: p.ready, authenticated: p.authenticated, userId: p.userId },
      identity: { username: p.username ?? null, avatarUrl: p.avatarUrl ?? null },
      EOAWallet: {
        ...get().EOAWallet,
        address: p.eoaAddress ?? get().EOAWallet.address,
        walletId: p.walletId ?? get().EOAWallet.walletId,
      },
      provision: { ...get().provision, setupComplete },
      safeWallet: {
        ...get().safeWallet,
        address: p.safeWalletAddress ?? get().safeWallet?.address,
      },
    });
  },
  setProvision: (p) => {
    const merged = { ...get().provision, ...p };
    merged.setupComplete = Boolean(
      merged.signersAdded 
      && merged.hasAllowances 
      && merged.hasClobCreds
      && merged.safeWalletDeployed
    );
    set({ provision: merged });
  },
  setEOAWallet: (w) => set({ EOAWallet: { ...get().EOAWallet, ...w } }),
  setSafeWallet: (w) => set({ safeWallet: { ...get().safeWallet, ...w } }),
  setLoading: (loading) => set({ status: { ...get().status, loading } }),
  setError: (error) => set({ status: { ...get().status, error } }),
  reset: () => set({ ...initialState }),
}));

// Zustand: It's a minimalist "client state" management library. It gives you a global "store" (your useVaticUserStore) where you can keep UI state (like loading flags, the user's identity, wallet balances) and access or update it from any component in your app without passing props down through many layers.