import { notFound } from "next/navigation";
import { fetchEventMetadata, getAllOutcomes, getPrimaryMarket } from "../../actions/event";
import Link from "next/link";
import { DescriptionDropdown } from "./description-dropdown";

function formatNumber(num: number): string {
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
  params: { slug: string; marketSlug?: string[] };
}) {
  const eventSlug = await params.slug;
  const marketSlug = params.marketSlug?.[0];

  const metadata = await fetchEventMetadata(eventSlug);

  if (!metadata) notFound();

  const { event, seriesData, isSeries, hasMultipleMarkets } = metadata;
  const primaryMarket = await getPrimaryMarket(event);

  if (!primaryMarket) notFound();

  const outcomes = await getAllOutcomes(primaryMarket);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Event Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-start gap-6 mb-6">
          {/* Event Image */}
          <img
            src={event.image}
            alt={event.title}
            className="w-24 h-24 rounded-xl object-cover border border-gray-800"
          />

          {/* Title & Description */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-3">{event.title}</h1>
            
            {/* Stats Row */}
            <div className="flex flex-wrap gap-6 text-sm mb-4">
              <div className="flex flex-col">
                <span className="text-gray-400">Volume</span>
                <span className="font-bold text-white">
                  {formatNumber(event.volume)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400">24h Volume</span>
                <span className="font-bold text-white">
                  {formatNumber(event.volume24hr)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400">Liquidity</span>
                <span className="font-bold text-emerald-400">
                  {formatNumber(event.liquidity)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-400">Ends</span>
                <span className="font-bold text-white">
                  {formatDate(event.endDate)}
                </span>
              </div>
              {hasMultipleMarkets && (
                <div className="flex flex-col">
                  <span className="text-gray-400">Markets</span>
                  <span className="font-bold text-blue-400">
                    {event.markets.length}
                  </span>
                </div>
              )}
            </div>

            {/* Tags */}
            {event.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-2.5 py-1 bg-gray-800/50 border border-gray-700 rounded-md text-xs text-gray-300"
                  >
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex flex-col gap-2">
            {event.featured && (
              <span className="px-3 py-1 bg-yellow-900/30 border border-yellow-700 rounded-md text-xs font-bold text-yellow-400">
                ⭐ Featured
              </span>
            )}
            {event.closed && (
              <span className="px-3 py-1 bg-red-900/30 border border-red-700 rounded-md text-xs font-bold text-red-400">
                Closed
              </span>
            )}
            {isSeries && (
              <span className="px-3 py-1 bg-purple-900/30 border border-purple-700 rounded-md text-xs font-bold text-purple-400">
                📊 Series
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <DescriptionDropdown description={event.description} />

        {/* Series Events (if applicable) */}
        {isSeries && seriesData && seriesData.events && seriesData.events.length > 1 && (
          <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
              Related Events in Series: {seriesData.title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {seriesData.events
                .filter((e) => e.id !== event.id)
                .map((relatedEvent) => {
                  const extractedDate = extractDateFromTitle(relatedEvent.title);
                  
                  return (
                    <Link
                      key={relatedEvent.id}
                      href={`/event_test/${relatedEvent.slug}`}
                      className="group block p-4 bg-gray-800/30 hover:bg-gray-800/60 border border-gray-700 hover:border-gray-600 rounded-lg transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={relatedEvent.image}
                          alt={relatedEvent.title}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          {extractedDate ? (
                            <>
                              <div className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                                {extractedDate}
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-1">
                                {relatedEvent.title}
                              </p>
                            </>
                          ) : (
                            <>
                              <h4 className="text-sm font-bold text-white line-clamp-2 group-hover:text-blue-400 transition-colors">
                                {relatedEvent.title}
                              </h4>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between text-xs border-t border-gray-700/50 pt-2">
                        <span className="text-gray-500">
                          Ends {formatDate(relatedEvent.endDate)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-gray-400">
                          Vol: {formatNumber(relatedEvent.volume)}
                        </span>
                        <span className="text-emerald-400">
                          Liq: {formatNumber(relatedEvent.liquidity)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* TODO: Client component will go here */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400">Chart & Interactive Components Coming Soon...</p>
          <p className="text-sm text-gray-500 mt-2">
            Primary Market: {primaryMarket.question}
          </p>
          <div className="flex justify-center gap-4 mt-4">
            {outcomes.map((outcome) => (
              <div key={outcome.clobTokenId} className="text-center">
                <span className="text-xs text-gray-400">{outcome.name}</span>
                <p className="text-lg font-bold text-white">
                  {(outcome.price * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}