"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { joinWaitlist, validateInviteCode } from "../actions/gate";

interface GateScreenProps {
  onAccessGranted: () => void;
}

export default function GateScreen({ onAccessGranted }: GateScreenProps) {
  const [activeTab, setActiveTab] = useState<"INVITE" | "WAITLIST">("INVITE");
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [twitter, setTwitter] = useState("");

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 5) {
        toast.error("Invalid Code", { description: "Code is too short." });
        return;
    }
    
    setLoading(true);
    
    try {
        const res = await validateInviteCode(code);
        if (res.success) {
            toast.success("Access Granted", { description: "Welcome to Vatic Beta." });
            onAccessGranted();
        } else {
            toast.error("Access Denied", { description: res.message });
        }
    } catch (err) {
        toast.error("Connection Error", { description: "Please try again." });
    } finally {
        setLoading(false);
    }
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side Spam/Validation Check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        toast.error("Invalid Email", { description: "Please enter a valid email address." });
        return;
    }

    setLoading(true);
    const res = await joinWaitlist(email, twitter);
    setLoading(false);

    if (res.success) {
      toast.success("List Joined", { description: res.message });
      setEmail("");
      setTwitter("");
    } else {
      toast.error("Error", { description: res.message });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] text-white p-6 relative overflow-hidden">
      
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[380px] z-10">
        
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-10 space-y-4">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-2xl border border-white/5">
             <Image 
                src="/logo.png" 
                alt="Vatic Logo" 
                fill 
                className="object-cover"
             />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-medium tracking-tight text-white">Vatic Trading</h1>
            <p className="text-sm text-white/40 mt-1">Trade Reality</p>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        <div className="bg-white/5 p-1 rounded-lg grid grid-cols-2 gap-1 mb-8 border border-white/5">
            <button
                onClick={() => setActiveTab("INVITE")}
                className={`py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    activeTab === "INVITE" 
                    ? "bg-[#1A1A1A] text-white shadow-sm border border-white/10" 
                    : "text-white/40 hover:text-white/60"
                }`}
            >
                Access Code
            </button>
            <button
                onClick={() => setActiveTab("WAITLIST")}
                className={`py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    activeTab === "WAITLIST" 
                    ? "bg-[#1A1A1A] text-white shadow-sm border border-white/10" 
                    : "text-white/40 hover:text-white/60"
                }`}
            >
                Waitlist
            </button>
        </div>

        {/* Forms */}
        <div className="min-h-[200px]">
            {activeTab === "INVITE" && (
                <form onSubmit={handleInviteSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                    <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="VATIC-XXXX-XXXX"
                        className="h-12 bg-black/40 border-white/10 text-center font-sans tracking-[0.2em] text-sm placeholder:text-white/20 placeholder:tracking-normal focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all uppercase rounded-lg text-white"
                        autoFocus
                    />
                    <p className="text-[10px] text-center text-white/30">
                        Enter your private beta invitation key.
                    </p>
                </div>
                <Button 
                    type="submit" 
                    disabled={loading || code.length < 5}
                    className="w-full h-11 bg-white text-black hover:bg-gray-200 font-semibold rounded-lg transition-all"
                >
                    {loading ? <Spinner className="w-4 h-4 text-black" /> : "Enter Terminal"}
                </Button>
                </form>
            )}

            {activeTab === "WAITLIST" && (
                <form onSubmit={handleWaitlistSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider ml-1">Email</label>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@fund.com"
                            className="h-11 bg-black/40 border-white/10 text-sm placeholder:text-white/20 focus:border-white/20 rounded-lg transition-all text-white"
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
                {/* CHANGED: White Button style consistent with Invite Tab */}
                <Button 
                    type="submit" 
                    disabled={loading || !email}
                    className="w-full h-11 bg-white text-black hover:bg-gray-200 font-semibold rounded-lg mt-2 transition-all"
                >
                    {loading ? <Spinner className="w-4 h-4 text-black" /> : "Request Access"}
                </Button>
                </form>
            )}
        </div>

        <div className="mt-12 text-center">
            <p className="text-[10px] text-white/20 font-medium tracking-wide">
                &copy; {new Date().getFullYear()} VATIC INC. PRIVATE BETA
            </p>
        </div>

      </div>
    </div>
  );
}