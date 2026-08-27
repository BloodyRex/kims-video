// TEMPORARY diagnostic #21 — reproduce LATEST deployed handler EXACTLY including
// the budget cap (top-20 detail) and the merge-with-map. Confirm ongoing is NON-empty
// and contains 207333 in THIS exact configuration. My budget change may have broken it.
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

function prevS(item,minPop,maxPop){
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
  const sc=it.map(m=>({item:m,region:cl(m),score:prevS(m,mn,mx),genre:(m.genre_ids||[])[0]}));
  sc.sort((a,b)=>b.score-a.score);
  const r={},po=[];for(const s of sc){const re=s.region;const sl=res[re]||0;if(sl>0&&!r[re])r[re]=[];if(sl>0&&r[re].length<sl){r[re].push(s);continue;}po.push(s);}
  const out=[];for(const x of Object.values(r))out.push(...x);const gc={};for(const s of po){if(out.length>=count)break;const g=s.genre;if(g&&(gc[g]||0)>=4)continue;gc[g]=(gc[g]||0)+1;out.push(s);}
  return out.sort((a,b)=>b.score-a.score).slice(0,count).map(s=>s.item);
}

async function main(){
  const onTheAir=[];let p;for(p=1;p<=2;p++){const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onTheAir.push(...(q.results||[]));}
  const trend=[];for(p=1;p<=3;p++){const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);trend.push(...(q.results||[]));}
  console.log("onTheAir:",onTheAir.length,"trend:",trend.length);

  const trendCandidates=trend.filter(s=>cnFilter(s)&&intelRatingOk(s)&&Number((s.first_air_date||"").slice(0,4))>=2010&&((s.popularity||0)>=30));
  console.log("trendCandidates:",trendCandidates.length,"| has207333:",trendCandidates.some(s=>s.id===207333));

  // EXACT handler: top-20 by pop detail backfill
  const trendTop=trendCandidates.slice().sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,20);
  console.log("trendTop size:",trendTop.length,"| 207333 in top20?",trendTop.some(s=>s.id===207333));
  const trendHydrated=[];
  for(const s of trendTop){const det=await get(`/tv/${s.id}?language=zh-CN`);trendHydrated.push(det.last_episode_to_air?{...s,last_episode_to_air:det.last_episode_to_air}:s);}
  const th207=trendHydrated.find(s=>s.id===207333);
  console.log("trendHydrated:",trendHydrated.length,"| 207333 last_ep in detail:",th207?.last_episode_to_air?.air_date);

  const onTheAirCandidates=onTheAir.filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  const mergedIds=new Set(onTheAirCandidates.map(s=>s.id));
  const trendMap=new Map(trendHydrated.map(s=>[s.id,s]));
  const trendFull=trendCandidates.map(s=>trendMap.get(s.id)||s);
  const ongoingCandidates=[...onTheAirCandidates,...trendFull.filter(s=>!mergedIds.has(s.id))];
  console.log("ongoingCandidates:",ongoingCandidates.length,"| has207333:",ongoingCandidates.some(s=>s.id===207333));

  const scored=ongoingCandidates.map(s=>{const la=s.last_episode_to_air?.air_date||"";const recent=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,recent};});
  const t1=scored.filter(x=>x.recent).map(x=>x.s);
  const t2=scored.filter(x=>!x.recent).map(x=>x.s);
  const selected=[...sel(t1,10,{cn:1,hmt:1,jp:1,kr:1}),...sel(t2,5,{cn:1,hmt:1,jp:1,kr:1})].slice(0,15);
  console.log("selected:",selected.length,"|",selected.map(s=>s.name).join(" | "));
  const hit=selected.find(s=>s.id===207333);
  console.log("207333 selected?",!!hit,hit?`rank=${selected.indexOf(hit)+1}`:"");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});