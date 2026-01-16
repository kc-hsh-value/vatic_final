"use client";

import { useEffect, useState } from "react";
import { useVaticUser } from "@/app/(main)/hooks/use-vatic-user";
import { fetchFeed, FeedFilter, fetchFeedV3, fetchFeedV4 } from "./actions/actions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, RefreshCw, Zap, Settings2, TrendingUp, AlertTriangle, Eye, GripVertical } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatSlugToTitle } from "@/lib/utils";
import { usePolymarketPrices } from "@/app/(main)/hooks/use-prices";
import { ManageSourcesDialog } from "./components/manage-sources-dialog";
import { MediaEntity, TweetMedia } from "./components/tweet_media";
import { WhaleWatching } from "./components/whale-watching";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ... Types remain the same ...
type Market = {
  market_id: string;
  question: string;
  slug: string;
  market_slug: string;
  outcomes: string[];
  clobTokenIds: string[];
  event_image?: string;
  market_image?: string;
  reason: string;
  urgency_score: number;
  relevance_score: number;
  price_change_1h?: number;
  price_change_12h?: number;
  price_change_24h?: number;
  event_id: string;
  condition_id: string;
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
   media_info: MediaEntity[];
};
type FeedCursor = { time: string; id: string } | null;



function cleanTweetText(text: string, media: MediaEntity[] | null) {
  if (!media || !text) return text;
  let clean = text;
  media.forEach(m => {
    if (m.url) clean = clean.replace(m.url, '');
  });
  return clean.trim();
}


