'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { getEventNewsAction } from '../actions/vatic-data';

export default function EventNewsSidebar({ slug }: { slug: string }) {
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    async function load() {
      setLoading(true);
      const res = await getEventNewsAction(slug);
      if (isMounted) {
        if (res.success) setNews(res.data);
        setLoading(false);
      }
    }
    load();

    return () => { isMounted = false; };
  }, [slug]);

  return (
    <div className="w-full h-full flex flex-col bg-card border-l border-border">
      <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Intel Stream
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
        {loading && (
          <div className="text-xs text-muted-foreground animate-pulse text-center py-10">
            Scanning data feeds...
          </div>
        )}

        {!loading && news.length === 0 && (
          <div className="text-center py-10 px-4 border border-dashed border-border rounded-lg">
            <p className="text-xs text-muted-foreground">No signals detected for this event yet.</p>
          </div>
        )}

        {news.map((item) => (
          <div key={item.tweet_id} className="relative pl-4 border-l-2 border-border hover:border-primary transition-colors group">
            {/* Timeline node */}
            <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${
              item.urgency_score > 0.7 ? 'bg-red-500' : 'bg-border group-hover:bg-primary'
            }`} />

            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-muted-foreground font-mono">
                {format(new Date(item.published_at), 'MMM d, HH:mm')}
              </span>
              {item.urgency_score > 0.7 && (
                <AlertCircle className="w-3 h-3 text-red-500" />
              )}
            </div>

            <div className="bg-muted/30 p-3 rounded-md hover:bg-muted/50 transition-colors">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-bold text-foreground">{item.author_name}</span>
                <span className="text-[10px] text-green-500 font-mono">
                  {Math.round(item.relevance_score * 100)}% REL
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {item.tweet_text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}