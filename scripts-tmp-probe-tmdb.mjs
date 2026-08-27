// TEMPORARY diagnostic #18 — verify the S_date fix (use last_episode) makes 207333
// reach ongoing top-10 in a realistic pool. Reproduces handleIntelTV with NEW scoring.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`${B}${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");
const cnFilter = (s) => hasChinese(s.title || s.name) && hasChinese(s.overview);
const intelRatingOk = (m) => !m.vote_average || m.vote_average >= 4;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
const daysAgo = (n) => { const d=new Date(); d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); };
const t30=daysAgo(30),t180=daysAgo(180),t90=daysAgo(90);

function classifyRegion(item){const lang=(item.original_language||"en").toLowerCase();if(lang==="zh"){const c=item.origin_country||[];if(c.includes("CN"))return"cn";if(["TW","HK","MO"].some(x=>c.includes(x)))return"hmt";return"zh";}if(["ja","ko","th","vi","id"].includes(lang))return lang;return"other";}
const SCORE={w_pop:0.25,w_date:0.45,w_qual:0.30,hlFuture:14,hlPast:7};
// NEW intelComputeScore with lastEp-aware S_date (mirrors my edit)
function computeScore(item,minPop,maxPop){
  const pop=item.popularity||0;const popRange=Math.max(maxPop-minPop,1);
  const S_pop=Math.min(100,Math.max(0,((pop-minPop)/popRange)*100));
  let S_qual;const r=item.vote_average;
  if(r!=null&&r>0)S_qual=Math.min(100,Math.max(0,(r/10)*100));else if((item.vote_count||0)>0)S_qual=50;else S_qual=40;
  const lastEp=item.last_episode_to_air?.air_date;
  const dateStr=item.release_date||lastEp||item.first_air_date;
  let S_date=0;
  if(dateStr){const now=new Date(today+"T00:00:00"),rel=new Date(dateStr+"T00:00:00");const du=(rel-now)/86400000;const hl=du>=0?14:7;S_date=100*Math.exp(-Math.LN2/hl*Math.abs(du));}
  return (0.25*S_pop+0.45*S_date+0.30*S_qual)/100;
}
function selectDiverse(items,count,reserved){
  if(items.length<=count)return items;
  const maxPop=Math.max(...items.map(m=>m.popularity||0),0),minPop=Math.min(...items.map(m=>m.popularity||0),0);
  const scored=items.map(m=>({item:m,region:classifyRegion(m),score:computeScore(m,minPop,maxPop),mainGenre:(m.genre_ids||[])[0]}));
  scored.sort((a,b)=>b.score-a.score);
  const reservedItems={},pool=[];
  for(const s of scored){const region=s.region;const slots=reserved[region]||0;if(slots>0&&!reservedItems[region])reservedItems[region]=[];if(slots>0&&reservedItems[region].length<slots){reservedItems[region].push(s);continue;}pool.push(s);}
  const result=[];for(const x of Object.values(reservedItems))result.push(...x);
  const genreCount={};for(const s of pool){if(result.length>=count)break;const g=s.mainGenre;if(g&&(genreCount[g]||0)>=4)continue;genreCount[g]=(genreCount[g]||0)+1;result.push(s);}
  return result.sort((a,b)=>b.score-a.score).slice(0,count).map(s=>s.item);
}

async function main() {
  // Build pool same as handler: onTheAir(2p) + trending(3p), dedup
  const pool=[];const seen=new Set();
  for(let p=1;p<=2;p++){const q=await get(`/tv/on_the_air?page=${p}&language=zh-CN`);for(const s of q.results||[]){if(!seen.has(s.id)){seen.add(s.id);pool.push(s);}}}
  for(let p=1;p<=3;p++){const q=await get(`/trending/tv/week?page=${p}&language=zh-CN`);for(const s of q.results||[]){if(!seen.has(s.id)){seen.add(s.id);pool.push(s);}}}
  console.log("raw pool:",pool.length, "has 207333:",pool.some(s=>s.id===207333));

  // filter
  const candidates=pool.filter(s=>cnFilter(s)&&intelRatingOk(s)&&Number((s.first_air_date||"").slice(0,4))>=2010&&((s.popularity||0)>=30));
  console.log("after gates:",candidates.length,"| 207333 in:",candidates.some(s=>s.id===207333));
  const p207=candidates.find(s=>s.id===207333);
  if(p207) console.log("  207333 fields: first_air",p207.first_air_date,"| list has last_ep:",!!p207.last_episode_to_air);

  // detail-backfill last_ep for those missing (needed for S_date score)
  const detailed=[];
  for(const s of candidates){if(s.last_episode_to_air){detailed.push(s);continue;}const det=await get(`/tv/${s.id}?language=zh-CN`);detailed.push(det);}
  const dd207=detailed.find(s=>s.id===207333);
  console.log("after detail, 207333 last_ep:",dd207?.last_episode_to_air?.air_date);

  // tier1/tier2 + select
  const scored=detailed.map(s=>{const la=s.last_episode_to_air?.air_date||"";const recent=(la&&la>=t30)||((s.first_air_date||"")>=t180);return{s,recent};});
  const tier1=scored.filter(x=>x.recent).map(x=>x.s);
  const tier2=scored.filter(x=>!x.recent).map(x=>x.s);
  const selected=[...selectDiverse(tier1,10,{cn:1,hmt:1,jp:1,kr:1}),...selectDiverse(tier2,5,{cn:1,hmt:1,jp:1,kr:1})].slice(0,15);
  console.log("\nselect tier1:",tier1.length,"tier2:",tier2.length,"| selected:",selected.length);
  console.log("  selected:",selected.map(s=>s.name).join(" | "));
  const inSel=selected.find(s=>s.id===207333);
  console.log("  207333 selected?",!!inSel, inSel?`rank=${selected.indexOf(inSel)+1}`:"");
  if(selected.some(s=>s.id===207333)){
    const my=selected.find(s=>s.id===207333);
    // score breakdown
    const all=detailed.map(s=>s.popularity||0);const maxPop=Math.max(...all),minPop=Math.min(...all);
    const sc=computeScore(my,minPop,maxPop);
    const la=my.last_episode_to_air?.air_date;
    console.log("  207333 score",sc.toFixed(4),"last_ep",la,"| would map to tvwall S"+my.last_episode_to_air?.season_number+"E"+my.last_episode_to_air?.episode_number);
  }
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});