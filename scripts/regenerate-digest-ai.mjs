#!/usr/bin/env node
/**
 * CI-side digest AI regeneration (2026-09-02, Rex-approved fix for blank digest).
 *
 * The Worker's DeepSeek call is unreliable (blank headline/summary shipped
 * 2026-08-28 → 09-02). This script runs in CI (no Cloudflare limit) and
 * regenerates the AI fields when the Worker's digest came back empty:
 *   headline / headlineEn / summary / summaryEn / industryHighlights
 * It preserves the Worker's programmatic topTrends (fallback) and date.
 *
 * Requires DEEPSEEK_API_KEY in the environment. No-op when absent or when the
 * digest already has a headline (Worker succeeded) — safe to run every run.
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(__dirname, "..", "public", "api");

const beijingDate = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

async function main() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.log("regenerate-digest-ai: DEEPSEEK_API_KEY not set — skipping");
    process.exit(0);
  }

  const digestPath = join(API_DIR, "digest.json");
  let dig;
  try {
    dig = JSON.parse(readFileSync(digestPath, "utf8"));
  } catch {
    console.log("regenerate-digest-ai: no digest.json found — skipping");
    process.exit(0);
  }

  // Worker already produced a headline → nothing to fix.
  if (dig.headline) {
    console.log(
      "regenerate-digest-ai: digest.headline present (Worker OK) — no-op",
    );
    process.exit(0);
  }

  const today = beijingDate();
  const pick = (arr) =>
    (arr || []).slice(0, 5).map((x) => x.title || x.name).filter(Boolean).join(", ");

  // Pull trending stats from the freshly-fetched files.
  const movies = JSON.parse(readFileSync(join(API_DIR, "movies.json"), "utf8"));
  const tv = JSON.parse(readFileSync(join(API_DIR, "tv.json"), "utf8"));
  // coming.json is the single source of truth for the release calendar the email
  // renders. Without it the AI writes "近期暂无重点待映项目" above a calendar full
  // of dated releases (shipped 2026-11-06/07).
  let coming = { next30Days: [] };
  try { coming = JSON.parse(readFileSync(join(API_DIR, "coming.json"), "utf8")); } catch {}

  const stats = [
    `${pick(movies.releasedThisWeek)}`.length ? `今日/本周电影热作: ${pick(movies.releasedThisWeek)}` : "",
    `${pick(tv.premieresThisWeek)}`.length ? `本周新剧首播: ${pick(tv.premieresThisWeek)}` : "",
    `${pick(tv.ongoing)}`.length ? `热播剧: ${pick(tv.ongoing)}` : "",
    `${pick(tv.upcoming)}`.length ? `待播剧: ${pick(tv.upcoming)}` : "",
    `${pick(movies.upcoming)}`.length ? `待映电影: ${pick(movies.upcoming)}` : "",
    (coming.next30Days || []).length
      ? `排片日历档期: ${(coming.next30Days || []).slice(0, 6).map(x => `${x.title || x.name}（${(x.releaseDate || "").slice(5)}）`).join(", ")}`
      : "",
  ].filter(Boolean).join("; ");

  const prompt = `Today is ${today}. Summarize today's entertainment news in a digest covering BOTH movies and TV series.

Data:
${stats || "(no stats available)"}

Rules — hard constraints:
1. Each highlight must add information the summary does NOT already state. Never repeat or paraphrase a summary sentence as a highlight.
2. Do NOT claim there is nothing upcoming/待映 when 排片日历档期 above is non-empty.
3. Only use titles and dates given above — never invent releases, dates, or numbers.
4. 3-4 highlights, each ≤ 30 Chinese characters.

Return JSON only:
{
  "headline": "One punchy headline in Chinese (max 30 chars)",
  "headlineEn": "Same headline in English",
  "summary": "One paragraph summary in Chinese (max 150 chars), must mention both a movie and a TV highlight",
  "summaryEn": "Same summary in English",
  "industryHighlights": [{ "text": "short highlight in Chinese", "en": "same in English" }]
}`;

  let lastErr = "";
  for (let ai = 0; ai < 4; ai++) {
    if (ai > 0) await new Promise((r) => setTimeout(r, 1500));
    try {
      const r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });
      if (!r.ok) { lastErr = `HTTP ${r.status}`; continue; }
      const dr = await r.json();
      const raw = dr?.choices?.[0]?.message?.content || "";
      const parsed = safeJsonParse(raw);
      if (parsed && parsed.headline && parsed.summary) {
        // Merge: keep Worker's topTrends/date, replace empty AI fields.
        const merged = {
          ...dig,
          headline: parsed.headline,
          headlineEn: parsed.headlineEn || parsed.headline,
          summary: parsed.summary,
          summaryEn: parsed.summaryEn || parsed.summary,
          industryHighlights: Array.isArray(parsed.industryHighlights)
            ? parsed.industryHighlights
            : (dig.industryHighlights || []),
        };
        writeFileSync(digestPath, JSON.stringify(merged, null, 2), "utf8");
        console.log("regenerate-digest-ai: regenerated digest (CI-side, attempt", ai + 1 + ")");
        process.exit(0);
      }
      lastErr = "parse/no-headline";
    } catch (e) { lastErr = e.message; }
  }
  console.log("regenerate-digest-ai: all attempts failed (" + lastErr + ") — keeping Worker digest");
  process.exit(0);
}

function safeJsonParse(s) {
  if (!s) return null;
  try { return JSON.parse(s.replace(/```json|```/g, "").trim()); }
  catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
}

main().catch((e) => {
  console.error("regenerate-digest-ai FATAL:", e.message);
  process.exit(1);
});