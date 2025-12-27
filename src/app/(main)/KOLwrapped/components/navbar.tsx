"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Lock, Sparkles } from "lucide-react";

// UI Components
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
import { joinWaitlist } from "../../auth/actions/gate";

// Server Action Import

// --- Waitlist Form Component (Internal) ---
function WaitlistForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [twitter, setTwitter] = useState("");

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      toast.error("Invalid Email", { description: "Please enter a valid email address." });
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
    } catch (err) {
      toast.error("Something went wrong", { description: "Please try again later." });
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

// --- Main Navbar Component ---
export default function WrappedNavbar() {
  const [open, setOpen] = useState(false);

  // Helper for disabled links to maintain the visual layout
  const DisabledLink = ({ children }: { children: React.ReactNode }) => (
    <span className="flex items-center gap-1.5 cursor-not-allowed text-white/30 hover:text-white/40 transition-colors">
      {children}
      <Lock className="w-3 h-3 opacity-50" />
    </span>
  );

  return (
    <div className="sticky top-0 z-40 w-full backdrop-blur-md bg-black/60 border-b border-white/10">
      <div className="mx-auto max-w-screen-2xl px-4">
        <div className="h-16 flex items-center justify-between">
          
          {/* Left: Brand + Disabled Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
              <Image src="/logo.png" alt="Vatic" width={28} height={28} className="rounded-md" />
              <span className="font-semibold tracking-tight text-white">vatic trading</span>
            </Link>

            {/* Ghost Navigation */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <DisabledLink>Markets</DisabledLink>
              <DisabledLink>Signals</DisabledLink>
              <DisabledLink>AlphaScope</DisabledLink>
              <DisabledLink>Portfolio</DisabledLink>
            </nav>
          </div>

          {/* Right: Waitlist CTA */}
          <div className="flex items-center gap-3">
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
              
              {/* 
                  FIX APPLIED: 
                  1. Added `!important` (using `!`) to fixed/left/top/translate classes.
                     This forces the modal to center even if parent contexts (like sticky nav) fight it.
                  2. Included explicit animation classes to ensure it zooms from center, not top-left.
              */}
              {/* <DialogContent className="fixed left-[50%] top-[50%] z-[100] translate-x-[-50%] translate-y-[-50%] gap-0 p-0 sm:max-w-[400px] border-white/10 bg-[#09090b] shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden"> */}
              {/* <DialogContent>

              
                <div className="absolute top-[-20%] left-[-10%] w-[200px] h-[200px] bg-blue-900/20 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[200px] h-[200px] bg-indigo-900/20 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="relative z-10 p-6">
                    <DialogHeader className="mb-2 flex flex-row items-center justify-between">
                        <div className="flex flex-col gap-1 text-left">
                            <DialogTitle className="text-xl font-medium tracking-tight text-white flex items-center gap-2">
                                <Image src="/logo.png" alt="" width={20} height={20} className="rounded opacity-80" />
                                Vatic Trading
                            </DialogTitle>
                            <p className="text-xs text-white/50 font-medium">Private Beta Access</p>
                        </div>
                    </DialogHeader>

                    <WaitlistForm onSuccess={() => setOpen(false)} />
                </div>
              </DialogContent>  */}
              <DialogContent className="sm:max-w-[400px] border-white/10 bg-[#09090b] shadow-2xl overflow-hidden">
                {/* Background FX */}
                <div className="absolute top-[-20%] left-[-10%] w-[200px] h-[200px] bg-blue-900/20 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[200px] h-[200px] bg-indigo-900/20 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="relative z-10">
                  <DialogHeader className="mb-2 flex flex-row items-center justify-between">
                    <div className="flex flex-col gap-1 text-left">
                      <DialogTitle className="text-xl font-medium tracking-tight text-white flex items-center gap-2">
                        <Image src="/logo.png" alt="" width={20} height={20} className="rounded opacity-80" />
                        Vatic Trading
                      </DialogTitle>
                      <p className="text-xs text-white/50 font-medium">Private Beta Access</p>
                    </div>
                  </DialogHeader>

                  <WaitlistForm onSuccess={() => setOpen(false)} />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
