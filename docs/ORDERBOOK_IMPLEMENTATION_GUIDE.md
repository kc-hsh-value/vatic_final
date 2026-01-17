# Polymarket Orderbook Implementation Guide

## Overview

This guide covers how to implement a real-time orderbook display for Polymarket markets, just like the one on polymarket.com. We tested this extensively with both low-volume and high-frequency markets to understand the complete flow.

## Architecture Overview

The orderbook implementation uses a **two-step approach**:

1. **Initial Load**: Fetch orderbook snapshot via REST API
2. **Real-time Updates**: Subscribe to WebSocket for continuous updates

This eliminates timing gaps - the WebSocket sends a full `book` message immediately upon subscription, ensuring you always have the most current data.

---

## Step 1: Initial Orderbook Snapshot (REST API)

### Endpoint
```
GET https://clob.polymarket.com/book?token_id={TOKEN_ID}
```

### Response Structure
```json
{
  "market": "0xaf9d0e448129a9f657f851d49495ba4742055d80e0ef1166ba0ee81d4d594214",
  "asset_id": "101676997363687199724245607342877036148401850938023978421879460310389391082353",
  "hash": "86bd91569a1b6357150e1b4715a624bcd17ff4ee",
  "bids": [
    {"price": "0.032", "size": "82.18"},
    {"price": "0.031", "size": "20.00"}
  ],
  "asks": [
    {"price": "0.999", "size": "2721.01"},
    {"price": "0.998", "size": "255.27"}
  ]
}
```

### Key Points
- `bids` = Buy orders (people buying YES/UP shares)
- `asks` = Sell orders (people selling YES/UP shares)
- `hash` = Orderbook state identifier (useful for debugging)
- Use this to populate your initial orderbook UI

---

## Step 2: WebSocket Connection for Real-Time Updates

### Connection
```javascript
const ws = new WebSocket('wss://ws-subscriptions-clob.polymarket.com/ws/market');
```

### Subscription Message
```json
{
  "type": "market",
  "assets_ids": ["TOKEN_ID_HERE"],
  "auth": {
    "apiKey": "YOUR_API_KEY",
    "secret": "YOUR_SECRET",
    "passphrase": "YOUR_PASSPHRASE"
  }
}
```

**Important Notes:**
- Field is `assets_ids` (plural with underscore), not `asset_ids`
- Authentication is **required** - use your CLOB API credentials
- You can subscribe to multiple token IDs in the array

### Keep-Alive Mechanism
Send `"PING"` message every 10 seconds, expect `"PONG"` response:
```javascript
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send('PING');
  }
}, 10000);
```

---

## Message Types & Handling

### 1. `book` Message
**When**: Sent immediately upon subscription OR when a trade significantly affects the book

**Purpose**: Full orderbook snapshot

**Example**:
```json
[{
  "event_type": "book",
  "market": "0x56af89da0c1e6fc3cdbf3838836968fe2ffc1ff9bdc614dcfdda235611a4b575",
  "asset_id": "79974041409923150213245836826010938265799605726528465355243112990852205011716",
  "timestamp": "1768633405056",
  "hash": "86bd91569a1b6357150e1b4715a624bcd17ff4ee",
  "bids": [
    {"price": "0.93", "size": "102.10"},
    {"price": "0.92", "size": "191.45"}
  ],
  "asks": [
    {"price": "0.94", "size": "153.18"},
    {"price": "0.95", "size": "777.10"}
  ],
  "last_trade_price": "0.973"
}]
```

**How to Handle**:
- Replace your entire orderbook state with this data
- Timestamp is in **string milliseconds** - parse as `parseInt(timestamp)`
- Messages come as **arrays**, even single messages

---

### 2. `price_change` Message
**When**: New order placed, order cancelled, or order size modified

**Purpose**: Incremental orderbook updates

**Example**:
```json
[{
  "event_type": "price_change",
  "market": "0x56af89da0c1e6fc3cdbf3838836968fe2ffc1ff9bdc614dcfdda235611a4b575",
  "timestamp": "1768633405056",
  "price_changes": [
    {
      "asset_id": "79974041409923150213245836826010938265799605726528465355243112990852205011716",
      "side": "BUY",
      "price": "0.93",
      "size": "102.10",
      "best_bid": "0.93",
      "best_ask": "0.94"
    }
  ]
}]
```

