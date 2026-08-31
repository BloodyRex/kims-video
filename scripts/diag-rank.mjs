// TMP: simulate tier1 intelSelectDiverse on real trending survivors; where does 207333 rank?
import { readFileSync } from "fs";
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => origFetch(url, opts);
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
const env = { TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB, DISCOVER_KV: null, SUBSCRIBE_KV: null };
await import("data:text/javascript," + encodeURIComponent(src));

// Rebuild the 44 trending survivors using real API (same as diag-sol-chain2)
const h = { headers: { Authorization: `Bearer ${env.TMDB_API_READ_ACCESS_TOKEN}`, "Content-Type": "application/json" } };
const hasCn = (t) => /[\u4e00-\u9fff]/.test(t || "");
const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;
(async () => {
  const all = [];
  for (let p = 1; p <= 3; p++) {
    const r = await fetch(`https://api.themoviedb.org/3/trending/tv/week?page=${p}&language=zh-CN`, h);
    const d = await r.json();
    all.push(...(d.results || []));
  }
  const seen = new Set(); const deduped = [];
  for (const x of all) { if (!x.id || seen.has(x.id)) continue; seen.add(x.id); deduped.push(x); }
  const premIds = new Set(), upIds = new Set();
  const survivors = deduped
    .filter(s => !premIds.has(s.id) && !upIds.has(s.id))
    .filter(intelRatingOk)
    .filter(s => Number((s.first_air_date || "").slice(0, 4)) >= 2010)
    .filter(s => (s.popularity || 0) >= 30)
    .filter(s => hasCn(s.name) && hasCn(s.overview || ""));
  survivors.forEach(s => { s._trendingOnly = true; if (!s.release_date) s.release_date = "2026-08-31"; });

  // scoreOpts TV, tier1=10, reserve all 0 (current)
  const scoreOpts = { w_pop: 0.25, w_date: 0.45, w_qual: 0.30, hlFuture: 14, hlPast: 7 };
  const today = "2026-08-31";
  const selected = globalThis.intelSelectDiverse(survivors, 10, { cn: 0, hmt: 0, jp: 0, kr: 0 }, scoreOpts, today);
  console.log("tier1 selected count:", selected.length);
  // print ranks: full sorted score + position of 207333
  const maxPop = Math.max(...survivors.map(m => m.popularity || 0), 0);
  const minPop = Math.min(...survivors.map(m => m.popularity || 0), 0);
  const scored = survivors.map(m => {
    const r = globalThis.intelComputeScore(m, scoreOpts, today, minPop, maxPop);
    return { id: m.id, name: m.name, score: r.score, S_pop: r.S_pop, S_date: r.S_date, S_qual: r.S_qual, pop: m.popularity };
  }).sort((a, b) => b.score - a.score);
  console.log("\nFULL tier1 ranking (score desc):");
  scored.forEach((s, i) => {
    const mark = s.id === 207333 ? ">>> " : "    ";
    console.log(`${mark}${String(i + 1).padStart(2)} | ${String(s.name).slice(0, 20).padEnd(20)} | score=${s.score.toFixed(3)} | pop=${Math.round(s.pop)} | S_p${s.S_pop.toFixed(0)} S_d${s.S_date.toFixed(0)} S_q${s.S_qual.toFixed(0)}`);
  });
  const solRank = scored.findIndex(x => x.id === 207333) + 1;
  console.log(`\n>>> 207333 rank in tier1 = ${solRank}${solRank <= 10 ? " (IN TOP 10 → selected)" : " (OUTSIDE TOP 10 → dropped)"}`);
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });