// TEMPORARY diagnostic script (do not ship / keep) — probes TMDB values for
// two titles the user asked about, and checks which candidate pools contain them.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}`, "Content-Type": "application/json" };

const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

const pad = (d) => d.toISOString().slice(0, 10);
const addDays = (days) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return pad(d); };

const today = pad(new Date());
const past90 = addDays(-90);
const past7 = addDays(-7);

async function main() {
  console.log("===== 1) Real TMDB values =====");
  const tv = await get("/tv/207333?language=zh-CN");
  console.log("TV 207333 (One Hundred Years):");
  console.log("  name:", tv.name, "| status:", tv.status, "| first_air_date:", tv.first_air_date);
  console.log("  popularity:", tv.popularity, "| vote_average:", tv.vote_average, "| vote_count:", tv.vote_count);
  console.log("  last_ep_air_date:", tv.last_episode_to_air?.air_date);
  console.log("  seasons:", tv.seasons?.map(s => `S${s.season_number}(${s.episode_count})`).join(" "));

  const mov = await get("/movie/1439808?language=zh-CN");
  console.log("\nMOV 1439808 (Hadestown):");
  console.log("  title:", mov.title, "| original:", mov.original_title, "| status:", mov.status);
  console.log("  popularity:", mov.popularity, "| vote_average:", mov.vote_average, "| vote_count:", mov.vote_count);
  console.log("  release_date:", mov.release_date);

  console.log("\n===== 2) Candidate pool membership =====");
  const findId = (list, id) => list.filter(x => x.id === id).map(x => ({ pop: x.popularity, va: x.vote_average, date: x.first_air_date || x.release_date }));

  // TV side
  const tvPools = {};
  for (let p = 1; p <= 5; p++) tvPools[`discover/tv released<=today p${p}`] = (await get(`/discover/tv?first_air_date.lte=${today}&sort_by=popularity.desc&page=${p}`)).results;
  for (let p = 1; p <= 4; p++) tvPools[`on_the_air p${p}`] = (await get(`/tv/on_the_air?page=${p}`)).results;
  tvPools["trending/tv/week"] = (await get("/trending/tv/week")).results;
  for (const [k, v] of Object.entries(tvPools)) {
    const hit = findId(v, 207333);
    console.log(`  TV 207333 in ${k}:`, hit.length ? JSON.stringify(hit) : "NO");
  }

  // Movie side
  const movPools = {};
  for (let p = 1; p <= 3; p++) movPools[`now_playing US p${p}`] = (await get(`/movie/now_playing?region=US&page=${p}`)).results;
  for (let p = 1; p <= 5; p++) movPools[`discover/movie 90d p${p}`] = (await get(`/discover/movie?primary_release_date.gte=${past90}&primary_release_date.lte=${today}&sort_by=popularity.desc&page=${p}`)).results;
  movPools["trending/movie/week"] = (await get("/trending/movie/week")).results;
  for (const [k, v] of Object.entries(movPools)) {
    const hit = findId(v, 1439808);
    console.log(`  MOV 1439808 in ${k}:`, hit.length ? JSON.stringify(hit) : "NO");
  }

  console.log("\n===== 3) Ranking context =====");
  console.log("  trending/tv/week top10:", tvPools["trending/tv/week"].slice(0, 10).map(x => x.name));
  console.log("  trending/movie/week top10:", movPools["trending/movie/week"].slice(0, 10).map(x => x.title));
  console.log("  now_playing US top15 pops:", movPools["now_playing US p1"].slice(0, 15).map(x => x.popularity.toFixed(1)));

  // Scoring simulation for a candidate Hadestown if it were present
  console.log("\n===== 4) Simulated composite scores (Hadestown in now_playing pool) =====");
  const poolPops = movPools["now_playing US p1"].map(x => x.popularity);
  const batchMaxPop = Math.max(...poolPops), batchMinPop = Math.min(...poolPops);
  const popRange = Math.max(batchMaxPop - batchMinPop, 1);
  const S_pop = Math.min(100, Math.max(0, ((mov.popularity - batchMinPop) / popRange) * 100));
  const S_qual = Math.min(100, Math.max(0, (mov.vote_average / 10) * 100));
  const release = new Date(mov.release_date + "T00:00:00"), now = new Date(today + "T00:00:00");
  const daysPast = (now - release) / 86400000;
  const S_date = 100 * Math.exp(-Math.LN2 / 7 * Math.abs(daysPast));
  const composite = (0.25 * S_pop + 0.55 * S_date + 0.20 * S_qual) / 100;
  console.log("  S_pop:", S_pop.toFixed(1), "S_date:", S_date.toFixed(1), "S_qual:", S_qual.toFixed(1), "composite:", composite.toFixed(4));
  console.log("  batchMinPop:", batchMinPop.toFixed(1), "batchMaxPop:", batchMaxPop.toFixed(1), "range:", popRange.toFixed(1));
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
