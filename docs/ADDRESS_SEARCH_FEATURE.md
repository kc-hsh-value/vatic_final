# Address Search Feature

## Overview
A global search modal that allows users to search for any Polymarket address across the entire Vatic platform. Combines results from both our indexed KOLs database and Polymarket's public API.

## Features

### 🔍 Search Capabilities
- **Dual Search**: Queries both our KOL database AND Polymarket's public API in parallel
- **KOL Search**: Search indexed KOLs by username, display name, or address (with X badges & followers)
- **Polymarket Search**: Discovers any public Polymarket profile/address via their API
- **Direct Address**: Paste any valid `0x...` Ethereum address to navigate directly
- **Smart Deduplication**: KOLs take priority; Polymarket profiles fill in gaps
- **Intelligent Merging**: KOLs first (sorted by followers), then Polymarket profiles

### ⌨️ Keyboard Shortcuts
- **`⌘K` / `Ctrl+K`**: Open search modal (global)
- **`Escape`**: Close modal
- **`↑↓` Arrow Keys**: Navigate results
- **`Enter`**: Select and navigate to address page

### 🎨 UI/UX
- Debounced search (300ms) for performance
- Real-time loading indicators
- Profile pictures, badges, and follower counts
- **KOL Badge**: Shows "KOL" tag for indexed accounts with X integration
- **Source Indicator**: "Polymarket" badge for profiles from their API
- Responsive design (desktop + mobile)
- Smooth animations and transitions
- Keyboard hints in footer

## Implementation Details

### Components
- **`/src/components/address-search-modal.tsx`**: Main search modal component
- **`/src/app/(main)/(KOL)/KOLwrapped/components/navbar.tsx`**: Updated navbar with search button
- **`/src/app/(main)/page.tsx`**: Landing page navbar integration

### API Route
- **`/src/app/api/search-addresses/route.ts`**
  - **Dual Query Strategy**: Hits both sources in parallel with `Promise.allSettled`
  - **Source 1 - KOLs Table**: Queries `polymarket_kols` in Supabase
    - Searches: `x_username`, `x_display_name`, `polymarket_address`
    - Orders by follower count (highest first)
    - Returns top 15 results
  - **Source 2 - Polymarket API**: Queries `https://gamma-api.polymarket.com/public-search`
    - Searches public profiles
    - Returns top 10 results
  - **Deduplication**: Removes Polymarket profiles already in KOLs table
  - **Merged Results**: Combined list (max 20 total), KOLs prioritized

### External API Integration
```typescript
// Polymarket Public Search API
GET https://gamma-api.polymarket.com/public-search
Query Params:
  - q: search query string
  - search_profiles: true
  - limit_per_type: 10
  
Response: { profiles: Profile[] }
```

### Database Query
```sql
-- KOLs Search
SELECT 
  polymarket_address,
  x_username,
  x_display_name,
  x_profile_image_url,
  x_badge_label,
  x_badge_icon_url,
  x_followers
FROM polymarket_kols
WHERE 
  x_username ILIKE '%query%' OR
  x_display_name ILIKE '%query%' OR
  polymarket_address ILIKE '%query%'
ORDER BY x_followers DESC NULLS LAST
LIMIT 15
```

## Usage

### Accessing Search
1. **Desktop**: Click search button in navbar or press `⌘K`
2. **Mobile**: Tap hamburger menu → "Search Addresses"

### Search Behavior
- Type any text to search both KOLs and Polymarket profiles
- Paste a full wallet address (0x...) to navigate directly
- Results update in real-time with 300ms debounce
- **KOL results** show with badges, followers, and X integration
- **Polymarket results** show with "Polymarket" indicator
- Click result or press Enter to navigate to `/address/[slug]`

### Result Prioritization
1. **Indexed KOLs** (from our database) - sorted by followers
2. **Polymarket Profiles** (from their API) - fill remaining slots
3. **Direct Address Input** - instant validation and navigation

## Performance
- Parallel API calls (non-blocking)
- 60s cache on Polymarket API responses
- Debounced input (300ms) reduces API load
- Failed queries don't block (graceful degradation)
- Max 20 results total for fast rendering

## Future Enhancements
- [ ] Add recent searches (localStorage)
- [ ] Show P&L and volume in results (requires additional API calls)
- [ ] Add fuzzy matching for better search
- [ ] Cache merged results for faster subsequent searches
- [ ] Add analytics tracking
- [ ] Infinite scroll for more than 20 results
- [ ] Search filters (KOL only, Polymarket only, etc.)
- [ ] Highlight search term matches in results
