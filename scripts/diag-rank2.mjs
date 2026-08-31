// TMP v2: export the score/select functions from worker source, then rank 207333.
import { readFileSync } from "fs";
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => origFetch(url, opts);
globalThis.caches = { default: { match: async () => null, put: async () => {}, delete: async () => {} } };
const src = readFileSync(new URL("../workers-1.4.js", import.meta.url), "utf8");
// append exports at end
const src2 = src + "\n;export { intelSelectDiverse, intelComputeScore };";
const mod = await import("data:text/javascript," + encodeURIComponent(src2));
const { intelSelectDiverse, intelComputeScore } = mod;
const h = { headers: { Authorization: `Bearer ${process.env.TMDB}`, "Content-Type": "application/json" } };
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
  const survivors = deduped
    .filter(s => !(new Set([])).has(s.id))
    .filter(intelRatingOk)
    .filter(s => Number((s.first_air_date || "").slice(0, 4)) >= 2010)
    .filter(s => (s.popularity || 0) >= 30)
    .filter(s => hasCn(s.name) && hasCn(s.overview || ""));
  survivors.forEach(s => { s._trendingOnly = true; if (!s.release_date) s.release_date = "2026-08-31"; });
  const scoreOpts = { w_pop: 0.25, w_date: 0.45, w_qual: 0.30, hlFuture: 14, hlPast: 7 };
  const today = "2026-08-31";
  const maxPop = Math.max(...survivors.map(m => m.popularity || 0), 0);
  const minPop = Math.min(...survivors.map(m => m.popularity || 0), 0);
  const scored = survivors.map(m => {
    const r = intelComputeScore(m, scoreOpts, today, minPop, maxPop);
    return { id: m.id, name: m.name, score: r.score, S_pop: r.S_pop, S_date: r.S_date, S_qual: r.S_qual, pop: m.popularity };
  }).sort((a, b) => b.score - a.score);
  console.log("survivors:", survivors.length, "| FULL ranking:");
  scored.forEach((s, i) => {
    const mark = s.id === 207333 ? ">>> " : "    ";
    console.log(`${mark}${String(i + 1).padStart(2)} | ${String(s.name).slice(0, 20).padEnd(20)} | sc=${s.score.toFixed(3)} pop=${Math.round(s.pop)} S_p${s.S_pop.toFixed(0)} S_d${s.S_date.toFixed(0)} S_q${s.S_qual.toFixed(0)}`);
  });
  const sr = scored.findIndex(x => x.id === 207333) + 1;
  console.log(`\n>>> 207333 rank=${sr} ${sr <= 10 ? "← IN TOP10" : "← OUTSIDE TOP10 (this is why not selected)"}`);
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });