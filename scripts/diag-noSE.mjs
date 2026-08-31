// TMP diag: do the currently-selected ongoing shows carry last_episode_to_air on TMDB detail?
// Pulls live worker /intelligence/tv, then checks TMDB tv/{id} detail for each.
const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
(async () => {
  const wr = await fetch("https://api.bloodyrex.xyz/intelligence/tv");
  console.log("worker /intelligence/tv status:", wr.status);
  const wd = await wr.json().catch(() => null);
  if (!wd || !wd.ongoing) { console.log("no ongoing:", JSON.stringify(wd).slice(0, 300)); return; }
  console.log(`worker ongoing count: ${wd.ongoing.length}, withS/E: ${wd.ongoing.filter(s => s.season != null && s.episode != null).length}`);
  for (const s of wd.ongoing) {
    const id = s.tmdbId;
    let d = null;
    try { d = await (await fetch(`https://api.themoviedb.org/3/tv/${id}?language=zh-CN`, h)).json(); } catch(e) { console.log(`  [${id}] detail fetch ERR ${e.message}`); continue; }
    const le = d.last_episode_to_air, ne = d.next_episode_to_air;
    const listLevel = (s.season != null && s.episode != null) ? `S${s.season}E${s.episode}` : "S?E?";
    console.log(`  [${String(id).padStart(7)}] ${String(s.title || "").padEnd(20)} | page:${listLevel} | detail_lasts:${le ? `S${le.season_number}E${le.episode_number}(air ${le.air_date})` : "NONE"} | nexts:${ne ? `S${ne.season_number}(air ${ne.air_date})` : "NONE"} | status=${d.status} | in_prod=${d.in_production}`);
  }
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });