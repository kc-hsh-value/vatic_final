"use client";

import { useState } from "react";

interface DescriptionDropdownProps {
  description: string;
}

export function DescriptionDropdown({ description }: DescriptionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gray-900/30 border border-gray-800 rounded-xl mb-6 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
          Description
        </h3>
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
      </button>
      
      {isOpen && (
        <div className="p-4 pt-0 border-t border-gray-800/50">
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {description}
          </p>
        </div>
      )}
    </div>
  );
}