**How to Handle**:
```javascript
price_changes.forEach(change => {
  const side = change.side === 'BUY' ? 'bids' : 'asks';
  const existingOrder = orderbook[side].find(o => o.price === change.price);
  
  if (change.size === "0" || parseFloat(change.size) === 0) {
    // Remove order
    orderbook[side] = orderbook[side].filter(o => o.price !== change.price);
  } else if (existingOrder) {
    // Update existing order
    existingOrder.size = change.size;
  } else {
    // Add new order
    orderbook[side].push({price: change.price, size: change.size});
  }
});
```

**Key Fields**:
- `side`: "BUY" or "SELL"
- `size`: "0" means remove the order
- `best_bid` / `best_ask`: Current best prices (useful for spread display)

---

### 3. `last_trade_price` Message
**When**: A maker and taker order match, creating a trade

**Example**:
```json
{
  "event_type": "last_trade_price",
  "market": "0x56af89da0c1e6fc3cdbf3838836968fe2ffc1ff9bdc614dcfdda235611a4b575",
  "price": "0.93",
  "timestamp": "1768633405056"
}
```

**How to Handle**:
- Display as "Last Trade" price
- Useful for price ticker/header

---

### 4. `best_bid_ask` Message
**When**: Best bid or ask prices change (requires `custom_feature_enabled` flag)

**Example**:
```json
{
  "event_type": "best_bid_ask",
  "market": "0x56af89da0c1e6fc3cdbf3838836968fe2ffc1ff9bdc614dcfdda235611a4b575",
  "asset_id": "79974041409923150213245836826010938265799605726528465355243112990852205011716",
  "best_bid": "0.93",
  "best_ask": "0.94",
  "timestamp": "1768633405056"
}
```

**How to Handle**:
- Update spread display
- Highlight best bid/ask in orderbook UI

---

### 5. `tick_size_change` Message
**When**: Market price reaches >0.96 or <0.04

**Example**:
```json
{
  "event_type": "tick_size_change",
  "market": "0x56af89da0c1e6fc3cdbf3838836968fe2ffc1ff9bdc614dcfdda235611a4b575",
  "tick_size": "0.001",
  "timestamp": "1768633405056"
}
```

**How to Handle**:
- Update minimum tick size for order placement
- Adjust price input step size in UI

---

## Linking Outcomes to Token IDs

For binary markets, you need to map outcome names (e.g., "Yes", "No", "Up", "Down") to their token IDs:

```javascript
// From market metadata
const market = {
  outcomes: ["Up", "Down"],
  clobTokenIds: ["79974041409923150213245836826010938265799605726528465355243112990852205011716", 
                 "82162017597430453934567919422755614406539307605098514579449715636791151760536"]
};

// Mapping
const outcomeMap = {
  [market.clobTokenIds[0]]: market.outcomes[0], // "Up"
  [market.clobTokenIds[1]]: market.outcomes[1]  // "Down"
};
```

**For the orderbook tabs:**
- 0th index outcome ↔ 0th index clobTokenId
- 1st index outcome ↔ 1st index clobTokenId

---

## Real-World Testing Results

### Low Volume Market (Trump Deportation)
- Initial orderbook: 12 bids, 51 asks
- Updates every few minutes
- Good for testing basic functionality

### High Volume Market (BTC Up/Down 15m)
- Initial orderbook: 20+ bids, 30+ asks
- **Constant updates** (multiple per second!)
- Updates as fast as every few milliseconds during active trading
- Perfect stress test for UI performance

**Example activity burst:**
```
07:10:02.252 - price_change (2 changes)
07:10:02.258 - price_change (2 changes)
07:10:02.265 - price_change (2 changes)
07:10:02.273 - price_change (2 changes)
07:10:02.282 - price_change (2 changes)
```

---

## UI Implementation Tips

### Orderbook Display Structure
```
┌─────────────────────────────┐
│  ASKS (Sell Orders - RED)   │
│  $0.999  │  2721.01         │
│  $0.998  │  255.27          │
│  $0.997  │  3900.00         │
├─────────────────────────────┤
│  Spread: $0.049 (0.05%)     │
├─────────────────────────────┤
│  BIDS (Buy Orders - GREEN)  │
│  $0.950  │  777.10          │
│  $0.920  │  191.45          │
│  $0.910  │  60.50           │
└─────────────────────────────┘
```

