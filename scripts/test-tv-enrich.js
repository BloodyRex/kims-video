// Temp test #8 — why 9 ongoing shows lack S/E (enrichment failure?). Delete after run.
const TOKEN = process.env.TMDB_API_READ_ACCESS_TOKEN;
if (!TOKEN) { console.error("NO TOKEN"); process.exit(1); }
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

// Pull IDs from live tv.json ongoing
async function main() {
  const r = await fetch("https://bloodyrex.xyz/api/tv.json", { headers: { "User-Agent": "test" } });
  const tv = await r.json();
  const ongoing = tv.ongoing || [];
  console.log("ongoing count:", ongoing.length);

  // Group: with latestAir (enriched OK) vs without (enrichment failed)
  const ok = ongoing.filter(x => x.latestAirDate);
  const bad = ongoing.filter(x => !x.latestAirDate);
  console.log(`\nenriched OK (${ok.length}): ${ok.map(x => x.title).join(" / ")}`);
  console.log(`\nmissing S/E (${bad.length}): ${bad.map(x => `${x.title}(id:${x.tmdbId}, first:${x.releaseDate})`).join(" / ")}`);

  // Re-fetch details for the missing ones — sequential (no rate limit pressure)
  console.log("\n== re-fetch details (sequential, zh-CN) for missing ==");
  for (const x of bad) {
    try {
      const d = await (await fetch(`https://api.themoviedb.org/3/tv/${x.tmdbId}?language=zh-CN`, { headers: H })).json();
      const le = d?.last_episode_to_air;
      const ne = d?.next_episode_to_air;
      console.log(`${x.title} | last_ep: ${le ? `${le.season_number}S${le.episode_number}E ${le.air_date}` : "NONE"} | next_ep: ${ne ? `${ne.season_number}S${ne.episode_number}E ${ne.air_date}` : "NONE"} | status: ${d?.status} | in_prod: ${d?.in_production}`);
    } catch (e) { console.log(`${x.title} | FETCH FAIL: ${e.message}`); }
  }

  // Now simulate the actual 20-concurrent fetch to check for rate limiting
  console.log("\n== simulate 20 concurrent (like intelFetchTVEpisodeDates) ==");
  const all = [...ok, ...bad];
  const results = await Promise.allSettled(all.map(async (x) => {
    const res = await fetch(`https://api.themoviedb.org/3/tv/${x.tmdbId}?language=zh-CN`, { headers: H });
    if (!res.ok) return `${x.title}: HTTP ${res.status}`;
    const d = await res.json();
    return `${x.title}: last=${d?.last_episode_to_air ? "YES" : "NO"} next=${d?.next_episode_to_air ? "YES" : "NO"}`;
  }));
  results.forEach(r => console.log(r.status === "fulfilled" ? r.value : `REJECTED: ${r.reason?.message}`));

  console.log("\n===== DONE =====");
}
main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
