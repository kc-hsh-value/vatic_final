"use client";

import { useEffect, useState } from "react";
import { useVaticUser } from "@/app/hooks/use-vatic-user"; // Or wherever your store is
import { fetchFeed, FeedFilter } from "./actions/actions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ExternalLink, RefreshCw, Zap } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatSlugToTitle } from "@/lib/utils";
import { usePolymarketPrices } from "@/app/hooks/use-prices"; 

type Market = {
  market_id: string;
  question: string;
  slug: string;
  market_slug: string;
  outcomes: string[];
  clobTokenIds: string[];
  event_image?: string;   // New
  market_image?: string;  // New
  reason: string;
  urgency_score: number;
  relevance_score: number;
};

type TweetCorrelation = {
  tweet_id: string;
  tweet_text: string;
  tweet_url: string;
  author_name: string;
  author_handle: string;
  author_avatar: string;
  published_at: string;
  max_urgency: number;
  markets: Market[];
};

export default function FeedPage() {
  const { auth } = useVaticUser();
  const [activeTab, setActiveTab] = useState<FeedFilter>("global");
  const [items, setItems] = useState<TweetCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Initial Fetch
  useEffect(() => {
    if (!auth.authenticated || !auth.userId) return;
    loadFeed(true);
  }, [auth.authenticated, auth.userId, activeTab]);

  const loadFeed = async (reset = false) => {
    if (!auth.userId) return;
    
    setLoading(true);
    const currentPage = reset ? 0 : page;
    
    // Call the Server Action
    const res = await fetchFeed(auth.userId, activeTab, currentPage);
    
    if (!res.success) {
      toast.error("Failed to load feed");
      setLoading(false);
      return;
    }

    const newItems = res.data as TweetCorrelation[];

    if (reset) {
      setItems(newItems);
      setPage(1);
    } else {
      // --- DEDUPLICATION LOGIC STARTS HERE ---
      setItems((prev) => {
        // Create a Set of existing IDs for O(1) lookup
        const existingIds = new Set(prev.map((item) => item.tweet_id));
        
        // Only keep new items that aren't already in the list
        const uniqueNew = newItems.filter((item) => !existingIds.has(item.tweet_id));
        
        return [...prev, ...uniqueNew];
      });
      // --- DEDUPLICATION LOGIC ENDS HERE ---
      
      setPage((prev) => prev + 1);
    }

    if (newItems.length < 20) setHasMore(false);
    else setHasMore(true);
    
    setLoading(false);
  };

  return (
    <main className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alpha Feed</h1>
            <p className="text-muted-foreground text-sm">
              Real-time semantic correlations between X and Polymarket.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadFeed(true)} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="global" onValueChange={(v: string) => setActiveTab(v as FeedFilter)} className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="global">Global Feed</TabsTrigger>
            <TabsTrigger value="following">My Following</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-6 space-y-4">
            <FeedList items={items} loading={loading} />
          </TabsContent>
          
          <TabsContent value="following" className="mt-6 space-y-4">
             {items.length === 0 && !loading ? (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                   You are not following any accounts yet. 
                   <br/> Add accounts in settings to populate this feed.
                </div>
             ) : (
               <FeedList items={items} loading={loading} />
             )}
          </TabsContent>
        </Tabs>

        {/* Load More */}
        {hasMore && items.length > 0 && (
          <Button 
            variant="ghost" 
            className="self-center mt-4" 
            onClick={() => loadFeed(false)} 
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        )}
      </div>
    </main>
  );
}

// --- Sub-Components ---

function FeedList({ items, loading }: { items: TweetCorrelation[]; loading: boolean }) {
  if (loading && items.length === 0) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <FeedItemSkeleton key={i} />)}</div>;
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <TweetCard key={item.tweet_id} data={item} />
      ))}
    </div>
  );
}

