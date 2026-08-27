// TEMPORARY diagnostic #22 — the clean recovery pool = trending shows NOT in on_the_air.
// Whole-season drops (Ended) aren't in on_the_air; weekly shows are. This delta is small
// enough to detail-fill ALL of it within budget, and 207333 must be in it.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const hasChinese=(t)=>/\p{Script=Han}/u.test(t||"");
const cnFilter=(s)=>hasChinese(s.title||s.name)&&hasChinese(s.overview);
const intelRatingOk=(m)=>!m.vote_average||m.vote_average>=4;

async function main(){
  const onAir=[];let p;for(p=1;p<=2;p++){const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onAir.push(...(q.results||[]));}
  const trend=[];for(p=1;p<=3;p++){const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);trend.push(...(q.results||[]));}
  const onAirSet=new Set(onAir.map(s=>s.id));
  console.log("on_the_air:",onAir.length,"trend:",trend.length,"| overlap:",trend.filter(s=>onAirSet.has(s.id)).length);

  // Recovery pool = trend shows NOT in on_the_air
  const trendOnly=trend.filter(s=>!onAirSet.has(s.id));
  console.log("trend-only (NOT in on_the_air):",trendOnly.length);
  const trendOnlyZh=trendOnly.filter(s=>hasChinese(s.name));
  console.log("  zh-title:",trendOnlyZh.length);
  const t207=trendOnly.find(s=>s.id===207333);
  console.log("  207333 in trend-only?",!!t207);

  // detail-fill ALL trend-only (small!) → get last_episode → which are recently concluded?
  const t90=new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  const candidates=trendOnly.filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  console.log("\ncandidates (trend-only, zh, pop>=30, 2010+):",candidates.length,"| 207333 in:",candidates.some(s=>s.id===207333));
  console.log("  candidate count is small → detail-fill ALL within budget");
  // detail all candidates (small), list recent concluded
  const detailed=[];
  for(const s of candidates){const det=await get(`/tv/${s.id}?language=zh-CN`);detailed.push(det);}
  const recent=detailed.filter(s=>s.last_episode_to_air?.air_date>=t90);
  console.log("\nof",detailed.length,"candidates, recently-concluded (last_ep<=90):",recent.length);
  recent.forEach(s=>console.log(`  ${s.name} | last=${s.last_episode_to_air?.air_date} S${s.last_episode_to_air?.season_number} | pop=${Math.round(s.popularity)} | zh=${hasChinese(s.name)&&hasChinese(s.overview)}`));
  const r207=detailed.find(s=>s.id===207333);
  console.log("207333: last_ep",r207?.last_episode_to_air?.air_date,"recent?",r207?.last_episode_to_air?.air_date>=t90,"status",r207?.status);
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});