export default function FeedPage() {
  const { auth } = useVaticUser();
  const [activeTab, setActiveTab] = useState<FeedFilter>("global");
  const [items, setItems] = useState<TweetCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<FeedCursor>(null);
  
  // Manage Sources Modal State
  const [manageOpen, setManageOpen] = useState(false);

  // Whale watching filter states - lifted to parent to allow TweetCard to update them
  // Structure to preserve event-market relationships and event IDs
  const [whaleFilters, setWhaleFilters] = useState<{
    events: Array<{
      eventSlug: string;
      eventId: string;
      markets: Array<{
        marketSlug: string;
        marketId: string;
        conditionId: string;
      }>;
    }>;
  }>({
    events: [],
  });

  // Function to add slugs from a tweet correlation to whale watching
  const watchWhalesForTweet = (markets: Market[]) => {
    // console.log("Watching whales for markets:", markets);
    
    // Group markets by event (slug)
    console.log("markets before: ", markets);
    const eventGroups = markets.reduce((acc, market) => {
      const eventSlug = market.slug;
      if (!acc[eventSlug]) {
        acc[eventSlug] = {
          eventSlug: eventSlug,
          eventId: market.event_id,
          markets: []
        };
      }
      acc[eventSlug].markets.push({
        marketSlug: market.market_slug,
        marketId: market.market_id,
        conditionId: market.condition_id,
        outcomes: market.outcomes,
        clobTokenIds: market.clobTokenIds,
        question: market.question
      });
      return acc;
    }, {} as Record<string, { eventSlug: string; eventId: string; markets: Array<{ marketSlug: string; marketId: string; conditionId: string; outcomes?: string[]; clobTokenIds?: string[]; question?: string }> }>);
    
    const events = Object.values(eventGroups);
    console.log("events after: ", events);
    
    setWhaleFilters({
      events
    });

    const totalMarkets = events.reduce((sum, e) => sum + e.markets.length, 0);
    toast.success(`Watching ${events.length} event(s) with ${totalMarkets} market(s) for whale activity`);
  };

  // Helper function to check if a tweet's markets are being watched
  const isBeingWatched = (markets: Market[]): boolean => {
    if (whaleFilters.events.length === 0) {
      return false;
    }

    // Get all watched event and market slugs
    const watchedEventSlugs = whaleFilters.events.map(e => e.eventSlug);
    const watchedMarketSlugs = whaleFilters.events.flatMap(e => e.markets.map(m => m.marketSlug));

    const tweetEventSlugs = markets.map(m => m.slug).filter(Boolean);
    const tweetMarketSlugs = markets.map(m => m.market_slug).filter(Boolean);

    // Check if any of this tweet's slugs match the current whale filters
    const eventMatch = tweetEventSlugs.some(slug => watchedEventSlugs.includes(slug));
    const marketMatch = tweetMarketSlugs.some(slug => watchedMarketSlugs.includes(slug));

    return eventMatch || marketMatch;
  };

  // useEffect(() => {
  //   if (!auth.authenticated || !auth.userId) return;
  //   loadFeed(true);
  // }, [auth.authenticated, auth.userId, activeTab]);

  useEffect(() => {
    if (!auth.authenticated || !auth.userId) return;
    setCursor(null);
    setHasMore(true);
    loadFeed(true);
  }, [auth.authenticated, auth.userId, activeTab]);

  // const loadFeed = async (reset = false) => {
  //   console.log("Loading feed...", { reset, page, activeTab });
  //   if (!auth.userId) return;
  //   // console.log("user exists to load the feed")
    
  //   if(reset) setLoading(true);
  //   // console.log("Loading feed with parameters:", { reset, page, activeTab });
  //   const currentPage = reset ? 0 : page;
    
  //   const res = await fetchFeed(auth.userId, activeTab, currentPage);
  //   // console.log("Feed loaded:", res);
    
  //   if (!res.success) {
  //     toast.error("Failed to load feed");
  //     setLoading(false);
  //     return;
  //   }

  //   const newItems = res.data as TweetCorrelation[];

  //   if (reset) {
  //     setItems(newItems);
  //     setPage(1);
  //   } else {
  //     setItems((prev) => {
  //       const existingIds = new Set(prev.map((item) => item.tweet_id));
  //       const uniqueNew = newItems.filter((item) => !existingIds.has(item.tweet_id));
  //       return [...prev, ...uniqueNew];
  //     });
  //     setPage((prev) => prev + 1);
  //   }

  //   if (newItems.length < 20) setHasMore(false);
  //   else setHasMore(true);
    
  //   setLoading(false);
  // };
  const loadFeed = async (reset = false) => {
    if (!auth.userId) return;

    if (reset) setLoading(true);

    const effectiveCursor = reset ? null : cursor;

    const res = await fetchFeedV4(auth.userId, activeTab, effectiveCursor, 20);

    if (!res.success) {
      toast.error("Failed to load feed");
      setLoading(false);
      return;
    }
    console.log("Feed loaded:", res);
    const newItems = res.data as TweetCorrelation[];

    if (reset) {
      setItems(newItems);
    } else {
      setItems((prev) => {
        const existingIds = new Set(prev.map((item) => item.tweet_id));
        const uniqueNew = newItems.filter((item) => !existingIds.has(item.tweet_id));
        return [...prev, ...uniqueNew];
      });
    }

    // Update cursor to the *last item in the newly fetched page*
    if (newItems.length > 0) {
      const last = newItems[newItems.length - 1];
      setCursor({ time: last.published_at, id: last.tweet_id });
    }

    setHasMore(newItems.length === 20);
    setLoading(false);
  };

  return (
    <main className="container max-w-[1800px] mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:h-screen lg:flex lg:flex-col">
      
      {/* === MOBILE LAYOUT: Tabs for Feed / Whale Watching === */}
      <div className="lg:hidden">
        <Tabs defaultValue="feed" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/10 p-1 mb-6">
            <TabsTrigger value="feed" className="data-[state=active]:bg-white/10">
              <TrendingUp className="mr-2 h-4 w-4" />
              Alpha Feed
            </TabsTrigger>
            <TabsTrigger value="whales" className="data-[state=active]:bg-white/10">
              <Eye className="mr-2 h-4 w-4" />
              Whale Watching
            </TabsTrigger>
          </TabsList>

          {/* Feed Tab */}
          <TabsContent value="feed" className="mt-0 space-y-6">
            {/* Header */}
            <div className="flex flex-col items-start gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                  Alpha Feed <span className="text-xs font-mono font-normal text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20">LIVE</span>
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Real-time semantic correlations between X and Polymarket.
                </p>
              </div>
              
              <div className="flex items-center gap-2 w-full">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => loadFeed(true)} 
                  disabled={loading}
                  className="flex-1 border-white/10 hover:bg-white/5"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setManageOpen(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white border-none"
                >
                  <Settings2 className="mr-2 h-4 w-4"/>
                  Sources
                </Button>
              </div>
            </div>

            {/* Feed Type Tabs */}
            <Tabs defaultValue="global" onValueChange={(v: string) => setActiveTab(v as FeedFilter)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/10 p-1">
                <TabsTrigger value="global" className="data-[state=active]:bg-white/10">Global</TabsTrigger>
                <TabsTrigger value="following" className="data-[state=active]:bg-white/10">Following</TabsTrigger>
              </TabsList>

              <TabsContent value="global" className="mt-6 space-y-4">
                <FeedList items={items} loading={loading} onWatchWhales={watchWhalesForTweet} isBeingWatched={isBeingWatched} />
              </TabsContent>
              
              <TabsContent value="following" className="mt-6 space-y-4">
                {items.length === 0 && !loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5 gap-4">
                    <p className="text-center">You are not following any accounts yet.</p>
                    <Button onClick={() => setManageOpen(true)} variant="default">
                      <TrendingUp className="mr-2 h-4 w-4" /> Add Accounts
                    </Button>
                  </div>
                ) : (
                  <FeedList items={items} loading={loading} onWatchWhales={watchWhalesForTweet} isBeingWatched={isBeingWatched} />
                )}
              </TabsContent>
            </Tabs>

            {/* Load More */}
            {hasMore && items.length > 0 && (
              <Button 
                variant="ghost" 
                className="w-full text-white/50 hover:text-white" 
                onClick={() => loadFeed(false)} 
                disabled={loading}
              >
                {loading ? "Loading..." : "Load More Activity"}
              </Button>
            )}
          </TabsContent>

          {/* Whale Watching Tab */}
          <TabsContent value="whales" className="mt-0">
            <div className="h-[calc(100vh-200px)] min-h-[600px]">
              <WhaleWatching selectedEvents={whaleFilters.events} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* === DESKTOP LAYOUT: Side by Side === */}
      <div className="hidden lg:flex lg:flex-row gap-6 lg:flex-1 lg:overflow-hidden">
        
        {/* LEFT COLUMN: Alpha Feed */}
        <div className="w-full lg:w-[60%] flex flex-col gap-6 lg:overflow-y-auto">
          
          {/* Header Area */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                Alpha Feed <span className="text-xs font-mono font-normal text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20">LIVE</span>
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Real-time semantic correlations between X and Polymarket.
              </p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadFeed(true)} 
                disabled={loading}
                className="flex-1 sm:flex-none border-white/10 hover:bg-white/5"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setManageOpen(true)}
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white border-none"
              >
                <Settings2 className="mr-2 h-4 w-4"/>
                Sources
              </Button>
            </div>
          </div>

          {/* Tabs & Content */}
          <Tabs defaultValue="global" onValueChange={(v: string) => setActiveTab(v as FeedFilter)} className="w-full">
            <TabsList className="grid w-full sm:w-[400px] grid-cols-2 bg-black/40 border border-white/10 p-1">
              <TabsTrigger value="global" className="data-[state=active]:bg-white/10">Global Feed</TabsTrigger>
              <TabsTrigger value="following" className="data-[state=active]:bg-white/10">My Following</TabsTrigger>
            </TabsList>

            <TabsContent value="global" className="mt-6 space-y-4 min-h-[50vh]">
              <FeedList items={items} loading={loading} onWatchWhales={watchWhalesForTweet} isBeingWatched={isBeingWatched} />
            </TabsContent>
            
            <TabsContent value="following" className="mt-6 space-y-4 min-h-[50vh]">
              {items.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5 gap-4">
                  <p className="text-center">You are not following any accounts yet.</p>
                  <Button onClick={() => setManageOpen(true)} variant="default">
                    <TrendingUp className="mr-2 h-4 w-4" /> Add Accounts
                  </Button>
                </div>
              ) : (
                <FeedList items={items} loading={loading} onWatchWhales={watchWhalesForTweet} isBeingWatched={isBeingWatched} />
              )}
            </TabsContent>
          </Tabs>

          {/* Load More */}
          {hasMore && items.length > 0 && (
            <Button 
              variant="ghost" 
              className="self-center mt-4 w-full sm:w-auto text-white/50 hover:text-white" 
              onClick={() => loadFeed(false)} 
              disabled={loading}
            >
              {loading ? "Loading..." : "Load More Activity"}
            </Button>
          )}
        </div>

        {/* RIGHT COLUMN: Whale Watching */}
        <div className="w-full lg:w-[40%] lg:h-full">
          <WhaleWatching selectedEvents={whaleFilters.events} />
        </div>
        
      </div>
      
      {/* The Dialog */}
      <ManageSourcesDialog open={manageOpen} onOpenChange={setManageOpen} />
    </main>
  );
}

