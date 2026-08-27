// TEMPORARY diagnostic #24 — verify oldest15 detail: budget-safe AND 207333 included.
// Also count TOTAL subrequests for the whole handler (on_air + discover + trending +
// premieres detail + trendOldest15 detail) to confirm < 50.
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
const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"});
const da=(n)=>{const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const t30=da(30),t180=da(180),t90=da(90);
let budget=0;

function score(item,minPop,maxPop){
  const pop=item.popularity||0;const pr=Math.max(maxPop-minPop,1);
  const S_pop=Math.min(100,Math.max(0,((pop-minPop)/pr)*100));
  const r=item.vote_average;const S_qual=r>0?Math.min(100,(r/10)*100):40;
  const lastEp=item.last_episode_to_air?.air_date;
  const ds=item.release_date||lastEp||item.first_air_date;
  let S_date=0;
  if(ds){const now=new Date(today+"T00:00:00"),rel=new Date(ds+"T00:00:00");const du=(rel-now)/86400000;const hl=du>=0?14:7;S_date=100*Math.exp(-Math.LN2/hl*Math.abs(du));}
  return (0.25*S_pop+0.45*S_date+0.30*S_qual)/100;
}
function cl(item){const l=(item.original_language||"en").toLowerCase();if(l==="zh"){const c=item.origin_country||[];if(c.includes("CN"))return"cn";if(["TW","HK","MO"].some(x=>c.includes(x)))return"hmt";return"zh";}if(["ja","ko","th","vi","id"].includes(l))return l;return"other";}
function sel(it,count,res){
  if(it.length<=count)return it;
  const mx=Math.max(...it.map(m=>m.popularity||0),0),mn=Math.min(...it.map(m=>m.popularity||0),0);
  const sc=it.map(m=>({item:m,region:cl(m),sv:score(m,mn,mx),g:(m.genre_ids||[])[0]}));
  sc.sort((a,b)=>b.sv-a.sv);
  const r={},po=[];for(const s of sc){const re=s.region;const sl=res[re]||0;if(sl>0&&!r[re])r[re]=[];if(sl>0&&r[re].length<sl){r[re].push(s);continue;}po.push(s);}
  const out=[];for(const x of Object.values(r))out.push(...x);const gc={};for(const s of po){if(out.length>=count)break;const g=s.g;if(g&&(gc[g]||0)>=4)continue;gc[g]=(gc[g]||0)+1;out.push(s);}
  return out.sort((a,b)=>b.sv-a.sv).slice(0,count).map(s=>s.item);
}

async function main(){
  // ---- SOURCE fetches (count budget) ----
  const onTheAir=[];let p;for(p=1;p<=2;p++){budget++;const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onTheAir.push(...(q.results||[]));}
  const trend=[];for(p=1;p<=3;p++){budget++;const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);trend.push(...(q.results||[]));}
  budget++; await get(`/discover/tv?first_air_date.gte=${today}&first_air_date.lte=${da(-90)}&sort_by=popularity.desc&page=1&language=zh-CN`); // discoverRaw
  budget++; await get(`/trending/tv/week?page=1&language=zh-CN`); // tvTrendingWeek? (dup, cached in prod)
  console.log("source fetches budget:",budget);

  const onTheAirCandidates=onTheAir.filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);

  const onAirIds=new Set(onTheAir.map(s=>s.id));
  const trendRecovery=trend.filter(s=>!onAirIds.has(s.id)).filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  const trendOldest15=trendRecovery.slice().sort((a,b)=>(a.first_air_date||"").localeCompare(b.first_air_date||"")).slice(0,15);
  console.log("trendRecovery:",trendRecovery.length,"| oldest15 size:",trendOldest15.length,"| 207333 in oldest15?",trendOldest15.some(s=>s.id===207333));

  // detail oldest15 (count budget)
  const trendHydrated=[];
  for(const s of trendOldest15){budget++;const det=await get(`/tv/${s.id}?language=zh-CN`);trendHydrated.push(det.last_episode_to_air?{...s,last_episode_to_air:det.last_episode_to_air}:s);}
  console.log("after trendOldest15 detail, budget:",budget,"| 207333 last_ep:",trendHydrated.find(s=>s.id===207333)?.last_episode_to_air?.air_date);

  // simulate premieres detail budget (handler uses intelFetchTVEpisodeDates on premieres ~15)
  console.log("  (premieres detail ~15-20 more in real handler)");
  console.log("  ⚠️ estimated TOTAL handler budget ≈", budget, "(source) + ~20 (premieres) =", budget+20);
  console.log("  ⚠️ if > 50 this is the ongoing=2 root cause");

  // select
  const mergedIds=new Set(onTheAirCandidates.map(s=>s.id));
  const ongoingCandidates=[...onTheAirCandidates,...trendHydrated.filter(s=>!mergedIds.has(s.id))];
  const sc=ongoingCandidates.map(s=>{const la=s.last_episode_to_air?.air_date||"";const recent=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,recent};});
  const t1=sc.filter(x=>x.recent).map(x=>x.s),t2=sc.filter(x=>!x.recent).map(x=>x.s);
  const selected=[...sel(t1,10,{cn:1,hmt:1,jp:1,kr:1}),...sel(t2,5,{cn:1,hmt:1,jp:1,kr:1})].slice(0,15);
  console.log("selected:",selected.length,"|",selected.map(s=>s.name).join(" | "));
  const hit=selected.find(s=>s.id===207333);
  console.log("207333 selected?",!!hit,hit?`rank=${selected.indexOf(hit)+1} S${hit.last_episode_to_air?.season_number}E${hit.last_episode_to_air?.episode_number}`:"");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});