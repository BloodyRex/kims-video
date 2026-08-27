// TEMPORARY diagnostic #19 — do trending/tv/week LIST items natively carry last_episode_to_air?
// This decides whether scoring can use it before hydrate, or whether we must reorder.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
async function main() {
  // p2 rank 21-40, check 207333 (rank23) and a few others: do they have last_episode_to_air natively?
  const q = await get("/trending/tv/week?page=2&language=zh-CN");
  const res = q.results || [];
  console.log("trending p2 items with last_episode_to_air:", res.filter(x=>x.last_episode_to_air).length, "of", res.length);
  const t207 = res.find(x=>x.id===207333);
  console.log("207333 in p2:", !!t207, "| native last_episode:", JSON.stringify(t207?.last_episode_to_air));
  // sample a few
  res.slice(20,30).forEach(x=>console.log(`  ${x.name} pop=${(x.popularity||0).toFixed(0)} has_last_ep=${!!x.last_episode_to_air}`));
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});