"use server";

import { getGeminiClient, getGeminiModelName } from "@/app/KOLwrapped/clients/gemini";
import { z } from "zod";

const VibesSchema = z.object({
  archetype: z.string().max(40),
  vibe: z.array(z.string().max(24)).max(6),
  summary: z.string().max(160),
  tagline: z.string().max(80),
});

function clampStr(s: any, max: number) {
  const str = String(s ?? "");
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function sanitizeVibes(obj: any) {
  if (!obj || typeof obj !== "object") return obj;

  if (obj.archetype) obj.archetype = clampStr(obj.archetype, 40);
  if (obj.tagline) obj.tagline = clampStr(obj.tagline, 80);
  if (obj.summary) obj.summary = clampStr(obj.summary, 160);

  if (Array.isArray(obj.vibe)) {
    obj.vibe = obj.vibe.slice(0, 6).map((v: any) => clampStr(v, 24));
  }

  return obj;
}

export type WrappedVibes = z.infer<typeof VibesSchema>;

function stripCodeFences(s: string) {
  return s.replace(/```json/gi, "```").replace(/```/g, "").trim();
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

export async function judgeVibes(input: {
  xUsername: string;
  twitter: { name?: string; bio?: string; followers?: number; badgeLabel?: string | null };
  polymarket?: { linked: boolean; overall?: { pnl?: number; rank?: string; traded?: number; vol?: number } };
  topTweets: Array<{ text: string; likeCount?: number; createdAt?: string }>;
}) {
  const prompt = `
You are "Vatic Trading KOL Wrapped 2025" judge.
Date: late December 2025.

Tone:
- Crypto-native and enthusiastic (confident, celebratory).
- Still tasteful: terminal / milady / remilio dry cadence. No forced meme-slang.
- Minimal emojis (0–2 total). No hashtags.
- No insults, no harassment, no accusations.

Output MUST be VALID JSON ONLY matching:
{
  "archetype": string (<=40),
  "vibe": string[] (<=6, each <=24),
  "summary": string (<=160),
  "tagline": string (<=80)
}

Core scoring / emphasis (IMPORTANT):
1) If polymarket.linked === true (and any trading history exists: overall.traded > 0 OR topTweets mention trades/markets),
   this is a BIG signal. Even if pnl is low OR even negative, frame it as "active trader", "onchain probabilities", "market participant".
   Prefer positive/status language over neutral.
2) If polymarket overall pnl is high OR rank is strong:
   lean into quant / math / edge:
   archetype ideas: "Prediction Market Quant", "Stat Genius", "Mathpilled Operator", "Probability Engineer", "Edge Seeker".
   vibe ideas: "mathpilled", "EV-maxxing", "stat-brained", "high-signal". ONLY ONE of them at once, not 2 together for the same account
3) If linked but pnl is small/unknown:
   avoid dunking. Make it "early grinder", "hands-on trader", "volume builder", "active participant".
4) If twitter.badgeLabel exists:
   - If recognized (Polymarket Traders/Polymarket/Kalshi Ecosystem/zerosupercycle/Polymarket Sports) reflect it lightly in vibe/summary.
   - If unknown: treat as generic affiliate badge; do NOT guess what it is.
5) If tweets are analytical / explain odds / discuss markets => include "high-signal".
   If tweets are mostly jokes/RTs => include "meme-forward" but keep it classy.

Constraints:
- summary must be <= 160 chars. Keep it one sentence if possible.
- tagline must be <= 80 chars. Snappy. Sounds like a card headline.

Input:
${JSON.stringify(input)}
`.trim();

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: getGeminiModelName() });

  const res = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 250 },
  });

  const raw = stripCodeFences(res.response.text().trim());
  const jsonObj = extractFirstJsonObject(raw);
  if (!jsonObj) throw new Error("LLM did not return JSON");

    const parsed = JSON.parse(jsonObj);
  const sanitized = sanitizeVibes(parsed);
  return VibesSchema.parse(sanitized);
}