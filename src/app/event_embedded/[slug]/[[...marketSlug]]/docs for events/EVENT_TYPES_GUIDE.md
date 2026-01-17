# Polymarket Event Types Guide for Frontend Developers

## Overview

When building a trading terminal on top of Polymarket, understanding the different event types is crucial for properly rendering the UI and handling market logic. This guide analyzes the event structures returned by the Polymarket API to help you build the appropriate interfaces.

## API Endpoint

```javascript
// Fetch event by slug
const response = await fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`);
const events = await response.json();
const event = events[0]; // API returns an array
```

---

## Event Type Classification

### 1. **Single Market Event**
**Example:** `will-trump-acquire-greenland-before-2027`

A simple binary market with one question and two outcomes (Yes/No).

#### Characteristics:
- `markets.length === 1`
- Single outcome question
- Binary resolution (Yes or No)
- `groupItemTitle` is empty or null
- May have derivative markets attached (see Type 6)

#### API Response Structure:
```json
{
  "id": "11663",
  "title": "Will Trump acquire Greenland before 2027?",
  "slug": "will-trump-acquire-greenland-before-2027",
  "markets": [
    {
      "id": "997488",
      "question": "Will Trump acquire Greenland before 2027?",
      "outcomePrices": ["0.42", "0.58"],
      "groupItemTitle": "",
      "groupItemThreshold": "0"
    }
  ]
}
```

#### UI Considerations:
- Display as a single binary bet interface
- Show price for Yes and No outcomes
- Simple buy/sell interface

---

### 2. **Mutually Exclusive Multi-Market Event**
**Example:** `fed-decision-in-january`

Multiple markets where **ONLY ONE can resolve to Yes**. These are categorical predictions.

#### Characteristics:
- `markets.length > 1`
- Each market has a unique `groupItemTitle`
- Sequential `groupItemThreshold` values (0, 1, 2, 3...)
- Different questions per market
- **Resolution logic**: Exactly one market resolves to "Yes"
- Usually represents categorical choices (A or B or C or D...)

#### API Response Structure:
```json
{
  "id": "45883",
  "title": "Fed decision in January?",
  "slug": "fed-decision-in-january",
  "markets": [
    {
      "id": "601697",
      "question": "Fed decreases interest rates by 50+ bps...",
      "groupItemTitle": "50+ bps decrease",
      "groupItemThreshold": "0",
      "outcomePrices": ["0.0035", "0.9965"]
    },
    {
      "id": "601698",
      "question": "Fed decreases interest rates by 25 bps...",
      "groupItemTitle": "25 bps decrease",
      "groupItemThreshold": "1",
      "outcomePrices": ["0.0405", "0.9595"]
    },
    {
      "id": "601699",
      "question": "No change in Fed interest rates...",
      "groupItemTitle": "No change",
      "groupItemThreshold": "2",
      "outcomePrices": ["0.9545", "0.0455"]
    },
    {
      "id": "601700",
      "question": "Fed increases interest rates by 25+ bps...",
      "groupItemTitle": "25+ bps increase",
      "groupItemThreshold": "3",
      "outcomePrices": ["0.0015", "0.9985"]
    }
  ]
}
```

#### UI Considerations:
- Display as a **multiple choice selection** (radio buttons style)
- Show all options with their probabilities
- Probabilities should sum close to 100% (accounting for fees)
- Use `groupItemTitle` for display labels
- Sort by `groupItemThreshold` for proper ordering
- Highlight the most likely outcome
- **Warning**: Users can only profit if their chosen option wins

---

### 3. **Independent Multi-Market Event (Timeline Events)**
**Example:** `us-strikes-iran-by`

Multiple markets where **multiple or none can resolve to Yes**. Common for time-based predictions.

#### Characteristics:
- `markets.length > 1`
- Each market has a unique `groupItemTitle` (usually dates)
- Sequential `groupItemThreshold` values
- Similar base question with different timeframes
- **Resolution logic**: Each market resolves independently based on whether the event happened by that date
- **Cascade resolution**: If event happens on Jan 15, all markets "by Jan 15 or later" resolve Yes

#### API Response Structure:
```json
{
  "id": "114242",
  "title": "US strikes Iran by...?",
  "slug": "us-strikes-iran-by",
  "markets": [
    {
      "id": "984440",
      "question": "US strikes Iran by December 31, 2025?",
      "groupItemTitle": "December 31",
      "groupItemThreshold": "0",
      "outcomePrices": ["0", "1"]
    },
    {
      "id": "1139590",
      "question": "US strikes Iran by January 11, 2026?",
      "groupItemTitle": "January 11",
      "groupItemThreshold": "1",
      "outcomePrices": ["0", "1"]
    },
    {
      "id": "1092199",
      "question": "US strikes Iran by January 31, 2026?",
      "groupItemTitle": "January 31",
      "groupItemThreshold": "10",
      "outcomePrices": ["0.295", "0.705"]
    }
    // ... more markets
  ]
}
```

#### UI Considerations:
- Display as a **timeline** or **milestone list**
- Show prices for each date
- Calculate implied probabilities between dates
  - P(event on Jan 15) = P(by Jan 15) - P(by Jan 14)
- Visual indicator for expired markets (price = 0 or 1)
- Sort chronologically by `groupItemThreshold`
- Show countdown timers for upcoming dates
- **Important**: Each market can be traded independently
- Consider showing probability density (rate of change between dates)

---

### 4. **Sports Event**
**Example:** `cs2-pain-bb3-2026-01-16`

Sports games with multiple betting markets (winner, handicaps, over/under, etc.).

#### Characteristics:
- `markets.length > 1` (typically 10-30+ markets)
- Main market: simple match winner
- Additional markets: handicaps, round totals, map winners
- `groupItemTitle` describes bet type
- `groupItemThreshold` may be null/undefined or non-sequential
- No clear threshold ordering (unlike Type 2 & 3)

#### API Response Structure:
```json
{
  "id": "154441",
  "title": "Counter-Strike: paiN vs BetBoom Team (BO3)...",
  "slug": "cs2-pain-bb3-2026-01-16",
  "markets": [
    {
      "id": "1148337",
      "question": "Counter-Strike: paiN vs BetBoom Team (BO3)",
      "groupItemTitle": "paiN vs BetBoom Team - BLAST Bounty Qualifier",
      "outcomePrices": ["0.89", "0.11"]
    },
    {
      "id": "1148338",
      "question": "Counter-Strike: paiN vs BetBoom Team - Map 1 Winner",
      "groupItemTitle": "Map 1 Winner",
      "outcomePrices": ["0.9995", "0.0005"]
    },
    {
      "id": "1148340",
      "question": "Games Total: O/U 2.5",
      "groupItemTitle": "O/U 2.5 Games",
      "outcomePrices": ["0.235", "0.765"]
    },
    {
      "id": "1148342",
      "question": "Total Rounds Over/Under 55.5",
      "groupItemTitle": "Total Rounds Over/Under 55.5",
      "outcomePrices": ["0.505", "0.495"]
    }
    // ... many more bet types
  ]
}
```

#### UI Considerations:
- **Group markets by type**: Match winner, Map winners, Totals, Handicaps
- Display main market (match winner) prominently
- Collapsible sections for different bet types
- Show live scores if game is in progress
- Filter/toggle to show only popular markets
- Consider implementing:
  - Quick bet interface for main market
  - Advanced view for all markets
  - Favorites/bookmarks for specific bet types

---

### 5. **Range-Based Series Event**
**Example:** `highest-temperature-in-nyc-on-january-13`

Multiple markets representing different ranges or brackets. Exactly one range resolves to Yes.

#### Characteristics:
- `markets.length > 1`
- `groupItemTitle` describes ranges (e.g., "42-43°F")
- Sequential `groupItemThreshold` values
- Mutually exclusive but representing continuous ranges
- Similar to Type 2 but specifically for ranges/buckets

#### API Response Structure:
```json
{
  "id": "157101",
  "title": "Highest temperature in NYC on January 13?",
  "slug": "highest-temperature-in-nyc-on-january-13",
  "markets": [
    {
      "id": "1158878",
      "question": "Will the highest temperature... be 41°F or below on January 13?",
      "groupItemTitle": "41°F or below",
      "groupItemThreshold": "0",
      "outcomePrices": ["0", "1"]
    },
    {
      "id": "1158879",
      "question": "Will the highest temperature... be between 42-43°F on January 13?",
      "groupItemTitle": "42-43°F",
      "groupItemThreshold": "1",
      "outcomePrices": ["0", "1"]
    },
    {
      "id": "1158880",
      "question": "Will the highest temperature... be between 44-45°F on January 13?",
      "groupItemTitle": "44-45°F",
      "groupItemThreshold": "2",
      "outcomePrices": ["0", "1"]
    }
    // ... more ranges
  ]
}
```

#### UI Considerations:
- Display as a **distribution chart** or **heat map**
- Show probability density across ranges
- Visual representation (bar chart, histogram)
- Highlight expected value/median
- Consider showing continuous probability curve
- Use `groupItemTitle` for x-axis labels
- Color-code by probability intensity

---

### 6. **Event with Derivative Markets**
**Example:** Same as Type 1, but with derivative markets attached

A single primary market can have "derivative" markets that are calculated based on the primary market's price.

#### Characteristics:
- Primary market: regular binary market
- Derivative markets: `market.derivative !== null`
- Derivative types include: "midpoint", "range", "threshold"
- Derivatives are programmatically calculated, not independently traded

#### How to Detect:
```javascript
const hasDerivatives = event.markets.some(m => m.derivative !== undefined && m.derivative !== null);
```

#### API Response:
```json
{
  "markets": [
    {
      "id": "123456",
      "question": "Will Trump acquire Greenland before 2027?",
      "derivative": null
      // This is the primary market
    },
    {
      "id": "123457",
      "question": "Will Trump acquire Greenland before Q2 2026?",
      "derivative": {
        "type": "midpoint",
        "id": "123456"
      }
      // This derives its price from market 123456
    }
  ]
}
```

#### UI Considerations:
- Display derivative markets separately or as sub-markets
- Indicate they are derived (e.g., "Calculated Market")
- Explain relationship to primary market
- Show which market they derive from
- Note: Derivative markets may have different liquidity characteristics

---

## Detection Logic

Here's a decision tree to classify events programmatically:

```javascript
function classifyEvent(event) {
  const marketCount = event.markets?.length || 0;
  
  // Single market
  if (marketCount === 1) {
    const hasDerivative = event.markets.some(m => m.derivative);
    return hasDerivative ? 'SINGLE_WITH_DERIVATIVES' : 'SINGLE_MARKET';
  }
  
  // Multi-market classification
  const hasGroupTitles = event.markets.some(m => m.groupItemTitle && m.groupItemTitle !== '');
  
  if (!hasGroupTitles) {
    return 'UNKNOWN'; // Rare case
  }
  
  // Check if all markets share similar base question (timeline events)
  const questions = event.markets.map(m => {
    // Extract base question (remove date/time specific parts)
    return m.question.replace(/by [A-Z][a-z]+ \d+, \d+\?/g, 'by DATE?')
                     .replace(/between [\d-]+°F/g, 'in RANGE')
                     .replace(/on [A-Z][a-z]+ \d+/g, 'on DATE');
  });
  
  const uniqueQuestions = new Set(questions);
  const similarQuestions = uniqueQuestions.size <= 3; // Allow slight variations
  
  // Check for date-based groupItemTitles (timeline events)
  const datePattern = /(January|February|March|April|May|June|July|August|September|October|November|December) \d+/;
  const hasDateTitles = event.markets.some(m => datePattern.test(m.groupItemTitle));
  
  // Sports events have many varied markets with non-sequential or null thresholds
  const thresholds = event.markets.map(m => m.groupItemThreshold).filter(t => t !== null);
  const maxThreshold = Math.max(...thresholds.map(Number));
  const hasLargeGaps = maxThreshold > marketCount * 2; // Sports often have duplicate thresholds
  
  if (hasLargeGaps || marketCount > 15) {
    return 'SPORTS_EVENT';
  }
  
  if (hasDateTitles || similarQuestions) {
    return 'INDEPENDENT_MULTI_MARKET'; // Timeline/cascade
  }
  
  // Range-based events (temperature, prices, etc.)
  const hasRanges = event.markets.some(m => 
    /\d+-\d+/.test(m.groupItemTitle) || 
    /or below|or higher/.test(m.groupItemTitle)
  );
  
  if (hasRanges) {
    return 'RANGE_BASED_SERIES';
  }
  
  // Default to mutually exclusive
  return 'MUTUALLY_EXCLUSIVE';
}
```

---

## Key Properties to Check

### Essential Fields:
- `event.markets.length` - number of markets
- `market.groupItemTitle` - label for multi-market events
- `market.groupItemThreshold` - ordering value
- `market.outcomePrices` - current prices [yes, no]
- `market.derivative` - derivative market info

### Series Detection:
```javascript
const isSeries = event.series !== null;
```

### Volume & Liquidity:
- `event.liquidity` - total event liquidity
- `market.volume` - individual market volume

---

## Resolution Logic Summary

| Event Type | Resolution Logic | Sum to 100%? |
|------------|------------------|--------------|
| Single Market | Yes or No | Yes (binary) |
| Mutually Exclusive | Exactly one Yes | Yes (~100%) |
| Independent Multi | Multiple can be Yes | No |
| Sports Event | Varies by bet type | Varies |
| Range-Based | Exactly one range | Yes (~100%) |

---

## Series Events

All the example events shown have `series !== null`, indicating they belong to a series. Series events are recurring or related events grouped together.

### To fetch series data:
```javascript
const response = await fetch(`https://gamma-api.polymarket.com/series/${seriesId}`);
```

*Note: The `event.series` object in the `/events` endpoint may have limited information. Use the dedicated series endpoint for full details.*

---

## Additional Event Types to Consider

### 7. **Conditional Markets**
Markets that depend on another market's outcome (e.g., "If Trump wins, will he...?")
- Not explicitly shown in API structure
- May need manual categorization

### 8. **Combo Markets**
Markets combining multiple events (parlays)
- Rare in Polymarket
- Would have special derivatives structure

### 9. **AMM vs Order Book**
- Check `event.enableOrderBook`
- `true` = Order book trading enabled
- `false` = AMM only

---

## Best Practices for Frontend Implementation

### 1. **Always sort by `groupItemThreshold`**
```javascript
const sortedMarkets = event.markets.sort((a, b) => 
  Number(a.groupItemThreshold) - Number(b.groupItemThreshold)
);
```

### 2. **Handle expired/resolved markets**
```javascript
// Markets with prices at extremes are likely resolved
const isResolved = market.outcomePrices?.[0] === "0" || 
                   market.outcomePrices?.[0] === "1";
