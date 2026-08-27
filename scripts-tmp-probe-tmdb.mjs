// Diagnostic #31b — test TMDB discover/tv date params with FLAT query strings.
// Key: does discover support sorting/filtering by RECENT ACTIVITY (next/last episode)
// so we can find recently-concluded shows regardless of old first_air_date?
const B="https://api.themoviedb.org/3";const AUTH={Authorization:`Bearer ${process.env.TMDB_KEY}`};
const get=async(p)=>{const r=await fetch(B+p,{headers:AUTH});if(!r.ok)throw new Error(p+" "+r.status);return r.json();};
const da=n=>{const d=new Date();d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
const t90=da(90),now=new Date().toISOString().slice(0,10);
async function q(label,path){
  try{const r=await get(path);const res=r.results||[];const t207=res.find(s=>s.id===207333);
    console.log(`[${label}] n=${res.length} | 207333: ${t207?"YES rank"+(res.indexOf(t207)+1):"no"} | sample=${res.slice(0,3).map(s=>`${s.name}`).join(" / ")}`);}
  catch(e){console.log(`[${label}] ERR ${e.message}`);}
}
async function main(){
  console.log("today:",now,"| 90d ago:",t90,"\n");
  // 1) discover/tv sorted by first_air desc (we saw before) — 207333 far away
  await q("discover first_air_date.desc", `/discover/tv?sort_by=first_air_date.desc&page=1`);
  // 2) NUMBER of pages by popularity — where is 207333 (global pop rank)
  // 3) KEY: is there a 'first_air_date.window' or can we combine with 'sort_by' by a recency signal?
  //    The only recency-ish discover param is 'air_date.gte' (next ep). Try sort by popularity within air_date window.
  // 4) Just directly: how many EPISODES did 百年孤独 S2 air? Last ep 8/26. If we could list by episode-air-date...
  // TMDB has NO such endpoint. Confirm via doc-implied: discover params only first_air_date / air_date(next ep)
  await q("air_date.gte=t90 (next-ep window)", `/discover/tv?air_date.gte=${t90}&sort_by=popularity.desc&page=1`);
  await q("air_date.gte=t90 (next-ep), 3 pages", `/discover/tv?air_date.gte=${t90}&sort_by=popularity.desc&page=3`);

  // 5) The REAL signal for whole-season drops: on_the_air + trending we already use.
  //    Confirm NO last-episode-date discover filter exists by trying status=Ended only.
  await q("Ended pop desc p1", `/discover/tv?with_status=3&sort_by=popularity.desc&page=1`);
  await q("Ended pop desc p20", `/discover/tv?with_status=3&sort_by=popularity.desc&page=20`);
  await q("Ended + first_air<=today", `/discover/tv?with_status=3&first_air_date.lte=${now}&sort_by=popularity.desc&page=5`);

  console.log("\n→ If 207333 appears in none of these list positions despite trending rank 23,");
  console.log("  it confirms TMDB has no list-level 'recently-concluded' filter; only detail(/tv/{id})");
  console.log("  carries last_episode_to_air, which is THE only reliable signal.");
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});