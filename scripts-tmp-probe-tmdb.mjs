// TEMPORARY diagnostic #9 — decisive: can with_networks (Netflix=213) + recency narrow to a
// small pool that RELIABLY contains 207333? If so, 方案A = "recent Netflix (or all) whole-season
// drops through a with_networks filter".
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const hasChinese = (t) => /[一-鿿]/.test(t || "");

async function main() {
  // A) Netflix (213) shows with first_air in last ~18 months, popularity desc — is 207333 in?
  for (const gte of ["2025-01-01", "2024-06-01"]) {
    const hit = { found: false };
    let poolSize = 0;
    let firstRank = -1;
    for (let p = 1; p <= 10; p++) {
      const d = await get(`/discover/tv?with_networks=213&first_air_date.gte=${gte}&sort_by=popularity.desc&page=${p}`);
      const res = d.results || [];
      if (!res.length) break;
      for (let i = 0; i < res.length; i++) { poolSize++; if (res[i].id === 207333 && !hit.found) { hit.found = true; hit.rank = (p-1)*20+i+1; hit.pop = res[i].popularity; } }
      if (res[res.length-1].popularity < 30 && poolSize > 80) break;
    }
    console.log(`[Netflix first_air>=${gte}] pool=${poolSize} 207333=`, hit.found ? `YES rank=${hit.rank} pop=${hit.pop.toFixed(1)}` : "NO");
  }

  // B) Same but for ALL networks, first_air>=2024-06 — already know 207333 rank 55. Count pool size to ~55.
  let pool = []; let hit2 = null;
  for (let p = 1; p <= 5; p++) {
    const d = await get(`/discover/tv?first_air_date.gte=2024-06-01&sort_by=popularity.desc&page=${p}`);
    for (const s of d.results||[]) { pool.push(s); if (s.id===207333) hit2 = { rank: pool.length, pop: s.popularity }; }
  }
  console.log(`\n[All networks first_air>=2024-06, 5pg] pool=${pool.length} 207333=`, hit2 ? `rank=${hit2.rank} pop=${hit2.pop.toFixed(1)}` : "NO");

  // C) The MOST reliable: does Netflix 2025+ popular include OTHER recently-dropped limited series?
  //    Show composition of the Netflix window pool (name/pop/first_air) so we see what a
  //    with_networks source would ADD to the ongoing row — meaningful curation, not noise.
  console.log("\n--- Netflix first_air>=2025-01 top 20 (what 方案A would surface) ---");
  let n = 0;
  for (let p = 1; p <= 1 && n < 20; p++) {
    const d = await get(`/discover/tv?with_networks=213&first_air_date.gte=2025-01-01&sort_by=popularity.desc&page=${p}`);
    for (const s of (d.results||[]).slice(0, 20)) {
      n++;
      console.log(`  ${n}. ${s.name || s.original_name} | pop=${s.popularity?.toFixed?.(0)} | first_air=${s.first_air_date} | zh=${hasChinese(s.name) ? "Y" : "N"}`);
    }
  }
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