// --- Sub-Components ---

function FeedList({ items, loading, onWatchWhales, isBeingWatched }: { 
  items: TweetCorrelation[]; 
  loading: boolean; 
  onWatchWhales: (markets: Market[]) => void;
  isBeingWatched: (markets: Market[]) => boolean;
}) {
  if (loading && items.length === 0) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <FeedItemSkeleton key={i} />)}</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {items.map((item) => (
        <TweetCard 
          key={item.tweet_id} 
          data={item} 
          onWatchWhales={onWatchWhales} 
          isBeingWatched={isBeingWatched(item.markets)}
        />
      ))}
    </div>
  );
}

function TweetCard({ data, onWatchWhales, isBeingWatched }: { 
  data: TweetCorrelation; 
  onWatchWhales: (markets: Market[]) => void;
  isBeingWatched: boolean;
}) {
  // 1. Group markets
  const groupedMarkets = data.markets.reduce((acc, market) => {
    const key = market.slug || "unknown-event";
    if (!acc[key]) acc[key] = [];
    acc[key].push(market);
    return acc;
  }, {} as Record<string, typeof data.markets>);

  // State for event order (slugs)
  const [eventOrder, setEventOrder] = useState<string[]>(Object.keys(groupedMarkets));
  
  // State for market orders within each event
  const [marketOrders, setMarketOrders] = useState<Record<string, string[]>>(() => {
    const orders: Record<string, string[]> = {};
    Object.entries(groupedMarkets).forEach(([slug, markets]) => {
      orders[slug] = markets.map(m => m.market_id);
    });
    return orders;
  });

  // Update event order when markets change
  useEffect(() => {
    const newSlugs = Object.keys(groupedMarkets);
    setEventOrder(prev => {
      // Keep existing order for slugs that are still present, add new ones at the end
      const existingSlugs = prev.filter(slug => newSlugs.includes(slug));
      const addedSlugs = newSlugs.filter(slug => !prev.includes(slug));
      return [...existingSlugs, ...addedSlugs];
    });
  }, [data.markets]);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle event reordering
  const handleEventDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setEventOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Handle market reordering within an event
  const handleMarketDragEnd = (eventSlug: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setMarketOrders((prev) => {
        const items = prev[eventSlug] || [];
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return {
          ...prev,
          [eventSlug]: arrayMove(items, oldIndex, newIndex),
        };
      });
    }
  };

  // 2. Extract Token IDs for Prices
  const allTokenIds = data.markets.flatMap((m) => m.clobTokenIds || []);
  const { data: prices } = usePolymarketPrices(allTokenIds);

  return (
    <Card className={`border shadow-lg overflow-hidden transition-all ${
      isBeingWatched 
        ? 'border-purple-500/50 bg-[#0F1115] ring-2 ring-purple-500/20' 
        : 'border-white/10 bg-[#0F1115] hover:border-white/20'
    }`}>
      
      {/* --- Tweet Content Section --- */}
      <div className="p-4 flex flex-row gap-4">
        {/* Avatar Column */}
        <div className="shrink-0">
            <Avatar className="h-11 w-11 rounded-md border border-white/10">
            <AvatarImage src={data.author_avatar} />
            <AvatarFallback>{data?.author_name ? data.author_name[0] : "?"}</AvatarFallback>
            </Avatar>
        </div>

        {/* Content Column */}
        <div className="flex-1 min-w-0">
            {/* Header: Name, Handle, Time, Urgency */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-sm text-white truncate">{data.author_name}</span>
                    <span className="text-white/40 text-xs truncate">@{data.author_handle}</span>
                    <span className="text-white/40 text-xs whitespace-nowrap">• {formatDistanceToNow(new Date(data.published_at))} ago</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant={isBeingWatched ? "default" : "outline"}
                      onClick={() => onWatchWhales(data.markets)}
                      className={`h-7 text-xs transition-all ${
                        isBeingWatched
                          ? 'bg-purple-500 hover:bg-purple-600 text-white'
                          : 'border-purple-500/20 hover:bg-purple-500/10 hover:border-purple-500/40 text-purple-400 hover:text-purple-300'
                      }`}
                      title={isBeingWatched ? "Currently monitoring whale activity" : "Monitor whale activity for these markets"}
                    >
                      <Eye className={`h-3 w-3 mr-1 ${isBeingWatched ? 'animate-pulse' : ''}`} />
                      {isBeingWatched ? 'Watching' : 'Watch Whales'}
                    </Button>
                    <UrgencyBadge score={data.max_urgency} />
                    <Link href={data.tweet_url} target="_blank" className="text-white/20 hover:text-blue-400 transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </div>

            {/* Tweet Text (Cleaned of media URLs) */}
            <p className="text-[15px] leading-6 text-white/90 whitespace-pre-wrap break-words">
                {cleanTweetText(data.tweet_text, data.media_info)}
            </p>

            {/* --- NEW: Rich Media Component --- */}
            {/* This renders the Video, Photo Grid, or Article Card */}
            <TweetMedia media={data.media_info} />

        </div>
      </div>

      {/* --- Markets Section (Accordion) --- */}
      <div className="border-t border-white/5 bg-black/20">
        <Accordion type="single" collapsible className="w-full">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleEventDragEnd}
          >
            <SortableContext items={eventOrder} strategy={verticalListSortingStrategy}>
              {eventOrder.map((slug) => {
                const markets = groupedMarkets[slug];
                if (!markets) return null;
                
                const eventMeta = markets[0];
                const orderedMarkets = (marketOrders[slug] || [])
                  .map(id => markets.find(m => m.market_id === id))
                  .filter(Boolean) as Market[];
                
                return (
                  <SortableAccordionItem 
                    key={slug} 
                    slug={slug}
                    eventMeta={eventMeta}
                    markets={orderedMarkets}
                    prices={prices}
                    onMarketDragEnd={handleMarketDragEnd(slug)}
                    sensors={sensors}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </Accordion>
      </div>
    </Card>
  );
}

// Sortable Accordion Item Component
function SortableAccordionItem({ 
  slug, 
  eventMeta, 
  markets, 
  prices,
  onMarketDragEnd,
  sensors
}: {
  slug: string;
  eventMeta: Market;
  markets: Market[];
  prices: Record<string, number> | undefined;
  onMarketDragEnd: (event: DragEndEvent) => void;
  sensors: any;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <AccordionItem 
      ref={setNodeRef}
      style={style}
      value={slug} 
      className="border-b-0 border-white/5 last:border-0"
    >
      {/* Accordion Trigger */}
      <AccordionTrigger className="hover:no-underline px-4 py-3 group hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 text-left w-full overflow-hidden">
          {/* Drag Handle */}
          <div 
            {...attributes}
            {...listeners}
            className="shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-5 h-5" />
          </div>

          {/* Event Image */}
          <div className="shrink-0">
            {eventMeta.event_image ? (
              <img 
                src={eventMeta.event_image} 
                alt="Event" 
                className="w-10 h-10 rounded-md object-cover bg-white/5 border border-white/10"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} 
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                <Zap className="w-5 h-5"/>
              </div>
            )}
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-400 leading-tight group-hover:text-blue-300 transition-colors truncate">
                {formatSlugToTitle(slug)} 
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>{markets.length} market{markets.length > 1 ? 's' : ''} correlated</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-white/30">• <Zap className="w-3 h-3"/> AI Reason Inside</span>
            </span>
          </div>
        </div>
      </AccordionTrigger>

      {/* Accordion Content */}
      <AccordionContent className="px-4 pb-4 pt-0">
        {/* Reasoning Box */}
        <div className="mb-4 mt-1 p-3 bg-blue-500/5 border border-blue-500/10 rounded-md text-xs text-blue-100/80 leading-relaxed flex gap-3">
          <Zap className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
          <div>
            <span className="font-bold text-blue-400 uppercase text-[10px] tracking-wider block mb-1">Correlation Analysis</span>
            {eventMeta.reason}
          </div>
        </div>

        {/* Market List with Drag and Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onMarketDragEnd}
        >
          <SortableContext items={markets.map(m => m.market_id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {markets.map((m) => (
                <SortableMarketItem key={m.market_id} market={m} slug={slug} prices={prices} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </AccordionContent>
    </AccordionItem>
  );
}

// Sortable Market Item Component
function SortableMarketItem({ 
  market, 
  slug, 
  prices 
}: { 
  market: Market; 
  slug: string; 
  prices: Record<string, number> | undefined;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: market.market_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 p-3 rounded-md border border-white/5 hover:border-white/10 transition-colors"
    >
      {/* Drag Handle */}
      <div 
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 transition-colors sm:mr-2"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Question Title with Price Changes */}
      <div className="flex-1 space-y-2">
        <Link 
          href={`https://polymarket.com/event/${slug}/${market.market_slug}`}
          target="_blank"
          className="text-sm text-white/90 font-medium leading-snug hover:text-blue-400 transition-colors block"
        >
          {market.question}
        </Link>
        
        {/* Price Change Indicators */}
        {(market.price_change_1h != null || market.price_change_12h != null || market.price_change_24h != null) && (
          <div className="flex items-center gap-2 flex-wrap">
            {market.price_change_1h != null && (
              <div className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                market.price_change_1h > 0 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : market.price_change_1h < 0 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : 'bg-white/5 text-white/40 border border-white/10'
              }`}>
                <span className="text-white/50 font-normal">1h:</span>
                {market.price_change_1h > 0 ? '+' : ''}{market.price_change_1h.toFixed(1)}%
              </div>
            )}
            {market.price_change_12h != null && (
              <div className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                market.price_change_12h > 0 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : market.price_change_12h < 0 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : 'bg-white/5 text-white/40 border border-white/10'
              }`}>
                <span className="text-white/50 font-normal">12h:</span>
                {market.price_change_12h > 0 ? '+' : ''}{market.price_change_12h.toFixed(1)}%
              </div>
            )}
            {market.price_change_24h != null && (
              <div className={`flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                market.price_change_24h > 0 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                  : market.price_change_24h < 0 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                  : 'bg-white/5 text-white/40 border border-white/10'
              }`}>
                <span className="text-white/50 font-normal">24h:</span>
                {market.price_change_24h > 0 ? '+' : ''}{market.price_change_24h.toFixed(1)}%
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Outcome Buttons with PRICES */}
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
        {market.outcomes && market.outcomes.length > 0 ? (
          market.outcomes.map((outcome, idx) => {
            const tokenId = market.clobTokenIds ? market.clobTokenIds[idx] : null;
            const price = tokenId && prices ? prices[tokenId] : null;
            
            const priceLabel = price 
              ? `${(price * 100).toFixed(0)}¢` 
              : <span className="animate-pulse">--</span>;

            return (
              <Button 
                key={idx} 
                size="sm" 
                variant="secondary" 
                className="h-8 text-xs px-3 bg-black/40 hover:bg-white/10 border border-white/10 flex-1 sm:flex-none justify-between gap-3 min-w-[80px]"
              >
                <span className="text-white/70 truncate max-w-[80px]">{outcome}</span>
                <span className={`font-mono font-bold ${price ? (price > 0.5 ? 'text-green-400' : 'text-red-400') : 'text-white/30'}`}>
                  {priceLabel}
                </span>
              </Button>
            );
          })
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs w-full">Trade</Button>
        )}
      </div>
    </div>
  );
}

function UrgencyBadge({ score }: { score: number }) {
  if (score >= 0.8) {
    return (
        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> Critical
        </div>
    )
  }
  return (
    <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
        Alpha
    </div>
  );
}

function FeedItemSkeleton() {
  return (
    <div className="flex gap-4 p-4 border border-white/5 rounded-lg bg-[#0F1115]">
      <Skeleton className="h-10 w-10 rounded-full bg-white/10" />
      <div className="flex-1 space-y-3">
        <div className="flex justify-between">
            <Skeleton className="h-4 w-1/3 bg-white/10" />
            <Skeleton className="h-4 w-16 bg-white/10" />
        </div>
        <Skeleton className="h-4 w-full bg-white/10" />
        <Skeleton className="h-20 w-full rounded-md mt-4 bg-white/5" />
      </div>
    </div>
  );
}