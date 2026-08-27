// TEMPORARY diagnostic #27 — 新思路落地：候选按"最新一季"排序（seasons[] 末尾 air_date）。
// 关键测：能否在预算内（<50）对精简池全 detail，并按最新季评分稳定产出百年孤独。
// 同时测 TMVAZE 能否提供"按季"的 schedule（季首播日）作为零 detail 的季信号。
const B="https://api.themoviedb.org/3";const AUTH={Authorization:`Bearer ${process.env.TMDB_KEY}`};
const get=async(p)=>{const r=await fetch(B+p,{headers:AUTH});if(!r.ok)throw new Error(p+" "+r.status);return r.json();};
let budget=0;
const hasChinese=t=>/\p{Script=Han}/u.test(t||"");
const cnFilter=s=>hasChinese(s.title||s.name)&&hasChinese(s.overview);
const intelRatingOk=m=>!m.vote_average||m.vote_average>=4;
const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"});
const da=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const t30=da(30),t180=da(180),t90=da(90);

// score using LATEST SEASON air_date (from seasons[] tail) instead of first_air
function latestSeasonAir(det){ // /tv/{id} detail → most recent season air_date
  const ss=(det.seasons||[]).filter(s=>s.season_number>0&&s.air_date);
  const sorted=ss.sort((a,b)=>(b.air_date).localeCompare(a.air_date));
  return sorted[0]?.air_date || det.last_episode_to_air?.air_date || det.first_air_date;
}
function score(it,latestAir,mn,mx){
  const pop=it.popularity||0;const pr=Math.max(mx-mn,1);
  const S_pop=Math.min(100,Math.max(0,(pop-mn)/pr*100));
  const r=it.vote_average;const S_qual=r>0?Math.min(100,(r/10)*100):40;
  const ds=latestAir||it.first_air_date;let S_date=0;
  if(ds){const now=new Date(today+"T00:00:00"),re=new Date(ds+"T00:00:00");const du=(re-now)/86400000;const hl=du>=0?14:7;S_date=100*Math.exp(-Math.LN2/hl*Math.abs(du));}
  return (0.25*S_pop+0.45*S_date+0.30*S_qual)/100;
}
function cl(it){const l=(it.original_language||"en").toLowerCase();if(l==="zh"){const c=it.origin_country||[];if(c.includes("CN"))return"cn";if(["TW","HK","MO"].some(x=>c.includes(x)))return"hmt";return"zh";}if(["ja","ko","th","vi","id"].includes(l))return l;return"other";}
function sel(items,count,res,latestAirMap){
  if(items.length<=count)return items;
  const mx=Math.max(...items.map(m=>m.popularity||0),0),mn=Math.min(...items.map(m=>m.popularity||0),0);
  const sc=items.map(m=>({item:m,region:cl(m),sv:score(m,latestAirMap.get(m.id),mn,mx),g:(m.genre_ids||[])[0]}));
  sc.sort((a,b)=>b.sv-a.sv);
  const r={},po=[];for(const s of sc){const re=s.region;const sl=res[re]||0;if(sl>0&&!r[re])r[re]=[];if(sl>0&&r[re].length<sl){r[re].push(s);continue;}po.push(s);}
  const out=[];for(const x of Object.values(r))out.push(...x);const gc={};for(const s of po){if(out.length>=count)break;const g=s.g;if(g&&(gc[g]||0)>=4)continue;gc[g]=(gc[g]||0)+1;out.push(s);}
  return out.sort((a,b)=>b.sv-a.sv).slice(0,count).map(s=>s.item);
}

async function main(){
  // sources
  const onTheAir=[];for(let p=1;p<=2;p++){budget++;const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onTheAir.push(...q.results||[]);}
  const trend=[];for(let p=1;p<=3;p++){budget++;const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);trend.push(...q.results||[]);}
  console.log("sources budget:",budget);

  // THE recovery pool = trend NOT in on_the_air (whole-season drops)
  const onAirIds=new Set(onTheAir.map(s=>s.id));
  const trendRecovery=trend.filter(s=>!onAirIds.has(s.id)).filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  console.log("trendRecovery:",trendRecovery.length,"| 百年孤独 in:",trendRecovery.some(s=>s.id===207333));

  // detail EVERY recovery candidate → get seasons[] latest air
  const latestAirMap=new Map();
  for(const s of trendRecovery){budget++;const det=await get(`/tv/${s.id}?language=zh-CN`);latestAirMap.set(s.id,latestSeasonAir(det));}
  console.log("after recovery detail, budget:",budget,"| 百年孤独 latest season air:",latestAirMap.get(207333));

  // on_the_air candidates: they lack seasons detail; use first_air as fallback (their latest season is ~now since on_the_air)
  const onTheAirCandidates=onTheAir.filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);

  // merge + score by latest season
  const merged=new Set(onTheAirCandidates.map(s=>s.id));
  const ongoing=[...onTheAirCandidates,...trendRecovery.filter(s=>!merged.has(s.id))];
  const latest=(id)=>latestAirMap.get(id)||null;
  const sc=ongoing.map(s=>{const laAir=latest(s.id);const la=laAir||s.last_episode_to_air?.air_date||"";const recent=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,recent};});
  const selAll=[...sel(sc.filter(x=>x.recent).map(x=>x.s),10,{cn:1,hmt:1,jp:1,kr:1},latestAirMap),...sel(sc.filter(x=>!x.recent).map(x=>x.s),5,{cn:1,hmt:1,jp:1,kr:1},latestAirMap)].slice(0,15);
  console.log("\nselected:",selAll.length,"|",selAll.map(s=>`${s.name}(${latest(s.id)||s.first_air_date})`).join("| "));
  const hit=selAll.find(s=>s.id===207333);
  console.log("百年孤独 selected?",!!hit,hit?`rank=${selAll.indexOf(hit)+1}`:"");
  console.log("\n*** BUDGET:",budget,"(limit 50) — includes recovery detail but NOT premieres detail ***");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});