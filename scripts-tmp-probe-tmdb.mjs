// TEMPORARY diagnostic #13 — GENERIC "recently-updated season" recovery across ALL platforms.
// Approach: pull a global popular TV pool (no network filter), then detail-backfill each to
// get last_episode_to_air.air_date, keep shows whose LATEST SEASON aired within N days.
// Measure: subrequest budget, whether 207333 qualifies, and what the pool looks like.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");
let budget = 0;

async function main() {
  const todayUTC = new Date();
  const daysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); };
  const t90 = daysAgo(90);

  // 1) Global popular-TV pool from discover (no network, no date window) — how big is the
  //    "recently-aired" tail? Use popularity.desc, several pages.
  const pool = []; const seen = new Set();
  for (let p = 1; p <= 4; p++) {
    budget++;
    const q = await get(`/discover/tv?sort_by=popularity.desc&page=${p}&language=zh-CN`);
    if (!(q.results||[]).length) break;
    for (const s of q.results||[]) { if (!seen.has(s.id)) { seen.add(s.id); pool.push(s); } }
  }
  console.log("global pool (4 pages):", pool.length, "budget:", budget);
  console.log("  has last_episode in list?", !!(pool.find(s=>s.id===207333)||pool[0]).last_episode_to_air);

  // 2) Detail-backfill the pool to read last_episode_to_air.air_date
  const detailed = [];
  for (const s of pool) {
    budget++;
    const det = await get(`/tv/${s.id}?language=zh-CN`);
    detailed.push(det);
  }
  console.log("detailed:", detailed.length, "| total budget now:", budget);

  // 3) Latest-season recency filter: last_episode_to_air.air_date within 90d
  const recent = detailed.filter(s => {
    const la = s.last_episode_to_air?.air_date;
    return la && la >= t90 && hasChinese(s.name) && hasChinese(s.overview) && (s.popularity||0)>=30;
  });
  console.log("\n[GENERIC recently-concluded (last ep in 90d, zh, pop>=30)]:", recent.length);
  recent.forEach(s => console.log(`  ${s.name} | last=${s.last_episode_to_air?.air_date} S${s.last_episode_to_air?.season_number} | pop=${Math.round(s.popularity)}`));
  console.log("  207333 included?", recent.some(s=>s.id===207333));

  // 4) Show what this WOULD have caught (any major recent whole-season drops across platforms)
  console.log("\n  ...all detailed shows' last-episode dates (top 25):");
  detailed.slice(0,25).forEach(s => {
    const la = s.last_episode_to_air?.air_date || "N/A";
    const label = la !== "N/A" && la >= t90 ? "🔴RECENT" : "";
    console.log(`    ${s.name} | last=${la} S${s.last_episode_to_air?.season_number||"?"} | pop=${Math.round(s.popularity||0)} ${label}`);
  });

  console.log("\n  FINAL total budget for full pool detail-backfill:", budget);
  console.log("  Worker limit is ~50 subrequests. Existing handler uses ~20-30 (on_air×2 + discover + trending + tvmaze).");
  console.log("  So a 20-title detail backfill ≈ +20 → likely EXCEEDS budget. Must cap backfill.");

  // 5) Alternative: only detail the pool that passed cheap gates (zh+pop) FIRST, reducing backfills
  const cheapGate = pool.filter(s => hasChinese(s.name) && (s.popularity||0)>=30);
  console.log("\n   cheap-gated (zh title + pop>=30) WITHOUT detail:", cheapGate.length, "of", pool.length);
  console.log("   → Only detail these (saves subrequests). Budget =", cheapGate.length, "backfills.");
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });