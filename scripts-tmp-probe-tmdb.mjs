// TEMPORARY diagnostic #7 — FINAL end-to-end simulation of 方案A:
// Add "recently-airing shows" source (first_air wide window + popularity sort + deep pages)
// AND fix S_date to use last_episode_to_air.air_date when it's newer.
// Verify 207333 ranks into ongoing top-10 → tvwall.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const intelToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const intelDaysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

// ---- mirror workers-1.4.js scoring ----
function intelComputeScore(item, opts, today, batchMinPop, batchMaxPop, dateSource) {
  const { w_pop = 0.25, w_date = 0.45, w_qual = 0.30, hlPast = 7 } = opts || {};
  const pop = item.popularity || 0;
  const popRange = Math.max(batchMaxPop - batchMinPop, 1);
  const S_pop = Math.min(100, Math.max(0, ((pop - batchMinPop) / popRange) * 100));
  let S_qual;
  if (item.vote_average > 0) S_qual = Math.min(100, Math.max(0, (item.vote_average / 10) * 100));
  else if ((item.vote_count || 0) > 0) S_qual = 50; else S_qual = 40;
  const dateStr = item[dateSource] || item.first_air_date;
  let S_date = 0;
  if (dateStr) {
    const now = new Date(today + "T00:00:00");
    const rel = new Date(dateStr + "T00:00:00");
    const daysUntil = (rel - now) / 86400000;
    S_date = 100 * Math.exp(-Math.LN2 / hlPast * Math.abs(daysUntil));
  }
  return { score: (w_pop * S_pop + w_date * S_date + w_qual * S_qual) / 100, S_pop, S_date, S_qual };
}
function classifyRegion(item) {
  const lang = (item.original_language || "en").toLowerCase();
  if (lang === "zh") { const c = item.origin_country || []; if (c.includes("CN")) return "cn"; if (["TW","HK","MO"].some(x => c.includes(x))) return "hmt"; return "zh"; }
  if (["ja","ko","th","vi","id"].includes(lang)) return lang; return "other";
}
function intelSelectDiverse(items, count, reserved, opts, today, dateSource) {
  if (items.length <= count) return items;
  const maxPop = Math.max(...items.map(m => m.popularity || 0), 0);
  const minPop = Math.min(...items.map(m => m.popularity || 0), 0);
  const scored = items.map(m => ({ item: m, region: classifyRegion(m), score: intelComputeScore(m, opts, today, minPop, maxPop, dateSource).score, mainGenre: (m.genre_ids || [])[0] }));
  scored.sort((a, b) => b.score - a.score);
  const reservedItems = {}; const pool = [];
  for (const s of scored) { const region = s.region; const slots = reserved[region] || 0; if (slots > 0 && !reservedItems[region]) reservedItems[region] = []; if (slots > 0 && reservedItems[region].length < slots) { reservedItems[region].push(s); continue; } pool.push(s); }
  const result = []; for (const r of Object.values(reservedItems)) result.push(...r);
  const genreCount = {};
  for (const s of pool) { if (result.length >= count) break; const g = s.mainGenre; if (g && (genreCount[g] || 0) >= 4) continue; genreCount[g] = (genreCount[g] || 0) + 1; result.push(s); }
  return result.sort((a, b) => b.score - a.score).slice(0, count).map(s => s.item);
}
const SCORE = { w_pop: 0.25, w_date: 0.45, w_qual: 0.30, hlPast: 7 };

