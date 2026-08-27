// TEMPORARY diagnostic #17 — does 207333 actually pass the trending → cnFilter
// pipeline with zh-CN? The handler uses intelFetchPages("/trending/tv/week",{},3)
// with language=zh-CN. Check each page's entries for 207333 and whether it has zh overview.
const B = "https://api.themoviedb.org/3";
const AUTH = { Authorization: `Bearer ${process.env.TMDB_KEY}` };
const get = async (path) => {
  const r = await fetch(`https://api.themoviedb.org/3${path}`, { headers: AUTH });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
};
const hasChinese = (t) => /[\u4e00-\u9fff]/.test(t || "");

async function main() {
  const all = [];
  for (let p = 1; p <= 3; p++) {
    const q = await get(`/trending/tv/week?page=${p}&language=zh-CN`);
    const res = q.results || [];
    all.push(...res.map((x,i)=>({...x, _pg:p, _rank:(p-1)*20+i+1})));
    console.log("page",p,"count",res.length, p===2?"rank21-40: "+res.slice(0,20).map((x,i)=>`${i+21}.${x.name}`).join(", "):"");
  }
  console.log("total across 3 pages:", all.length);
  // find 207333
  const near207 = all.filter(x=>x.id===207333);
  console.log("207333 in pages1-3?", near207.length ? near207.map(x=>({pg:x._pg,rank:x._rank,name:x.name,pop:x.popularity,zhName:hasChinese(x.name),zhOv:hasChinese(x.overview),ov:(x.overview||"").slice(0,40)})) : "NO");
  // how many 207333 passes cnFilter if present
}
main().catch(e=>{console.error("FATAL",e.message);process.exit(1);});