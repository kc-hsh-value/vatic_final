import { notFound } from "next/navigation";
import { fetchEventMetadata, getAllOutcomes, getPrimaryMarket, EventType } from "../../actions/event";
import Link from "next/link";
import { DescriptionDropdown } from "./description-dropdown";
import { RelatedEventsDropdown } from "./related-events-dropdown";
import { SingleMarketView } from "./components/single-market";
import { MutuallyExclusiveView } from "./components/mutually-exclusive";
import { IndependentMultiView } from "./components/independent-multi";
import { SportsEventView } from "./components/sports-event";
import { RangeBasedView } from "./components/range-based";

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return "$0.00";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Extract date from series event title
 * Example: "Odds Trump acquires Greenland before 2027 hit __ by March 31?" -> "March 31"
 */
function extractDateFromTitle(title: string): string | null {
  // Look for pattern "by [date]?" or similar
  const match = title.match(/by\s+([^?]+)\??$/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; marketSlug?: string[] }>;
}) {
  const { slug: eventSlug, marketSlug } = await params;
  console.log("eventSlug:", eventSlug);
  const marketSlugValue = marketSlug?.[0];

  const metadata = await fetchEventMetadata(eventSlug);


  if (!metadata) notFound();

  console.log("event metadata:", metadata);

  const { event, seriesData, isSeries, hasMultipleMarkets, eventType } = metadata;
  const primaryMarket = await getPrimaryMarket(event);

  if (!primaryMarket) notFound();

  const outcomes = await getAllOutcomes(primaryMarket);

  return (
    <div className="min-h-screen bg-black text-white p-3">
      {/* Compact Event Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex items-start gap-3 mb-3">
          {/* Event Image - Smaller */}
          <img
            src={event.image}
            alt={event.title}
            className="w-16 h-16 rounded-lg object-cover border border-gray-800 flex-shrink-0"
          />

          {/* Title & Description */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold mb-2 leading-tight">{event.title}</h1>
            
            {/* Stats Row - Compact */}
            <div className="flex flex-wrap gap-3 text-xs mb-2">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Vol:</span>
                <span className="font-semibold text-white">
                  {formatNumber(event.volume)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">24h:</span>
                <span className="font-semibold text-white">
                  {formatNumber(event.volume24hr)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Liq:</span>
                <span className="font-semibold text-emerald-400">
                  {formatNumber(event.liquidity)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Ends:</span>
                <span className="font-semibold text-white">
                  {formatDate(event.endDate)}
                </span>
              </div>
              {hasMultipleMarkets && (
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Markets:</span>
                  <span className="font-semibold text-blue-400">
                    {event.markets.length}
                  </span>
                </div>
              )}
            </div>

            {/* Tags - Compact */}
            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {event.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-1.5 py-0.5 bg-gray-800/50 border border-gray-700 rounded text-[10px] text-gray-400"
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Status Badges - Compact horizontal */}
          <div className="flex flex-wrap gap-1">
            {/* Event Type Badge */}
            <span className="px-2 py-0.5 bg-blue-900/30 border border-blue-700 rounded text-[10px] font-bold text-blue-400">
              {eventType.replace(/_/g, " ")}
            </span>
            
            {event.featured && (
              <span className="px-2 py-0.5 bg-yellow-900/30 border border-yellow-700 rounded text-[10px] font-bold text-yellow-400">
                ⭐
              </span>
            )}
            {event.closed && (
              <span className="px-2 py-0.5 bg-red-900/30 border border-red-700 rounded text-[10px] font-bold text-red-400">
                Closed
              </span>
            )}
            {isSeries && (
              <span className="px-2 py-0.5 bg-purple-900/30 border border-purple-700 rounded text-[10px] font-bold text-purple-400">
                📊
              </span>
            )}
          </div>
        </div>

        {/* Description - More compact */}
        <div className="mb-3">
          <DescriptionDropdown description={event.description} />
        </div>

        {/* Series Events (if applicable) - Hide in embedded to save space */}
      </div>

      {/* Render based on event type */}
      <div className="max-w-7xl mx-auto">
        {eventType === EventType.SINGLE_MARKET && (
          <SingleMarketView market={primaryMarket} />
        )}
        
        {eventType === EventType.SINGLE_WITH_DERIVATIVES && (
          <div className="space-y-4">
            <SingleMarketView market={primaryMarket} />
            <div className="bg-orange-900/20 border border-orange-700 rounded-xl p-4">
              <p className="text-sm text-orange-400">
                ⚠️ This event has derivative markets
              </p>
            </div>
          </div>
        )}
        
        {eventType === EventType.MUTUALLY_EXCLUSIVE && (
          <MutuallyExclusiveView 
            markets={event.markets.sort((a, b) => 
              Number(a.groupItemThreshold || 0) - Number(b.groupItemThreshold || 0)
            )} 
          />
        )}
        
        {eventType === EventType.INDEPENDENT_MULTI_MARKET && (
          <IndependentMultiView 
            markets={event.markets.sort((a, b) => 
              Number(a.groupItemThreshold || 0) - Number(b.groupItemThreshold || 0)
            )} 
          />
        )}
        
        {eventType === EventType.SPORTS_EVENT && (
          <SportsEventView markets={event.markets} />
        )}
        
        {eventType === EventType.RANGE_BASED_SERIES && (
          <RangeBasedView 
            markets={event.markets.sort((a, b) => 
              Number(a.groupItemThreshold || 0) - Number(b.groupItemThreshold || 0)
            )} 
          />
        )}
        
        {eventType === EventType.UNKNOWN && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-400">❓ Unknown event type</p>
            <p className="text-sm text-gray-500 mt-2">
              This event structure is not yet classified
            </p>
          </div>
        )}
      </div>
    </div>
  );
}