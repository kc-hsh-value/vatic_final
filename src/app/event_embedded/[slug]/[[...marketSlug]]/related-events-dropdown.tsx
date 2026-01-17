"use client";

import { useState } from "react";
import Link from "next/link";
import { PolymarketEvent } from "../../actions/event";

interface RelatedEventsDropdownProps {
  seriesTitle: string;
  events: PolymarketEvent[];
  currentEventId: string;
  hasDerivatives: boolean;
}

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

function extractDateFromTitle(title: string): string | null {
  // Look for pattern "by [date]?" or similar
  const match = title.match(/by\s+([^?]+)\??$/i);
  if (match) {
    return match[1].trim();
  }
  return null;
}

export function RelatedEventsDropdown({
  seriesTitle,
  events,
  currentEventId,
  hasDerivatives,
}: RelatedEventsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const relatedEvents = events.filter((e) => e.id !== currentEventId);

  return (
    <div className="bg-gray-900/30 border border-gray-800 rounded-xl mb-6 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
            Related Events in Series: {seriesTitle}
          </h3>
          {hasDerivatives && (
            <span className="px-2 py-0.5 bg-orange-900/30 border border-orange-700 rounded text-xs font-bold text-orange-400">
              📈 Derivative Markets
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {relatedEvents.length} event{relatedEvents.length !== 1 ? 's' : ''}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 pt-0 border-t border-gray-800/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {relatedEvents.map((relatedEvent) => {
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
  );
}
