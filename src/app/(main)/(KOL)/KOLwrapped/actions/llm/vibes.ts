"use server";

import { getGeminiClient, getGeminiModelName } from "@/app/(main)/(KOL)/KOLwrapped/clients/gemini";
import { z } from "zod";

const VibesSchema = z.object({
  archetype: z.string().max(40),
  vibe: z.array(z.string().max(24)).max(6),
  summary: z.string().max(280),
  tagline: z.string().max(160),
});

function clampStr(s: any, max: number) {
  const str = String(s ?? "");
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function sanitizeVibes(obj: any) {
  if (!obj || typeof obj !== "object") return obj;

  if (obj.archetype) obj.archetype = clampStr(obj.archetype, 40);
  if (obj.tagline) obj.tagline = clampStr(obj.tagline, 160);
  if (obj.summary) obj.summary = clampStr(obj.summary, 280);

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
const VIBE_LEXICON = [
  // signal / analysis
  "high-signal", "research-coded", "terminal-brained", "thesis poster",
  "probability-first", "market-literate", "data-forward", "macro-aware",
  "risk-managed", "edge-hunting", "conviction-sized", "positioning",
  "execution-focused", "book-aware", "flow-reader", "precision",

  // trader personality
  "EV-positive", "odds enjoyer", "spreadsheet demon", "variance-tolerant",
  "calm operator", "quiet confidence", "clip farmer", "fast hands",
  "tape-watching", "orderbook instincts", "size discipline",

  // prediction market native
  "probability-pilled", "market mechanic", "resolver lore", "oracle enjoyer",
  "settlement aware", "arb sniffing", "yes/no maximalist", "line shopper",

  // culture / aesthetic (tasteful)
  "remilio-adjacent", "milady-coded", "clean edge",
  "dry cadence", "post-meme", "noisy but sharp", "low-emoji",
];

const prompt = `
You are "Vatic Trading KOL Wrapped 2025" judge.
Date: late December 2025.

Tone:
- Crypto-native and enthusiastic (confident, celebratory).
- Still tasteful: milady / remilio dry cadence.
- Minimal emojis (0–2 total). No hashtags.
- No insults, no harassment, no accusations.

Output MUST be VALID JSON ONLY matching:
{
  "archetype": string (<=40),
  "vibe": string[] (<=6, each <=24),
  "summary": string (<=280),
  "tagline": string (<=160)
}

Vibe selection rules (IMPORTANT):
- Choose 4–6 vibe words.
- They must be DISTINCT (no synonyms like "high-signal" + "research-coded" together).
- Prefer picking from this lexicon, but you may add up to 2 original ones if they fit the user.
- Avoid repeating the same vibe across users; be specific to the input.

Vibe lexicon:
${JSON.stringify(VIBE_LEXICON)}

Core scoring / emphasis (IMPORTANT):
1) If polymarket.linked === true and trading history exists => BIG signal (positive framing even if pnl low/negative). If
negative pnl, don't mention it's negative: focus on the fact that even participation in the markets is something 
bold, courageous, and rare among KOLs. The pnl can be found in polymarket.overall.pnl. if it has (-) sign, it's negative e.g.
-2500.
2) If pnl is high OR rank strong => lean quant/math/edge ("Prediction Market Quant", "Probability Engineer", etc).
3) If linked but pnl small/unknown => "active participant", "hands-on trader".
4) BadgeLabel: recognized ones ok; unknown => generic.
5) Analytical tweets => include ONE signal vibe.
6) Avoid using the word "terminal" a lot.

Constraints:
- summary <=280, 1 sentence.
- tagline <=160, card headline.

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