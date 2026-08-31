// TMP: clean re-run — does 207333 pass the FULL trendingCandidates chain AND
// then fight through tier assignment + intelSelectDiverse top-15?
const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
const hasCn = (t) => /[\u4e00-\u9fff]/.test(t || "");
const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;
const yearCutoff = 2010, popFloor = 30;
const SOL = 207333;
(async () => {
  const all = [];
  for (let p = 1; p <= 3; p++) {
    const r = await fetch(`https://api.themoviedb.org/3/trending/tv/week?page=${p}&language=zh-CN`, h);
    const d = await r.json();
    all.push(...(d.results||[]));
  }
  const seen = new Set(); const deduped = [];
  for (const x of all) { if (!x.id || seen.has(x.id)) continue; seen.add(x.id); deduped.push(x); }
  const premIds = new Set(), upIds = new Set();
  const passers = deduped
    .filter(s => !premIds.has(s.id) && !upIds.has(s.id))
    .filter(intelRatingOk)
    .filter(s => Number((s.first_air_date||"").slice(0,4)) >= yearCutoff)
    .filter(s => (s.popularity||0) >= popFloor)
    .filter(s => hasCn(s.name) && hasCn(s.overview||""));
  console.log("trendingCandidates survivors:", passers.length, "| has207333:", passers.some(x=>x.id===SOL));
  if (!passers.some(x=>x.id===SOL)) { console.log(">>> SOLITUDE FILTERED OUT of trendingCandidates"); process.exit(0); }
  console.log("survivor ids:", passers.map(x=>`${x.id}:${(x.name||"").slice(0,12)}[pop${Math.round(x.popularity)}]`).join(" | "));

  // Is 207333 even in on_the_air (so it's NOT _trendingOnly)? Check next.
  for (let p = 1; p <= 4; p++) {
    const r = await fetch(`https://api.themoviedb.org/3/tv/on_the_air?page=${p}`, h);
    const d = await r.json();
    if ((d.results||[]).some(x=>x.id===SOL)) { console.log("207333 IS in on_the_air page", p, "→ NOT trending-only"); }
  }
  console.log("(no on_the_air hit printed = it's trending-only)");
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });