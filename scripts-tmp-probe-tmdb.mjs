// TEMPORARY diagnostic #15 — reproduce handleIntelTV ongoing filter chain to find
// why ongoing=0 after my change. Replicates exact logic and prints pool sizes at
// each filter stage.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

async function main() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");
  const cnFilter = (s) => hasChinese(s.title || s.name) && hasChinese(s.overview);
  const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;

  // on_the_air (2 pages)
  const onTheAir = [];
  for (let p = 1; p <= 2; p++) { const q = await get(`/tv/on_the_air?page=${p}&language=zh-CN`); onTheAir.push(...(q.results||[])); }
  console.log("on_the_air raw:", onTheAir.length);
  console.log("  with zh title:", onTheAir.filter(s=>hasChinese(s.name)).length);
  console.log("  with zh title AND overview:", onTheAir.filter(cnFilter).length);
  console.log("  + intelRatingOk:", onTheAir.filter(s=>cnFilter(s)&&intelRatingOk(s)).length);
  console.log("  + 2010 cutoff:", onTheAir.filter(s=>cnFilter(s)&&intelRatingOk(s)&&Number((s.first_air_date||"").slice(0,4))>=2010).length);
  console.log("  + pop>=30 (final onTheAirCandidates):", onTheAir.filter(s=>cnFilter(s)&&intelRatingOk(s)&&Number((s.first_air_date||"").slice(0,4))>=2010&&((s.popularity||0)>=30)).length);
  // show first few that passt all but pop>=30, and their pop
  const near = onTheAir.filter(s=>cnFilter(s)&&intelRatingOk(s)&&Number((s.first_air_date||"").slice(0,4))>=2010);
  console.log("  near-final pool (before pop gate):", near.length);
  near.slice(0,20).forEach(s=>console.log(`    ${s.name} | pop=${(s.popularity||0).toFixed(0)} | ${(s.popularity||0)>=30?"PASS":"low"}`));
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });