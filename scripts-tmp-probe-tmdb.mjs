// TEMPORARY diagnostic #11 — verify the EXACT production filters on the new
// streamer source don't over-include stale Netflix shows. Mirrors the code I wrote.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

async function main() {
  // Recompute cutoff via daysAgo
  const d700 = new Date(); d700.setUTCDate(d700.getUTCDate() - 700); const cutoff = d700.toISOString().slice(0,10);
  const q = await get(`/discover/tv?with_networks=213&first_air_date.gte=${cutoff}&sort_by=popularity.desc&page=1&language=zh-CN`);
  const hasChinese = (t) => /[一-鿿]/.test(t || "");
  const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;
  const res = (q.results || []);
  console.log("raw Netflix pool (700d window):", res.length);

  // Apply production filters: premieres/upcoming excluded (null here), cnFilter relaxed to zh title+overview,
  // 2010+, pop>=30, first_air>=cutoff
  const pool = res.filter(s =>
    Number((s.first_air_date || "").slice(0, 4)) >= 2010 &&
    (s.popularity || 0) >= 30 &&
    hasChinese(s.name) && hasChinese(s.overview) &&
    intelRatingOk(s) &&
    (s.first_air_date || "") >= cutoff
  );
  console.log("after production filters:", pool.length);
  console.log("\n— Final ongoing-eligible Netflix pool —");
  pool.forEach(s => console.log(`  ${s.name} | pop=${Math.round(s.popularity)} | first_air=${s.first_air_date} | zh=${hasChinese(s.name)}`));

  // How many of these would ACTUALLY be new (not already in on_the_air)? Fetch on_the_air ids.
  const onAir = [];
  for (let p = 1; p <= 2; p++) { const o = await get(`/tv/on_the_air?page=${p}`); onAir.push(...(o.results||[]).map(x=>x.id)); }
  const onAirSet = new Set(onAir);
  const news = pool.filter(s => !onAirSet.has(s.id));
  console.log("\non_the_air size:", onAirSet.size, "| Netflix pool shows NOT in on_the_air (truly net-new):", news.length);
  news.forEach(s => console.log(`    ➕ ${s.name} (pop ${Math.round(s.popularity)})`));
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });