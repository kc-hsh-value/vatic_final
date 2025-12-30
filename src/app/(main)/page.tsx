// "use client";

// import { usePrivy } from "@privy-io/react-auth";
// import Image from "next/image";
// import { ToastContainer } from "react-toastify";

// import { FullScreenLoader } from "@/components/ui/fullscreen-loader";
// import { Header } from "@/components/ui/header";
// import CreateAWallet from "@/components/sections/create-a-wallet";
// import UserObject from "@/components/sections/user-object";
// import { ArrowLeftIcon } from "@heroicons/react/16/solid";
// import FundWallet from "@/components/sections/fund-wallet";
// import LinkAccounts from "@/components/sections/link-accounts";
// import UnlinkAccounts from "@/components/sections/unlink-accounts";
// import WalletActions from "@/components/sections/wallet-actions";
// import SessionSigners from "@/components/sections/session-signers";
// import WalletManagement from "@/components/sections/wallet-management";
// import MFA from "@/components/sections/mfa";

// function Home() {
//   const { ready, authenticated, logout, login } = usePrivy();
//   if (!ready) {
//     return <FullScreenLoader />;
//   }

//   return (
//     <div className="bg-[#E0E7FF66] md:max-h-[100vh] md:overflow-hidden">
//       <Header />
//       {authenticated ? (
//         <section className="w-full flex flex-col md:flex-row md:h-[calc(100vh-60px)]">
//           <div className="flex-grow overflow-y-auto h-full p-4 pl-8">
//             <button className="button" onClick={logout}>
//               <ArrowLeftIcon className="h-4 w-4" strokeWidth={2} /> Logout
//             </button>

//             <div>
//               <CreateAWallet />
//               <FundWallet />
//               <LinkAccounts />
//               <UnlinkAccounts />
//               <WalletActions />
//               <SessionSigners />
//               <WalletManagement />
//               <MFA />
//             </div>
//           </div>
//           <UserObject />
//         </section>
//       ) : (
//         <section className="w-full flex flex-row justify-center items-center h-[calc(100vh-60px)] relative">
//           <Image
//             src="./BG.svg"
//             alt="Background"
//             fill
//             style={{ objectFit: "cover", zIndex: 0 }}
//             priority
//           />
//           <div className="z-10 flex flex-col items-center justify-center w-full h-full">
//           <div className="flex h-10 items-center justify-center rounded-[20px] border border-white px-6 text-lg text-white font-abc-favorit">
//             Next.js Demo
//           </div>
//         <div className="text-center mt-4 text-white text-7xl font-medium font-abc-favorit leading-[81.60px]">
//           Starter repo
//         </div>
//             <div className="text-center text-white text-xl font-normal leading-loose mt-8">
//               Get started developing with Privy using our Next.js starter repo
//             </div>
//             <button
//               className="bg-white text-brand-off-black mt-15 w-full max-w-md rounded-full px-4 py-2 hover:bg-gray-100 lg:px-8 lg:py-4 lg:text-xl"
//               onClick={() => {
//                 login();
//                 setTimeout(() => {
//                   (document.querySelector('input[type="email"]') as HTMLInputElement)?.focus();
//                 }, 150);
//               }}
//             >
//               Get started
//             </button>
//           </div>
//         </section>
//       )}
  
//       <ToastContainer
//         position="top-center"
//         autoClose={5000}
//         hideProgressBar
//         newestOnTop={false}
//         closeOnClick={false}
//         rtl={false}
//         pauseOnFocusLoss
//         draggable={false}
//         pauseOnHover
//         limit={1}
//         aria-label="Toast notifications"
//         style={{ top: 58 }}
//       />
//     </div>
//   );
// }

// export default Home;
"use client";

import React, { useState } from "react";
import Image from "next/image";
import { 
  Terminal, 
  TrendingUp, 
  Activity, 
  Zap, 
  Share2, 
  Bell, 
  ChevronRight, 
  ArrowRight, 
  Minus,
  Plus,
  Globe,
  BarChart3,
  Layers,
  Cpu
} from "lucide-react";

