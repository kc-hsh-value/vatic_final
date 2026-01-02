// app/api/polymarket/leaderboard/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRangeToTimePeriod(range: string) {
  switch (range) {
    case "1D":
      return "day";
    case "1W":
      return "week";
    case "1M":
      return "month";
    default:
      return "all";
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const range = (searchParams.get("range") || "ALL").toUpperCase();

  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const timePeriod = mapRangeToTimePeriod(range);

  const url = new URL("https://data-api.polymarket.com/v1/leaderboard");
  url.searchParams.set("timePeriod", timePeriod);
  url.searchParams.set("user", address);
  url.searchParams.set("category", "overall");

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 },
    headers: { "accept": "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Upstream error ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  // upstream returns array; keep it as-is
  return NextResponse.json(data);
}