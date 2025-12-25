import { NextResponse } from "next/server";

const ALLOW_HOSTS = new Set(["pbs.twimg.com"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return new NextResponse("Bad url", { status: 400 });
  }

  if (!ALLOW_HOSTS.has(u.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  const upstream = await fetch(u.toString(), {
    // Twitter sometimes behaves better with a UA
    headers: { "User-Agent": "Mozilla/5.0 VaticWrapped/1.0" },
    // cache is fine, these are public avatars/badges
    cache: "force-cache",
  });

  if (!upstream.ok) {
    return new NextResponse(`Upstream failed: ${upstream.status}`, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const buf = await upstream.arrayBuffer();

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}