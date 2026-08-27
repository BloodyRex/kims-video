// TEMPORARY diagnostic #2 — find WHERE One Hundred Years ranks in discover/tv
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const pad = (d) => d.toISOString().slice(0, 10);
const today = pad(new Date());

async function main() {
  // discover/tv by popularity desc, released <= today — find page & rank of id 207333
  let found = null;
  let scanned = 0;
  for (let p = 1; p <= 60; p++) {
    const d = await get(`/discover/tv?first_air_date.lte=${today}&sort_by=popularity.desc&page=${p}`);
    const results = d.results || [];
    if (!results.length) break;
    for (let i = 0; i < results.length; i++) {
      scanned++;
      if (results[i].id === 207333) {
        found = { page: p, rankInPage: i + 1, globalRank: scanned, ...results[i] };
        console.log("FOUND 207333 in discover/tv page", p, "global rank", scanned);
        console.log("  popularity:", results[i].popularity, "vote_avg:", results[i].vote_average, "first_air:", results[i].first_air_date);
      }
    }
    // stop scanning early if we pass popularity < 35 (its pop is 38.29; keep margin)
    if (results[results.length - 1]?.popularity < 30) { console.log(`  (stopped at page ${p}, tail popularity ${results[results.length-1].popularity})`); break; }
  }
  console.log("scanned:", scanned, "found:", !!found);

  // Also: how many shows between pop 35-45 in that pool (the "neighborhood")
  console.log("\n--- How the released-on-popularity pool is distributed near 38.29 ---");

  // Reference: what does MOVIES upcoming (floor 15) look like? Hadestown 12.9 is below.
  // Simulate Hadestown under a 'popularity OR rating' combo gate.
  console.log("\n--- Hadestown under alternative gates ---");
  const pop = 12.8992, va = 9.1;
  console.log("  existing nowPlaying floor pop>=25:", pop >= 25 ? "PASS" : "FAIL");
  console.log("  existing upcoming floor pop>=15:", pop >= 15 ? "PASS" : "FAIL");
  console.log("  gate (pop>=15 AND va>=7):", (pop >= 15 && va >= 7) ? "PASS" : "FAIL");
  console.log("  gate (pop>=10 AND va>=8):", (pop >= 10 && va >= 8) ? "PASS" : "FAIL");
  console.log("  gate (pop + 1.0*va >= 20):", (pop + 1.0 * va >= 20) ? "PASS" : "FAIL");
  console.log("  gate (pop + 1.5*va >= 25):", (pop + 1.5 * va >= 25) ? "PASS" : "FAIL");
  console.log("  gate (pop>=12 OR va>=8.5):", (pop >= 12 || va >= 8.5) ? "PASS" : "FAIL");
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
