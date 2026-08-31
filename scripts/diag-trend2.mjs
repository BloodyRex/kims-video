// TMP clean: does zh-CN trending/tv/week pages 1-3 contain 207333 RIGHT NOW?
// Print all CN-named items + whether 207333 is in each page (worker fetches zh-CN).
const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
const hasCn = (t) => /[\u4e00-\u9fff]/.test(t || "");
(async () => {
  const solId = 207333;
  const all = [];
  for (let p = 1; p <= 3; p++) {
    const r = await fetch(`https://api.themoviedb.org/3/trending/tv/week?page=${p}&language=zh-CN`, h);
    const d = await r.json();
    const rows = d.results || [];
    const sol = rows.find(x => x.id === solId);
    const cnRows = rows.filter(x => hasCn(x.name));
    console.log(`page ${p}: ${rows.length} items | contains207333=${!!sol} | cn-named=${cnRows.length}`);
    if (sol) {
      console.log(`   >>> 207333 ${JSON.stringify(sol.name)} pop=${Math.round(sol.popularity)} rate=${sol.vote_average} cnName=${hasCn(sol.name)} cnOv=${hasCn(sol.overview||"")} firstAir=${sol.first_air_date} hasLe=${!!sol.last_episode_to_air}`);
    }
    cnRows.forEach(x => { all.push(x.id); if (x.id !== solId) console.log(`      cn: ${x.id} | ${String(x.name).slice(0,24)} | pop${Math.round(x.popularity)}`); });
  }
  console.log("\nDISTINCT cn-named ids across 3 pages:", all.length, new Set(all).size);
  console.log("\n>>> 207333 present in zh-CN trending pages 1-3:", all.includes(solId) ? "YES" : "NO");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });