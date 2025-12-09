'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Globe, Filter } from 'lucide-react';
import { getGlobalAlphaFeedAction } from '../actions/vatic-data';

export default function GlobalFeedPage() {
  const [minUrgency, setMinUrgency] = useState(0.5);

  const { data: feed, isLoading } = useQuery({
    queryKey: ['global-feed'],
    queryFn: async () => {
      const res = await getGlobalAlphaFeedAction();
      return res.data || [];
    },
    refetchInterval: 10000, // Poll every 10s
  });

  // Client-side filtering
  const filteredFeed = feed?.filter((item: any) => item.max_urgency >= minUrgency) || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card/50 p-4 rounded-xl border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Globe className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Global Alpha Stream</h1>
              <p className="text-xs text-muted-foreground">Real-time market intelligence from all sources</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">Min Urgency:</span>
            <select 
              value={minUrgency} 
              onChange={(e) => setMinUrgency(parseFloat(e.target.value))}
              className="bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="0.0">All (0%)</option>
              <option value="0.5">Medium (50%)</option>
              <option value="0.7">High (70%)</option>
              <option value="0.8">Critical (80%)</option>
            </select>
          </div>
        </div>

        {/* The Feed */}
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-card/30 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredFeed.map((item: any) => (
              <div key={item.tweet_id} className="bg-card border border-border/60 rounded-xl p-5 hover:border-purple-500/50 transition-all">
                
                {/* Top Row */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    {/* AVATAR ADDED HERE */}
                    <div className="relative">
                      {item.author_avatar ? (
                        <img 
                          src={item.author_avatar} 
                          alt={item.author_name} 
                          className="w-10 h-10 rounded-full border border-border object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                          <span className="text-sm font-bold text-purple-400">
                            {item.author_name.substring(0,2).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col">
                      <a href={item.author_url} target="_blank" className="font-bold text-foreground hover:text-purple-400 text-sm md:text-base">
                        {item.author_name}
                      </a>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.published_at))} ago</span>
                    </div>
                  </div>

                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    item.max_urgency > 0.7 ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    URGENCY: {Math.round(item.max_urgency * 100)}%
                  </div>
                </div>

                <p className="text-sm text-gray-300 mb-4 whitespace-pre-wrap pl-[52px]">{item.tweet_text}</p>

                {/* Markets Scroll */}
                <div className="flex gap-3 overflow-x-auto pb-2 pl-[52px] scrollbar-thin scrollbar-thumb-gray-800">
                  {item.related_markets.map((m: any) => (
                    <a 
                      key={`${item.tweet_id}-${m.market_id}`}
                      // USING SLUG HERE with fallback to market_id if slug is missing
                      href={`https://polymarket.com/event/${m.slug || m.market_id}`}
                      target="_blank"
                      className="min-w-[280px] max-w-[320px] bg-background/50 border border-border p-3 rounded-lg hover:bg-accent group flex-shrink-0"
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] uppercase text-muted-foreground">{m.category}</span>
                        <span className="text-[10px] font-bold text-green-500">{Math.round(m.relevance * 100)}% Match</span>
                      </div>
                      <div className="text-xs font-medium text-foreground line-clamp-2 mb-1">
                        {m.question.replace("Market: ", "")}
                      </div>
                      <div className="text-[10px] text-gray-500 italic line-clamp-2">&apos;{m.reason}&apos;</div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
            
            {filteredFeed.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                No signals found above the selected urgency threshold.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}