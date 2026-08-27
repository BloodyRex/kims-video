// TEMPORARY diagnostic #12b — GENERAL multi-platform whole-season recovery.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};

async function main() {
  // Resolve candidate streamer network ids (varied guesses, keep only that resolve)
  const cands = [213, 1029, 1024, 2552, 49, 130, 104, 3373, 5024, 273, 531, 453, 313, 66, 56, 60, 383, 3672, 430, 1732, 3020, 975, 328];
  console.log("=== network id resolution ===");
  const resolved = {};
  for (const id of cands) {
    try { const n = await get("/network/" + id); if (n.name) { resolved[id] = n.name; console.log(`  ${id} = ${n.name}`); } } catch (e) {}
  }

  // Known/suspected big global streamers by name
  const streamerNames = ["netflix","disney","prime","apple tv","max","hbo","hulu","paramount","peacock","crunchyroll","amazon","apple"];
  const streamers = Object.entries(resolved)
    .filter(([id, n]) => streamerNames.some(s => n.toLowerCase().includes(s)))
    .map(([id]) => Number(id));
  console.log("\nselected global streamer ids:", streamers, streamers.map(id=>resolved[id]));

  if (streamers.length) {
    const nw = streamers.join(",");
    for (const wind of [null, "2024-01-01"]) {
      const params = `with_networks=${nw}${wind ? `&first_air_date.gte=${wind}` : ""}&sort_by=popularity.desc`;
      const q = await get(`/discover/tv?${params}&page=1&language=zh-CN`);
      const res = q.results || [];
      const zh = res.filter(s=>/[\u4e00-\u9fff]/.test(s.name||""));
      console.log(`\n[multi-streamer ${wind||"no-window"}] p1=${res.length} 207333?${res.some(x=>x.id===207333)?"YES":"no"} zh-title=${zh.length}`);
      if (res.some(x=>x.id===207333)) {
        const hit=res.find(x=>x.id===207333);
        console.log("  207333 rank:", res.indexOf(hit)+1, "pop:", hit.popularity.toFixed(1));
      }
      // total pages
      console.log("  total_pages:", q.total_pages);
    }
  }
}
main().catch(e => { console.error("FATAL", e.message); process.exit(1); });