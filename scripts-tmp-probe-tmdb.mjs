// TEMPORARY diagnostic #4 — find a RELIABLE source that surfaces id 207333.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${await r.text().catch(()=> "")}`);
  return r.json();
};
const intelToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const intelDaysAgo = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

async function main() {
  const today = intelToday();
  const todayUtc = new Date().toISOString().slice(0, 10);
  const t30 = intelDaysAgo(30);
  const t60 = intelDaysAgo(60);

  console.log("today(CST):", today, "today(UTC):", todayUtc);

  async function probe(label, path) {
    try {
      const d = await get(path);
      const res = d.results || [];
      const hit = res.filter(x => x.id === 207333);
      console.log(`[${label}] total_pages=${d.total_pages || "?"} results=${res.length} hit=`, hit.length ? JSON.stringify({ pop: hit[0].popularity, va: hit[0].vote_average }) : "NO");
      return res;
    } catch (e) { console.log(`[${label}] ERR ${e.message}`); return []; }
  }

  // 1) Does air_date window match NEXT episode (future) rather than LAST aired?
  await probe("discover/tv air_date 30d", `/discover/tv?air_date.gte=${t30}&air_date.lte=${today}&sort_by=popularity.desc&page=1&language=zh-CN`);
  await probe("discover/tv air_date next7d", `/discover/tv?air_date.gte=${today}&air_date.lte=${todayUtc}&sort_by=popularity.desc&page=1`);

  // 2) tv/popular (static popularity list)
  for (let p = 1; p <= 5; p++) await probe(`tv/popular p${p}`, `/tv/popular?page=${p}`);

  // 3) trending/tv/week all 20
  const tw = await probe("trending/tv/week", "/trending/tv/week");
  console.log("   trending week full names:", tw.slice(0, 20).map(x => x.name));

  // 4) discover/tv with status filters — status=3 (Ended)
  await probe("discover/tv with_status=Ended top", "/discover/tv?sort_by=popularity.desc&with_status=3&page=1");

  // 5) discover/tv first_air 2026 (new this year) pop desc — page 1-3
  for (let p = 1; p <= 3; p++) await probe(`discover/tv first_air>=2026 p${p}`, `/discover/tv?first_air_date.gte=2026-01-01&sort_by=popularity.desc&page=${p}`);

  // 6) The KEY experiment: without zh, does discover/tv air_date catch it in en-US?
  await probe("discover/tv air_date 60d en", `/discover/tv?air_date.gte=${t60}&air_date.lte=${today}&sort_by=popularity.desc&page=1`);

  // 7) Directly inspect what air_date.gte returns (first 8 names) to see if ENDED shows appear at all
  const ad = await get(`/discover/tv?air_date.gte=${t30}&sort_by=popularity.desc&page=1`);
  console.log("   air_date 30d window sample names:", (ad.results || []).slice(0, 12).map(x => `${x.name}(S${x.last_episode_to_air?.season_number ?? "?"})`));
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
