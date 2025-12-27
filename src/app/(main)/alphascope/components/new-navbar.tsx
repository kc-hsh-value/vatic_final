"use client";

import Link from "next/link";
import Image from "next/image";

import { useFundWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Copy, LogOut, Wallet, ChevronDown, RefreshCcw, Settings } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { polygon } from "viem/chains";

import { Spinner } from "@/components/ui/spinner";
import { useVaticUser } from "@/app/(main)/hooks/use-vatic-user";
import WithdrawDialog from "./withdraw-dialog";

function shortAddr(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function StatusDot({ ok, warn }: { ok?: boolean; warn?: boolean }) {
  const cl = ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-rose-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cl}`} />;
}

export default function DashboardNavbar() {
  const { logout } = usePrivy();
  const { auth, identity, provision, eoaWallet, safeWallet, status, resumeSetup } = useVaticUser();
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
    


  const setupState = useMemo(() => {
    if (provision.setupComplete) return { label: "Ready", warn: false };
    if (provision.signersAdded || provision.hasAllowances || provision.hasClobCreds)
      return { label: "Finish setup", warn: true };
    return { label: "Not ready", warn: true };
  }, [provision]);

  const copyAddr = async () => {
    if (!safeWallet?.address) return;
    await navigator.clipboard.writeText(safeWallet.address);
    toast.success("Address copied");
  };
  const USDCe = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;

  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet();

  // pick the embedded EVM wallet only
  const embeddedEvm = useMemo(
    () => wallets.find((w) => w.connectorType === "embedded"),
    [wallets]
  );

  const onDeposit = async () => {
    try {
      if (!safeWallet?.address) {
        toast.error("No embedded EVM wallet found");
        return;
      }

      await fundWallet(safeWallet.address, {
        // omit amount to let user pick in the widget, or set a default like "100"
        // amount: "100",
        asset: { erc20: USDCe },
        chain: polygon,
        uiConfig: {
          receiveFundsTitle: "Add USDC.e to your balance",
          receiveFundsSubtitle: "(we’ll add more assets soon)",
          landing: {
            title: "Send ONLY USDC.e (Polygon)",
          },
        },
      });

      // Nudge an immediate refresh after the widget flow opens/returns
      // (balances also refresh on the 15s poll)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("vatic:force-refresh"));
      }, 1000);

    } catch (err) {
      console.error(err);
      toast.error("Funding widget failed to open");
    }
  };

  const onSync = () => {
    // The provider polls; you can trigger an immediate refresh by invalidating queries or emitting a custom event you wire in later.
    window.dispatchEvent(new CustomEvent("vatic:force-refresh"));
    toast("Sync requested");
  };

  return (
    <div className="sticky top-0 z-40 w-full backdrop-blur bg-black/40 border-b border-white/10">
      <div className="mx-auto max-w-screen-2xl px-4">
        <div className="h-16 flex items-center justify-between">
          {/* Left: Brand + Nav */}
          <div className="flex items-center gap-6">
            <Link href="/alphascope" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Vatic" width={28} height={28} className="rounded-md" />
              <span className="font-semibold tracking-tight">vatic trading</span>
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm text-white/80">
              <Link href="/markets" className="hover:text-white">Markets</Link>
              <Link href="/signals" className="hover:text-white">Signals</Link>
              <Link href="/alphascope" className="hover:text-white">AlphaScope</Link>
              <Link href="/portfolio" className="hover:text-white">Portfolio</Link>
              <Link href="/history" className="hover:text-white">History</Link>
            </nav>
          </div>

          {/* Right: Wallet + Balance + Profile */}
          <div className="flex items-center gap-3">
            {/* Wallet pill */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="h-9 gap-2">
                  <StatusDot ok={provision.setupComplete} warn={!provision.setupComplete} />
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">{shortAddr(safeWallet?.address)}</span>
                  <span className="hidden sm:inline text-white/60">• Polygon</span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Wallet</DropdownMenuLabel>
                <div className="px-2 pb-2 text-xs text-white/70">{safeWallet?.address ?? "—"}</div>
                <DropdownMenuSeparator />
                {!provision.setupComplete && (
                  <DropdownMenuItem onClick={() => resumeSetup()}>
                    Finish setup
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={copyAddr}>
                  <Copy className="mr-2 h-4 w-4" /> Copy address
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDeposit}>
                  <Wallet className="mr-2 h-4 w-4" /> Deposit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`https://polygonscan.com/address/${safeWallet?.address ?? ""}`} target="_blank">
                    View on Polygonscan
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Balance chip */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5">
              <span className="text-xs text-white/60">
                {showPortfolio ? "Portfolio Value" : "Available (USDC.e)"}
              </span>
              <Separator orientation="vertical" className="h-4 bg-white/10" />
              <span className="text-sm tabular-nums">
                {showPortfolio
                  ? safeWallet?.positionsValue?.toFixed(2) ?? <Spinner className="size-3"/>
                  : safeWallet?.balanceUSDC?.toFixed(2) ?? <Spinner className="size-3"/>}
              </span>

              {/* Switch button */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setShowPortfolio((prev) => !prev)}
                title={showPortfolio ? "Show Available Balance" : "Show Portfolio Value"}
              >
                <Wallet className="h-4 w-4" />
              </Button>

              {/* Sync button */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onSync}
                title="Sync"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={identity.avatarUrl ?? undefined} alt="@user" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-sm leading-none">
                        {identity.username ? `@${identity.username}` : shortAddr(safeWallet?.address)}
                      </span>
                      <span className="text-xs text-white/60">
                        {setupState.label}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild onClick={() => setWithdrawOpen(true)}>
                  <span><Wallet className="mr-2 h-4 w-4" /> Withdraw</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* <WithdrawDialog
          open={withdrawOpen}
          onOpenChange={setWithdrawOpen}
          walletId={wallet.walletId}
          fromAddress={wallet.address as `0x${string}` | undefined}
          availableUSDC={wallet.balanceUSDC}
        /> */}
        <WithdrawDialog
            open={withdrawOpen}
            onOpenChange={setWithdrawOpen}
            // Pass details for BOTH wallets
            walletId={eoaWallet.walletId}
            fromAddress={safeWallet?.address as `0x${string}` | undefined} // Funds are FROM the Safe Wallet
            eoaAddress={eoaWallet.address as `0x${string}` | undefined} // The EOA is the SIGNER
            availableUSDC={safeWallet?.balanceUSDC}
        />

        {/* Setup banner */}
        {!provision.setupComplete && auth.authenticated && (
          <div className="mb-3 -mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusDot warn />
              <span className="font-medium">Finish wallet setup</span>
              <span className="text-white/80">
                {[
                  provision.signersAdded ? "Signer ✓" : "Signer",
                  provision.hasAllowances ? "Allowances ✓" : "Allowances",
                  provision.hasClobCreds ? "CLOB ✓" : "CLOB",
                ].join(" • ")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => resumeSetup()} disabled={status.loading}>
                {status.loading ? "Working…" : "Complete setup"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}