// Diagnostic #34 — 207333's pop rank within wsDrop subset (first_air<300d).
const B="https://api.themoviedb.org/3";const AUTH={Authorization:`Bearer ${process.env.TMDB_KEY}`};
const get=async(p)=>{const r=await fetch(B+p,{headers:AUTH});if(!r.ok)throw new Error(p+" "+r.status);return r.json();};
const hz=t=>/\p{Script=Han}/u.test(t||"");
const cnF=s=>hz(s.title||s.name)&&hz(s.overview);
const rk=m=>!m.vote_average||m.vote_average>=4;
async function main(){
  const onAir=[];for(let p=1;p<=2;p++){const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);onAir.push(...q.results||[]);}
  const trend=[];for(let p=1;p<=3;p++){const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);trend.push(...q.results||[]);}
  const onAirIds=new Set(onAir.map(s=>s.id));
  const rec=trend.filter(s=>!onAirIds.has(s.id)).filter(cnF).filter(rk).filter(s=>Number((s.first_air_date||"").slice(0,4))>=2010).filter(s=>(s.popularity||0)>=30);
  const cutoff=new Date();cutoff.setUTCDate(cutoff.getUTCDate()-300);const c=cutoff.toISOString().slice(0,10);
  const ws=rec.filter(s=>(s.first_air_date||"")<c);
  const byPop=ws.slice().sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  console.log("wsDrop by pop (rank : name : pop : first_air):");
  byPop.forEach((s,i)=>console.log(`  ${i+1}. ${s.name} pop=${s.popularity.toFixed(1)} first_air=${s.first_air_date}${s.id===207333?"  ←207333":""}`));
  const idx=byPop.findIndex(s=>s.id===207333);
  console.log("207333 wsDrop pop rank:",idx+1,"of",ws.length,"| pop>45 count:",byPop.filter(s=>s.popularity>45).length);
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});
