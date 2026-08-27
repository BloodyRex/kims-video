// TEMPORARY diagnostic #16 — full handleIntelTV ongoing downstream reproduction.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");
const cnFilter = (s) => hasChinese(s.title || s.name) && hasChinese(s.overview);
const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const daysAgo = (n) => { const d=new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); };
const t30 = daysAgo(30), t180 = daysAgo(180), t90 = daysAgo(90);

function classifyRegion(item) {
  const lang=(item.original_language||"en").toLowerCase();
  if(lang==="zh"){const c=item.origin_country||[];if(c.includes("CN"))return"cn";if(["TW","HK","MO"].some(x=>c.includes(x)))return"hmt";return"zh";}
  if(["ja","ko","th","vi","id"].includes(lang))return lang;return"other";
}
const SCORE={w_pop:0.25,w_date:0.45,w_qual:0.30,hlFuture:14,hlPast:7};
function computeScore(item,minPop,maxPop){
  const pop=item.popularity||0;const popRange=Math.max(maxPop-minPop,1);
  const S_pop=Math.min(100,Math.max(0,((pop-minPop)/popRange)*100));
  let S_qual;const r=item.vote_average;
  if(r!=null&&r>0)S_qual=Math.min(100,Math.max(0,(r/10)*100));else if((item.vote_count||0)>0)S_qual=50;else S_qual=40;
  const ds=item.first_air_date;let S_date=0;
  if(ds){const now=new Date(today+"T00:00:00"),rel=new Date(ds+"T00:00:00");const du=(rel-now)/86400000;const hl=du>=0?14:7;S_date=100*Math.exp(-Math.LN2/hl*Math.abs(du));}
  return (0.25*S_pop+0.45*S_date+0.30*S_qual)/100;
}
function selectDiverse(items,count,reserved){
  if(items.length<=count)return items;
  const maxPop=Math.max(...items.map(m=>m.popularity||0),0),minPop=Math.min(...items.map(m=>m.popularity||0),0);
  const scored=items.map(m=>({item:m,region:classifyRegion(m),score:computeScore(m,minPop,maxPop),mainGenre:(m.genre_ids||[])[0]}));
  scored.sort((a,b)=>b.score-a.score);
  const reservedItems={},pool=[];
  for(const s of scored){const region=s.region;const slots=reserved[region]||0;if(slots>0&&!reservedItems[region])reservedItems[region]=[];if(slots>0&&reservedItems[region].length<slots){reservedItems[region].push(s);continue;}pool.push(s);}
  const result=[];for(const x of Object.values(reservedItems))result.push(...x);
  const genreCount={};for(const s of pool){if(result.length>=count)break;const g=s.mainGenre;if(g&&(genreCount[g]||0)>=4)continue;genreCount[g]=(genreCount[g]||0)+1;result.push(s);}
  return result.sort((a,b)=>b.score-a.score).slice(0,count).map(s=>s.item);
}

async function main() {
  const onTheAir=[];for(let p=1;p<=2;p++){const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onTheAir.push(...(q.results||[]));}
  const onTheAirCandidates=onTheAir.filter(cnFilter).filter(intelRatingOk)
    .filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  console.log("[1] onTheAirCandidates:",onTheAirCandidates.length);

  // detail backfill (intelFetchTVEpisodeDates equivalent)
  const detailed=[];
  for(const s of onTheAirCandidates){const det=await get(`/tv/${s.id}?language=zh-CN`);detailed.push(det);}
  console.log("[2] raw with last_ep:",onTheAirCandidates.filter(s=>s.last_episode_to_air).length,"| after detail:",detailed.filter(s=>s.last_episode_to_air).length);

  const step=detailed.map(s=>{const la=s.last_episode_to_air?.air_date||"";const recent=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,recent};});
  const tier1=step.filter(x=>x.recent).map(x=>x.s);
  const tier2=step.filter(x=>!x.recent).map(x=>x.s);
  console.log("[3] tier1:",tier1.length,"tier2:",tier2.length);

  const selected=[...selectDiverse(tier1,10,{cn:1,hmt:1,jp:1,kr:1}),...selectDiverse(tier2,5,{cn:1,hmt:1,jp:1,kr:1})].slice(0,15);
  console.log("[4] selected:",selected.length,"|",selected.map(s=>s.name).join(" | "));

  const finalList=selected.filter(s=>{const la=s.last_episode_to_air?.air_date;return !la||la>=t90;});
  console.log("[5] after 90d filter:",finalList.length,"|",finalList.map(s=>s.name).join(" | "));

  const tv207=await get("/tv/207333?language=zh-CN");
  console.log("\n[6] 207333: last_ep=",tv207.last_episode_to_air?.air_date,"S"+tv207.last_episode_to_air?.season_number,"| in90d?",tv207.last_episode_to_air?.air_date>=t90,"| pop",tv207.popularity,"| zhboth?",hasChinese(tv207.name)&&hasChinese(tv207.overview));
}

main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});