"use client";

import { useVaticUserStore } from "@/state/use-vatic-store";
import { fetchClobCredentials } from "../actions/clob-credentials";
import { useCallback } from "react";

export function useVaticUser() {
  const s = useVaticUserStore();

  const loadClobCredentials = useCallback(async () => {
    if (!s.auth.userId) {
      console.warn("Cannot load CLOB credentials: user not authenticated");
      return null;
    }

    s.setLoading(true);
    try {
      const credentials = await fetchClobCredentials(s.auth.userId);
      if (credentials) {
        s.setClobCredentials({
          address: credentials.address,
          apiKey: credentials.apiKey,
          secret: credentials.secret,
          passphrase: credentials.passphrase,
          lastSyncAt: Date.now(),
        });
        return credentials;
      }
      return null;
    } catch (error) {
      console.error("Error loading CLOB credentials:", error);
      s.setError("Failed to load CLOB credentials");
      return null;
    } finally {
      s.setLoading(false);
    }
  }, [s]);

  return {
    auth: s.auth,
    identity: s.identity,
    provision: s.provision,
    eoaWallet: s.EOAWallet,
    safeWallet: s.safeWallet,
    clobCredentials: s.clobCredentials,
    status: s.status,
    // actions
    loadClobCredentials,
    refreshBalances: () => {
      // rely on the provider's poller; optionally force a one-shot via a custom event:
      window.dispatchEvent(new CustomEvent("vatic:force-refresh"));
    },
    resumeSetup: async () => {
      // calls the global bound action
      await (globalThis as any).__vatic_resume_setup__?.();
    },
    setError: s.setError,
  };
}