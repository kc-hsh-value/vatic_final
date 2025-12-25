"use client";

import { useMemo, useState } from "react";
import { generateWrapped } from "./lib/generate-wrapped";
import type { WrappedResult } from "./types";
import { judgeVibes, type WrappedVibes } from "./actions/twitter/llm/vibes";
import { toPng } from "html-to-image";
import { useRef } from "react";

function fmtNumber(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtMoney(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  // keep it readable in a card
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function yearFromCreatedAt(createdAt?: string) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

function pickTopTweet(tweets: any[]) {
  if (!Array.isArray(tweets) || tweets.length === 0) return null;

  // Prefer 2025 tweets, fallback to anything
  const in2025 = tweets.filter((t) => yearFromCreatedAt(t.createdAt) === 2025);
  const pool = in2025.length ? in2025 : tweets;

  // Score = views + 100*likes + 150*retweets (tweak later)
  const score = (t: any) =>
    (t.viewCount ?? 0) +
    100 * (t.likeCount ?? 0) +
    150 * (t.retweetCount ?? 0);

  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
}
function pickTopTweetsByLikes(tweets: any[], n = 3) {
  if (!Array.isArray(tweets) || tweets.length === 0) return [];

  const year = (createdAt?: string) => {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
  };

  const in2025 = tweets.filter((t) => year(t.createdAt) === 2025);
  const pool = in2025.length ? in2025 : tweets;

  return [...pool]
    .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
    .slice(0, n);
}
export default function KolWrappedPage() {
  const [xUsername, setXUsername] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WrappedResult["result"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vibes, setVibes] = useState<WrappedVibes | null>(null);
  const [stage, setStage] = useState<string>("");


  const cardRef = useRef<HTMLDivElement | null>(null);
  const normalized = useMemo(() => {
    const s = xUsername.trim();
    if (!s) return "";
    return s.startsWith("@") ? s.slice(1).trim() : s;
  }, [xUsername]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) return;

    setSubmitted(normalized);
    setLoading(true);
    setError(null);
    setData(null);

    try {
      setStage("Fetching data...");
      const res = await generateWrapped(normalized);
      setData(res.result);

      setStage("Judging vibes...");
      const profile = res.result.twitter.profile;
      const tweets = res.result.twitter.tweets ?? [];
      const top3 = pickTopTweetsByLikes(tweets, 3).map((t) => ({
        text: String(t.text ?? "").slice(0, 420),
        likeCount: t.likeCount ?? 0,
        createdAt: t.createdAt ?? "",
      }));

      const judged = await judgeVibes({
        xUsername: normalized,
        twitter: {
          name: profile?.name,
          bio: profile?.bio,
          followers: profile?.followers,
          badgeLabel: profile?.badge?.description ?? null,
        },
        polymarket: res.result.polymarket,
        topTweets: top3,
      });

      setVibes(judged);
      setStage("");
    } catch (err: any) {
      setError(err?.message ? String(err.message) : "Failed to generate wrapped.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPng() {
    if (!cardRef.current) return;
    const dataUrl = await toPng(cardRef.current, {
      cacheBust: true,
      pixelRatio: 2, // crisp
    });

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `vatic-kol-wrapped-${submitted ?? "user"}.png`;
    a.click();
  }

  function tweetIntentUrl() {
    const text = `Vatic Trading KOL Wrapped 2025 — @${submitted ?? ""}\n\nvatic.trading`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  }

  const profile = data?.twitter?.profile;
  const tweets = data?.twitter?.tweets ?? [];
  const pm = data?.polymarket;

  const topTweet = useMemo(() => pickTopTweet(tweets), [tweets]);
  const topTweets = useMemo(() => pickTopTweetsByLikes(tweets, 3), [tweets]);

  return (
    <main style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
        KOL Wrapped
      </h1>

      <form onSubmit={onSubmit} style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={xUsername}
          onChange={(e) => setXUsername(e.target.value)}
          placeholder="Enter X username (e.g. tenad0me)"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            fontSize: 14,
          }}
        />

        <button
          type="submit"
          disabled={!normalized || loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: !normalized || loading ? "#eee" : "#111",
            color: !normalized || loading ? "#777" : "#fff",
            cursor: !normalized || loading ? "not-allowed" : "pointer",
            fontSize: 14,
            minWidth: 110,
          }}
        >
          {loading ? "Working..." : "Generate"}
        </button>
      </form>

      {submitted && (
        <div style={{ marginTop: 12, fontSize: 14, color: "#333" }}>
          Selected user: <strong>@{submitted}</strong>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #f3b4b4",
            background: "#fff5f5",
            color: "#7a1c1c",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* CARD */}
      {data && (
        <section
          style={{
            marginTop: 18,
            borderRadius: 18,
            border: "1px solid #e5e5e5",
            background: "#0b0b0d",
            color: "#fff",
            padding: 18,
            boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          }}
          ref={cardRef}
        >
          {/* Header */}
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                overflow: "hidden",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                flex: "0 0 auto",
              }}
            >
              {profile?.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profilePicture}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Vatic Trading · KOL Wrapped 2025</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: "-0.02em" }}>
                  {profile?.name ?? `@${data.input.xUsername}`}
                </div>
                <div style={{ fontSize: 14, opacity: 0.75 }}>@{data.input.xUsername}</div>
              </div>

              {/* Badge row */}
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {profile?.badge?.description ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      fontSize: 12,
                      opacity: 0.95,
                    }}
                  >
                    {profile?.badge?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.badge.imageUrl}
                        alt=""
                        style={{ width: 16, height: 16, borderRadius: 4 }}
                      />
                    ) : null}
                    {profile.badge.description}
                  </span>
                ) : null}

                {profile?.isBlueVerified ? (
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      background: "rgba(0,180,255,0.12)",
                      border: "1px solid rgba(0,180,255,0.25)",
                      fontSize: 12,
                    }}
                  >
                    Verified
                  </span>
                ) : null}
              </div>

              {/* vibes */}
              {vibes ? (
                <div style={{ marginTop: 10, opacity: 0.92 }}>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>Vibe check</div>
                  <div style={{ fontSize: 18, fontWeight: 650, marginTop: 4 }}>{vibes.tagline}</div>
                  <div style={{ fontSize: 13, marginTop: 6, opacity: 0.85 }}>{vibes.summary}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 12 }}>
                      {vibes.archetype}
                    </span>
                    {vibes.vibe.map((v) => (
                      <span key={v} style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", fontSize: 12 }}>
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Twitter stats */}
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>Twitter</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {[
                { label: "Followers", value: fmtNumber(profile?.followers) },
                { label: "Following", value: fmtNumber(profile?.following) },
                { label: "Posts", value: fmtNumber(profile?.statusesCount) },
                { label: "Tweets fetched", value: fmtNumber(tweets.length) },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    borderRadius: 14,
                    padding: 12,
                    background: "rgba(0,0,0,0.22)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 650, marginTop: 4 }}>{s.value}</div>
                </div>
              ))}
            </div>
            {topTweets.length > 0 ? (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Top tweets (by likes)</div>

                {topTweets.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,0.22)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>
                      {String(t.text ?? "").slice(0, 260)}
                      {String(t.text ?? "").length > 260 ? "…" : ""}
                    </div>

                    <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, opacity: 0.75 }}>
                      <span>❤️ {fmtNumber(t.likeCount)}</span>
                      <span>🔁 {fmtNumber(t.retweetCount)}</span>
                      <span>💬 {fmtNumber(t.replyCount)}</span>
                      <span>👀 {fmtNumber(t.viewCount)}</span>
                      {t.url ? (
                        <a href={t.url} target="_blank" rel="noreferrer" style={{ color: "rgba(120,200,255,0.95)", textDecoration: "none" }}>
                          View →
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {/* {topTweet ? (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(0,0,0,0.22)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                  Top tweet (by engagement)
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>
                  {String(topTweet.text ?? "").slice(0, 320)}
                  {String(topTweet.text ?? "").length > 320 ? "…" : ""}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, opacity: 0.75 }}>
                  <span>❤️ {fmtNumber(topTweet.likeCount)}</span>
                  <span>🔁 {fmtNumber(topTweet.retweetCount)}</span>
                  <span>💬 {fmtNumber(topTweet.replyCount)}</span>
                  <span>👀 {fmtNumber(topTweet.viewCount)}</span>
                  {topTweet.url ? (
                    <a
                      href={topTweet.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "rgba(120,200,255,0.95)", textDecoration: "none" }}
                    >
                      View →
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null} */}
          </div>

          {/* Polymarket stats */}
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 16,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>Polymarket</div>

            {!pm?.linked ? (
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                No linked Polymarket address found for this handle.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {[
                    { label: "PnL", value: fmtMoney(pm.overall?.pnl) },
                    { label: "Rank", value: pm.overall?.rank ? `#${pm.overall.rank}` : "—" },
                    { label: "Volume", value: fmtMoney(pm.overall?.vol) },
                    { label: "Markets", value: fmtNumber(pm.overall?.traded) },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        borderRadius: 14,
                        padding: 12,
                        background: "rgba(0,0,0,0.22)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{s.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 650, marginTop: 4 }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {Array.isArray(pm.topMarkets2025) && pm.topMarkets2025.length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
                      Top markets (2025)
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {pm.topMarkets2025.slice(0, 5).map((m) => (
                        <div
                          key={m.conditionId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "baseline",
                            borderRadius: 12,
                            padding: "10px 12px",
                            background: "rgba(0,0,0,0.22)",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <div style={{ fontSize: 13, opacity: 0.95, flex: 1 }}>
                            {m.title}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 650 }}>
                            {fmtMoney(m.realizedPnl)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* download buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button
              onClick={downloadPng}
              disabled={!data}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                cursor: !data ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              Download PNG
            </button>

            <a
              href={tweetIntentUrl()}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Tweet (attach PNG)
            </a>

            <span style={{ fontSize: 12, opacity: 0.65, alignSelf: "center" }}>
              Download → Tweet → attach image (X doesn’t allow auto-attaching via link).
            </span>
          </div>

          {/* Footer */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", opacity: 0.7, fontSize: 11 }}>
            <span>Generated {new Date(data.debug.fetchedAtIso).toUTCString()}</span>
            <span>vatic.trading</span>
          </div>
        </section>
      )}
    </main>
  );
}