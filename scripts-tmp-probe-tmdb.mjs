// Diagnostic #32 — FINAL clean approach: trendRecovery → detail only shows whose
// first_air is OLDER than N days (whole-season-drop candidates). Verify this subset
// is small enough to detail within budget AND includes 207333 (first_air 2024-12-11).
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
  console.log("trendRecovery total:",rec.length,"| 207333 in:",rec.some(s=>s.id===207333));

  // subset: first_air older than 300 days (would-be whole-season drops)
  const cutoff=new Date();cutoff.setUTCDate(cutoff.getUTCDate()-300);const cutoffStr=cutoff.toISOString().slice(0,10);
  const oldies=rec.filter(s=>(s.first_air_date||"")<cutoffStr);
  console.log("\nfirst_air < "+cutoffStr+" (older than 300d) subset:",oldies.length);
  oldies.forEach(s=>console.log(`  ${s.name} first_air=${s.first_air_date} pop=${s.popularity.toFixed(0)}${s.id===207333?"  ← 207333":""}`));
  console.log("207333 in oldies?",oldies.some(s=>s.id===207333));

  // If subset too big, tighten to 400d
  const cutoff4=new Date();cutoff4.setUTCDate(cutoff4.getUTCDate()-400);const c4=cutoff4.toISOString().slice(0,10);
  const oldies4=rec.filter(s=>(s.first_air_date||"")<c4);
  console.log("\nfirst_air < "+c4+" (older than 400d) subset:",oldies4.length,"| 207333 in:",oldies4.some(s=>s.id===207333));

  // 207333's first_air age in days
  const fa=rec.find(s=>s.id===207333)?.first_air_date;
  console.log("\n207333 first_air:",fa,"≈",Math.round((new Date()-new Date(fa))/86400000),"days old");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});