/*
  ARCHITECTURE NOTES: RATE LIMITING STRATEGY
  ------------------------------------------
  
  Why a custom table (user_rate_limits) and RPC (bump_follow_limit)?

  1. Stateless Environment: 
     Since we are using Next.js Server Actions (Serverless), we cannot store 
     variable states like "user_X_requests_count" in memory. The server 
     instance might die or restart between requests. We need a persistent store.

  2. Race Conditions:
     If we did this in JavaScript:
       -> Fetch current count
       -> Check if < 10
       -> Increment and Save
     Two requests happening at the exact same millisecond could both read "9", 
     both increment to "10", and both pass. 
     By using a PostgreSQL Function (RPC), the "Check + Increment" happens 
     atomically inside the database in a single transaction.

  3. Cost Protection:
     We pay for the External X API (twitterapi.io). We must prevent a malicious 
     user (or a bug) from spamming the "Add Account" button and draining our 
     API credits or hitting the vendor's hard limits.

  4. Logic Flow (Fixed Window Counter):
     - The table stores: `user_id`, `action`, `hits`, `window_start`.
     - When a user clicks "Add":
       a. We try to INSERT a row with hits=1.
       b. If the row exists (ON CONFLICT):
          - If the `window_start` is older than 60 seconds (expired window): 
            Reset `hits` to 1 and `window_start` to NOW().
          - If the window is still valid: 
            Increment `hits` by 1.
     - Finally, we return the new count. If count > limit, we throw an error.
*/