function TweetCard({ data }: { data: TweetCorrelation }) {
  // 1. Group markets
  const groupedMarkets = data.markets.reduce((acc, market) => {
    const key = market.slug || "unknown-event";
    if (!acc[key]) acc[key] = [];
    acc[key].push(market);
    return acc;
  }, {} as Record<string, typeof data.markets>);

  // 2. Extract ALL token IDs needed for this card to batch fetch
  const allTokenIds = data.markets.flatMap((m) => m.clobTokenIds || []);

  // 3. Fetch Prices (Polls every 15s)
  const { data: prices } = usePolymarketPrices(allTokenIds);

  return (
    <Card className="border-l-4 border-l-transparent hover:border-l-primary transition-all bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start gap-4 pb-2">
        {/* Author Avatar */}
        <Avatar className="h-10 w-10 border border-white/10">
          <AvatarImage src={data.author_avatar} />
          <AvatarFallback>{data?.author_name ? data.author_name[0] : "?"}</AvatarFallback>
        </Avatar>

        <div className="flex-1 space-y-1">
           {/* Header Line */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{data.author_name}</span>
              <span className="text-muted-foreground text-xs">@{data.author_handle}</span>
              <span className="text-muted-foreground text-xs">• {formatDistanceToNow(new Date(data.published_at))} ago</span>
              
              <Link 
                href={data.tweet_url} 
                target="_blank" 
                rel="noreferrer"
                className="text-muted-foreground hover:text-blue-400 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <UrgencyBadge score={data.max_urgency} />
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/90 mt-1">
            {data.tweet_text}
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Accordion type="single" collapsible className="w-full space-y-2">
          {Object.entries(groupedMarkets).map(([slug, markets]) => {
             const eventMeta = markets[0];
             
             return (
              <AccordionItem value={slug} key={slug} className="border border-white/5 rounded-lg overflow-hidden bg-white/5 px-0">
                
                {/* --- TRIGGER --- */}
                <AccordionTrigger className="hover:no-underline px-3 py-2 group">
                  <div className="flex items-center gap-3 text-left w-full">
                     {/* Event Image */}
                     {eventMeta.event_image ? (
                        <img 
                          src={eventMeta.event_image} 
                          alt="Event" 
                          className="w-8 h-8 rounded-full object-cover bg-white/10"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} 
                        />
                     ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 text-xs font-bold">E</div>
                     )}

                     <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-blue-400 leading-none group-hover:text-blue-300 transition-colors">
                                {formatSlugToTitle(slug)} 
                            </span>
                            <Link
                                href={`https://polymarket.com/event/${slug}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white"
                            >
                                <ExternalLink className="h-3 w-3" />
                            </Link>
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1">
                          {markets.length} market{markets.length > 1 ? 's' : ''} affected
                        </span>
                     </div>
                  </div>
                </AccordionTrigger>

                {/* --- CONTENT --- */}
                <AccordionContent className="px-3 pb-3 pt-1">
                  
                  {/* Reasoning */}
                  <div className="mb-3 p-2 bg-blue-500/5 border border-blue-500/10 rounded text-[11px] text-blue-200/80 italic flex gap-2">
                    <Zap className="w-3 h-3 mt-0.5 shrink-0 text-blue-400" />
                    {eventMeta.reason}
                  </div>

                  {/* Market List */}
                  <div className="space-y-2">
                    {markets.map((m) => (
                      <div key={m.market_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/20 p-2 rounded border border-white/5">
                         
                         {/* Question Title */}
                         <div className="flex items-start gap-2">
                            <Link 
                                href={`https://polymarket.com/event/${slug}/${m.market_slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-white/90 font-medium leading-snug hover:text-blue-400 hover:underline decoration-blue-400/50 underline-offset-2 transition-all"
                            >
                                {m.question}
                            </Link>
                         </div>
                         
                         {/* Outcome Buttons with PRICES */}
                         <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                            {m.outcomes && m.outcomes.length > 0 ? (
                                m.outcomes.map((outcome, idx) => {
                                    // Map Outcome Index -> CLOB Token ID
                                    const tokenId = m.clobTokenIds ? m.clobTokenIds[idx] : null;
                                    const price = tokenId && prices ? prices[tokenId] : null;
                                    
                                    // Formatting: 0.55 -> 55¢
                                    const priceLabel = price 
                                        ? `${(price * 100).toFixed(0)}¢` 
                                        : <span className="animate-pulse">--</span>;

                                    return (
                                        <Button 
                                            key={idx} 
                                            size="sm" 
                                            variant="secondary" 
                                            className="h-6 text-[10px] px-2 bg-white/10 hover:bg-white/20 hover:text-white border border-white/5 min-w-[60px] flex justify-between gap-2"
                                        >
                                            <span>{outcome}</span>
                                            <span className="text-green-400 font-mono font-bold">
                                                {priceLabel}
                                            </span>
                                        </Button>
                                    );
                                })
                            ) : (
                                <Button size="sm" variant="outline" className="h-6 text-[10px]">
                                    Trade
                                </Button>
                            )}
                         </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>

              </AccordionItem>
            )
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
function UrgencyBadge({ score }: { score: number }) {
  // Logic to color code urgency
  let color = "bg-blue-500/10 text-blue-500 border-blue-500/20";
  let label = "Low Urgency";

  if (score >= 0.8) {
    color = "bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse";
    label = "CRITICAL";
  } else if (score >= 5) {
    color = "bg-amber-500/10 text-amber-500 border-amber-500/20";
    label = "High Urgency";
  }

  return (
    <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${color}`}>
      {label}
    </div>
  );
}

function FeedItemSkeleton() {
  return (
    <div className="flex gap-4 p-4 border rounded-lg bg-card/20">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-20 w-full rounded-md mt-4" />
      </div>
    </div>
  );
}