// Diagnostic #33 — FINAL verify: recovery detail = trendRecovery where first_air older
// than 300d (whole-season-drop candidates, incl. 207333). Detail these + latest-season
// score → confirm 207333 enters ongoing, budget safe.
const B="https://api.themoviedb.org/3";const AUTH={Authorization:`Bearer ${process.env.TMDB_KEY}`};
const get=async(p)=>{const r=await fetch(B+p,{headers:AUTH});if(!r.ok)throw new Error(p+" "+r.status);return r.json();};
let budget=0;
const hz=t=>/\p{Script=Han}/u.test(t||"");
const cnF=s=>hz(s.title||s.name)&&hz(s.overview);
const rk=m=>!m.vote_average||m.vote_average>=4;
const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"});
const da=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const t30=da(30),t180=da(180),t90=da(90),t300=da(300);
function scr(it,mn,mx){const pop=it.popularity||0;const pr=Math.max(mx-mn,1);const S_pop=Math.min(100,Math.max(0,(pop-mn)/pr*100));const r=it.vote_average;const S_qual=r>0?Math.min(100,(r/10)*100):40;const le=it.last_episode_to_air?.air_date;const ds=it.release_date||le||it.first_air_date;let S_date=0;if(ds){const now=new Date(today+"T00:00:00"),re=new Date(ds+"T00:00:00");const du=(re-now)/86400000;const hl=du>=0?14:7;S_date=100*Math.exp(-Math.LN2/hl*Math.abs(du));}return(0.25*S_pop+0.45*S_date+0.30*S_qual)/100;}
function cl(it){const l=(it.original_language||"en").toLowerCase();if(l==="zh"){const c=it.origin_country||[];if(c.includes("CN"))return"cn";if(["TW","HK","MO"].some(x=>c.includes(x)))return"hmt";return"zh";}if(["ja","ko","th","vi","id"].includes(l))return l;return"other";}
function sel(it,count,res){if(it.length<=count)return it;const mx=Math.max(...it.map(m=>m.popularity||0),0),mn=Math.min(...it.map(m=>m.popularity||0),0);const sc=it.map(m=>({item:m,region:cl(m),sv:scr(m,mn,mx),g:(m.genre_ids||[])[0]}));sc.sort((a,b)=>b.sv-a.sv);const r={},po=[];for(const s of sc){const re=s.region;const sl=res[re]||0;if(sl>0&&!r[re])r[re]=[];if(sl>0&&r[re].length<sl){r[re].push(s);continue;}po.push(s);}const out=[];for(const x of Object.values(r))out.push(...x);const gc={};for(const s of po){if(out.length>=count)break;const g=s.g;if(g&&(gc[g]||0)>=4)continue;gc[g]=(gc[g]||0)+1;out.push(s);}return out.sort((a,b)=>b.sv-a.sv).slice(0,count).map(s=>s.item);}
async function main(){
  const onTheAir=[];for(let p=1;p<=2;p++){budget++;const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onTheAir.push(...q.results||[]);}
  const trend=[];for(let p=1;p<=3;p++){budget++;const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);trend.push(...q.results||[]);}
  console.log("after sources budget:",budget);
  const onTheAirCandidates=onTheAir.filter(cnF).filter(rk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  const onAirIds=new Set(onTheAir.map(s=>s.id));
  const trendRecovery=trend.filter(s=>!onAirIds.has(s.id)).filter(cnF).filter(rk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  // FINAL: only detail whole-season-drop candidates = first_air older than 300 days
  const wsDropCands=trendRecovery.filter(s=>(s.first_air_date||"")<t300);
  console.log("whole-season-drop candidates (first_air<300d):",wsDropCands.length,"| 207333 in:",wsDropCands.some(s=>s.id===207333));
  // detail these (small, budget-safe)
  const wsDetailed=[];
  for(const s of wsDropCands){budget++;const det=await get(`/tv/${s.id}?language=zh-CN`);wsDetailed.push(det.last_episode_to_air?{...s,last_episode_to_air:det.last_episode_to_air}:s);}
  console.log("after wsDrop detail, budget:",budget,"| 207333 last_ep:",wsDetailed.find(s=>s.id===207333)?.last_episode_to_air?.air_date);
  // merge (on_the_air + wsDetailed recovery)
  const merged=new Set(onTheAirCandidates.map(s=>s.id));
  const oc=[...onTheAirCandidates,...wsDetailed.filter(s=>!merged.has(s.id))];
  const sc=oc.map(s=>{const la=s.last_episode_to_air?.air_date||"";const rec=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,rec};});
  const selAll=[...sel(sc.filter(x=>x.rec).map(x=>x.s),10,{cn:1,hmt:1,jp:1,kr:1}),...sel(sc.filter(x=>!x.rec).map(x=>x.s),5,{cn:1,hmt:1,jp:1,kr:1})].slice(0,15);
  console.log("\nselected:",selAll.length,"|",selAll.map(s=>s.name).join(" | "));
  const hit=selAll.find(s=>s.id===207333);
  console.log("207333 selected?",!!hit,hit?`rank=${selAll.indexOf(hit)+1} S${hit.last_episode_to_air?.season_number}E${hit.last_episode_to_air?.episode_number}`:"");
  console.log("\n*** BUDGET:",budget,"(+premieres ~0-15) — safe***");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});