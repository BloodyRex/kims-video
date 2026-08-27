// TEMPORARY diagnostic #8 — REAL pipeline faithful sim with zh + detail backfill.
// KEY QUESTION: can 方案A surface 207333 with available subrequest budget (<=50)?
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const intelToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const intelDaysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const hasChinese = (t) => /[一-鿿]/.test(t || "");

function classifyRegion(item) {
  const lang = (item.original_language || "en").toLowerCase();
  if (lang === "zh") { const c = item.origin_country || []; if (c.includes("CN")) return "cn"; if (["TW","HK","MO"].some(x => c.includes(x))) return "hmt"; return "zh"; }
  if (["ja","ko","th","vi","id"].includes(lang)) return lang; return "other";
}
const SCORE = { w_pop: 0.25, w_date: 0.45, w_qual: 0.30, hlPast: 7 };
function compute(item, today, minPop, maxPop, dateSrc) {
  const pop = item.popularity || 0;
  const S_pop = Math.min(100, Math.max(0, ((pop - minPop) / Math.max(maxPop - minPop, 1)) * 100));
  const S_qual = item.vote_average > 0 ? Math.min(100, (item.vote_average / 10) * 100) : 40;
  const dateStr = (dateSrc ? dateSrc(item) : null) || item.first_air_date;
  let S_date = 0;
  if (dateStr) { const now = new Date(today+"T00:00:00"); const rel = new Date(dateStr+"T00:00:00"); const d = Math.abs((now-rel)/86400000); S_date = 100*Math.exp(-Math.LN2/7*d); }
  return (0.25*S_pop + 0.45*S_date + 0.30*S_qual) / 100;
}

async function main() {
  const today = intelToday();
  const t30 = intelDaysAgo(30);
  const t180 = intelDaysAgo(180);
  let budget = 0; // count TMDB subrequests

  // 1) on_the_air (existing) + 2) NEW: last-365d first-air popular (5 pages)
  const pool = []; const seen = new Set();
  for (let p = 1; p <= 2; p++) { budget++; const d = await get(`/tv/on_the_air?page=${p}&language=zh-CN`); for (const s of d.results||[]) { if (!seen.has(s.id)) { seen.add(s.id); pool.push({ ...s, _src: "onair" }); } } }
  const t365 = intelDaysAgo(365);
  for (let p = 1; p <= 5; p++) { budget++; const d = await get(`/discover/tv?first_air_date.gte=${t365}&sort_by=popularity.desc&page=${p}&language=zh-CN`); if (!(d.results||[]).length) break; for (const s of d.results||[]) { if (!seen.has(s.id)) { seen.add(s.id); pool.push({ ...s, _src: "recent" }); } } }
  console.log("pool:", pool.length, "| 207333 in pool:", pool.some(s=>s.id===207333), "at rank", pool.filter(s=>s.id===207333).length ? pool.findIndex(s=>s.id===207333)+1 : "-", "of", pool.length);
  console.log("  (list entry last_episode_to_air present?", !!(pool.find(s=>s.id===207333)?.last_episode_to_air), ")");

  // gate: 2010+, pop>=30, zh title (overview relax: list entry may lack it; use name only like many shows)
  const gated = pool.filter(s => Number((s.first_air_date||"").slice(0,4)) >= 2010 && (s.popularity||0) >= 30 && hasChinese(s.name));
  console.log("gated:", gated.length);

  // 3) rank all gated by CURRENT score (first_air-based) and by a proposed "recent-air" proxy.
  //    Since list entries have no last_episode, propose: feed score with first_air BUT restrict
  //    the NEW-source candidates to those whose FIRST AIR is within ~1y (they're the "recent shows").
  const maxPop = Math.max(...gated.map(m=>m.popularity||0),1); const minPop = Math.min(...gated.map(m=>m.popularity||0),0);
  const cur = gated.map(s => ({ s, score: compute(s, today, minPop, maxPop, null) })).sort((a,b)=>b.score-a.score);
  console.log("207333 CURRENT rank:", cur.findIndex(x=>x.s.id===207333) >= 0 ? cur.findIndex(x=>x.s.id===207333)+1 : "NOT FOUND", "of", cur.length);
  console.log("   (CURRENT top30:", cur.slice(0,30).map(x=>x.s.name).join(" | "),")");

  // 4) KEY: fetch /tv/{id} detail for the first N to get last_episode_to_air, then re-score by last air.
  //    Budget-friendly: only detail-fetch a bounded top set. Show: at what N does 207333 get included?
  const detailFor = async (id) => {
    const det = await get(`/tv/${id}?language=zh-CN`);
    budget++;
    return { ...det, _src: "detail" };
  };
  // Take top 30 by current score, detail them, re-score with last_episode.air_date
  const top30 = cur.slice(0, 30).map(x => x.s);
  const detailed = [];
  for (const s of top30) { const d = await detailFor(s.id); detailed.push(d); }
  const maxPop2 = Math.max(...detailed.map(m=>m.popularity||0),1); const minPop2 = Math.min(...detailed.map(m=>m.popularity||0),0);
  const recent = detailed.map(s => ({ s, score: compute(s, today, minPop2, maxPop2, (it)=>it.last_episode_to_air?.air_date || it.first_air_date) })).sort((a,b)=>b.score-a.score);
  console.log("\nAfter detail backfill + last-air scoring, 207333 rank:", recent.findIndex(x=>x.s.id===207333) >= 0 ? recent.findIndex(x=>x.s.id===207333)+1 : "NOT in top30");
  if (recent.some(x=>x.s.id===207333)) console.log("  207333 in selected set with season:", recent.find(x=>x.s.id===207333).s.last_episode_to_air?.season_number);
  console.log("  recent-scored top15:", recent.slice(0,15).map(x=>x.s.name).join(" | "));
  console.log("\n  total subrequests used:", budget, "(budget 50)");

  // 5) If 207333 not in top-30-of-136, how deep must we go? Show its popularity vs neighbors.
  const byPop = gated.slice().sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  const idx = byPop.findIndex(s=>s.id===207333);
  console.log("\nBy popularity among gated:", idx+1, "of", gated.length, "| pop list around it:", byPop.slice(Math.max(0,idx-2), idx+3).map(s=>`${s.name}(${s.popularity.toFixed(0)})`).join(" "));
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
