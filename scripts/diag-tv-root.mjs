// TMP diag: trending payload carries ep? + live worker S/E + subrequest health
const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
(async () => {
  // 1) trending/tv/week pages 1-3: does each item carry last_episode_to_air?
  for (let p = 1; p <= 3; p++) {
    const r = await fetch(`https://api.themoviedb.org/3/trending/tv/week?page=${p}`, h);
    const d = await r.json();
    const rows = (d.results || []).map(x => ({
      id: x.id, name: x.name,
      hasLe: !!x.last_episode_to_air, hasNe: !!x.next_episode_to_air,
      le: x.last_episode_to_air ? `S${x.last_episode_to_air.season_number}E${x.last_episode_to_air.episode_number}` : null,
      firstAir: x.first_air_date, pop: Math.round(x.popularity)
    }));
    console.log(`\n=== trending/tv/week page ${p} (${rows.length}) ===`);
    rows.forEach(r => console.log(`  ${String(r.id).padStart(7)} | ${String(r.name).padEnd(22)} | EP:${r.hasLe} ${r.le||"-"} | Ne:${r.hasNe} | ${r.firstAir} | pop${r.pop}`));
    const withLe = rows.filter(r => r.hasLe).length;
    console.log(`  -> items with last_episode_to_air: ${withLe}/${rows.length}`);
  }

  // 2) live worker /intelligence/tv
  try {
    const wr = await fetch("https://api.bloodyrex.xyz/intelligence/tv");
    console.log("\n=== live worker /intelligence/tv status:", wr.status, "===");
    const wd = await wr.json().catch(()=>null);
    if (wd && wd.ongoing) {
      let withSE = 0;
      wd.ongoing.forEach(s => {
        const has = s.season != null && s.episode != null;
        if (has) withSE++;
        console.log(`  ${String(s.tmdbId||"").padStart(7)} | ${String(s.title||"").padEnd(22)} | S${s.season??"?"}-E${s.episode??"?"} | last=${s.latestAirDate||"-"}`);
      });
      console.log(`  -> withS/E: ${withSE}/${wd.ongoing.length}`);
    } else {
      console.log("  no worker ongoing or error:", JSON.stringify(wd).slice(0,300));
    }
  } catch(e){ console.log("\nworker fetch ERR", e.message); }
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });