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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Copy, LogOut, Wallet, ChevronDown, RefreshCcw, Settings, Search, Menu } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState, useEffect } from "react";
import { polygon } from "viem/chains";

import { Spinner } from "@/components/ui/spinner";
import { useVaticUser } from "@/app/(main)/hooks/use-vatic-user";
import WithdrawDialog from "./withdraw-dialog";
import AddressSearchModal from "@/components/address-search-modal";

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global keyboard shortcut for search (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
    


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
          {/* Left: Brand + Desktop Nav */}
          <div className="flex items-center gap-6">
            <Link href="/test" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Vatic" width={28} height={28} className="rounded-md" />
              <span className="font-semibold tracking-tight text-base sm:text-sm">vatic</span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4 text-sm text-white/80">
              {/* KOL Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 hover:text-white transition-colors">
                    KOL
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/KOL/leaderboard" className="cursor-pointer">Leaderboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/KOL/badge-wars" className="cursor-pointer">Badge Wars</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/KOLwrapped" className="cursor-pointer">KOL Wrapped 2025</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Link href="/test" className="hover:text-white">AlphaScope</Link>
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group h-9"
            >
              <Search className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" />
              <span className="text-xs text-white/50 group-hover:text-white/70">
                Search
              </span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/40 border border-white/10">
                <span>⌘</span>
                <span>K</span>
              </kbd>
            </button>

            {/* Mobile: Compact Balance */}
            <div className="md:hidden flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5">
              <span className="text-xs tabular-nums font-medium">
                ${showPortfolio
                  ? safeWallet?.positionsValue?.toFixed(0) ?? "—"
                  : safeWallet?.balanceUSDC?.toFixed(0) ?? "—"}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5"
                onClick={() => setShowPortfolio((prev) => !prev)}
              >
                <Wallet className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Desktop: Full Wallet + Balance */}
            <div className="hidden md:flex items-center gap-3">
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
            </div>

            {/* Desktop Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 px-2 hidden md:flex">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={identity.avatarUrl ?? undefined} alt="@user" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="hidden lg:flex flex-col items-start">
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
                <DropdownMenuItem onClick={() => setWithdrawOpen(true)}>
                  <Wallet className="mr-2 h-4 w-4" /> Withdraw
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile: Hamburger Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[350px]">
                <SheetHeader>
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                
                <div className="mt-6 flex flex-col gap-6">
                  {/* Profile Section */}
                  <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={identity.avatarUrl ?? undefined} alt="@user" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {identity.username ? `@${identity.username}` : shortAddr(safeWallet?.address)}
                      </span>
                      <span className="text-xs text-white/60 flex items-center gap-1.5">
                        <StatusDot ok={provision.setupComplete} warn={!provision.setupComplete} />
                        {setupState.label}
                      </span>
                    </div>
                  </div>

                  {/* Wallet Info */}
                  <div className="space-y-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Wallet</div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white/60">Address</span>
                        <span className="text-sm font-mono">{shortAddr(safeWallet?.address)}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={copyAddr}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-white/60">Balance</span>
                        <span className="text-sm font-semibold tabular-nums">
                          ${safeWallet?.balanceUSDC?.toFixed(2) ?? "—"}
                        </span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={onSync}>
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={onDeposit} className="flex-1" size="sm">
                        <Wallet className="mr-2 h-4 w-4" /> Deposit
                      </Button>
                      <Button onClick={() => { setWithdrawOpen(true); setMobileMenuOpen(false); }} variant="outline" className="flex-1" size="sm">
                        Withdraw
                      </Button>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="space-y-2">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Navigation</div>
                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" className="justify-start" onClick={() => { setSearchOpen(true); setMobileMenuOpen(false); }}>
                        <Search className="mr-2 h-4 w-4" /> Search
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/test" onClick={() => setMobileMenuOpen(false)}>AlphaScope</Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/KOL/leaderboard" onClick={() => setMobileMenuOpen(false)}>KOL Leaderboard</Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/KOL/badge-wars" onClick={() => setMobileMenuOpen(false)}>Badge Wars</Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/KOLwrapped" onClick={() => setMobileMenuOpen(false)}>KOL Wrapped 2025</Link>
                      </Button>
                    </div>
                  </div>

                  {/* Account Actions */}
                  <div className="space-y-2 pt-4 border-t border-white/10">
                    {!provision.setupComplete && (
                      <Button 
                        onClick={() => { resumeSetup(); setMobileMenuOpen(false); }} 
                        className="w-full justify-start" 
                        variant="secondary"
                        disabled={status.loading}
                      >
                        {status.loading ? "Working…" : "Complete Setup"}
                      </Button>
                    )}
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link href="/settings" onClick={() => setMobileMenuOpen(false)}>
                        <Settings className="mr-2 h-4 w-4" /> Settings
                      </Link>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300" onClick={() => logout()}>
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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

      {/* Address Search Modal */}
      <AddressSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}