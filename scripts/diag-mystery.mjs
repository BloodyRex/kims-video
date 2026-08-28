const token = process.env.TMDB;
const h = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
const hasCN = (t) => /[\u4e00-\u9fff]/.test(t || "");
(async () => {
  // 1. search 神秘肌肤 / Mysterious Skin to get id + metadata
  const s1 = await (await fetch("https://api.themoviedb.org/3/search/movie?query=Mysterious%20Skin&language=zh-CN", h)).json();
  const hit = s1.results?.[0];
  console.log("SEARCH hit:", hit ? JSON.stringify({ id: hit.id, title: hit.title, orig: hit.original_title, year: (hit.release_date||"").slice(0,4), rel: hit.release_date, pop: hit.popularity, rate: hit.vote_average }) : "NOT FOUND");
  // 2. now_playing pages 1-4: is this id present? list their release years
  let inNowPlaying = [];
  for (let p = 1; p <= 4; p++) {
    const np = await (await fetch(`https://api.themoviedb.org/3/movie/now_playing?language=zh-CN&region=US&page=${p}`, h)).json();
    const r = np.results || [];
    // collect title+year for all, and note if hit present
    inNowPlaying.push(...r.map(m => ({ id: m.id, title: m.title, orig: m.original_title, year: (m.release_date||"").slice(0,4), rel: m.release_date, pop: m.popularity, rate: m.vote_average, matched: hit && m.id === hit.id })));
  }
  const my = inNowPlaying.filter(x => x.matched);
  console.log("now_playing total:", inNowPlaying.length);
  console.log("神秘肌肤 IN now_playing:", my.length ? JSON.stringify(my[0]) : "NO");
  const years = {};
  inNowPlaying.forEach(m => { const y = m.year || "?"; years[y] = (years[y]||0)+1; });
  console.log("now_playing year distribution:", JSON.stringify(years));
  console.log("pre-2015 in now_playing:", inNowPlaying.filter(m=>Number(m.year||0)<2015).map(m=>`${m.title}(${m.year})`).join(", "));
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });