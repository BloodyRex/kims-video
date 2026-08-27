// TEMPORARY diagnostic #5 — find a window that surfaces id 207333 among ENDED shows.
// The show: first_air 2024-12, ended 2026-08. popularity 45.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

async function main() {
  const ID = 207333;

  // A) All ENDED shows sorted by last-episode recency (air_date.desc) — do fresh endings float to top?
  //    air_date desc = shows whose most recent episode is newest.
  for (const sortBy of ["air_date.desc", "first_air_date.desc", "vote_average.desc", "popularity.desc"]) {
    for (const status of [3]) { // 3 = Ended
      const d = await get(`/discover/tv?sort_by=${sortBy}&with_status=${status}&page=1&air_date.gte=2026-01-01`);
      const res = d.results || [];
      const hit = res.find(x => x.id === ID);
      console.log(`[Ended, sort=${sortBy}, air_date>=2026] p1 hit?`, hit ? `YES pop=${hit.popularity}` : "NO", "| names:", res.slice(0, 8).map(x => x.name));
    }
  }

  // B) popularity.desc, no status filter, page 1..20 — where does 207333 land?
  //    (We already know 854 globally; check if air_date filter + first_air >= 2024 narrows it)
  let found = null;
  for (let p = 1; p <= 30; p++) {
    const d = await get(`/discover/tv?first_air_date.gte=2024-06-01&sort_by=popularity.desc&page=${p}`);
    const res = d.results || [];
    for (let i = 0; i < res.length; i++) {
      if (res[i].id === ID) { found = { page: p, rank: (p - 1) * 20 + i + 1, pop: res[i].popularity }; }
    }
    if (res.length < 20) break;
  }
  console.log("\n[first_air>=2024-06, pop desc] 207333:", found ? `page=${found.page} rank=${found.rank} pop=${found.pop}` : "NOT FOUND in 30 pages");

  // C) The actual last-episode date — confirm the show's last episode 2026-08-26
  const tv = await get("/tv/207333?language=zh-CN");
  console.log("\nlast_episode_to_air:", JSON.stringify(tv.last_episode_to_air));
  console.log("status:", tv.status, "| in_production:", tv.in_production, "| last_air_date:", tv.last_air_date);

  // D) Does air_date filter work for shows whose LAST episode aired recently, REGARDLESS of next_episode?
  //    Try a tighter window: air_date.gte with BOTH gte/lte today, sort by popularity, NO zh — page1... already done (NO).
  //    Root-cause check: what does the air_date filter actually match? Look at a sample returned by air_date 30d:
  //    those shows all have NEXT episodes upcoming (weekly shows). Confirms hypothesis: air_date = NEXT episode date.
  console.log("\n→ Hypothesis confirm: air_date.gte matches NEXT episode (upcoming air dates), not last air date.");
  console.log("  So an ENDED show (no next episode) NEVER matches air_date regardless of recent ending.");
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
