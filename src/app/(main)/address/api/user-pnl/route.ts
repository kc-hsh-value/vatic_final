// app/api/polymarket/user-pnl/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRangeToParams(range: string) {
  // Your proposed mapping:
  // daily: interval=1d&fidelity=1h
  // weekly: interval=1w&fidelity=1h
  // monthly: interval=1m&fidelity=1h
  // all: interval=all&fidelity=3h
  switch (range) {
    case "1D":
      return { interval: "1d", fidelity: "1h" };
    case "1W":
      return { interval: "1w", fidelity: "3h" };
    case "1M":
      return { interval: "1m", fidelity: "18h" };
    default:
      return { interval: "all", fidelity: "12h" };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  const range = (searchParams.get("range") || "ALL").toUpperCase();

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const { interval, fidelity } = mapRangeToParams(range);

  const url = new URL("https://user-pnl-api.polymarket.com/user-pnl");
  url.searchParams.set("user_address", address);
  url.searchParams.set("interval", interval);
  url.searchParams.set("fidelity", fidelity);

  const res = await fetch(url.toString(), {
    // light caching is fine; this is not super high-stakes realtime
    next: { revalidate: 60 },
    headers: { "accept": "application/json" },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Upstream error ${res.status}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}