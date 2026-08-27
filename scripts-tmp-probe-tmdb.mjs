// Diagnostic #30 — FINAL proposed source: discover/tv with_status=Ended + first_air recent
// + popularity.desc, as a dedicated "recently-concluded whole-season" pool. Verify:
// 1) pool is SMALL (budget-safe to fully detail)
// 2) 207333 (百年孤独) is in it and near the top
// 3) after detail + latest-season scoring it reaches ongoing
const B="https://api.themoviedb.org/3";const AUTH={Authorization:`Bearer ${process.env.TMDB_KEY}`};
const get=async(p)=>{const r=await fetch(B+p,{headers:AUTH});if(!r.ok)throw new Error(p+" "+r.status);return r.json();};
const hz=t=>/\p{Script=Han}/u.test(t||"");
const cnF=s=>hz(s.title||s.name)&&hz(s.overview);
const rk=m=>!m.vote_average||m.vote_average>=4;
const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"});
const da=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const t30=da(30),t180=da(180),t90=da(90),t400=da(400);

function scr(it,mn,mx){const pop=it.popularity||0;const pr=Math.max(mx-mn,1);const S_pop=Math.min(100,Math.max(0,(pop-mn)/pr*100));const r=it.vote_average;const S_qual=r>0?Math.min(100,(r/10)*100):40;const le=it.last_episode_to_air?.air_date;const ds=it.release_date||le||it.first_air_date;let S_date=0;if(ds){const now=new Date(today+"T00:00:00"),re=new Date(ds+"T00:00:00");const du=(re-now)/86400000;const hl=du>=0?14:7;S_date=100*Math.exp(-Math.LN2/hl*Math.abs(du));}return(0.25*S_pop+0.45*S_date+0.30*S_qual)/100;}
function cl(it){const l=(it.original_language||"en").toLowerCase();if(l==="zh"){const c=it.origin_country||[];if(c.includes("CN"))return"cn";if(["TW","HK","MO"].some(x=>c.includes(x)))return"hmt";return"zh";}if(["ja","ko","th","vi","id"].includes(l))return l;return"other";}
function sel(it,count,res){if(it.length<=count)return it;const mx=Math.max(...it.map(m=>m.popularity||0),0),mn=Math.min(...it.map(m=>m.popularity||0),0);const sc=it.map(m=>({item:m,region:cl(m),sv:scr(m,mn,mx),g:(m.genre_ids||[])[0]}));sc.sort((a,b)=>b.sv-a.sv);const r={},po=[];for(const s of sc){const re=s.region;const sl=res[re]||0;if(sl>0&&!r[re])r[re]=[];if(sl>0&&r[re].length<sl){r[re].push(s);continue;}po.push(s);}const out=[];for(const x of Object.values(r))out.push(...x);const gc={};for(const s of po){if(out.length>=count)break;const g=s.g;if(g&&(gc[g]||0)>=4)continue;gc[g]=(gc[g]||0)+1;out.push(s);}return out.sort((a,b)=>b.sv-a.sv).slice(0,count).map(s=>s.item);}

async function main(){
  // PROPOSED source: Ended + first_air in last ~400d + popularity.desc, limit pages
  let ended=[];
  for(let p=1;p<=8;p++){const q=await get(`/discover/tv?with_status=3&first_air_date.gte=${t400}&sort_by=popularity.desc&page=${p}&language=zh-CN`);ended.push(...(q.results||[]));if(!(q.results||[]).length)break;}
  console.log("with_status=Ended + first_air>=400d raw:",ended.length);
  const endedZh=ended.filter(cnF).filter(rk).filter(s=>(s.popularity||0)>=20);
  console.log("after zh+rating+pop>=20:",endedZh.length);
  console.log("207333 in pool?",endedZh.some(s=>s.id===207333));
  const idx=endedZh.findIndex(s=>s.id===207333);
  if(idx>=0){console.log("207333 by pop rank:",idx+1,"of",endedZh.length);}
  // pool size is small → full detail budget-safe
  console.log("pool size",endedZh.length,"→ detail all ~",endedZh.length,"+ source pages",8,"= budget fits");

  // detail all (small pool) → latest season
  const detailed=[];
  for(const s of endedZh){const det=await get(`/tv/${s.id}?language=zh-CN`);detailed.push(det.last_episode_to_air?{...s,last_episode_to_air:det.last_episode_to_air}:s);}
  const th207=detailed.find(s=>s.id===207333);
  console.log("207333 last_ep:",th207?.last_episode_to_air?.air_date,"status:",th207?.status);

  // Show all recently-concluded (status Ended, last_ep in 90d)
  const rec=detailed.filter(s=>s.last_episode_to_air?.air_date>=t90 && (s.popularity||0)>=20);
  console.log("\nrecently-concluded (last_ep<=90d, pop>=20):",rec.length);
  rec.forEach(s=>console.log(`  ${s.name} | last=${s.last_episode_to_air?.air_date} S${s.last_episode_to_air?.season_number} | pop=${Math.round(s.popularity)}`));

  // Score by latest season → select top 15-20 for ongoing supplement
  const sc=detailed.map(s=>({s}));
  // merged into ongoing later; here just show it CAN be selected
  const scored=detailed.map(s=>{const la=s.last_episode_to_air?.air_date||"";const rec2=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,rec:rec2};});
  const selAll=[...sel(scored.filter(x=>x.rec).map(x=>x.s),10,{cn:1,hmt:1,jp:1,kr:1}),...sel(scored.filter(x=>!x.rec).map(x=>x.s),5,{cn:1,hmt:1,jp:1,kr:1})].slice(0,15);
  console.log("\nselected (from Ended pool alone):",selAll.length,"|",selAll.map(s=>s.name).join(" | "));
  const hit=selAll.find(s=>s.id===207333);
  console.log("207333 selected?",!!hit,hit?`rank=${selAll.indexOf(hit)+1} S${hit.last_episode_to_air?.season_number}E${hit.last_episode_to_air?.episode_number}`:"");
  console.log("\n*** BUDGET: source 8 + detail",endedZh.length,"+ premieres ... ≈",8+endedZh.length,"-... < 50? ***");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});