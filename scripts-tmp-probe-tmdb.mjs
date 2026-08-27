// TEMPORARY diagnostic #10 — FINAL: with_networks funnel + zh + S/E for tvwall.
// Verify 207333 exits cleanly and carries season/episode for the TV wall.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

async function main() {
  // 1) Fetch the with_networks recent-pool and show 207333's S/E + zh from DETAIL (list has none)
  const detail = await get("/tv/207333?language=zh-CN");
  console.log("=== 207333 detail (zh) ===");
  console.log("  name:", detail.name);
  console.log("  overview zh?:", /[一-鿿]/.test(detail.overview || ""));
  console.log("  popularity:", detail.popularity, "| status:", detail.status);
  console.log("  last_episode_to_air:", JSON.stringify({ season: detail.last_episode_to_air?.season_number, ep: detail.last_episode_to_air?.episode_number, air: detail.last_episode_to_air?.air_date, type: detail.last_episode_to_air?.episode_type }));
  console.log("  next_episode_to_air:", JSON.stringify(detail.next_episode_to_air || null));

  // 2) The with_networks pool in zh — which of the top entries pass zh gate (title+overview)?
  console.log("\n=== with_networks=213 first_air>=2024-06 p1 (zh) — zh gate audit ===");
  const d = await get("/discover/tv?with_networks=213&first_air_date.gte=2024-06-01&sort_by=popularity.desc&page=1&language=zh-CN");
  let pass = [];
  for (const s of d.results || []) {
    const zhT = /[一-鿿]/.test(s.name || "");
    if (zhT) pass.push(`${s.name}(pop=${Math.round(s.popularity)})`);
  }
  console.log("  total in pool:", (d.results||[]).length, "| zh-title entries:", pass.length);
  console.log("  zh-title:", JSON.stringify(pass));
  console.log("  207333 in zh pool p1?", (d.results||[]).some(x=>x.id===207333), "at rank", (d.results||[]).findIndex(x=>x.id===207333)+1);

  // 3) S/E via trending hydration? 207333 not in trending. Confirm the tvwall entry shape works
  //    from last_episode data (which the worker's intelFetchTVEpisodeDates fetches).
  console.log("\n  → tvwall entry would be: tmdbId=207333 season=", detail.last_episode_to_air?.season_number, "episode=", detail.last_episode_to_air?.episode_number, "latestAirDate=", detail.last_episode_to_air?.air_date);

  // 4) Budget audit: what does adding 1 more discover call cost? Current handleIntelTV already
  //    does 5 page-fetches (on_the_air×2, discover/tv×1, tvmaze×2 batches, trending×1) + detail S/E
  //    backfill. One extra discover call = +1 subrequest. Fine.
  console.log("\n  Budget: +1 discover page (equivalent to existing discover/tv call) = +1 subrequest. No issue.");
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