// --- Components ---

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-white/70 ${className}`}>
      {children}
    </span>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-12 md:mb-16">
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg text-white/50 max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// --- Sections ---

export default function VaticLandingPage() {
  const [activeTab, setActiveTab] = useState("prediction");

  const toggleTab = (tab: string) => setActiveTab(tab);

  return (
    <div className="min-h-screen bg-[#050608] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* 1. Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#050608]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-md overflow-hidden border border-white/10">
              <Image src="/logo.png" alt="Vatic Logo" fill className="object-cover" />
            </div>
            <span className="font-semibold tracking-tight text-lg">Vatic Trading</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            <a href="#product" className="hover:text-white transition-colors">Product</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
            <a href="#use-cases" className="hover:text-white transition-colors">Use Cases</a>
            <a href="#fees" className="hover:text-white transition-colors">Fees</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-white/70 hover:text-white transition-colors hidden sm:block">
              Log in
            </button>
            <button className="bg-white text-black text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors">
              Request Access
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20">
        
        {/* 2. Hero Section */}
        <section className="max-w-7xl mx-auto px-6 mb-32 relative">
          {/* Background Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="text-center max-w-4xl mx-auto mb-16 relative z-10">
            <Badge className="mb-6">v1.0 Private Beta</Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              The most efficient prediction market terminal.
            </h1>
            <p className="text-xl text-white/50 mb-10 leading-relaxed max-w-2xl mx-auto">
              We aggregate diverse information streams and weaponize prediction market data to facilitate high-precision trading across crypto, stocks, and beyond.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="w-full sm:w-auto bg-white text-black px-8 py-3.5 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                Request Access <ArrowRight className="w-4 h-4" />
              </button>
              <button className="w-full sm:w-auto bg-white/5 border border-white/10 text-white px-8 py-3.5 rounded-xl font-medium hover:bg-white/10 transition-all">
                View Demo
              </button>
            </div>
          </div>

          {/* Hero Visual: Terminal Mockup */}
          <div className="relative z-10 rounded-xl border border-white/10 bg-[#090A0C] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Mock Header */}
            <div className="h-10 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
              </div>
              <div className="ml-4 text-xs font-mono text-white/40">vatic_terminal_view // TRUMP-2024-POLY</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] h-[500px]">
              {/* Left: Chart Area */}
              <div className="p-6 relative border-r border-white/5">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="text-2xl font-mono font-bold text-white">52.4¢</div>
                    <div className="text-sm text-emerald-400 flex items-center gap-1">+4.2% <TrendingUp className="w-3 h-3" /></div>
                  </div>
                  <div className="flex gap-2">
                    <Badge>Correlation Engine: Active</Badge>
                    <Badge>Live</Badge>
                  </div>
                </div>

                {/* Simulated Chart */}
                <div className="absolute inset-x-6 bottom-10 top-24">
                  <svg className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(52, 211, 153, 0.2)" />
                        <stop offset="100%" stopColor="rgba(52, 211, 153, 0)" />
                      </linearGradient>
                    </defs>
                    <path 
                      d="M0,250 C50,240 100,260 150,200 C200,140 250,160 300,120 C350,80 400,100 450,60 C500,20 550,40 600,10 L800,10 V300 H0 Z" 
                      fill="url(#chartGrad)" 
                      className="opacity-50"
                    />
                    <path 
                      d="M0,250 C50,240 100,260 150,200 C200,140 250,160 300,120 C350,80 400,100 450,60 C500,20 550,40 600,10 L800,10" 
                      fill="none" 
                      stroke="#34d399" 
                      strokeWidth="2" 
                    />
                    
                    {/* Signal Markers */}
                    <circle cx="150" cy="200" r="4" fill="#050608" stroke="#3b82f6" strokeWidth="2" />
                    <circle cx="300" cy="120" r="4" fill="#050608" stroke="#3b82f6" strokeWidth="2" />
                    <circle cx="450" cy="60" r="4" fill="#050608" stroke="#fbbf24" strokeWidth="2" />
                  </svg>

                  {/* Absolute Positioned Signal Cards overlaying chart */}
                  <div className="absolute top-[35%] left-[18%] bg-[#090A0C]/90 backdrop-blur border border-blue-500/30 p-2 rounded text-[10px] w-40 animate-pulse">
                    <div className="text-blue-400 font-bold mb-1">X / Twitter Signal</div>
                    <div className="text-white/70 leading-tight">Sentiment spike detected on {'Election Odds'}.</div>
                  </div>
                  
                  <div className="absolute top-[10%] left-[58%] bg-[#090A0C]/90 backdrop-blur border border-yellow-500/30 p-2 rounded text-[10px] w-40">
                     <div className="text-yellow-400 font-bold mb-1">News Break</div>
                     <div className="text-white/70 leading-tight">New poll data released via AP.</div>
                  </div>

                </div>
              </div>

              {/* Right: Signal Feed */}
              <div className="hidden lg:flex flex-col bg-white/[0.02]">
                <div className="p-4 border-b border-white/5 text-xs font-medium text-white/50 uppercase tracking-wider">
                  Info Stream
                </div>
                <div className="flex-1 overflow-hidden p-4 space-y-4">
                  {[
                    { type: "X", text: "@tier10k: Sources say approval imminent.", time: "2m ago", color: "border-l-blue-500" },
                    { type: "POLY", text: "Volume spike > $2M in 5 mins.", time: "4m ago", color: "border-l-emerald-500" },
                    { type: "NEWS", text: "Reuters: Regulatory body sets deadline.", time: "12m ago", color: "border-l-yellow-500" },
                  ].map((item, i) => (
                    <div key={i} className={`bg-white/5 border border-white/5 ${item.color} border-l-2 p-3 rounded-r-lg`}>
                      <div className="flex justify-between text-[10px] text-white/40 mb-1">
                        <span>{item.type}</span>
                        <span>{item.time}</span>
                      </div>
                      <div className="text-xs text-white/90 leading-snug">
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Problem / Solution */}
        <section className="max-w-7xl mx-auto px-6 mb-32">
          <SectionHeading title="Markets move before explanations." subtitle="The gap between price action and information availability is where edge exists. Vatic bridges that gap." />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
             {/* Problems */}
             {[
               { title: "Opacity", desc: "Markets move instantly; context arrives minutes later." },
               { title: "Noise", desc: "Signal is buried under thousands of bot tweets and headlines." },
               { title: "Fragmentation", desc: "Context is scattered across X, order books, and news sites." }
             ].map((item, i) => (
               <div key={i} className="p-6 rounded-2xl bg-red-500/[0.03] border border-red-500/10">
                 <div className="text-red-400 mb-2"><Minus className="w-5 h-5"/></div>
                 <h3 className="text-lg font-medium text-white mb-2">{item.title}</h3>
                 <p className="text-sm text-white/50">{item.desc}</p>
               </div>
             ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Solutions */}
             {[
               { title: "Time-Aligned Context", desc: "See exactly what news hit the wire the second the candle printed." },
               { title: "Weaponized Data", desc: "Turn raw prediction data into actionable signals for any asset class." },
               { title: "Unified Terminal", desc: "One interface for price, prediction markets, and information flow." }
             ].map((item, i) => (
               <div key={i} className="p-6 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/10">
                 <div className="text-emerald-400 mb-2"><Plus className="w-5 h-5"/></div>
                 <h3 className="text-lg font-medium text-white mb-2">{item.title}</h3>
                 <p className="text-sm text-white/50">{item.desc}</p>
               </div>
             ))}
          </div>
        </section>

        {/* 4. How It Works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-6 mb-32">
          <SectionHeading title="Architecture of signal." />
          
          <div className="relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[
                { icon: Layers, title: "Ingest", desc: "Aggregating 500+ prediction markets, X firehoses, and news wires." },
                { icon: Cpu, title: "Index", desc: "Semantic correlation engine maps keywords to ticker symbols." },
                { icon: Activity, title: "Detect", desc: "Identifying volatility triggers and narrative formation in real-time." },
                { icon: Terminal, title: "Act", desc: "Execution via terminal view with cross-asset signal overlays." },
              ].map((step, i) => (
                <div key={i} className="relative z-10">
                  <div className="w-24 h-24 rounded-2xl bg-[#090A0C] border border-white/10 flex items-center justify-center mb-6 mx-auto md:mx-0 shadow-xl">
                    <step.icon className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-medium text-white mb-2 text-center md:text-left">{step.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed text-center md:text-left">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Features Grid */}
        <section id="product" className="max-w-7xl mx-auto px-6 mb-32">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BarChart3, title: "Market View", desc: "Multi-market dashboard. Compare Poly vs Hyperliquid vs Binance in one glance." },
              { icon: Activity, title: "Signal Markers", desc: "Overlays news events directly on price charts. Never guess 'why' again." },
              { icon: Globe, title: "Correlation Engine", desc: "Quantify the relationship between social volume and price impact." },
              { icon: Share2, title: "Sharable Bundles", desc: "Create a URL for a specific basket of markets and share your thesis." },
              { icon: Bell, title: "Smart Alerts", desc: "Get notified when prediction markets diverge from spot price." },
              { icon: Zap, title: "Cross-Venue Edge", desc: "Use prediction signals to trade spot, perps, and tokenized RWAs." },
            ].map((feat, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all">
                <feat.icon className="w-8 h-8 text-white/40 group-hover:text-white transition-colors mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-white/50">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Use Cases */}
        <section id="use-cases" className="max-w-7xl mx-auto px-6 mb-32">
          <SectionHeading title="Edge for every participant." />
          
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Tabs */}
            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 lg:w-1/4">
               {[
                 { id: "prediction", label: "Prediction Traders" },
                 { id: "crypto", label: "Crypto / Perps" },
                 { id: "research", label: "Analysts" },
               ].map((tab) => (
                 <button
                   key={tab.id}
                   onClick={() => toggleTab(tab.id)}
                   className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-all whitespace-nowrap ${
                     activeTab === tab.id 
                     ? "bg-white text-black" 
                     : "text-white/40 hover:text-white hover:bg-white/5"
                   }`}
                 >
                   {tab.label}
                 </button>
               ))}
            </div>

            {/* Content */}
            <div className="flex-1 min-h-[300px] p-8 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.02] to-transparent">
               {activeTab === "prediction" && (
                 <div className="animate-in fade-in zoom-in-95 duration-300">
                   <h3 className="text-2xl font-semibold text-white mb-4">Dominating Prediction Markets</h3>
                   <ul className="space-y-4">
                     <li className="flex items-start gap-3">
                       <CheckIcon />
                       <span className="text-white/70">Identify mispriced odds before the general market reacts to breaking news.</span>
                     </li>
                     <li className="flex items-start gap-3">
                       <CheckIcon />
                       <span className="text-white/70">Visualize spread discrepancies between varying prediction venues (Polymarket vs Kalshi).</span>
                     </li>
                     <li className="flex items-start gap-3">
                       <CheckIcon />
                       <span className="text-white/70">Automate entries based on social sentiment thresholds.</span>
                     </li>
                   </ul>
                 </div>
               )}

               {activeTab === "crypto" && (
                 <div className="animate-in fade-in zoom-in-95 duration-300">
                   <h3 className="text-2xl font-semibold text-white mb-4">Alpha for Spot & Perps</h3>
                   <ul className="space-y-4">
                     <li className="flex items-start gap-3">
                       <CheckIcon />
                       <span className="text-white/70">Use prediction markets as a leading indicator for token prices.</span>
                     </li>
                     <li className="flex items-start gap-3">
                       <CheckIcon />
                       <span className="text-white/70">Spot narrative rotations early by tracking prediction volume on niche topics.</span>
                     </li>
                     <li className="flex items-start gap-3">
                       <CheckIcon />
                       <span className="text-white/70">Fade fake news events by verifying source credibility instantly.</span>
                     </li>
                   </ul>
                 </div>
               )}

               {activeTab === "research" && (
                 <div className="animate-in fade-in zoom-in-95 duration-300">
                   <h3 className="text-2xl font-semibold text-white mb-4">Deep Dive Research</h3>
                   <ul className="space-y-4">
                     <li className="flex items-start gap-3">
                       <CheckIcon />
                       <span className="text-white/70">Backtest narrative events against price action.</span>
                     </li>
                     <li className="flex items-start gap-3">
                       <CheckIcon />
                       <span className="text-white/70">Export clean datasets of correlated market moves and social posts.</span>
                     </li>
                   </ul>
                 </div>
               )}
            </div>
          </div>
        </section>

        {/* 7. Business Model (Replaces Pricing) */}
        <section id="fees" className="max-w-7xl mx-auto px-6 mb-32">
          <SectionHeading title="Aligned Incentives." subtitle="No gatekeeping. No subscriptions." />
          
          <div className="rounded-3xl border border-white/10 bg-[#090A0C] p-8 md:p-16 text-center relative overflow-hidden">
             {/* Decor */}
             <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-indigo-500/5 blur-[80px] pointer-events-none" />
             
             <div className="relative z-10 max-w-2xl mx-auto">
               <h3 className="text-3xl font-semibold text-white mb-6">Minimal fees on execution.</h3>
               <p className="text-lg text-white/50 mb-10 leading-relaxed">
                 We believe in democratizing access to high-fidelity market intelligence. 
                 Vatic charges a transparent, minimal fee on trades executed through our terminal across all supported asset classes.
               </p>
               
               <button className="bg-white text-black px-8 py-3.5 rounded-xl font-semibold hover:bg-gray-200 transition-all">
                 Request Access
               </button>
             </div>
          </div>
        </section>

        {/* 8. FAQ */}
        <section id="faq" className="max-w-4xl mx-auto px-6 mb-32">
          <SectionHeading title="Frequently asked questions." />
          
          <div className="space-y-4">
             {[
               { q: "Is Vatic a broker?", a: "No. Vatic is an intelligence layer and terminal interface. You connect your own wallets (Metamask, etc.) to execute trades directly on-chain." },
               { q: "Do you execute trades?", a: "We provide the interface and the data. Execution happens via smart contracts on the underlying venues (Polymarket, Hyperliquid, etc.)." },
               { q: "What sources do you track?", a: "We track major prediction markets (Polymarket, Kalshi), social feeds (X/Twitter, Farcaster), and major financial news wires." },
               { q: "How do market bundles work?", a: "Bundles allow you to view aggregated price action for multiple related markets (e.g., 'Election 2024') in a single chart." },
               { q: "Is this only for crypto?", a: "Primarily crypto and prediction markets today. We are aggressively expanding to tokenized stocks and RWAs." },
               { q: "When is access available?", a: "We are currently in Private Beta. Request access to join the waitlist." }
             ].map((item, i) => (
               <details key={i} className="group bg-white/[0.02] border border-white/5 rounded-lg open:bg-white/[0.04] transition-all">
                 <summary className="flex items-center justify-between p-6 cursor-pointer list-none font-medium text-white/80 group-hover:text-white">
                   {item.q}
                   <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-white/40" />
                 </summary>
                 <div className="px-6 pb-6 text-sm text-white/50 leading-relaxed">
                   {item.a}
                 </div>
               </details>
             ))}
          </div>
        </section>

        {/* 9. Final CTA */}
        <section className="max-w-7xl mx-auto px-6 mb-20">
          <div className="rounded-3xl bg-gradient-to-b from-[#0F1115] to-[#050608] border border-white/10 p-12 md:p-24 text-center relative overflow-hidden">
             {/* Decor */}
             <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 blur-[100px] pointer-events-none" />
             
             <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-8 relative z-10">
               See the story behind the candle.
             </h2>
             <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
              <button className="w-full sm:w-auto bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all">
                Request Access
              </button>
              <button className="w-full sm:w-auto bg-transparent border border-white/20 text-white px-8 py-4 rounded-xl font-medium hover:bg-white/5 transition-all">
                View Demo
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 10. Footer */}
      <footer className="border-t border-white/5 bg-[#030304] pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                 <div className="relative w-6 h-6 rounded border border-white/10 overflow-hidden opacity-80">
                   <Image src="/logo.png" alt="Vatic" fill className="object-cover" />
                 </div>
                 <span className="font-semibold text-white">Vatic</span>
              </div>
              <p className="text-sm text-white/40">
                Trade reality. <br/>
                Real-time intelligence for the prediction economy.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li><a href="#" className="hover:text-white transition-colors">Terminal</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Correlation Engine</a></li>
                <li><a href="#fees" className="hover:text-white transition-colors">Fees</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-medium mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-medium mb-4">Social</h4>
              <ul className="space-y-2 text-sm text-white/40">
                <li><a href="#" className="hover:text-white transition-colors">X / Twitter</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Discord</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Farcaster</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-xs text-white/30">
              © {new Date().getFullYear()} Vatic Trading Inc. All rights reserved.
            </div>
            <div className="text-xs text-white/30 text-center md:text-right max-w-md">
              Not financial advice. Vatic provides data and analytics tools only. Trading involves risk.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper Subcomponents

function CheckIcon() {
  return (
    <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
      <Checkmark className="w-3 h-3 text-indigo-400" />
    </div>
  );
}

function Checkmark({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}