"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, DollarSign, TrendingUp, TrendingDown, Activity, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import Image from "next/image";

/**
 * Trade Message Interface based on Polymarket WebSocket API
 * Topic: "activity", Type: "trades"
 * Reference: https://github.com/Polymarket/real-time-data-client
 */
interface TradeMessage {
  topic: string;
  type: string;
  timestamp: number;
  connection_id: string;
  payload: {
    asset: string;           // ERC1155 token ID
    bio: string;             // User bio
    conditionId: string;     // Market condition ID
    eventSlug: string;       // Event slug
    icon: string;            // Market icon URL
    name: string;            // User name
    outcome: string;         // Human readable outcome (e.g., "Yes", "No")
    outcomeIndex: number;    // Outcome index
    price: number;           // Trade price (0-1)
    profileImage: string;    // User profile image URL
    proxyWallet: string;     // User wallet address
    pseudonym: string;       // User pseudonym
    side: "BUY" | "SELL";    // Trade side
    size: number;            // Trade size in tokens
    slug: string;            // Market slug
    timestamp: number;       // Trade timestamp
    title: string;           // Event title
    transactionHash: string; // Transaction hash
  };
}

/**
 * Whale Watching Component
 * Connects to Polymarket WebSocket to display real-time large trades
 */
export function WhaleWatching() {
  // --- State Management ---
  const [trades, setTrades] = useState<TradeMessage[]>([]);
  const [minValue, setMinValue] = useState<number>(1000); // Default minimum value filter: $1000
  const [tempMinValue, setTempMinValue] = useState<string>("1000");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);

  /**
   * Connect to Polymarket WebSocket
   * Subscribes to "activity" topic with "trades" type
   */
  const connectWebSocket = () => {
    // Prevent multiple connections
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    setIsConnecting(true);
    
    try {
      // Create WebSocket connection
      const ws = new WebSocket("wss://ws-live-data.polymarket.com");
      
      // --- WebSocket Event Handlers ---
      
      ws.onopen = () => {
        console.log("✅ WebSocket connected to Polymarket");
        setIsConnected(true);
        setIsConnecting(false);
        
        // Subscribe to trades activity
        const subscribeMessage = {
          action: "subscribe",
          subscriptions: [
            {
              topic: "activity",
              type: "trades",
              // No filters - receive all trades, filter client-side by size
            }
          ]
        };
        
        ws.send(JSON.stringify(subscribeMessage));
        console.log("📡 Subscribed to activity:trades");
      };
      
      ws.onmessage = (event: MessageEvent) => {
        // --- Handle WebSocket messages safely ---
        // The WebSocket may send: ping/pong messages, connection confirmations, or actual data
        
        // Skip empty messages
        if (!event.data || event.data.length === 0) {
          return;
        }
        
        // Skip non-string messages (binary data, etc.)
        if (typeof event.data !== "string") {
          return;
        }
        
        // Skip ping/pong and other control messages
        if (event.data === "ping" || event.data === "pong") {
          return;
        }
        
        try {
          const message: TradeMessage = JSON.parse(event.data);
          
          // Only process trade messages with payload
          if (message.topic === "activity" && message.type === "trades" && message.payload) {
            const tradeValue = message.payload.size * message.payload.price;
            
            // Filter by minimum value threshold
            if (tradeValue >= minValue) {
              setTrades(prev => [message, ...prev].slice(0, 50)); // Keep last 50 trades
              console.log(`🐋 Whale trade detected: $${tradeValue.toFixed(2)} - ${message.payload.outcome} @ ${(message.payload.price * 100).toFixed(1)}¢`);
            }
          }
        } catch (error) {
          // Silently ignore non-JSON messages (subscription confirmations, etc.)
          // Only log if it looks like it should have been JSON
          if (event.data.includes("{") || event.data.includes("payload")) {
            console.warn("Failed to parse WebSocket message:", event.data);
          }
        }
      };
      
      ws.onerror = (error) => {
        // --- Handle WebSocket errors ---
        // Note: Browser WebSocket API doesn't provide detailed error info in the error event
        // This is normal browser security behavior
        console.warn("⚠️ WebSocket connection issue (will auto-reconnect)");
        setIsConnecting(false);
      };
      
      ws.onclose = (event) => {
        console.log("🔌 WebSocket disconnected", event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          console.log("🔄 Attempting to reconnect...");
          connectWebSocket();
        }, 5000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setIsConnecting(false);
    }
  };

  /**
   * Disconnect from WebSocket
   */
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
      setTrades([]);
    }
  };

  /**
   * Update minimum value filter
   */
  const updateMinValue = () => {
    const value = parseFloat(tempMinValue);
    if (!isNaN(value) && value >= 0) {
      setMinValue(value);
      setTrades([]); // Clear existing trades when filter changes
    }
  };

  // Auto-connect on component mount
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="border border-white/10 bg-[#0F1115] shadow-lg h-full flex flex-col overflow-hidden">
      {/* --- Header Section --- */}
      <CardHeader className="border-b border-white/10 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Eye className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                Whale Watching
                {isConnected && (
                  <Badge variant="outline" className="bg-green-500/10 border-green-500/20 text-green-400 text-xs">
                    <Activity className="h-3 w-3 mr-1 animate-pulse" />
                    LIVE
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Real-time large trades on Polymarket
              </p>
            </div>
          </div>
        </div>

        {/* --- Filter Controls --- */}
        <div className="flex items-center gap-2 mt-4">
          <div className="flex-1 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-white/40" />
            <Input
              type="number"
              value={tempMinValue}
              onChange={(e) => setTempMinValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && updateMinValue()}
              placeholder="Min trade value"
              className="bg-black/40 border-white/10 text-white h-8 text-sm"
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={updateMinValue}
              className="h-8 border-white/10 hover:bg-white/5"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {isConnecting && (
              <span className="text-xs text-yellow-400">Connecting...</span>
            )}
            {!isConnected && !isConnecting && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={connectWebSocket}
                className="h-8 text-xs border-white/10 hover:bg-white/5"
              >
                Reconnect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* --- Trades List Section with Independent Scroll --- */}
      {/* This section scrolls independently from the Alpha Feed */}
      <CardContent className="flex-1 overflow-y-auto p-0">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <Eye className="h-12 w-12 text-white/20 mb-4" />
            <p className="text-white/40 text-sm">
              {isConnected 
                ? `Waiting for trades ≥ $${minValue.toLocaleString()}...` 
                : "Connecting to Polymarket..."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {trades.map((trade, idx) => {
              const tradeValue = trade.payload.size * trade.payload.price;
              const isBuy = trade.payload.side === "BUY";
              
              return (
                <div 
                  key={`${trade.payload.transactionHash}-${idx}`}
                  className="p-4 hover:bg-white/5 transition-colors"
                >
                  {/* Trade Header: User & Time */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {trade.payload.profileImage ? (
                        <Image 
                          src={trade.payload.profileImage} 
                          alt={trade.payload.name}
                          width={24}
                          height={24}
                          className="h-6 w-6 rounded-full border border-white/10"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-purple-500/20 border border-purple-500/20" />
                      )}
                      {/* Clickable username - links to user's address page */}
                      <Link
                        target="_blank"
                        href={`/address/${trade.payload.proxyWallet}`}
                        className="text-sm font-medium text-white/90 hover:text-purple-400 transition-colors"
                      >
                        {trade.payload.pseudonym || trade.payload.name || "Anonymous"}
                      </Link>
                    </div>
                    <span className="text-xs text-white/40">
                      {/* Convert Unix timestamp (seconds) to milliseconds for date-fns */}
                      {formatDistanceToNow(trade.payload.timestamp * 1000)} ago
                    </span>
                  </div>

                  {/* Trade Details */}
                  <div className="space-y-2">
                    {/* Market Title */}
                    <Link
                      href={`https://polymarket.com/event/${trade.payload.eventSlug}/${trade.payload.slug}`}
                      target="_blank"
                      className="text-sm text-white/80 hover:text-blue-400 transition-colors line-clamp-2 block"
                    >
                      {trade.payload.title}
                    </Link>

                    {/* Trade Info Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Side & Outcome */}
                      <div className="flex items-center gap-2">
                        {isBuy ? (
                          <TrendingUp className="h-4 w-4 text-green-400" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-400" />
                        )}
                        <span className={`text-xs font-bold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.payload.side}
                        </span>
                        <span className="text-xs text-white/60">
                          {trade.payload.outcome}
                        </span>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <span className="text-xs text-white/40">Price: </span>
                        <span className="text-xs font-mono font-bold text-white/90">
                          {(trade.payload.price * 100).toFixed(1)}¢
                        </span>
                      </div>

                      {/* Size */}
                      <div>
                        <span className="text-xs text-white/40">Size: </span>
                        <span className="text-xs font-mono text-white/80">
                          {trade.payload.size.toLocaleString()} shares
                        </span>
                      </div>

                      {/* Total Value - Highlighted */}
                      <div className="text-right">
                        <span className="text-xs text-white/40">Value: </span>
                        <span className="text-sm font-mono font-bold text-purple-400">
                          ${tradeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
