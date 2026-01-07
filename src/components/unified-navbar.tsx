"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, Sparkles, Menu, Terminal, Search, ChevronDown, Wallet, Copy, LogOut, RefreshCcw, Settings } from "lucide-react";
import { usePrivy, useFundWallet, useWallets, useLogin } from "@privy-io/react-auth";
import { polygon } from "viem/chains";
import { isEmbeddedEvmWallet } from '@/types/polymarket';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

import { joinWaitlist } from "@/app/(main)/auth/actions/gate";
import AddressSearchModal from "@/components/address-search-modal";

// --- Helper Functions ---
function shortAddr(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function StatusDot({ ok, warn }: { ok?: boolean; warn?: boolean }) {
  const cl = ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-rose-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cl}`} />;
}

// --- Waitlist Form Component ---
function WaitlistForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [twitter, setTwitter] = useState("");

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast.error("Invalid Email", {
        description: "Please enter a valid email address.",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await joinWaitlist(email, twitter);
      if (res.success) {
        toast.success("List Joined", { description: res.message });
        setEmail("");
        setTwitter("");
        onSuccess();
      } else {
        toast.error("Error", { description: res.message });
      }
    } catch {
      toast.error("Something went wrong", {
        description: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleWaitlistSubmit} className="space-y-4 pt-4">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider ml-1">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@fund.com"
            className="h-11 bg-black/40 border-white/10 text-sm placeholder:text-white/20 focus:border-white/20 rounded-lg transition-all text-white"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider ml-1">
            X Handle <span className="text-white/20">(Optional)</span>
          </label>
          <Input
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="@username"
            className="h-11 bg-black/40 border-white/10 text-sm placeholder:text-white/20 focus:border-white/20 rounded-lg transition-all text-white"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading || !email}
        className="w-full h-11 bg-white text-black hover:bg-gray-200 font-semibold rounded-lg mt-2 transition-all"
      >
        {loading ? <Spinner className="w-4 h-4 text-black" /> : "Request Access"}
      </Button>

      <p className="text-[10px] text-center text-white/30 pt-2">
        We are gradually rolling out access to the prediction market terminal.
      </p>
    </form>
  );
}

// --- Main Unified Navbar Component ---
export default function UnifiedNavbar() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login } = useLogin();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);

  // Get wallet info directly from Privy
  const { wallets } = useWallets();
  const { fundWallet } = useFundWallet();
  
  // Find the embedded wallet
  const embeddedWallet = useMemo(
    () => wallets.find((w) => w.connectorType === "embedded"),
    [wallets]
  );

  const walletAddress = embeddedWallet?.address;

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

  const USDCe = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;

  const copyAddr = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    toast.success("Address copied");
  };

  const onDeposit = async () => {
    try {
      if (!walletAddress) {
        toast.error("No wallet found");
        return;
      }

      await fundWallet(walletAddress, {
        asset: { erc20: USDCe },
        chain: polygon,
        uiConfig: {
          receiveFundsTitle: "Add USDC.e to your balance",
          receiveFundsSubtitle: "(we'll add more assets soon)",
          landing: {
            title: "Send ONLY USDC.e (Polygon)",
          },
        },
      });

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("vatic:force-refresh"));
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error("Funding widget failed to open");
    }
  };

  const onSync = () => {
    window.dispatchEvent(new CustomEvent("vatic:force-refresh"));
    toast("Sync requested");
  };

  const handleLogin = () => {
    login();
  };

  const navItems = [
    { label: "Leaderboard", href: "/KOL/leaderboard" },
    { label: "Badge Wars", href: "/KOL/badge-wars" },
    { label: "KOL Wrapped 2025", href: "/KOLwrapped" },
  ] as const;

  return (
    <div className="sticky top-0 z-40 w-full backdrop-blur-md bg-black/60 border-b border-white/10">
      <div className="mx-auto max-w-screen-2xl px-4">
        <div className="h-16 flex items-center justify-between">
          {/* Left: Brand + Nav */}
          <div className="flex items-center gap-3 md:gap-6">
            {/* Mobile Hamburger */}
            <div className="md:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>

                <SheetContent
                  side="left"
                  className="w-[280px] border-white/10 bg-black/95"
                >
                  <SheetHeader className="pb-4">
                    <SheetTitle className="text-white flex items-center gap-2">
                      <Image
                        src="/logo.png"
                        alt="Vatic"
                        width={22}
                        height={22}
                        className="rounded-md"
                      />
                      <span className="font-semibold tracking-tight">
                        vatic trading
                      </span>
                    </SheetTitle>
                  </SheetHeader>

                  <div className="flex flex-col gap-2">
                    {/* KOL Section */}
                    <div className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 py-2">
                      KOL
                    </div>
                    {navItems.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
                      >
                        {item.label}
                      </Link>
                    ))}

                    {authenticated && (
                      <>
                        <div className="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 py-2 mt-2">
                          Trading
                        </div>
                        <Link
                          href="/test"
                          onClick={() => setMobileOpen(false)}
                          className="rounded-lg px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
                        >
                          AlphaScope
                        </Link>
                      </>
                    )}

                    <div className="pt-4 border-t border-white/10 space-y-2">
                      {/* Search Button (Mobile) */}
                      <button
                        onClick={() => {
                          setSearchOpen(true);
                          setMobileOpen(false);
                        }}
                        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-white/70 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <Search className="w-4 h-4" />
                        Search Addresses
                      </button>

                      {!authenticated && (
                        <>
                          <Link
                            href="/test"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center justify-center gap-2 w-full h-10 rounded-lg px-3 py-2 text-sm font-medium text-white/70 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <Terminal className="w-4 h-4" />
                            Have an invite code?
                          </Link>

                          <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full h-10 gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                                onClick={() => setMobileOpen(false)}
                              >
                                <Sparkles className="h-4 w-4 text-indigo-400" />
                                Join Waitlist
                              </Button>
                            </DialogTrigger>

                            <DialogContent className="sm:max-w-[400px] border-white/10 bg-[#09090b] shadow-2xl overflow-hidden">
                              <div className="absolute top-[-20%] left-[-10%] w-[200px] h-[200px] bg-blue-900/20 rounded-full blur-[80px] pointer-events-none" />
                              <div className="absolute bottom-[-20%] right-[-10%] w-[200px] h-[200px] bg-indigo-900/20 rounded-full blur-[80px] pointer-events-none" />

                              <div className="relative z-10">
                                <DialogHeader className="mb-2 flex flex-row items-center justify-between">
                                  <div className="flex flex-col gap-1 text-left">
                                    <DialogTitle className="text-xl font-medium tracking-tight text-white flex items-center gap-2">
                                      <Image
                                        src="/logo.png"
                                        alt=""
                                        width={20}
                                        height={20}
                                        className="rounded opacity-80"
                                      />
                                      Vatic Trading
                                    </DialogTitle>
                                    <p className="text-xs text-white/50 font-medium">
                                      Private Beta Access
                                    </p>
                                  </div>
                                </DialogHeader>

                                <WaitlistForm
                                  onSuccess={() => {
                                    setOpen(false);
                                  }}
                                />
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Brand */}
            <Link
              href="/"
              className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity"
            >
              <Image
                src="/logo.png"
                alt="Vatic"
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="font-semibold tracking-tight text-white">
                vatic trading
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {/* KOL Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-white/70 hover:text-white transition-colors">
                    KOL
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {navItems.map((item) => (
                    <DropdownMenuItem key={item.label} asChild>
                      <Link href={item.href} className="cursor-pointer">
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {authenticated && (
                <Link href="/test" className="text-white/70 hover:text-white transition-colors">
                  AlphaScope
                </Link>
              )}
            </nav>
          </div>

          {/* Right: Search + Auth/Profile */}
          <div className="flex items-center gap-3">
            {/* Search Button (Desktop) */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
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

            {!authenticated ? (
              // Unauthenticated: Show Terminal + Waitlist buttons
              <>
                <Link
                  href="/test"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden lg:flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors px-3 py-2"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="text-xs">Have an invite code?</span>
                </Link>

                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="hidden sm:inline">Join Waitlist</span>
                      <span className="sm:hidden">Join</span>
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="sm:max-w-[400px] border-white/10 bg-[#09090b] shadow-2xl overflow-hidden">
                    <div className="absolute top-[-20%] left-[-10%] w-[200px] h-[200px] bg-blue-900/20 rounded-full blur-[80px] pointer-events-none" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[200px] h-[200px] bg-indigo-900/20 rounded-full blur-[80px] pointer-events-none" />

                    <div className="relative z-10">
                      <DialogHeader className="mb-2 flex flex-row items-center justify-between">
                        <div className="flex flex-col gap-1 text-left">
                          <DialogTitle className="text-xl font-medium tracking-tight text-white flex items-center gap-2">
                            <Image
                              src="/logo.png"
                              alt=""
                              width={20}
                              height={20}
                              className="rounded opacity-80"
                            />
                            Vatic Trading
                          </DialogTitle>
                          <p className="text-xs text-white/50 font-medium">
                            Private Beta Access
                          </p>
                        </div>
                      </DialogHeader>

                      <WaitlistForm onSuccess={() => setOpen(false)} />
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              // Authenticated: Show Wallet + Profile
              <>
                {/* Wallet pill */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="h-9 gap-2">
                      <StatusDot ok={true} />
                      <Wallet className="h-4 w-4" />
                      <span className="hidden sm:inline">{shortAddr(walletAddress)}</span>
                      <span className="hidden sm:inline text-white/60">• Polygon</span>
                      <ChevronDown className="h-4 w-4 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Wallet</DropdownMenuLabel>
                    <div className="px-2 pb-2 text-xs text-white/70">{walletAddress ?? "—"}</div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={copyAddr}>
                      <Copy className="mr-2 h-4 w-4" /> Copy address
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onDeposit}>
                      <Wallet className="mr-2 h-4 w-4" /> Deposit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`https://polygonscan.com/address/${walletAddress ?? ""}`} target="_blank">
                        View on Polygonscan
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Profile */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-9 px-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage 
                            src={
                              user?.twitter?.profilePictureUrl || 
                              user?.farcaster?.pfp || 
                              undefined
                            } 
                            alt="@user" 
                          />
                          <AvatarFallback>
                            {user?.twitter?.name?.[0] || 
                             user?.farcaster?.displayName?.[0] || 
                             user?.google?.name?.[0] ||
                             "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:flex flex-col items-start">
                          <span className="text-sm leading-none">
                            {user?.twitter?.username ? `@${user.twitter.username}` : 
                             user?.farcaster?.username ? `@${user.farcaster.username}` :
                             user?.google?.name || shortAddr(walletAddress)}
                          </span>
                          <span className="text-xs text-white/60">
                            Ready
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-70" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href="/test"><Terminal className="mr-2 h-4 w-4" /> AlphaScope</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()}>
                      <LogOut className="mr-2 h-4 w-4" /> Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Address Search Modal */}
      <AddressSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
