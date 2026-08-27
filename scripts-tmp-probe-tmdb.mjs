// TEMPORARY diagnostic #26 — does TMDB TV list data expose per-season signals?
// KEY QUESTION for 新思路 (treat each season as independent show):
// - What do on_the_air / discover/tv / trending items carry for season info?
// - Is there a "current season premiere date" distinct from show's first_air_date?
// - Can we rank by "latest season" without per-show detail?
const B="https://api.themoviedb.org/3";const AUTH={Authorization:`Bearer ${process.env.TMDB_KEY}`};
const get=async(p)=>{const r=await fetch(B+p,{headers:AUTH});if(!r.ok)throw new Error(p+" "+r.status);return r.json();};

async function main(){
  // 1) on_the_air first page — inspect fields of each item
  const onair=await get("/tv/on_the_air?page=1&language=zh-CN");
  console.log("=== on_the_air p1 items: per-season signals ===");
  (onair.results||[]).slice(0,8).forEach(s=>{
    console.log(`  ${s.name} | first_air=${s.first_air_date} | origin_yr=${(s.first_air_date||"").slice(0,4)} | season#=${s.season_number??s.season??'-'} | last_ep=${s.last_episode_to_air?.name||'NONE'} L${s.last_episode_to_air?.air_date||''} | next_ep=${s.next_episode_to_air?.air_date||'NONE'}`);
  });
  console.log("  ⚠️ keys sample:", Object.keys(onair.results[0]).join(","));
  const hasSeasonData = onair.results.every(s=>s.last_episode_to_air);
  console.log("  all items have last_episode_to_air?", hasSeasonData);

  // 2) Does on_the_air return items in "recently-airing" order (latest season)?
  //    Check: are these current-season shows, and does first_air_date reflect recent?

  // 3) discover/tv — can we get per-season premiere via a param? Try none, list shows same.
  const disc=await get("/discover/tv?sort_by=first_air_date.desc&page=1");
  console.log("\n=== discover/tv first_air_date.desc top 5 (first_air = SHOW premiere, not season) ===");
  (disc.results||[]).slice(0,5).forEach(s=>console.log(`  ${s.name} first_air=${s.first_air_date} last=${s.last_episode_to_air?.air_date||'-'} season=${s.season_number??'-'}`));

  // 4) CRITICAL: is there any TMDB list endpoint that sorts by LATEST SEASON premiere?
  //    airing_today? Check a week on_the_air vs airing_today difference.
  try{
    const at=await get("/tv/airing_today");
    console.log("\n=== airing_today p1 (first_air + last_ep) ===");
    (at.results||[]).slice(0,6).forEach(s=>console.log(`  ${s.name} first_air=${s.first_air_date} season=${s.season_number??'-'} next_ep=${s.next_episode_to_air?.air_date||'-'}`));
  }catch(e){console.log("airing_today err",e.message);}

  // 5) Detail of a specific show: does /tv/{id} give season premiere dates list?
  const det=await get("/tv/207333?language=zh-CN");
  console.log("\n=== 百年孤独 detail: seasons array (per-season premiere dates) ===");
  (det.seasons||[]).forEach(s=>console.log(`  S${s.season_number}: ${s.name} | ep_count=${s.episode_count} | air_date=${s.air_date||'-'} | id=${s.id}`));
  // Also confirm /tv/{id}/season/{n} endpoint shape
  const s2=await get("/tv/207333/season/2");
  console.log("  season/2 object:", JSON.stringify({name:s2.name,air_date:s2.air_date,episode_count:s2.episodes?.length,first:[(s2.episodes||[])[0]?.air_date,(s2.episodes||[])[0]?.episode_number]}));

  console.log("\n=== CONCLUSION DATA ===");
  console.log("  does any BN_TYPE list endpoint sort by latest-season premiere? → check output above");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});