// TMP: is 百年孤独 (One Hundred Years of Solitude) missing from ongoing?
// 1) What is its TMDB id + data (pop, rating, dates, S/E)
// 2) Is it in trending/tv/week pages 1-3? What rank + does it pass ongoing filters?
// 3) Search by title to get id if unknown
const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
const hasCn = (t) => /[\u4e00-\u9fff]/.test(t || "");
(async () => {
  // 3) find id by search
  console.log("=== SEARCH tv:q=One Hundred Years of Solitude ===");
  const sr = await fetch("https://api.themoviedb.org/3/search/tv?query=One%20Hundred%20Years%20of%20Solitude&language=zh-CN", h);
  const sd = await sr.json();
  (sd.results || []).slice(0, 5).forEach(x => {
    console.log(`  id=${x.id} | ${x.name} | firstAir=${x.first_air_date} | pop=${Math.round(x.popularity)} | rate=${x.vote_average} | lang=${x.original_language} | cnTitle=${hasCn(x.name)} | cnOv=${hasCn(x.overview)}`);
  });

  // detail of the main one (id 207333 per prior comment)
  const id = 207333;
  console.log(`\n=== DETAIL tv/${id} lang=zh-CN ===`);
  const dr = await fetch(`https://api.themoviedb.org/3/tv/${id}?language=zh-CN`, h);
  const dd = await dr.json();
  const le = dd.last_episode_to_air, ne = dd.next_episode_to_air;
  console.log(`  name=${dd.name} | orig=${dd.original_name} | status=${dd.status} | in_prod=${dd.in_production}`);
  console.log(`  firstAir=${dd.first_air_date} | pop=${Math.round(dd.popularity)} | rate=${dd.vote_average} | votes=${dd.vote_count} | lang=${dd.original_language}`);
  console.log(`  cnTitle=${hasCn(dd.name)} | cnOv=${hasCn(dd.overview)}`);
  console.log(`  lastEp=${le ? `S${le.season_number}E${le.episode_number} air ${le.air_date}` : "NONE"} | nextEp=${ne ? `S${ne.season_number} air ${ne.air_date}` : "NONE"}`);
  console.log(`  seasons=${(dd.seasons||[]).map(s=>`S${s.season_number}(${s.name||s.air_date||""})`).join(", ")}`);

  // 2) is it in trending pages 1-3?
  console.log("\n=== TRENDING/tv/week pages 1-3: find id ===");
  for (let p = 1; p <= 3; p++) {
    const tr = await fetch(`https://api.themoviedb.org/3/trending/tv/week?page=${p}`, h);
    const td = await tr.json();
    const found = (td.results||[]).find(x => x.id === id);
    const rows = (td.results||[]).map(x => ({ id: x.id, rank_in_page: (td.results||[]).indexOf(x)+1 }));
    const idx = (td.results||[]).findIndex(x => x.id === id);
    console.log(`  page ${p}: hasSolitude=${!!found} | idx=${idx} | hasLastEp=${found? (!!found.last_episode_to_air):"n/a"}`);
    if (found) {
      console.log(`    -> pop=${Math.round(found.popularity)} rate=${found.vote_average} cnTitle=${hasCn(found.name)} cnOv=${hasCn(found.overview)} firstAir=${found.first_air_date} hasLe=${!!found.last_episode_to_air} hasNe=${!!found.next_episode_to_air}`);
    }
  }
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });