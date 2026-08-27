// TEMPORARY diagnostic #20 — reproduce LATEST handler (trend detail-before-score) fully.
// Confirm 207333 now reaches ongoing. Mirrors exact flow including intelFetchTVEpisodeDates.
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
const t30=daysAgo(30),t180=daysAgo(180),t90=daysAgo(90);

function intelComputeScore(item,minPop,maxPop){ // uses last_episode (my edit)
  const pop=item.popularity||0;const popRange=Math.max(maxPop-minPop,1);
  const S_pop=Math.min(100,Math.max(0,((pop-minPop)/popRange)*100));
  const r=item.vote_average;const S_qual=r>0?Math.min(100,(r/10)*100):40;
  const lastEp=item.last_episode_to_air?.air_date;
  const dateStr=item.release_date||lastEp||item.first_air_date;
  let S_date=0;
  if(dateStr){const now=new Date(today+"T00:00:00"),rel=new Date(dateStr+"T00:00:00");const du=(rel-now)/86400000;const hl=du>=0?14:7;S_date=100*Math.exp(-Math.LN2/hl*Math.abs(du));}
  return (0.25*S_pop+0.45*S_date+0.30*S_qual)/100;
}
function classifyRegion(item){const lang=(item.original_language||"en").toLowerCase();if(lang==="zh"){const c=item.origin_country||[];if(c.includes("CN"))return"cn";if(["TW","HK","MO"].some(x=>c.includes(x)))return"hmt";return"zh";}if(["ja","ko","th","vi","id"].includes(lang))return lang;return"other";}
function selectDiverse(items,count,reserved){
  if(items.length<=count)return items;
  const maxPop=Math.max(...items.map(m=>m.popularity||0),0),minPop=Math.min(...items.map(m=>m.popularity||0),0);
  const scored=items.map(m=>({item:m,region:classifyRegion(m),score:intelComputeScore(m,minPop,maxPop),mainGenre:(m.genre_ids||[])[0]}));
  scored.sort((a,b)=>b.score-a.score);
  const reservedItems={},pool=[];
  for(const s of scored){const region=s.region;const slots=reserved[region]||0;if(slots>0&&!reservedItems[region])reservedItems[region]=[];if(slots>0&&reservedItems[region].length<slots){reservedItems[region].push(s);continue;}pool.push(s);}
  const result=[];for(const x of Object.values(reservedItems))result.push(...x);
  const genreCount={};for(const s of pool){if(result.length>=count)break;const g=s.mainGenre;if(g&&(genreCount[g]||0)>=4)continue;genreCount[g]=(genreCount[g]||0)+1;result.push(s);}
  return result.sort((a,b)=>b.score-a.score).slice(0,count).map(s=>s.item);
}
async function intelFetchTVEpisodeDates(shows){ // simplified: detail-fill if no last_ep
  const out=[];
  for(const s of shows||[]){if(s.last_episode_to_air||s.next_episode_to_air){out.push(s);continue;}const det=await get(`/tv/${s.id}?language=zh-CN`);if(det?.last_episode_to_air||det?.next_episode_to_air)out.push({...s,last_episode_to_air:det.last_episode_to_air,next_episode_to_air:det.next_episode_to_air});else out.push(s);}
  return out;
}

async function main(){
  // fetch sources
  const onTheAir=[];let p;for(p=1;p<=2;p++){const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onTheAir.push(...(q.results||[]));}
  const trend=[];for(p=1;p<=3;p++){const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);trend.push(...(q.results||[]));}

  // trendCandidates (same filters as handler) then PRE-FILL detail
  const trendCandidates=trend.filter(s=>cnFilter(s)&&intelRatingOk(s)&&Number((s.first_air_date||"").slice(0,4))>=2010&&((s.popularity||0)>=30));
  console.log("trendCandidates:",trendCandidates.length,"| 207333 in:",trendCandidates.some(s=>s.id===207333));
  const trendHydrated=await intelFetchTVEpisodeDates(trendCandidates);
  const th207=trendHydrated.find(s=>s.id===207333);
  console.log("after trend detail, 207333 last_ep:",th207?.last_episode_to_air?.air_date,"| detail count:",trendHydrated.length);

  const onTheAirCandidates=onTheAir.filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  const mergedIds=new Set(onTheAirCandidates.map(s=>s.id));
  const ongoingCandidates=[...onTheAirCandidates,...trendHydrated.filter(s=>!mergedIds.has(s.id))];
  console.log("ongoingCandidates:",ongoingCandidates.length);

  const scored=ongoingCandidates.map(s=>{const la=s.last_episode_to_air?.air_date||"";const recent=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,recent};});
  const tier1=scored.filter(x=>x.recent).map(x=>x.s);
  const tier2=scored.filter(x=>!x.recent).map(x=>x.s);
  const selected=[...selectDiverse(tier1,10,{cn:1,hmt:1,jp:1,kr:1}),...selectDiverse(tier2,5,{cn:1,hmt:1,jp:1,kr:1})].slice(0,15);
  console.log("\nselected:",selected.length,"|",selected.map(s=>s.name).join(" | "));
  const fin=selected.find(s=>s.id===207333);
  console.log("207333 selected?",!!fin,fin?`rank=${selected.indexOf(fin)+1} S${fin.last_episode_to_air?.season_number}E${fin.last_episode_to_air?.episode_number}`:"");
}
let _x;
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});