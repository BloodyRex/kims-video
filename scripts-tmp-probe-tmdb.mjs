// TEMPORARY diagnostic #25 — FAITHFUL full-handler subrequest budget.
// Simulates premieres (hydrateFromTrending reduction + detail) AND the trendRecovery
// full-detail to see if total < 50. 100年孤独 must be in trendRecovery + detail'd.
const B="https://api.themoviedb.org/3";const AUTH={Authorization:`Bearer ${process.env.TMDB_KEY}`};
const get=async(p)=>{const r=await fetch(B+p,{headers:AUTH});if(!r.ok)throw new Error(p+" "+r.status);return r.json();};
let budget=0;
const hasChinese=t=>/\p{Script=Han}/u.test(t||"");
const cnFilter=s=>hasChinese(s.title||s.name)&&hasChinese(s.overview);
const intelRatingOk=m=>!m.vote_average||m.vote_average>=4;
const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"});
const da=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const t30=da(30),t180=da(180),t90=da(90);

function score(it,mn,mx){const pop=it.popularity||0;const pr=Math.max(mx-mn,1);const S_pop=Math.min(100,Math.max(0,(pop-mn)/pr*100));const r=it.vote_average;const S_qual=r>0?Math.min(100,(r/10)*100):40;const le=it.last_episode_to_air?.air_date;const ds=it.release_date||le||it.first_air_date;let S_date=0;if(ds){const now=new Date(today+"T00:00:00"),re=new Date(ds+"T00:00:00");const du=(re-now)/86400000;const hl=du>=0?14:7;S_date=100*Math.exp(-Math.LN2/hl*Math.abs(du));}return(0.25*S_pop+0.45*S_date+0.30*S_qual)/100;}
function cl(it){const l=(it.original_language||"en").toLowerCase();if(l==="zh"){const c=it.origin_country||[];if(c.includes("CN"))return"cn";if(["TW","HK","MO"].some(x=>c.includes(x)))return"hmt";return"zh";}if(["ja","ko","th","vi","id"].includes(l))return l;return"other";}
function sel(it,count,res){if(it.length<=count)return it;const mx=Math.max(...it.map(m=>m.popularity||0),0),mn=Math.min(...it.map(m=>m.popularity||0),0);const sc=it.map(m=>({item:m,region:cl(m),sv:score(m,mn,mx),g:(m.genre_ids||[])[0]}));sc.sort((a,b)=>b.sv-a.sv);const r={},po=[];for(const s of sc){const re=s.region;const sl=res[re]||0;if(sl>0&&!r[re])r[re]=[];if(sl>0&&r[re].length<sl){r[re].push(s);continue;}po.push(s);}const out=[];for(const x of Object.values(r))out.push(...x);const gc={};for(const s of po){if(out.length>=count)break;const g=s.g;if(g&&(gc[g]||0)>=4)continue;gc[g]=(gc[g]||0)+1;out.push(s);}return out.sort((a,b)=>b.sv-a.sv).slice(0,count).map(s=>s.item);}
// intelFetchTVEpisodeDates with cache-skip (skip if has last_ep) + budget count
async function epDates(shows){const out=[];for(const s of shows||[]){if(s.last_episode_to_air||s.next_episode_to_air){out.push(s);continue;}budget++;const det=await get(`/tv/${s.id}?language=zh-CN`);if(det.last_episode_to_air||det.next_episode_to_air)out.push({...s,last_episode_to_air:det.last_episode_to_air,next_episode_to_air:det.next_episode_to_air});else out.push(s);}return out;}

async function main(){
  // ---- sources ----
  const onTheAir=[];for(let p=1;p<=2;p++){budget++;const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onTheAir.push(...q.results||[]);}
  const trend=[];for(let p=1;p<=3;p++){budget++;const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);trend.push(...q.results||[]);}
  budget++;await get(`/discover/tv?first_air_date.gte=${today}&first_air_date.lte=${da(90)}&sort_by=popularity.desc&page=1`);
  console.log("after sources, budget:",budget);

  // ---- premieres (mirror handler: on_the_air window → select 15 → hydrate → detail) ----
  const weekAgo=da(7);
  const premiereFromOnAir=onTheAir.filter(s=>s.first_air_date&&s.first_air_date>=weekAgo&&s.first_air_date<=today).filter(intelRatingOk).filter(s=>hasChinese(s.name)||hasChinese(s.overview));
  const premiereMerged=[...premiereFromOnAir];
  const premiereSelected=premiereMerged.slice(0,15); // approx, handler uses intelSelectDiverse
  // hydrateFromTrending: for each premiere, if trend has it with last_ep, merge (no budget)
  const trendMap=new Map(trend.map(s=>[s.id,s]));
  const premiereHydrated=premiereSelected.map(s=>{const t=trendMap.get(s.id);return (t&&(t.last_episode_to_air||t.next_episode_to_air))?{...s,last_episode_to_air:t.last_episode_to_air,next_episode_to_air:t.next_episode_to_air}:s;});
  const premiereEnriched=await epDates(premiereHydrated); // detail (only non-hydrated)
  const pDetail=premiereEnriched.map(s=>s.name);
  console.log("premieres selected:",premiereSelected.length,"| after detail (budget now",budget,") names:",premiereEnriched.map(s=>s.name).join("|"));

  // ---- trendRecovery full detail ----
  const onAirIds=new Set(onTheAir.map(s=>s.id));
  const trendRecovery=trend.filter(s=>!onAirIds.has(s.id)).filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  console.log("trendRecovery:",trendRecovery.length,"| 100年孤独 in:",trendRecovery.some(s=>s.id===207333));
  const trendHydrated=await epDates(trendRecovery);
  console.log("after trendRecovery full detail, budget:",budget);
  console.log("100年孤独 last_ep:",trendHydrated.find(s=>s.id===207333)?.last_episode_to_air?.air_date);

  // ---- ongoing select ----
  const onTheAirCandidates=onTheAir.filter(cnFilter).filter(intelRatingOk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30).map(s=>{const t=trendMap.get(s.id);return (t&&(t.last_episode_to_air||t.next_episode_to_air))?{...s,last_episode_to_air:t.last_episode_to_air,next_episode_to_air:t.next_episode_to_air}:s;});
  const merged=new Set(onTheAirCandidates.map(s=>s.id));
  const oc=[...onTheAirCandidates,...trendHydrated.filter(s=>!merged.has(s.id))];
  const sc=oc.map(s=>{const la=s.last_episode_to_air?.air_date||"";const recent=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,recent};});
  const selAll=[...sel(sc.filter(x=>x.recent).map(x=>x.s),10,{cn:1,hmt:1,jp:1,kr:1}),...sel(sc.filter(x=>!x.recent).map(x=>x.s),5,{cn:1,hmt:1,jp:1,kr:1})].slice(0,15);
  console.log("\nonGoing selected:",selAll.length,"|",selAll.map(s=>s.name).join("|"));
  const hit=selAll.find(s=>s.id===207333);
  console.log("100年孤独 selected?",!!hit,hit?`rank=${selAll.indexOf(hit)+1} S${hit.last_episode_to_air?.season_number}E${hit.last_episode_to_air?.episode_number}`:"");
  console.log("\n*** FINAL TOTAL BUDGET:",budget," (limit 50) ***");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});