```

### 3. **Calculate implied probabilities**
```javascript
const yesPrice = parseFloat(market.outcomePrices[0]);
const noPrice = parseFloat(market.outcomePrices[1]);
const impliedProbability = yesPrice * 100; // Percentage
```

### 4. **Probability sum validation** (for mutually exclusive events)
```javascript
const totalProbability = event.markets.reduce((sum, m) => 
  sum + parseFloat(m.outcomePrices[0]), 0
);
// Should be close to 1.0 for mutually exclusive events
const isValid = Math.abs(totalProbability - 1.0) < 0.1; // 10% tolerance for fees
```

### 5. **Group markets for better UX**
```javascript
// For sports events, group by bet type
const grouped = {};
event.markets.forEach(market => {
  const category = categorizeMarket(market.groupItemTitle);
  if (!grouped[category]) grouped[category] = [];
  grouped[category].push(market);
});
```

---

## Testing Your Implementation

Use these slugs to test each event type:

```javascript
const TEST_SLUGS = {
  singleMarket: 'will-trump-acquire-greenland-before-2027',
  mutuallyExclusive: 'fed-decision-in-january',
  independent: 'us-strikes-iran-by',
  sports: 'cs2-pain-bb3-2026-01-16',
  rangeBased: 'highest-temperature-in-nyc-on-january-13'
};
```

---

## Common Pitfalls

1. **Don't assume all multi-market events are mutually exclusive**
   - Check the resolution logic carefully
   - Timeline events are independent, not mutually exclusive

2. **Don't ignore `groupItemThreshold`**
   - Essential for proper ordering
   - May not be sequential (especially in sports events)

3. **Handle missing volumes**
   - Some markets have `undefined` volume
   - Always check before displaying

4. **Series data may be incomplete**
   - The `event.series` object might be null or have undefined sub-properties
   - Fetch from dedicated series endpoint if needed

5. **Derivative markets need special handling**
   - They're calculated, not independently traded
   - Different liquidity characteristics

---

## Conclusion

Understanding these event types will help you:
- Build appropriate UI components for each type
- Implement correct trading logic
- Display probabilities accurately
- Provide better user experience

For a complete implementation, combine this knowledge with:
- Order book data (if `enableOrderBook === true`)
- Historical price data
- User portfolio positions
- Real-time updates via WebSocket

Happy building! 🚀