async function main() {
  const today = intelToday();
  const t30 = intelDaysAgo(30);
  const t90 = intelDaysAgo(90);
  const t365 = intelDaysAgo(365);
  const twoY = "2024-06-01"; // wide first-air window
  const hasChinese = (t) => /[一-鿿]/.test(t || "");
  const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;

  console.log("today:", today);

  // Build the AUGMENTED pool: on_the_air(2p) + "recent/active shows" = first_air>=2024-06 & pop desc, 5 pages
  const pool = [];
  const seen = new Set();
  const pushU = (list, tag) => { for (const s of list || []) { if (seen.has(s.id)) continue; seen.add(s.id); pool.push({ ...s, _src: tag }); } };

  for (let p = 1; p <= 2; p++) pushU((await get(`/tv/on_the_air?page=${p}`)).results, "onair");
  for (let p = 1; p <= 5; p++) pushU((await get(`/discover/tv?first_air_date.gte=${twoY}&sort_by=popularity.desc&page=${p}`)).results, "recent");

  console.log("raw pool:", pool.length);
  const p207 = pool.filter(x => x.id === 207333).map(x => `_src=${x._src} pop=${x.popularity.toFixed(1)} va=${x.vote_average} last=${x.last_episode_to_air?.air_date}`);
  console.log("207333 in pool:", p207.length ? JSON.stringify(p207) : "NO");

  // Apply ongoing gates (mirror handleIntelTV)
  const qualified = pool.filter(s =>
    !Number.isNaN(Number((s.first_air_date || "").slice(0, 4))) &&
    Number((s.first_air_date || "").slice(0, 4)) >= 2010 &&
    (s.popularity || 0) >= 30 &&
    hasChinese(s.name) && hasChinese(s.overview) &&
    intelRatingOk(s)
  );
  console.log("qualified:", qualified.length);

  // tier1 := recent activity: last episode in 30d OR premiered in 180d
  const t180 = intelDaysAgo(180);
  const tier1 = qualified.filter(s => {
    const la = s.last_episode_to_air?.air_date || "";
    return (la && la >= t30) || ((s.first_air_date || "") >= t180);
  });
  const tier2 = qualified.filter(s => !tier1.includes(s));
  console.log("tier1:", tier1.length, "tier2:", tier2.length, "| 207333 in tier1:", tier1.some(s => s.id === 207333));

  // CURRENT scoring (dateSource=first_air_date) — expect 207333 to MISS
  const selOld = [
    ...intelSelectDiverse(tier1, 10, { cn: 1, hmt: 1, jp: 1, kr: 1 }, SCORE, today, "first_air_date"),
    ...intelSelectDiverse(tier2, 5, { cn: 1, hmt: 1, jp: 1, kr: 1 }, SCORE, today, "first_air_date"),
  ].slice(0, 15);
  console.log("\n[CURRENT scoring] 207333 selected?", selOld.some(s => s.id === 207333), "| top8:", selOld.slice(0, 8).map(s => s.name));

  // NEW scoring (dateSource=last_episode_to_air.air_date, fallback first_air_date)
  const lastAirDate = (s) => s.last_episode_to_air?.air_date || s.first_air_date;
  const selNew = [
    ...intelSelectDiverse(tier1, 10, { cn: 1, hmt: 1, jp: 1, kr: 1 }, SCORE, today, lastAirDate),
    ...intelSelectDiverse(tier2, 5, { cn: 1, hmt: 1, jp: 1, kr: 1 }, SCORE, today, lastAirDate),
  ].slice(0, 15);
  console.log("[NEW scoring] 207333 selected?", selNew.some(s => s.id === 207333));
  if (selNew.some(s => s.id === 207333)) {
    const me = selNew.find(s => s.id === 207333);
    console.log("  207333 ranked #", selNew.indexOf(me) + 1, "of", selNew.length);
    const sc = intelComputeScore(me, SCORE, today, Math.min(...qualified.map(m => m.popularity || 0)), Math.max(...qualified.map(m => m.popularity || 0)), lastAirDate);
    console.log("  S_pop:", sc.S_pop.toFixed(1), "S_date:", sc.S_date.toFixed(1), "S_qual:", sc.S_qual.toFixed(1), "score:", sc.score.toFixed(4), "| last_air:", lastAirDate(me));
  }
  console.log("[NEW] top12:", selNew.slice(0, 12).map(s => `${s.name}(#${selNew.indexOf(s) + 1})`));

  // would it carry the S/E needed by tvwall? season from last_episode_to_air
  const me = selNew.find(s => s.id === 207333);
  if (me) console.log("\ntvwall entry would carry: tmdbId=207333 season=", me.last_episode_to_air?.season_number, "episode=", me.last_episode_to_air?.episode_number, "latestAirDate=", me.last_episode_to_air?.air_date);
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
