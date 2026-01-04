Run it daily, not hourly.

Hourly is wasted work + it’ll make the “24h change” meaningless (it becomes “since last hour snapshot” unless you add more logic).

Here’s what we did and how to automate it cleanly.

⸻

What we built (conceptually)

You have two kinds of data:

1) “Live” fields (update often)

These come from Polymarket and can change anytime:
	•	pnl_daily, pnl_weekly, pnl_monthly, pnl_all
	•	pnl_updated_at

Your existing worker already updates these every 1–2 hours. Keep that.

2) “Delta / trend” fields (need a baseline)

These are comparisons between “now” and “yesterday”:
	•	rank_today = today’s leaderboard rank by pnl_daily
	•	rank_yesterday = yesterday’s rank_today snapshot
	•	rank_change_24h = how much rank moved since yesterday
	•	pnl_daily_yesterday = yesterday’s pnl_daily snapshot
	•	pnl_change_24h = today’s pnl_daily - pnl_daily_yesterday

Key idea: deltas require saving yesterday.
If you don’t store yesterday somewhere, you can’t compute “change”.

⸻

When to run what

A) Hourly (or every 2 hours): keep this

Your current worker:
	•	fetches Polymarket leaderboard PNLS
	•	updates pnl_daily/week/month/all
This is your “live refresh”.

✅ Schedule: every 1–2 hours (what you already have).

B) Daily (once per day): run the snapshot + rank + delta pipeline

This is your “midnight bookkeeping”.

✅ Schedule: once daily, ideally a bit after midnight in your desired timezone.

⸻

Exact daily pipeline order (important)

Run these in order:

1) Snapshot “yesterday”

Copy today’s values into yesterday columns BEFORE you overwrite ranks/deltas for the new day.

UPDATE polymarket_kols
SET
  rank_yesterday = rank_today,
  pnl_daily_yesterday = pnl_daily;

2) Compute today’s rank

WITH ranked AS (
  SELECT
    polymarket_address,
    RANK() OVER (ORDER BY pnl_daily DESC) AS rank_today
  FROM polymarket_kols
)
UPDATE polymarket_kols k
SET rank_today = r.rank_today
FROM ranked r
WHERE k.polymarket_address = r.polymarket_address;

3) Compute deltas

UPDATE polymarket_kols
SET
  pnl_change_24h = CASE
    WHEN pnl_daily_yesterday IS NULL THEN NULL
    ELSE pnl_daily - pnl_daily_yesterday
  END,
  rank_change_24h = CASE
    WHEN rank_yesterday IS NULL THEN NULL
    ELSE rank_yesterday - rank_today
  END;

That’s it.

⸻

Where to run it

Pick one of these (both work):

Option 1: Run daily SQL in Supabase (cleanest)

Supabase has scheduled jobs (cron). You schedule a daily job that runs those SQL statements.

Pros: no extra infra, no Python needed
Cons: you need to set up the scheduled job in Supabase

Option 2: Run daily job on your DigitalOcean droplet (simple since you already have it)

Create a second script (or add a mode flag) that runs the 3 SQL steps above using Supabase service key.
Then schedule with cron.

Pros: you already have the VPS flow
Cons: you’re responsible for scheduling/logging

⸻

What I recommend for you (minimal moving parts)
	•	Keep your existing hourly pnl updater as-is.
	•	Add a second script: update_daily_deltas.py
	•	Cron it once per day, e.g. 00:10 Europe/Bucharest (so the “daily pnl” has rolled over).

Example cron:

# every 2 hours: pnl refresh
0 */2 * * * /usr/bin/python3 /root/app/update_pnl.py >> /root/app/logs/pnl.log 2>&1

# daily at 00:10: snapshot + rank + deltas
10 0 * * * /usr/bin/python3 /root/app/update_daily_deltas.py >> /root/app/logs/deltas.log 2>&1


⸻

One subtle but important note about “daily pnl”

Polymarket’s DAY is based on their definition of day (likely UTC).
So your “midnight” should match their reset, not necessarily Bucharest midnight.

If you notice the daily pnl resets at 02:00 your time or something, schedule the daily job right after that reset (easy fix).

⸻

If you want, paste:
	•	what you’re using to schedule on the droplet (cron/systemd/etc),
	•	and what time you observed pnl_daily resetting,

and I’ll tell you the exact best run time + give you a ready-to-run update_daily_deltas.py script.