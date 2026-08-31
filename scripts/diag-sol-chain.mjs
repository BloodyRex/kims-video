// TMP: reproduce the EXACT trendingCandidates filters on 207333 with real fetched trending data.
// Fetch zh-CN trending 3 pages, take the 207333 item, evaluate each filter + full chain.
const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
const hasCn = (t) => /[\u4e00-\u9fff]/.test(t || "");
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const weekAgo = new Date(Date.now() - 7*86400000).toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"});
const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;
const yearCutoff = 2010, popFloor = 30;
(async () => {
  const all = [];
  for (let p = 1; p <= 3; p++) {
    const r = await fetch(`https://api.themoviedb.org/3/trending/tv/week?page=${p}&language=zh-CN`, h);
    const d = await r.json();
    all.push(...(d.results||[]));
  }
  // dedup like intelFetchPages
  const seen = new Set(); const deduped = [];
  for (const x of all) { if (!x.id) continue; if (seen.has(x.id)) continue; seen.add(x.id); deduped.push(x); }
  const sol = deduped.find(x => x.id === 207333);
  console.log("found 207333 in deduped trending:", !!sol);
  if (!sol) { console.log("NOT FOUND — this is the root cause"); process.exit(0); }
  console.log("\n=== filter evaluation for 207333 ===");
  console.log(`  intelRatingOk(rate=8.03): ${intelRatingOk(sol)}`);
  const yr = Number((sol.first_air_date||"").slice(0,4));
  console.log(`  year ${yr} >= ${yearCutoff}: ${yr >= yearCutoff}`);
  console.log(`  pop ${sol.popularity} >= ${popFloor}: ${(sol.popularity||0) >= popFloor}`);
  const cnf = hasCn(sol.name) && hasCn(sol.overview||"");
  console.log(`  cnFilter: ${cnf}`);
  console.log(`  first_air=${sol.first_air_date} (today=${today}, weekAgo=${weekAgo})`);
  console.log(`  lang=${sol.original_language} origin=${JSON.stringify(sol.origin_country)}`);

  // now simulate the FULL trendingCandidates pipe to see what survives
  const premIds = new Set(); const upIds = new Set(); // empty in real runs for 207333
  const cands = deduped
    .filter(s => !premIds.has(s.id) && !upIds.has(s.id))
    .filter(intelRatingOk)
    .filter(s => Number((s.first_air_date||"").slice(0,4)) >= yearCutoff)
    .filter(s => (s.popularity||0) >= popFloor)
    .filter(hasCn(s => s)); // placeholder
  // (just count passers)
  const passers = deduped
    .filter(s => !premIds.has(s.id) && !upIds.has(s.id))
    .filter(intelRatingOk)
    .filter(s => Number((s.first_air_date||"").slice(0,4)) >= yearCutoff)
    .filter(s => (s.popularity||0) >= popFloor)
    .filter(s => hasCn(s.name) && hasCn(s.overview||""));
  console.log(`\nfull trendingCandidates count (zh-CN, all 4 filters): ${passers.length}`);
  console.log("207333 survived?", passers.some(x=>x.id===207333));
  console.log("survivors:", passers.map(x=>`${x.id}:${x.name.slice(0,18)}`).join(" | "));
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });