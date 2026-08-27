// Diagnostic #28 — trendRecovery popularity distribution. If 207333(pop45) is in the
// top-N by pop within the already-small recovery pool, we can cap detail to top-N safely.
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
  console.log("trendRecovery size:",rec.length);
  // sort by pop desc
  const byPop=rec.slice().sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  console.log("By popularity desc (rank : name : pop : first_air):");
  byPop.forEach((s,i)=>console.log(`  ${i+1}. ${s.name} pop=${s.popularity.toFixed(1)} first_air=${s.first_air_date}${s.id===207333?"  ←207333":""}`));
  // 207333's position
  const idx=byPop.findIndex(s=>s.id===207333);
  console.log("207333 byPop rank:",idx+1,"of",rec.length);
  // how many have pop > 45
  console.log("count with pop > 45:",byPop.filter(s=>(s.popularity||0)>45).length);
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});