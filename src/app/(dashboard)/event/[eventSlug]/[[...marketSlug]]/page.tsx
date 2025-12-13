
import { notFound } from 'next/navigation';
import { getPageData } from '../../actions/polymarket-api';

interface PageProps {
  params: {
    eventSlug: string;
    marketSlug?: string[]; // Next.js optional catch-all is an array
  };
}

export default async function EventPage({ params }: PageProps) {
  const { eventSlug, marketSlug } = await params;
  
  // Handle the optional slug array (e.g., ['market-name'])
  const specificMarketSlug = marketSlug && marketSlug.length > 0 ? marketSlug[0] : undefined;

  // Fetch all data server-side
  const data = await getPageData(eventSlug, specificMarketSlug);

  if (!data || !data.activeMarket) {
    return notFound();
  }

  const { event, activeMarket, correlatedTweets } = data;

  return (
    <div className="min-h-screen bg-black text-white p-6 grid grid-cols-12 gap-6">
      
      {/* HEADER / INFO */}
      <div className="col-span-12 mb-4 border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <p className="text-gray-400 text-sm mt-1">{activeMarket.question}</p>
      </div>

      {/* LEFT COLUMN: CHARTS & MARKERS */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        
        {/* Placeholder for Price Chart */}
        <div className="h-[500px] bg-gray-900 rounded-lg border border-gray-800 flex items-center justify-center relative">
          <p className="text-gray-500">
            [TradingView Chart for Market ID: {activeMarket.id}]
          </p>
          
          {/* Example of how we will overlay tweet markers later */}
          <div className="absolute top-4 right-4 bg-blue-900/50 text-blue-200 text-xs px-2 py-1 rounded">
            {correlatedTweets?.length} Correlated Tweets Found
          </div>
        </div>

        {/* TWEET FEED (The "Alpha") */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h3 className="text-lg font-bold mb-4">News Correlation Stream</h3>
          {correlatedTweets?.map((tweet) => (
            <div key={tweet.id} className="mb-4 p-3 bg-black/50 rounded border border-gray-700">
              <div className="flex justify-between items-start">
                 <span className="font-mono text-xs text-green-400">
                   Relevance: {tweet.relevance_score.toFixed(2)}
                 </span>
                 <span className="text-xs text-gray-500">
                   ID: {tweet.tweet_id}
                 </span>
              </div>
              <p className="mt-2 text-sm text-gray-300">{tweet.relevance_reason}</p>
            </div>
          ))}
          {correlatedTweets?.length === 0 && (
             <p className="text-gray-500 text-sm">No signals detected yet.</p>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ORDERBOOK & TRADING */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
        
        {/* OUTCOME SELECTOR / STATS */}
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Outcomes & Token IDs</h3>
          <div className="space-y-2">
            {activeMarket.outcomesProcessed.map((outcome: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center bg-black p-2 rounded">
                <div className="flex flex-col">
                  <span className="font-bold">{outcome.name}</span>
                  <span className="text-[10px] text-gray-600 font-mono truncate w-24">
                    {outcome.tokenId}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-green-400 font-mono">
                    {(outcome.price * 100).toFixed(1)}¢
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ORDERBOOK PLACEHOLDER */}
        <div className="bg-gray-900 rounded-lg h-64 border border-gray-800 flex items-center justify-center">
           Orderbook (WebSocket)
        </div>

        {/* TRADE UI PLACEHOLDER */}
        <div className="bg-gray-900 rounded-lg flex-1 border border-gray-800 p-4">
           Buy / Sell Interface
        </div>

      </div>
    </div>
  );
}