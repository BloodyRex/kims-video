// TMP v2: confirm why solitude excluded
// 1) Is it in on_the_air pages 1-4? (it's Ended+in_prod=false so likely NO)
// 2) On trending page2, what language does TMDB return title/overview in (en? which field)?
// 3) Which successful ongoing entries came from trending (en-payload) and how did they pass cnFilter?
//    -> Reproduce the cnFilter on trending page2 items that DID make it vs solitude.
const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
const hasCn = (t) => /[\u4e00-\u9fff]/.test(t || "");
(async () => {
  // 1) on_the_air first 4 pages: does 207333 appear?
  console.log("=== on_the_air pages 1-4: solitude present? ===");
  for (let p = 1; p <= 4; p++) {
    const r = await fetch(`https://api.themoviedb.org/3/tv/on_the_air?page=${p}`, h);
    const d = await r.json();
    const f = (d.results||[]).find(x => x.id === 207333);
    console.log(`  page ${p}: contains 207333 = ${!!f}`);
  }

  // 2) trending page2 raw fields for 207333 (what language is name/overview)
  console.log("\n=== trending/tv/week page2: raw payload for 207333 ===\n");
  const tr = await fetch("https://api.themoviedb.org/3/trending/tv/week?page=2", h);
  const td = await tr.json();
  const item = (td.results||[]).find(x => x.id === 207333);
  console.log(`  name=${item.name} | original_name=${item.original_name} | overview_len=${(item.overview||"").length}`);
  console.log(`  overview_first80=${(item.overview||"").slice(0,80)}`);
  console.log(`  cnName=${hasCn(item.name)} | cnOverview=${hasCn(item.overview)}`);
  console.log(`  lang=${item.original_language} | origin_country=${JSON.stringify(item.origin_country)}`);

  // 3) For every trending page2 item, evaluate the exact ongoing filters:
  //    intelRatingOk (rate>0), year>=2010, pop>=30, cnFilter(titleCn && overviewCn)
  //    and show which pass -> these are the ones that could enter ongoing via trending.
  console.log("\n=== trending page2: filter reproduction (which pass cnFilter) ===");
  (td.results||[]).forEach((x,i)=>{
    const from = Number((x.first_air_date||"").slice(0,4));
    const yearOk = from >= 2010;
    const popOk = (x.popularity||0) >= 30;
    const rateOk = (x.vote_average||0) > 0;
    const cnT = hasCn(x.name); const cnO = hasCn(x.overview);
    const cnOk = cnT && cnO;
    const pass = yearOk && popOk && rateOk && cnOk;
    const isS = x.id === 207333;
    if (pass || isS) {
      console.log(`  ${isS?"***":"   "} id=${x.id} | ${String(x.name||"").slice(0,26)} | year${yearOk} pop${popOk} rate${rateOk} cn[${cnT?1:0}${cnO?1:0}] => ${pass?"PASS":"FAIL"} ${isS?"<-- SOLITUDE":""}`);
    }
  });
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });