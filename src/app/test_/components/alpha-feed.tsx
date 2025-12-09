'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Flame, TrendingUp } from 'lucide-react'; // Lucide icons
import { useVaticUser } from '@/app/hooks/use-vatic-user';
import { getAlphaFeedAction } from '../actions/vatic-data';



export default function AlphaFeed() {
  const user = useVaticUser(); // Get user from your Zustand store
  
  // Use React Query for caching/polling
  const { data: feed, isLoading } = useQuery({
    queryKey: ['alpha-feed', user?.auth?.userId],
    queryFn: async () => {
      if (!user?.auth?.userId) return [];
      const res = await getAlphaFeedAction(user.auth.userId);
      return res.data || [];
    },
    enabled: !!user?.auth?.userId, // Only run if user exists
    refetchInterval: 15000, // Poll every 15s for new alpha
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-card/50 rounded-xl border border-border" />
        ))}
      </div>
    );
  }

  if (!feed || feed.length === 0) {
    return (
      <div className="text-center p-10 text-muted-foreground">
        <p>No high-urgency signals found for your followed accounts.</p>
        <p className="text-sm">Try following @Reuters or @ElonMusk via our dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="text-orange-500 w-5 h-5" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">Live Alpha Feed</h2>
      </div>

      {feed.map((item) => (
        <div 
          key={item.tweet_id} 
          className="group relative bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200"
        >
          {/* Urgency Indicator Line */}
          <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r ${
            item.max_urgency > 0.8 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
            item.max_urgency > 0.6 ? 'bg-orange-500' : 'bg-blue-500'
          }`} />

          <div className="pl-4">
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <a 
                  href={item.author_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="font-bold text-foreground hover:text-primary transition-colors"
                >
                  {item.author_name}
                </a>
                <span className="text-xs text-muted-foreground">
                  • {formatDistanceToNow(new Date(item.published_at))} ago
                </span>
              </div>
              
              {item.max_urgency > 0.7 && (
                <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                  HIGH IMPACT
                </span>
              )}
            </div>

            {/* Tweet Body */}
            <p className="text-sm md:text-base text-foreground/90 whitespace-pre-wrap leading-relaxed mb-5">
              {item.tweet_text}
            </p>

            {/* Related Markets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {item.related_markets.slice(0, 4).map((market) => (
                <a
                  key={market.market_id}
                  href={`https://polymarket.com/market/${market.market_id}`} // ID-based link
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col p-3 rounded-lg bg-background/50 border border-border/50 hover:bg-accent hover:border-primary/30 transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      {market.category}
                    </span>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span className="text-[10px] font-bold text-green-500">
                        {Math.round(market.relevance * 100)}% REL
                      </span>
                    </div>
                  </div>
                  
                  <h4 className="text-sm font-medium text-foreground/80 line-clamp-2 leading-snug mb-2">
                    {market.question.replace("Market: ", "")}
                  </h4>
                  
                  <div className="mt-auto pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground italic line-clamp-1">
                      AI: &apos;{market.reason}&apos;
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}