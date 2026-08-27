// TEMPORARY diagnostic #14 — trending pagination as a ZERO-detail generic "recent/whole-season"
// recovery. trending/tv/week carries full episode objects (last_episode_to_air) for FREE.
// Pages 1..N = the hottest N shows this week (整季放出剧上线当周冲最前).
// Does 207333 appear in trending pages? If so → zero-budget generic fix.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");

async function main() {
  // 1) trending/tv/week across pages 1-5 — find 207333 and count how many have last_episode
  let found = null; let total = 0; let withLast = 0;
  for (let p = 1; p <= 5; p++) {
    const q = await get(`/trending/tv/week?page=${p}&language=zh-CN`);
    const res = q.results || [];
    if (!res.length) break;
    for (let i = 0; i < res.length; i++) {
      total++;
      if (res[i].id === 207333) found = { page: p, rank: (p-1)*20+i+1, pop: res[i].popularity, last: res[i].last_episode_to_air?.air_date };
    }
    if (res.some(x => x.last_episode_to_air)) withLast += res.filter(x=>x.last_episode_to_air).length;
    console.log(`[trending/tv/week p${p}] ${res.length} results | has last_episode count this page: ${res.filter(x=>x.last_episode_to_air).length}`);
  }
  console.log("total scanned:", total, "| with last_episode:", withLast);
  console.log("  207333 in trending pages1-5:", found ? `YES page=${found.page} rank=${found.rank} pop=${found.pop} last=${found.last}` : "NO");

  // 2) If trending is the fix, what would it surface? All shows in trending p1-3 with last_episode
  //    recent (< 90d), zh-visible, pop ok — these are today's hottest including whole-season drops
  const t90 = new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  console.log("\n  trending p1-3 shows with last_episode <=90d & zh name (the generic recents):");
  const pool = [];
  for (let p = 1; p <= 3; p++) { const q = await get(`/trending/tv/week?page=${p}&language=zh-CN`); pool.push(...(q.results||[])); }
  pool.filter(s => s.last_episode_to_air?.air_date >= t90 && hasChinese(s.name)).slice(0,30)
    .forEach(s => console.log(`    ${s.name} | last=${s.last_episode_to_air?.air_date} S${s.last_episode_to_air?.season_number} | pop=${Math.round(s.popularity)}`));
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });