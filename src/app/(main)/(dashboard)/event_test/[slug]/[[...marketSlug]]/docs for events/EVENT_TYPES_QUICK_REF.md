# Polymarket Event Types - Quick Reference

## Detection Flowchart

```
START: Fetch event by slug
  │
  ├─→ markets.length === 1?
  │   ├─→ YES: Check for derivatives
  │   │   ├─→ Has derivative? → TYPE 6: Single Market with Derivatives
  │   │   └─→ No derivative? → TYPE 1: Single Market
  │   │
  │   └─→ NO: Continue to multi-market checks
  │       │
  │       ├─→ markets.length > 15? → TYPE 4: Sports Event
  │       │
  │       ├─→ groupItemTitles contain dates?
  │       │   └─→ YES → TYPE 3: Independent Multi-Market (Timeline)
  │       │
  │       ├─→ groupItemTitles contain ranges (e.g., "42-43°F")?
  │       │   └─→ YES → TYPE 5: Range-Based Series
  │       │
  │       └─→ DEFAULT → TYPE 2: Mutually Exclusive
```

## Quick Comparison Table

| Feature | Single Market | Mutually Exclusive | Independent Multi | Sports Event | Range-Based |
|---------|--------------|-------------------|------------------|--------------|-------------|
| **Market Count** | 1 | 2-10 | 5-30 | 10-30+ | 5-15 |
| **groupItemTitle** | Empty/None | Unique per market | Date-based | Bet type | Range labels |
| **groupItemThreshold** | "0" | Sequential (0,1,2...) | Sequential | Random/Null | Sequential |
| **Probabilities Sum** | 100% (binary) | ~100% | Variable | Variable | ~100% |
| **Resolution** | One Yes/No | Exactly one Yes | Multiple can be Yes | Varies | Exactly one Yes |
| **Example** | Trump/Greenland | Fed Rate Decision | Iran Strike Timeline | CS2 Match | NYC Temperature |

## Key Indicators by Type

### 🎯 Type 1: Single Market
```javascript
✓ markets.length === 1
✓ groupItemTitle === "" or null
✗ No derivatives
```

### 🎯 Type 2: Mutually Exclusive
```javascript
✓ markets.length > 1
✓ Each market has unique groupItemTitle
✓ groupItemThreshold: 0, 1, 2, 3...
✓ Sum of probabilities ≈ 100%
✓ Different questions
```

### 🎯 Type 3: Independent Multi-Market (Timeline)
```javascript
✓ markets.length > 1
✓ groupItemTitles contain dates
✓ Similar base question + different dates
✓ groupItemThreshold: sequential
✓ Cascade resolution (later dates include earlier)
```

### 🎯 Type 4: Sports Event
```javascript
✓ markets.length > 15 (usually)
✓ Multiple bet types (winner, handicap, total)
✓ groupItemThreshold: non-sequential or null
✓ High variety in groupItemTitles
```

### 🎯 Type 5: Range-Based Series
```javascript
✓ markets.length > 1
✓ groupItemTitles contain ranges ("42-43°F")
✓ Or "X or below" / "X or higher"
✓ groupItemThreshold: sequential
✓ Sum of probabilities ≈ 100%
```

### 🎯 Type 6: Single with Derivatives
```javascript
✓ markets.length >= 1
✓ At least one market.derivative !== null
✓ Derivative.id points to parent market
```

## Resolution Logic

### Type 1: Single Market
- **Yes** or **No**
- Binary outcome
- Simple win/lose

### Type 2: Mutually Exclusive
- **Exactly one** market resolves to Yes
- All others resolve to No
- Like multiple choice (A or B or C or D)

### Type 3: Independent Multi-Market
- **Multiple** markets can resolve to Yes
- Or **none** can resolve to Yes
- Each market independent
- **Cascade rule**: If event happens on Jan 15, all "by Jan 15 or later" resolve Yes

### Type 4: Sports Event
- **Main market**: Team A wins or Team B wins
- **Other markets**: Independent resolutions
  - Map winners: Yes/No per map
  - Over/Under: Yes if over, No if under
  - Handicaps: Yes if condition met

### Type 5: Range-Based
- **Exactly one** range resolves to Yes
- All others resolve to No
- Like mutually exclusive but for continuous ranges

## Code Snippets

### Detect Event Type
```javascript
function getEventType(event) {
  if (event.markets.length === 1) {
    return 'SINGLE_MARKET';
  }
  
  const hasGroupTitles = event.markets.some(m => m.groupItemTitle);
  if (!hasGroupTitles) return 'UNKNOWN';
  
  const hasDateTitles = event.markets.some(m => 
    /January|February|March|April|May|June|July|August|September|October|November|December/.test(m.groupItemTitle)
  );
  if (hasDateTitles) return 'TIMELINE_EVENT';
  
  const hasRanges = event.markets.some(m => 
    /\d+-\d+|or below|or higher/.test(m.groupItemTitle)
  );
  if (hasRanges) return 'RANGE_BASED';
  
  if (event.markets.length > 15) return 'SPORTS_EVENT';
  
  return 'MUTUALLY_EXCLUSIVE';
}
```

### Sort Markets
```javascript
const sorted = event.markets.sort((a, b) => 
  Number(a.groupItemThreshold) - Number(b.groupItemThreshold)
);
```

### Calculate Probability
```javascript
const probability = parseFloat(market.outcomePrices[0]) * 100; // percentage
```

### Check if Resolved
```javascript
const isResolved = 
  market.outcomePrices[0] === "0" || 
  market.outcomePrices[0] === "1";
```

### Validate Mutually Exclusive Sum
```javascript
const total = event.markets.reduce((sum, m) => 
  sum + parseFloat(m.outcomePrices[0]), 0
);
const isValid = Math.abs(total - 1.0) < 0.1; // 10% tolerance
```

## UI Component Suggestions

### Type 1: Single Market
```
┌────────────────────────────────┐
│ Will Trump acquire Greenland?  │
├────────────────────────────────┤
│  YES 42%  │  NO 58%             │
│  [BUY]    │  [BUY]              │
└────────────────────────────────┘
```

### Type 2: Mutually Exclusive
```
┌────────────────────────────────┐
│ Fed Decision in January?       │
├────────────────────────────────┤
│ ○ 50+ bps decrease    0.35%    │
│ ○ 25 bps decrease     4.05%    │
│ ● No change          95.45%  ✓ │
│ ○ 25+ bps increase    1.15%    │
└────────────────────────────────┘
```

### Type 3: Timeline
```
┌────────────────────────────────┐
│ US strikes Iran by...?         │
├────────────────────────────────┤
│ Jan 14  ████████████████ 0%  ✗ │
│ Jan 15  ████████████████ 0%  ✗ │
│ Jan 16  ███              1.8%   │
│ Jan 17  ████             4.1%   │
│ Jan 23  ████████        17.0%   │
│ Jan 31  ████████████    29.5%   │
└────────────────────────────────┘
```

### Type 4: Sports
```
┌────────────────────────────────┐
│ paiN vs BetBoom Team (BO3)     │
├────────────────────────────────┤
│ ★ Match Winner                 │
│   paiN 89% │ BetBoom 11%       │
├────────────────────────────────┤
│ ▼ Map Winners                  │
│ ▼ Over/Under                   │
│ ▼ Handicaps                    │
└────────────────────────────────┘
```

### Type 5: Range-Based
```
┌────────────────────────────────┐
│ Highest temp in NYC?           │
├────────────────────────────────┤
│ Distribution Chart:            │
│    ║                           │
│  % ║   ▃▅██▅▃                  │
│    ║  ▁█████▁                  │
│    └────────────────→ °F       │
│     41 44 46 48 50 52          │
└────────────────────────────────┘
```

## Common Patterns

### Pattern: Fetching and Displaying
```javascript
// 1. Fetch
const response = await fetch(
  `https://gamma-api.polymarket.com/events?slug=${slug}`
);
const events = await response.json();
const event = events[0];

// 2. Classify
const type = getEventType(event);

// 3. Sort
const markets = event.markets.sort((a, b) => 
  Number(a.groupItemThreshold) - Number(b.groupItemThreshold)
);

// 4. Render based on type
switch(type) {
  case 'SINGLE_MARKET':
    return <BinaryMarketUI market={markets[0]} />;
  case 'MUTUALLY_EXCLUSIVE':
    return <RadioGroupUI markets={markets} />;
  case 'TIMELINE_EVENT':
    return <TimelineUI markets={markets} />;
  case 'SPORTS_EVENT':
    return <SportsBookUI markets={markets} />;
  case 'RANGE_BASED':
    return <DistributionUI markets={markets} />;
}
```

## Testing URLs

```
Single Market:
https://polymarket.com/event/will-trump-acquire-greenland-before-2027

Mutually Exclusive:
https://polymarket.com/event/fed-decision-in-january

Timeline:
https://polymarket.com/event/us-strikes-iran-by

Sports:
https://polymarket.com/event/cs2-pain-bb3-2026-01-16

Range-Based:
https://polymarket.com/event/highest-temperature-in-nyc-on-january-13
```

## Important Notes

⚠️ **Always sort by groupItemThreshold** before displaying

⚠️ **Check for null/undefined values** in volume and outcomePrices

⚠️ **Timeline events cascade** - later dates include earlier outcomes

⚠️ **Sports events** need special grouping logic

⚠️ **Probabilities in mutually exclusive** should sum to ~100% (±10% for fees)

⚠️ **Derivative markets** are calculated, not independently traded

✅ **Use groupItemTitle** for display labels, not the full question

✅ **Check enableOrderBook** to determine if order book is available

✅ **Series events** may need additional API call for full series data
