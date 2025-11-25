"use client";

import { useVaticUserStore } from "@/state/use-vatic-store";



export function useVaticUser() {
  const s = useVaticUserStore();
  return {
    auth: s.auth,
    identity: s.identity,
    provision: s.provision,
    eoaWallet: s.EOAWallet,
    safeWallet: s.safeWallet,
    status: s.status,
    // actions
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