### Sorting
- **Asks**: Sort descending (highest price at top, closest to spread)
- **Bids**: Sort descending (highest price at top, closest to spread)

### Performance Optimization
- **Throttle UI updates**: Update display max every 100-200ms (batch changes)
- **Limit displayed rows**: Show top 10-20 orders per side
- **Virtual scrolling**: For full orderbook view
- **Debounce rapid changes**: Prevent flicker on high-frequency updates

### Visual Feedback
- **Highlight changes**: Flash green for size increase, red for decrease
- **Depth visualization**: Background bars showing relative size
- **Best bid/ask highlighting**: Distinct color/border
- **Price levels**: Fixed decimal places based on tick size

---

## Critical Implementation Details

### 1. Timestamp Handling
```javascript
// Timestamps come as string milliseconds
const timestamp = parseInt(message.timestamp);
const date = new Date(timestamp);
```

### 2. Message Array Parsing
```javascript
// Messages ALWAYS come as arrays
const messages = Array.isArray(parsed) ? parsed : [parsed];
messages.forEach(message => handleMessage(message));
```

### 3. Size Zero = Remove Order
```javascript
if (parseFloat(change.size) === 0) {
  // Remove this price level from orderbook
}
```

### 4. WebSocket Reconnection
Implement reconnection logic with exponential backoff:
```javascript
let reconnectDelay = 1000;
ws.on('close', () => {
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    reconnectWebSocket();
  }, reconnectDelay);
});
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User navigates to market page                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Fetch market metadata (outcomes, clobTokenIds, etc.)     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Fetch initial orderbook via REST API                     │
│    GET /book?token_id={TOKEN_ID}                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Display initial orderbook in UI                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Open WebSocket connection                                │
│    wss://ws-subscriptions-clob.polymarket.com/ws/market     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Subscribe with auth + token IDs                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Receive 'book' message (replaces initial state)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Start PING/PONG loop (every 10s)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Listen for messages:                                     │
│    - price_change → Update specific orders                  │
│    - last_trade_price → Update ticker                       │
│    - best_bid_ask → Update spread display                   │
│    - tick_size_change → Update order form                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Example: Complete Implementation

See `test_orderbook_realtime.js` for a working implementation that demonstrates:
- ✅ REST API initial load
- ✅ WebSocket subscription with auth
- ✅ Handling all message types
- ✅ Maintaining orderbook state
- ✅ PING/PONG keep-alive
- ✅ Proper timestamp parsing
- ✅ Array message handling

---

## Common Gotchas

❌ **Using `asset_ids` instead of `assets_ids`** → WebSocket closes immediately
❌ **Not parsing timestamps as integers** → Invalid date errors
❌ **Forgetting messages are arrays** → Parsing errors
❌ **Not sending PING messages** → Connection drops after ~30 seconds
❌ **Missing auth credentials** → Connection closes without error
❌ **Not handling size=0** → Ghost orders remain in orderbook
❌ **Wrong token ID** → "No orderbook exists" error

---

## Testing Strategy

1. **Start with low-volume market** (e.g., political prediction)
   - Verify basic connection
   - Test message parsing
   - Confirm orderbook updates

2. **Move to high-frequency market** (e.g., BTC Up/Down 15m)
   - Stress test performance
   - Verify rapid update handling
   - Check UI responsiveness

3. **Test edge cases**
   - WebSocket disconnect/reconnect
   - Order removals (size=0)
   - Tick size changes
   - Network interruptions

---

## Resources

- **CLOB API Docs**: https://docs.polymarket.com/developers/CLOB
- **WebSocket Market Channel**: https://docs.polymarket.com/developers/CLOB/websocket/market-channel
- **REST Orderbook API**: https://docs.polymarket.com/api-reference/orderbook/get-order-book-summary
- **Working Test Script**: `test_orderbook_realtime.js`

---

## Summary

The orderbook implementation is straightforward:

1. **Load** initial state via REST
2. **Connect** to WebSocket with auth
3. **Handle** book messages (full snapshot)
4. **Update** on price_change messages (incremental)
5. **Maintain** connection with PING/PONG
6. **Optimize** UI updates for performance

The key insight: **No timing gap exists** because the WebSocket sends a full `book` message immediately upon subscription, ensuring you always start with the current state.

Good luck with the implementation! 🚀
