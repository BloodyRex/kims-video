// ═══════════════════════════════════════════════════════════════════
// Kim's Video — Intelligence Worker (mechanically sliced from workers-1.4.js)
// Routes: /intelligence/overview | movies | tv | coming | weekly
//         /intelligence/hidden-gems | debug | trailer
// 逐字节切片，逻辑零改动。digest / 音乐管线留给后续 Phase。
// ═══════════════════════════════════════════════════════════════════

async function searchTMDB(title, year, type, token, language) {
  language = language || "zh-CN"; const dateF = type === "movie" ? "release_date" : "first_air_date"; const nameF = type === "movie" ? "title" : "name"; const origF = type === "movie" ? "original_title" : "original_name";
  const clean = title.replace(/[《》「」『』【】]/g, "").trim();
  const params = new URLSearchParams({ query: clean, include_adult: "false", language });
  const result = { poster: null, tmdbId: null, originalTitle: "", director: "", year: year || "", type: "", genres: [] };
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    if (!res.ok) return result; const d = await res.json(); const items = d?.results || []; if (!items.length) return result;
    let match = null, conf = "low";
    if (year) { const ym = items.find(m => { const y = m[dateF] ? Number(m[dateF].slice(0,4)) : null; return y && Math.abs(y - year) <= 1; }); if (ym) { match = ym; conf = "high"; } else { const nm = items.find(m => (m[nameF]||"").toLowerCase().includes(title.toLowerCase().slice(0,6))); if (nm) match = nm; } }
    match = match || items[0];
    if (match?.poster_path) result.poster = `https://image.tmdb.org/t/p/w342${match.poster_path}`;
    result.tmdbId = match.id || null; result.title = match[nameF] || ""; result.genres = match.genre_ids || [];
    if (result.tmdbId) { const ep = await fetchEnglishPoster(result.tmdbId, type, token); if (ep) result.poster = ep; }
    if (conf === "low") return result;
    result.originalTitle = match[origF] || ""; if (match[dateF]) result.year = match[dateF].slice(0,4);
    if (result.tmdbId) { const cr = await withCache(`${result.tmdbId}-${type}-credits-${language}`, async () => { const c = await fetch(`https://api.themoviedb.org/3/${type}/${result.tmdbId}/credits?language=${language}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }); return c.ok ? c.json() : null; }); if (cr) { const d = cr.crew?.find(c => c.job === "Director")?.name || ""; if (d) result.director = d; } }
  } catch (e) {}
  return result;
}

async function fetchEnglishPoster(tmdbId, type, token) { const d = await withCache(`${tmdbId}-${type}-poster`, async () => { const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?include_image_language=en,null`, { headers: { Authorization: `Bearer ${token}` } }); return r.ok ? r.json() : null; }); if (!d) return null; const p = d?.posters || []; const ep = p.find(x => x.iso_639_1 === "en") || p[0]; return ep ? `https://image.tmdb.org/t/p/w342${ep.file_path}` : null; }

async function withCache(key, fetcher, ttl = 86400) { const c = caches.default; const r = new Request(`https://tmdb-cache/${key}`); const h = await c.match(r); if (h) { console.log("[CACHE HIT]", key); return h.json(); } console.log("[CACHE MISS]", key); const d = await fetcher(); // Empty arrays are NOT valid results (2026-08-24): a subrequest-budget blowup
  // mid-handler once cached on_the_air=[] for a full TTL, and the pipeline's
  // US-edge colo kept serving that poisoned entry → 热播中 went blank site-wide
  // while the Asia colo (manually warmed) looked fine. Treat [] as failure so
  // the next caller re-fetches instead of inheriting the empty answer.
  if (!d || (Array.isArray(d) && d.length === 0)) return null; const resp = new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` } }); c.put(r, resp.clone()); return d; }

async function fetchTMDBDetails(tmdbId, token, language, opts = {}) {
  language = language || "zh-CN";
  const movieOnly = !!opts.movieOnly; // wall collection: movies only — TV must NOT enter the wall
  let d = await fetchTMDBByType(tmdbId, "movie", token, language);
  if (d) return d;
  if (movieOnly) return null; // movie lookup failed → it's a TV show (or invalid); never fall through to tv
  d = await fetchTMDBByType(tmdbId, "tv", token, language);
  return d || {};
}

async function fetchTMDBByType(tmdbId, type, token, language) { language = language || "zh-CN"; try { const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; const det = await withCache(`${tmdbId}-${type}-${language}-details`, async () => { const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?language=${language}`, { headers: h }); return r.ok ? r.json() : null; }); if (!det) return null; const cr = await withCache(`${tmdbId}-${type}-${language}-credits`, async () => { const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/credits?language=${language}`, { headers: h }); return r.ok ? r.json() : { crew: [] }; }) || { crew: [] }; const director = cr.crew?.find(c => c.job === "Director")?.name || ""; const yr = det.release_date ? det.release_date.slice(0,4) : det.first_air_date ? det.first_air_date.slice(0,4) : ""; const tLabel = type === "movie" ? (language.startsWith("zh") ? "电影" : "Movie") : (language.startsWith("zh") ? "剧集" : "TV Series"); const cast = cr.cast?.slice(0,5).map(c => c.name) || []; let poster = det.poster_path ? `https://image.tmdb.org/t/p/w342${det.poster_path}` : null; if (poster) { const ep = await fetchEnglishPoster(tmdbId, type, token); if (ep) poster = ep; } return { director, year: yr, originalTitle: det.original_title || det.original_name || "", type: tLabel, title: det.title || det.name || "", imdb_id: det.imdb_id || "", poster, overview: det.overview || "", genres: (det.genres || []).map(g => g.name), vote_average: det.vote_average || null, runtime: det.runtime || null, cast, release_date: det.release_date || det.first_air_date || "" }; } catch (e) { return null; } }

const INTEL_GENRE_IDS = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
};

function intelMapGenres(ids) { return (ids || []).map(id => INTEL_GENRE_IDS[id]).filter(Boolean); }

function intelToday() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }
function intelDaysAgo(n) { return new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }); }

function intelDaysUntil(releaseDateStr, todayStr) {
  if (!releaseDateStr) return typeof releaseDateStr === "number" ? releaseDateStr : 999;
  const today = todayStr || intelToday();
  return Math.ceil((Date.parse(`${releaseDateStr}T00:00:00+08:00`) - Date.parse(`${today}T00:00:00+08:00`)) / 86400000);
}
function intelRatingOk(m) { return !m.vote_average || m.vote_average >= 4; }

function intelCredibleRating(item, cred) {
  const v = item && item.vote_count ? item.vote_count : 0;
  const R = item && item.vote_average ? item.vote_average : 0;
  if (R <= 0) return 0;                                   // 无评分 → 0（上游原始可靠挡）
  const m = (cred && cred.minVotes) || 20;
  const C = (cred && cred.meanRating) != null ? cred.meanRating : 6.0;
  if (v <= 0) return C;                                   // 有评分无票数 → 按中性基准（不硬砍）
  const w = v / (v + m);
  return w * R + (1 - w) * C;
}

function intelParseJSON(raw) { return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim()); }

const SCORE_OPTS = {
  movie:  { w_pop: 0.25, w_date: 0.55, w_qual: 0.20, hlFuture: 14, hlPast: 7 },
  tv:     { w_pop: 0.25, w_date: 0.45, w_qual: 0.30, hlFuture: 14, hlPast: 7 },
  music:  { w_pop: 0.50, w_date: 0.20, w_qual: 0.30, hlFuture: 21, hlPast: 14 },
};

const DEFAULT_INTEL_CFG = {
  movie: {
    sources: {                                   // import sources: 打勾是否收录 + 抓取页数
      nowPlayingUS:  { enabled: true, pages: 2 },// 美国在映:每页20部,取最近2页
      nowPlayingCN:  { enabled: true, pages: 2 },// 中国内地院线(牛来等国内上映但未进美区的片)
      recently90d:   { enabled: true, pages: 3 },// 过去90天discover(补非美小片)
      upcoming90d:   { enabled: true, pages: 1 },// 未来90天discover(即将上映池)
    },
    gateNow: {                                   // 正在热映"质量复合门槛"(gateNowPlaying)
      wRating: 0.7, wPop: 0.3, floor: 6.0,       // score=wRating×分 + wPop×pop10 ≥ floor
      popScale: 10, popCap10: 10,                // pop10=min(popCap10, pop/popScale)
      cnFloorPopularity: 8, cnFloorRating: 2,    // 国产片放宽: 仅需热度≥8且分≥2
    },
    reserve: { zh: 0, ja: 0, ko: 0 },            // 地区保底名额: 全部关闭(2026-08-28 Rex决策)
    weekBack: 10,                                // "本周"窗口: 近N天起的上映(CN日二次分桶)
    score:     { w_pop: 0.25, w_date: 0.55, w_qual: 0.20, hlFuture: 14, hlPast: 7 },
  },
  tv: {
    sources: {                                   // all sources: 数据勾选 + 抓取规模
      onTheAir:           { enabled: true, pages: 2 },// 排播中剧(未来7天有新集) TMDB
      discoverUpcoming:   { enabled: true, pages: 1 },// TMDB discover 未来90天首播
      tvmazePremiere:     { enabled: true, offsets: [0, 1, 2, 3] },// TVMAZE 未来0-3天首播
      tvmazeUpcoming:     { enabled: true, offsets: [7, 14] },     // TVMAZE 未来+7/+14天首播
      trendingWeek:       { enabled: true, pages: 3 },// 本周最热(TMDB) 60部 —— 补"整季放出"剧
    },
    yearCutoff: 2010,                            // 超长连载剧首播年份>=此值(数值比较)
    popFloor: 30,                                // ongoing 热播剧最低popularity
    reserve: { cn: 0, hmt: 0, jp: 0, kr: 0 },    // 地区保底: 全部关闭(2026-08-28 Rex决策)
    ongoingTier1: 10,                            // 近30天活跃剧抢先名额
        ongoingTier2: 5,                             // 其余剧补充名额
        ongoingDetailCap: 8,                         // 热播剧 episode detail 回填上限(防50子请求超限)
    detailBudget: 12,                            // premieres+ongoing 共享的 episode-detail 总预算(防50子请求超限)
    upcomingScore: { wDate: 0.5, wPop: 0.3, wZh: 0.1, wRating: 0.1 }, // 即将播出评分权重(日期/热度/中文/评分) 四者和=1; wPop 2026-09-04 加(池内min-max软信号),修 dateScore 全打平
    score:     { w_pop: 0.25, w_date: 0.45, w_qual: 0.30, hlFuture: 14, hlPast: 7 },
  },
  ai: {                                          // AI 搜索推荐"恰好5部"的分类配比
    recRatio: { total: 5, popular: 2, hidden: 2, controversial: 1 }, // 前N热门/中N冷门/末N争议
    fillPopularDesc: "高评分、高知名度的大众热门影片",
    fillHiddenDesc: "高品质冷门/小众/独立影片",
    fillControversialDesc: "评价存在争议、口碑两极分化的影片",
  },
  // ── 评分可信度 (2026-09-03 Rex 决策，IMDb 贝叶斯加权) ──
  // 主方案：把"评分人数"纳入评分本身——票数越少的分越不可信，被拉向中性基准 C。
  //   R加权 = (v/(v+m))×R + (m/(v+m))×C   (R=TMDB评分, v=vote_count, m=minVotes, C=meanRating)
  // 已上映/已开播的普通来源用加权分；upcoming/premiere/TVMAZE 天然无票，不适用，跳过。
  // 可选硬下限 minVoteCountHard 默认关：开启后对普通来源 .filter(v>=minVotes)，
  // 但默认用贝叶斯加权自然压尾更稳妥，不误伤上映首周新片。
  credibility: {
    minVotes: 20,            // m：最小票数阈值（普通来源；CN池用 cnMinVotes）
    meanRating: 6.0,         // C：中性基准分，票数→0 时 R加权→C
    cnMinVotes: 20,          // 国产/华语池阈值。实测(2026-09-03)国产池中位数95反而高于非CN(24)，
                             // 故默认与全局一致、不额外放宽；留作可调应对未来数据分布变化
    minVoteCountHard: false, // 可选硬下限，默认关（贝叶斯加权已足够，硬砍易误伤新片）
  },
};

function deepMerge(base, over) {
  if (over == null || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
  return out;
}
function structClone(obj) { return typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }

const INTEL_CFG_CACHE_KEY = "intelcfg:v1";

async function getIntelConfig(env) {
  const mergedWith = async (saved) => deepMerge(structClone(DEFAULT_INTEL_CFG), saved || {});
  try {
    const c = caches.default;
    const req = new Request(`https://intelcfg/${INTEL_CFG_CACHE_KEY}`);
    const hit = await c.match(req);
    if (hit) { try { return await mergedWith(await hit.json()); } catch (e) {} }
  } catch (e) {}
  let saved = null;
  if (env?.DISCOVER_KV) { try { saved = await env.DISCOVER_KV.get("intel:cfg", "json"); } catch (e) {} }
  const merged = await mergedWith(saved);
  try {
    const resp = new Response(JSON.stringify(merged), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } });
    caches.default.put(new Request(`https://intelcfg/${INTEL_CFG_CACHE_KEY}`), resp.clone());
  } catch (e) {}
  return merged;
}

function intelComputeScore(item, opts, today, batchMinPop, batchMaxPop) {
  const {
    w_pop = 0.25, w_date = 0.55, w_qual = 0.20,
    hlFuture = 14, hlPast = 7
  } = opts || {};

  // ── S_pop: popularity (0-100), normalized within current batch ──
  const pop = item.popularity || 0;
  const popRange = Math.max(batchMaxPop - batchMinPop, 1);
  const S_pop = Math.min(100, Math.max(0, ((pop - batchMinPop) / popRange) * 100));

  // ── S_qual: quality from credible rating (0-100) ──
  // 用 IMDb 贝叶斯加权分（R加权）替代裸 vote_average：个位数票的高分被拉向 C，
  // 高票高分才可信。cred 来自 opts.cred（admin 可调）。无票/无分仍走基线。
  let S_qual;
  const rawQual = item.vote_average;
  if (rawQual != null && rawQual > 0) {
    // TMDB 0-10 评分 → 贝叶斯加权 → 0-100
    const credR = intelCredibleRating(item, opts && opts.cred);
    S_qual = Math.min(100, Math.max(0, (credR / 10) * 100));
  } else if ((item.vote_count || 0) > 0) {
    // Has votes but result is 0 or unrated → neutral baseline
    S_qual = 50;
  } else {
    // No data at all → mild baseline (won't boost but won't bury)
    S_qual = 40;
  }

  // ── S_date: non-axial decay (0-100) ──
    // TV 剧集优先用"最近一季"的播出日期 (last_episode_to_air.air_date) 计算新近度，
    // 而非剧集首播日 —— 整季放出型剧（如《百年孤独》首播 2024-12）刚完结新季
    // (8/26) 时 first_air 已过老，只有 last_episode 能反映"它现在正热"。这样
    // 评分能真正体现"最新一季"，而不是被首播年份拖老。movie 无此字段，退回原逻辑。
    const lastEp = item.last_episode_to_air?.air_date;
    const dateStr = item.release_date || lastEp || item.first_air_date;
  let S_date = 0;
  if (dateStr) {
    const now = new Date(today + "T00:00:00");
    const release = new Date(dateStr + "T00:00:00");
    const daysUntil = (release - now) / 86400000;
    const halfLife = daysUntil >= 0 ? hlFuture : hlPast;
    S_date = 100 * Math.exp(-Math.LN2 / halfLife * Math.abs(daysUntil));
  }
  // No date → S_date stays 0, item sinks in ranking

  const composite = (w_pop * S_pop + w_date * S_date + w_qual * S_qual) / 100;
  return { score: composite, S_pop, S_date, S_qual };
}

function intelNormalizeMovie(m, type) {
  type = type || "movie";
  const df = type === "movie" ? "release_date" : "first_air_date";
  const item = {
    tmdbId: m.id,
    title: m.title || m.name || "",
    titleEn: m._titleEn || m.original_title || m.original_name || m.title || "",
    originalLanguage: m.original_language || "",
    originCountry: m.origin_country || [],
    year: (m[df] || "").slice(0, 4),
    releaseDate: m[df] || "",
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
    rating: m.vote_average || 0,
    genre: intelMapGenres(m.genre_ids),
    summary: (m.overview || "").slice(0, 200),
    summaryEn: (m._overviewEn || m.overview || "").slice(0, 200),
  };
  // TV extras — only set nextAirDate from actual next_episode_to_air data
  if (type === "tv") {
    if (m.next_episode_to_air?.air_date) item.nextAirDate = m.next_episode_to_air.air_date;
    if (m.last_episode_to_air?.season_number) item.season = m.last_episode_to_air.season_number;
    else if (m.next_episode_to_air?.season_number) item.season = m.next_episode_to_air.season_number;
    else if (m.season_number) item.season = m.season_number;
    if (m.last_episode_to_air?.episode_number) item.episode = m.last_episode_to_air.episode_number;
    else if (m.next_episode_to_air?.episode_number) item.episode = m.next_episode_to_air.episode_number;
    else if (m.episode_number) item.episode = m.episode_number;
    if (m.last_episode_to_air?.air_date) item.latestAirDate = m.last_episode_to_air.air_date;
    else if (m.next_episode_to_air?.air_date) item.latestAirDate = m.next_episode_to_air.air_date;
  }
  return item;
}

async function intelFetchTMDB(token, path, params, lang, opts = {}) {
  params = params || {};
  lang = lang || "zh-CN";
  // opts.en=false → skip the parallel en-US fetch (saves 1 subrequest/page).
  // handleIntelTV list scraping uses this to free budget for episode-detail
  // backfill (S/E), which was hitting Cloudflare's 50-subrequest ceiling.
  // en metadata (_titleEn/_overviewEn) is a nice-to-have for the EN UI; the
  // list cards fall back to original_name/overview, which is acceptable.
  const wantEn = opts.en !== false;
  const buildUrl = (language) => {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    url.searchParams.set("language", language);
    return url;
  };
  const zhUrl = buildUrl(lang);
  const cacheKey = "intel2-" + btoa(zhUrl.toString()).replace(/[=+/]/g, "");
  const data = await withCache(cacheKey, async () => {
    if (!wantEn) {
      const zhRes = await fetch(zhUrl, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      if (!zhRes.ok) throw new Error(`TMDB ${path}: ${zhRes.status}`);
      return (await zhRes.json()).results || [];
    }
    const [zhRes, enRes] = await Promise.all([
      fetch(zhUrl, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }),
      fetch(buildUrl("en-US"), { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }),
    ]);
    if (!zhRes.ok) throw new Error(`TMDB ${path}: ${zhRes.status}`);
    const zhData = await zhRes.json();
    const zhResults = zhData.results || [];
    if (enRes.ok) {
      const enData = await enRes.json();
      const enMap = new Map((enData.results || []).map(r => [r.id, r]));
      return zhResults.map(item => {
        const en = enMap.get(item.id);
        if (en) {
          item._overviewEn = en.overview || "";
          item._titleEn = en.title || en.name || "";
        }
        return item;
      });
    }
    return zhResults;
  }, 3600);
  return data;
}

async function intelFetchPages(token, path, params = {}, pages = 4, opts = {}) {
  const all = [];
  const seen = new Set();
  for (let p = 1; p <= pages; p++) {
    const page = await intelFetchTMDB(token, path, { ...params, page: p }, undefined, opts);
    if (!page || page.length === 0) break;
    for (const item of page) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        all.push(item);
      }
    }
  }
  return all;
}

async function intelFetchUpcomingMovies(token, pages = 10) {
  const today = intelToday();
  const plus90 = new Date(Date.now() + 90 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  return intelFetchPages(token, "/discover/movie", {
    "primary_release_date.gte": today,
    "primary_release_date.lte": plus90,
    "sort_by": "popularity.desc",
  }, pages);
}

async function intelFetchReleasedMovies(token, pages = 3) {
  const today = intelToday();
  const minus90 = intelDaysAgo(90);
  return intelFetchPages(token, "/discover/movie", {
    "primary_release_date.gte": minus90,
    "primary_release_date.lte": today,
    "sort_by": "popularity.desc",
  }, pages);
}

function classifyRegion(item) {
  const lang = (item.original_language || "en").toLowerCase();
  if (lang === "zh") {
    const countries = item.origin_country || [];
    if (countries.includes("CN")) return "cn";
    if (["TW", "HK", "MO"].some(c => countries.includes(c))) return "hmt";
    return "zh";
  }
  if (lang === "ja") return "jp";
  if (lang === "ko") return "kr";
  return "other";
}

function intelSelectDiverse(items, count = 20, reserved = { zh: 0, ja: 0, ko: 0 }, opts = null, today = null) {
  if (items.length <= count) return items;

  const maxPop = Math.max(...items.map(m => m.popularity || 0), 0);
  const minPop = Math.min(...items.map(m => m.popularity || 0), 0);

  const scored = items.map(m => {
    let score;
    if (opts && today) {
      score = intelComputeScore(m, opts, today, minPop, maxPop).score;
    } else {
      const popRange = Math.max(maxPop - minPop, 1);
      score = ((m.vote_average || 0) / 10) * 0.5 + ((m.popularity || 0) - minPop) / popRange * 0.5;
    }
    return {
      item: m,
      region: classifyRegion(m),
      score,
      mainGenre: (m.genre_ids || [])[0],
    };
  });
  scored.sort((a, b) => b.score - a.score);

  // Reserve slots by region (pick highest scored per region)
  const reservedItems = {};
  const pool = [];
  for (const s of scored) {
    const region = s.region;
    const slots = reserved[region] || 0;
    if (slots > 0) {
      if (!reservedItems[region]) reservedItems[region] = [];
      if (reservedItems[region].length < slots) {
        reservedItems[region].push(s);
        continue;
      }
    }
    pool.push(s);
  }

  // Assemble: reserved first, then fill with genre cap
  const result = [];
  for (const items of Object.values(reservedItems)) result.push(...items);

  const genreCount = {};
  for (const s of pool) {
    if (result.length >= count) break;
    const g = s.mainGenre;
    if (g && (genreCount[g] || 0) >= 4) continue;
    genreCount[g] = (genreCount[g] || 0) + 1;
    result.push(s);
  }

  return result.sort((a, b) => b.score - a.score).slice(0, count).map(s => s.item);
}

function intelSelectScored(items, floor, cap = 15) {
  const qual = items.filter(m => (m.popularity || 0) >= floor);
  if (!qual.length) return [];
  const maxPop = Math.max(...qual.map(m => m.popularity || 0), 1);
  const minPop = Math.min(...qual.map(m => m.popularity || 0), 0);
  const popRange = Math.max(maxPop - minPop, 1);
  const zhC = (t) => /[一-鿿]/.test(t || "");
  const zhScore = (m) => (zhC(m.title || m.name) ? 50 : 0) + (zhC(m.overview) ? 50 : 0);
  return qual
    .map(m => ({
      m,
      score: (0.6 * Math.min(100, Math.max(0, ((m.popularity || 0) - minPop) / popRange * 100)) + 0.4 * zhScore(m)) / 100,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map(x => x.m);
}

async function intelFetchMusicBrainz(dateStr) {
  const cacheKey = `intel-mb-${dateStr}`;
  return withCache(cacheKey, async () => {
    const url = `https://musicbrainz.org/ws/2/release?query=date:${dateStr}&fmt=json&limit=25`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BloodyRex-Intelligence/1.0 (rexhr@yahoo.com)" },
    });
    if (!res.ok) throw new Error(`MusicBrainz: ${res.status}`);
    const data = await res.json();
    const releases = (data?.releases || []).map(r => ({
      mbid: r.id,
      title: r.title || "",
      artist: (r["artist-credit"] || []).map(ac => ac.name || ac.artist?.name || "").join(", "),
      releaseDate: r.date || dateStr,
      year: (r.date || "").slice(0, 4),
      cover: "",
      status: r.status || "",
      country: r.country || "",
      primaryType: r["release-group"]?.["primary-type"] || "",
      secondaryTypes: r["release-group"]?.["secondary-types"] || [],
      genre: (r["release-group"]?.["primary-type"] || ""),
      tags: (r["release-group"]?.tags || []).map(t => t.name).slice(0, 5),
    }));
    return releases;
  }, 7200);
}

const MAP_LIMIT_DEFAULT = 10;
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit || 1, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(runners);
  return out;
}

async function handleIntelOverview(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const weekAgo = intelDaysAgo(7);
  const cfg = await getIntelConfig(env);
  const movieSc = { ...SCORE_OPTS.movie, ...cfg.movie.score, cred: cfg.credibility };
  const tvSc = { ...SCORE_OPTS.tv, ...cfg.tv.score, cred: cfg.credibility };

  // Fetch data directly with same page counts as category handlers (21 subrequests)
  // MusicBrainz is wrapped in its own catch: a MB infra blip (525, hit
  // 2026-08-24) must not 500 the WHOLE overview — stats lose one number,
  // everything else still ships.
  //
  // 2026-10-02 — same treatment for the four TMDB groups. This handler reads ~30
  // upstream resources; on a COLD cache (first hit after every deploy, every edge
  // cache expiry) it fetches all of them at once, and ANY single group tripping
  // the per-invocation budget rejected the bare Promise.all → uncaught → 500 for
  // the first visitor after each deploy. Each group is now isolated: it degrades
  // to [] and its NAME is reported in `degraded`, which the daily pipeline treats
  // as "not today's data" and retries — the retry finds the groups that DID
  // succeed warm in cache, so the budget reaches further and the cold miss
  // self-heals instead of being published as a 500 / hole.
  const degraded = [];
  const group = async (name, fn) => {
    try {
      return (await fn()) || [];
    } catch (e) {
      degraded.push(name);
      console.warn(`overview: ${name} fetch failed (degrades to empty) — ${e.message}`);
      return [];
    }
  };
  const [nowPlaying, upcoming, trending, tvOnAir] = await Promise.all([
    group("nowPlaying", () => intelFetchPages(token, "/movie/now_playing", { region: "US" }, 4)),
    group("upcoming", () => intelFetchUpcomingMovies(token, 1)),
    group("trending", () => intelFetchTMDB(token, "/trending/movie/week")),
    group("tvOnAir", () => intelFetchPages(token, "/tv/on_the_air", {}, 2)),
  ]);
  let todayMB = [];
  try {
    todayMB = await intelFetchMusicBrainz(today) || [];
  } catch (e) {
    console.warn("MB fetch failed (stats only):", e.message);
  }

  const hasChinese = (text) => /[一-鿿]/.test(text || "");
  const cnFilter = (m) => hasChinese(m.title || m.name) && hasChinese(m.overview);

  // Movies: same cnFilter + diversity as handleIntelMovies
  const weekCandidates = nowPlaying
    .filter(m => m.release_date && m.release_date >= weekAgo && m.release_date <= today)
    .filter(cnFilter)
    .filter(intelRatingOk);
  const weekSelected = intelSelectDiverse(weekCandidates, 20, { zh: 0, ja: 0, ko: 0 }, movieSc, today);
  const moviesReleased = weekCandidates.length;

  // TV: same cnFilter as handleIntelTV  (ongoing section)
  const tvCandidates = tvOnAir.filter(cnFilter).filter(intelRatingOk);
  const tvSelected = intelSelectDiverse(tvCandidates, 20, { cn: 0, hmt: 0, jp: 0, kr: 0 }, tvSc, today);

  // ── Upcoming movies (P1-2 fix 2026-08-24): SAME scored selection as
  // handleIntelMovies.upcoming — popularity floor 15 + zh bonus (0.4 weight),
  // NO hard zh filter. The previous local ovZh hard gate shrank the list to 0/6
  // (live data 2026-08-23) and contradicted movies.json.upcoming; the pipeline
  // deliberately does NOT re-filter `upcoming` keys for this exact reason.
  // Full cap 15 kept (= movies.upcoming cap) so the overview can take a
  // date-first subset of the very same set.
  const upcomingCandidates = upcoming
    .filter(m => m.release_date && m.release_date >= today)
    .filter(intelRatingOk);
  const upcomingSelected = intelSelectScored(upcomingCandidates, 15);
  const comingSoon = upcomingSelected.map(m => ({
      ...intelNormalizeMovie(m),
      daysUntil: Math.max(0, intelDaysUntil(m.release_date, today)),
    }));

  // ── Editor's Picks v2 (2026-08-23): fixed 6 cards, daily rotation ──
  // Rex: 总览的编辑精选 = 合并原「隐藏宝藏」「热榜趋势」，固定 6 张，每天有变化。
  // Composition: ★编辑 ×2 (composite-scored this-week pool) +
  //               💎宝藏 ×2 (released pool, rating≥7.5 + low relative popularity) +
  //               🔥热榜 ×2 (top of trending/movie/week — trending already fetched).
  // Daily rotation = deterministic shuffle seeded by Beijing date string: stable
  // across same-day pipeline reruns, shifts across days. Pools that come up short
  // backfill from other pools so the count is ALWAYS exactly 6.
  const dailySeed = Number(today.replace(/-/g, "")); // e.g. 20260823
  const seededShuffle = (arr) => {
    const a = [...arr];
    let s = dailySeed || 1;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) % 2147483648; // LCG — deterministic
      const j = s % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // ⚠️ Pools here are RAW TMDB shapes (id / vote_average), not normalized —
  // read fields defensively or the gem pool silently ends up empty.
  const ovGid = (m) => String(m.tmdbId ?? m.id);
  const ovRate = (m) => m.vote_average ?? m.rating ?? 0;
  // zh gate mirrors the pipeline's filterChineseContent (title AND overview in
  // Chinese). Both pools need it: non-zh picks get killed by the pipeline
  // filter layer AFTER the worker already counted them → short sections.
  const ovZh = (m) => {
    const t = m.title || m.name || "";
    return /[一-鿿]/.test(t) && /[一-鿿]/.test(m.overview || "");
  };
  const popSorted = [...nowPlaying].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  // Same zh gate on the gem pool — non-zh gems would be killed by the pipeline's
  // filterChineseContent AFTER the worker already counted them (2026-08-24:
  // Barrio Triste / Cookie Queens dropped the section to 4 cards).
  // ── Gem cooldown (2026-09-02, Rex: 神秘肌肤 2005 re-release topped 编辑精选
  // 6 straight days 08-28→09-02). A re-release is legitimately in now_playing
  // (low heat + high rating = perfect "hidden gem"), but should not headline
  // every day. Exclude gems selected in the last N days (default 7) so picks
  // rotate. KV-backed (DISCOVER_KV), key intel:gemCool:{tmdbId}=lastPickedDate.
  const gemCooldownDays = 7;
  let gemCoolSet = new Set();
  if (env?.DISCOVER_KV) {
    try {
      const coolKeys = await env.DISCOVER_KV.list({ prefix: "intel:gemCool:", limit: 200 });
      // Keys self-expire (TTL == the 7-day window), so the set is bounded and 200
      // is generous — but never truncate silently: stale entries past the page
      // would be ignored and the gem rotation would quietly degrade.
      if (!coolKeys.list_complete) console.warn(`gem cooldown list truncated at ${coolKeys.keys.length} keys — entries beyond this are ignored`);
      const now = Date.now();
      const cutoff = now - gemCooldownDays * 86400000;
      // 2026-10-02: bounded concurrency — up to 200 cooldown keys used to be read
      // (and the expired ones deleted) one KV round-trip at a time, ~25s of the
      // cold overview path. Same request count, no serial queueing. One key
      // failing no longer abandons the remaining keys.
      const fresh = [];
      await mapLimit(coolKeys.keys, MAP_LIMIT_DEFAULT, async (k) => {
        let raw = null;
        try { raw = await env.DISCOVER_KV.get(k.name, "json"); } catch { return; }
        const dt = raw?.date ? Date.parse(raw.date) : 0;
        if (dt >= cutoff) fresh.push(k.name);
        else await env.DISCOVER_KV.delete(k.name).catch(() => {});
      });
      gemCoolSet = new Set(fresh.map(k => k.replace("intel:gemCool:", "")));
    } catch (e) { console.warn("gem cooldown read failed:", e.message); }
  }
  const gemPool = nowPlaying.filter((m) => {
    if (ovRate(m) < 7.5) return false;
    if (gemCoolSet.has(ovGid(m))) return false; // recently picked — rotate out
    return ovZh(m);
  }).filter((m) => {
    // "hidden" = low popularity RELATIVE to the released pool (bottom 60%)
    const rank = popSorted.findIndex((p) => ovGid(p) === ovGid(m));
    return rank < 0 || rank >= Math.floor(popSorted.length * 0.4);
  });
  const weekIds6 = new Set(weekSelected.map(m => ovGid(m)));
  const trendPool = (trending || []).filter(intelRatingOk)
    .filter(t => ovZh(t))
    .filter(t => !weekIds6.has(ovGid(t)));

  const mkPick = (m, cat) => ({ ...intelNormalizeMovie(m), pickCategory: cat });

  const picksStar = seededShuffle(weekSelected).slice(0, 2).map(m => mkPick(m, "editors"));
  const picksGem = seededShuffle(gemPool)
    .filter(m => !weekIds6.has(ovGid(m)))
    .slice(0, 2).map(m => mkPick(m, "gem"));
  const picksTrend = seededShuffle(trendPool).slice(0, 2).map(m => mkPick(m, "trending"));

  // Backfill to always-6: fill shortfalls from remaining pools (round-robin),
  // skipping anything already picked.
  const pickedIds = new Set([...picksStar, ...picksGem, ...picksTrend].map(p => p.tmdbId));
  const backfillPools = [
    ...seededShuffle(weekSelected).map(m => mkPick(m, "editors")),
    ...seededShuffle(gemPool).map(m => mkPick(m, "gem")),
    ...seededShuffle(trendPool).map(m => mkPick(m, "trending")),
  ];
  const editorsPicksV2 = [...picksStar, ...picksGem, ...picksTrend];
  for (const cand of backfillPools) {
    if (editorsPicksV2.length >= 6) break;
    if (pickedIds.has(cand.tmdbId)) continue;
    pickedIds.add(cand.tmdbId);
    editorsPicksV2.push(cand);
  }
  // CN-first release date correction on the final six (same semantics as before;
  // cached 1 day so repeat runs don't refetch). Best-effort since 2026-10-02: a
  // budget/upstream failure here must not discard the six picks we already have
  // (nor 500 the overview) — ship them uncorrected and report it.
  let editorsPicksFinal = editorsPicksV2;
  try {
    const corrected = (await Promise.all(
      editorsPicksV2.map(m => intelPickCnReleaseDate(m, token))
    )).filter(Boolean);
    if (corrected.length) editorsPicksFinal = corrected;
  } catch (e) {
    degraded.push("cnReleaseDate");
    console.warn(`overview: cnReleaseDate failed (picks ship uncorrected) — ${e.message}`);
  }
  // ── Gem cooldown write: record today's picked gems so they rotate out for
  // the next gemCooldownDays. Only gem-category picks get cooled (star/trending
  // are heat-driven and self-rotating). Best-effort: a KV failure must not 500.
  if (env?.DISCOVER_KV) {
    try {
      const pickedGems = editorsPicksFinal.filter(m => m.pickCategory === "gem");
      for (const g of pickedGems) {
        await env.DISCOVER_KV.put(`intel:gemCool:${ovGid(g)}`, JSON.stringify({ date: today }), { expirationTtl: gemCooldownDays * 86400 });
      }
    } catch (e) { console.warn("gem cooldown write failed:", e.message); }
  }

  // ── 剧集热榜 (Rex 2026-08-24): 总览编辑精选下方追加 6 张热度剧集卡 ──
  // trending/tv/week was already fetched by the weekly endpoint earlier in the
  // pipeline task order → this call hits its cache (≈0 subrequests). zh gate +
  // daily rotation, same standards as the movie pools above.
  const tvTrendingWeek = await group("tvTrending", () => intelFetchTMDB(token, "/trending/tv/week"));
  const weeklyHotTv = seededShuffle((tvTrendingWeek || [])
    .filter(intelRatingOk)
    .filter(s => ovZh(s)))
    .slice(0, 6)
    .map(s => ({ ...intelNormalizeMovie(s, "tv"), pickCategory: "tvhot" }));

  // ── 即将上映剧集 (Rex 2026-08-24): 电影排片下方追加 6 张 ──
  // Same discover call the tv handler makes → cache hit. Sorted by daysUntil
  // (date-first, the section's whole point), zh-gated for the pipeline layer.
  const ninetyDaysLaterOv = new Date(Date.now() + 90 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const tvUpcomingRaw = await group("tvUpcoming", () => intelFetchPages(token, "/discover/tv",
    { "first_air_date.gte": today, "first_air_date.lte": ninetyDaysLaterOv, "sort_by": "popularity.desc" }, 1));
  const comingSoonTv = (tvUpcomingRaw || [])
    .filter(s => s.first_air_date && s.first_air_date > today)
    .filter(intelRatingOk)
    .filter(s => ovZh(s))
    .sort((a, b) => (a.first_air_date || "").localeCompare(b.first_air_date || ""))
    .slice(0, 6)
    .map(s => {
      const days = Math.max(0, Math.ceil((new Date(s.first_air_date) - new Date(today + "T00:00:00")) / 86400000));
      return { ...intelNormalizeMovie(s, "tv"), daysUntil: days };
    });
  // ── 即将上映·电影 (P1-2 fix 2026-08-24) ──
  // comingSoon is now the SAME scored set as movies.upcoming (zh bonus inside the
  // score, no hard gate). Section takes the date-first slice — the section's
  // whole point — instead of a zh-gate that emptied it (0/6 live on 08-23).
  const comingSoonFinal = [...comingSoon]
    .sort((a, b) => (a.daysUntil ?? 9999) - (b.daysUntil ?? 9999))
    .slice(0, 6);

  return {
    updated: today,
    // Empty when every group fetched. NON-EMPTY = names of the groups that failed
    // (cold-cache budget / upstream blip) → consumers MUST NOT publish this as
    // today's overview; scripts/fetch-intelligence-data.js retries, and otherwise
    // keeps yesterday's file.
    degraded,
    stats: {
      moviesReleased,
      tvAiringThisWeek: tvSelected.length,
      albumsReleased: (todayMB || []).length,
      trending: (trending || []).length,
    },
    editorsPicks: editorsPicksFinal,
    weeklyHotTv,
    comingSoon: comingSoonFinal,
    comingSoonTv,
    brief: `Today: ${moviesReleased} movie(s) released, ${tvSelected.length} TV show(s) airing, ${(todayMB || []).length} new album(s).`,
  };
}

async function handleIntelMovies(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const weekAgo = intelDaysAgo(7);
  const ninetyDaysAgo = intelDaysAgo(90);
  const cfg = await getIntelConfig(env);
  const sm = cfg.movie.sources;
  const reserve = cfg.movie.reserve;
  const scoreOpts = { ...SCORE_OPTS.movie, ...cfg.movie.score, cred: cfg.credibility };

  const [nowPlayingRaw, cnPlayingRaw, releasedRaw, upcomingRaw] = await Promise.all([
    // US theatrical: 2 pages (CN-first bucketing means US dates only pre-filter)
    sm.nowPlayingUS.enabled ? intelFetchPages(token, "/movie/now_playing", { region: "US" }, sm.nowPlayingUS.pages) : [],
    // CN theatrical: catches domestic Chinese hits (牛来, 欢迎来龙餐馆…) that
    // never played US theatres but are in CN rotation.
    sm.nowPlayingCN.enabled ? intelFetchPages(token, "/movie/now_playing", { region: "CN" }, sm.nowPlayingCN.pages) : [],
    sm.recently90d.enabled ? intelFetchReleasedMovies(token, sm.recently90d.pages) : [],
    sm.upcoming90d.enabled ? intelFetchUpcomingMovies(token, sm.upcoming90d.pages) : [],
  ]);

  const hasChinese = (text) => /[一-鿿]/.test(text || "");
  // Strict filter for US/global pool: BOTH title & overview must be Chinese.
  const cnFilter = (m) => hasChinese(m.title || m.name) && hasChinese(m.overview);
  // CN-theatrical pool: list endpoint returns EN title/overview even for CN
  // releases (probed 2026-08-20: 牛来 title="The Cow is Coming" zh-overview=false),
  // so strict AND kills ALL of them. Relax to: title OR overview in Chinese.
  // The detail fetch (intelPickCnReleaseDate) later restores the zh title.
  const cnPoolFilter = (m) => hasChinese(m.title || m.name) || hasChinese(m.overview);

    // ── Unified recent pool: US now_playing + past-90d discover (dedup by id) ──
  // Covers US-theatrical titles AND non-US releases (CN/JP/KR) that never
  // played US theatres but are still in theatrical rotation at home.
  const recentMerged = [...nowPlayingRaw];
  const recentIds = new Set(nowPlayingRaw.map(m => m.id));
  // CN-theatrical ids: these get a relaxed popularity floor (domestic CN hits
  // like 牛来 have low global popularity but are genuinely in CN theatres).
  const cnPoolIds = new Set();
  for (const m of cnPlayingRaw) {
    if (!recentIds.has(m.id)) { recentIds.add(m.id); cnPoolIds.add(m.id); recentMerged.push(m); }
  }
  for (const m of releasedRaw) {
    if (!recentIds.has(m.id)) { recentIds.add(m.id); recentMerged.push(m); }
  }

  // ── This week: CN theatrical date in [weekAgo, today] ──
  // US release_date is only a pre-filter (expanded by 3d on both sides because
  // CN theatrical dates often lead/lag US by a few days); the definitive bucket
  // decision uses the CN release date (intelPickCnReleaseDate, type 2/3).
  const weekCandidates = recentMerged
      .filter(m => m.release_date && m.release_date >= intelDaysAgo(cfg.movie.weekBack) && m.release_date <= today)
      // CN-pool entries skip the zh filter entirely: region=CN list endpoint returns
      // EN title/overview for every film (probed), so zh-filtering would kill all of
      // them; the detail fetch below restores zh titles.
      .filter(m => cnPoolIds.has(m.id) || cnFilter(m))
      .filter(intelRatingOk);
    const weekSelected = intelSelectDiverse(weekCandidates, 15, reserve, scoreOpts, today);
  // CN-first release date (2026-08-17). Cached 1 day; subrequests stay bounded.
  // CN-pool entries: list date IS the CN date → only restore zh title/overview.
  const weekNormalized = (await Promise.all(
    weekSelected.map(m => cnPoolIds.has(m.id)
      ? intelFetchZhDetails(intelNormalizeMovie(m), token)
      : intelPickCnReleaseDate(intelNormalizeMovie(m), token))
  )).filter(Boolean);
  // Bucket by CN date: [weekAgo, today] → this week; earlier → now playing
  const weekM = weekNormalized.filter(m => m.releaseDate && m.releaseDate >= weekAgo && m.releaseDate <= today);
  // Overflow: CN date in [ninetyDaysAgo, weekAgo) — still in theatrical rotation
  const weekOverflow = weekNormalized.filter(m => m.releaseDate && m.releaseDate >= ninetyDaysAgo && m.releaseDate < weekAgo);
  const weekIds = new Set(weekSelected.map(m => m.id));

  // Upcoming: release_date >= today, popularity floor 15, scored (pop + zh bonus), cap 15
  const upcomingCandidates = upcomingRaw
    .filter(m => m.release_date && m.release_date >= today)
    .filter(m => !weekIds.has(m.id))
    .filter(intelRatingOk);
  const upcomingSelected = intelSelectScored(upcomingCandidates, 15);
  const upcoming = upcomingSelected.map(m => {
      const days = intelDaysUntil(m.release_date, today);
      return { ...intelNormalizeMovie(m), daysUntil: Math.max(0, days) };
    });

  // ── Now playing quality gate (2026-08-27, Rex): composite popularity+rating ──
  // 原纯 popularity>=25 门槛忽略口碑，把高评分小众佳作（如 Hadestown:
  // rate 9.1 / pop 12.9，音乐剧官摄）挡在墙外。改为加权复合分：
  //   score = 0.7 * rating + 0.3 * pop10,  pop10 = min(10, popularity/10)
  // rating 已为 0-10；popularity 归一化到 0-10 (10 热度→1 分，100 热度封顶)。
  // 高口碑佳作 (9.1,12.9→6.76) 与 热门高口碑 均入选；低口碑靠热度被挡
  // (4,100→5.8)。CN-theatrical 保持放宽（domestic 热度即可，不受此 gate）。
  const g = cfg.movie.gateNow;
  const cred = cfg.credibility || {};
    const gateNowPlaying = (m) => {
      const pop = m.popularity || 0;
      // 用贝叶斯加权分 R加权 替代裸 vote_average：个位数票高分 (如 3票9.8) 被拉向 C，
      // 过不了 floor；高票高分才可信。见 intelCredibleRating。
      const rate = intelCredibleRating(m, { minVotes: cred.minVotes, meanRating: cred.meanRating }) || m.vote_average || 0;
      const pop10 = Math.min(g.popCap10, pop / g.popScale);          // popularity → 0-10
      return (g.wRating * rate + g.wPop * pop10) >= g.floor;
    };
    // 可选硬下限（默认关）：普通来源票数 < 门槛直接剔除。CN 用放宽值。
    const hardFloor = (m) => {
      if (!cred.minVoteCountHard) return true;
      const v = m.vote_count || 0;
      const t = cnPoolIds.has(m.id) ? (cred.cnMinVotes != null ? cred.cnMinVotes : 5) : cred.minVotes;
      return v >= t;
    };

  // NOW PLAYING: exclude this week + upcoming, 90-day window (CN date based)
  const upcomingIds = new Set(upcomingSelected.map(m => m.id));
  const nowPlayingCandidates = recentMerged
    .filter(m => m.release_date && m.release_date >= ninetyDaysAgo)
    .filter(m => !weekIds.has(m.id) && !upcomingIds.has(m.id))
    // CN-pool entries skip the zh filter (region=CN list returns EN everywhere)
    .filter(m => cnPoolIds.has(m.id) || cnFilter(m))
    // Composite gate (all above); CN-theatrical keeps relaxed domestic floor.
        .filter(m => cnPoolIds.has(m.id) ? (m.popularity || 0) >= g.cnFloorPopularity && (!m.vote_average || m.vote_average >= g.cnFloorRating) : gateNowPlaying(m))
    .filter(hardFloor);
      const nowPlayingSelected = intelSelectDiverse(nowPlayingCandidates, 15, reserve, scoreOpts, today);
  const nowPlayingNormalized = (await Promise.all(
    nowPlayingSelected.map(m => cnPoolIds.has(m.id)
      ? intelFetchZhDetails(intelNormalizeMovie(m), token)
      : intelPickCnReleaseDate(intelNormalizeMovie(m), token))
  )).filter(Boolean);
  // CN-date bucket: [ninetyDaysAgo, weekAgo) → now playing; plus week overflow
  const nowPlayingFromPool = nowPlayingNormalized.filter(m => m.releaseDate && m.releaseDate >= ninetyDaysAgo && m.releaseDate < weekAgo);
  const nowPlaying = [...weekOverflow, ...nowPlayingFromPool].slice(0, 15);

  return {
    updated: today,
    releasedThisWeek: weekM.slice(0, 15),
    upcoming,
    nowPlaying,
  };
}

async function intelFetchTVEpisodeDates(shows, token) {
  if (!token) return shows || [];
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  // A (2026-09-01): fetch detail in small concurrent batches + stop early on
  // subrequest-budget exhaustion, instead of Promise.all over ALL shows at once.
  // One-shot Promise.all(15) blew Cloudflare's 50-subrequest ceiling mid-loop and
  // left every detail unfilled (live diag: "Too many subrequests" on the tail).
  // Batching (≤3 concurrent) + early abort means the higher-priority shows (which
  // are first in the list) always get their S/E even under budget pressure, and a
  // budget blow-up no longer wipes the whole section.
  const CONCURRENCY = 3;
  const list = (shows || []);
  const results = new Array(list.length).fill(null);
  let aborted = false;
  let cursor = 0;
  const worker = async () => {
    while (!aborted) {
      const idx = cursor++;
      if (idx >= list.length) return;
      const show = list[idx];
      // Skip re-fetch when the list endpoint already carried episode data
      if (show.last_episode_to_air || show.next_episode_to_air) { results[idx] = show; continue; }
      const c = caches.default;
      const cacheKey = `tvep-v2-${show.id}`;
      try {
        const cached = await c.match(new Request(`https://tmdb-cache/${cacheKey}`));
        if (cached) {
          const hit = await cached.json();
          if (hit?.last_episode_to_air || hit?.next_episode_to_air) {
            results[idx] = { ...show, last_episode_to_air: hit.last_episode_to_air, next_episode_to_air: hit.next_episode_to_air };
            continue;
          }
        }
      } catch (e) {}
      let details = null;
      try {
        const r = await fetch(`https://api.themoviedb.org/3/tv/${show.id}?language=zh-CN`, { headers });
        if (r.ok) { details = await r.json(); }
      } catch (e) {
        const msg = (e?.message || "") || "";
        if (/subrequest/i.test(msg)) { aborted = true; results[idx] = show; continue; } // budget gone — stop, don't wipe rest
        details = null;
      }
      if (details?.last_episode_to_air || details?.next_episode_to_air) {
        try {
          const resp = new Response(JSON.stringify(details), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
          c.put(new Request(`https://tmdb-cache/${cacheKey}`), resp.clone());
        } catch (e) {}
        results[idx] = { ...show, last_episode_to_air: details.last_episode_to_air, next_episode_to_air: details.next_episode_to_air };
      } else {
        results[idx] = show;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length || 1) }, worker));
  return results.filter(Boolean);
}

async function intelPickCnReleaseDate(movie, token) {
  if (!movie?.tmdbId || !token) return movie;
  try {
    const rd = await withCache(`${movie.tmdbId}-releasedates`, async () => {
      const r = await fetch(`https://api.themoviedb.org/3/movie/${movie.tmdbId}/release_dates`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      return r.ok ? r.json() : null;
    }, 86400);
    const results = rd?.results || [];
    const region = results.find(x => x.iso_3166_1 === "CN") || results.find(x => x.iso_3166_1 === "US");
    if (!region) return movie;
    // type: 1=Premiere(festival), 2=Theatrical(limited), 3=Theatrical.
    // Skip festival premieres (type 1) entirely — e.g. a 2025 Sundance bow is
    // not a public release date. Pick the EARLIEST of type 2/3 (mirrors TMDB
    // page's primary release date, e.g. 八仙！ CN 07-10 limited before 07-18 wide).
    const theatrical = (region.release_dates || [])
      .filter(d => [2, 3].includes(d.type))
      .sort((a, b) => a.release_date.localeCompare(b.release_date))[0];
    if (theatrical?.release_date) movie.releaseDate = theatrical.release_date.slice(0, 10);
  } catch (e) { console.warn("release-date fix fail:", movie.tmdbId, e.message); }
  return movie;
}

async function intelFetchZhDetails(movie, token) {
  if (!movie?.tmdbId || !token) return movie;
  try {
    const det = await withCache(`${movie.tmdbId}-zh-details`, async () => {
      const r = await fetch(`https://api.themoviedb.org/3/movie/${movie.tmdbId}?language=zh-CN`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      return r.ok ? r.json() : null;
    }, 86400);
    if (det) {
      if (det.title) movie.title = det.title;
      if (det.overview) movie.overview = det.overview;
      if (!movie.releaseDate && det.release_date) movie.releaseDate = det.release_date.slice(0, 10);
    }
  } catch (e) { console.warn("zh-details fail:", movie.tmdbId, e.message); }
  return movie;
}

const TVMAZE_LANG_MAP = {
  english: "en", mandarin: "zh", chinese: "zh", cantonese: "zh",
  japanese: "ja", korean: "ko", spanish: "es", french: "fr",
  german: "de", portuguese: "pt", russian: "ru", arabic: "ar",
  hindi: "hi", tamil: "ta", telugu: "te", thai: "th", vietnamese: "vi",
};

async function intelFetchTVMazeWeb(offsets = [0, 1]) {
  const today = new Date();
  const dates = offsets.map(d => new Date(today.getTime() + d * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }));
  const results = await Promise.allSettled(dates.map(date =>
    fetch(`https://api.tvmaze.com/schedule/web?date=${date}`)
      .then(r => (r.ok ? r.json() : []))
      .catch(() => [])
  ));
  const eps = [];
  for (const r of results) if (r.status === "fulfilled" && Array.isArray(r.value)) eps.push(...r.value);
  return eps;
}

function intelTVMazeToCandidate(ep) {
  // schedule/web embeds the show under _embedded.show (ep.show is undefined there)
  const s = ep?._embedded?.show || ep?.show || {};
  const name = s.name || "";
  const date = s.premiered || ep?.airdate || "";
  const rating = s.rating?.average || 0;
  const langRaw = (s.language || "en").toLowerCase();
  const country = s.network?.country?.code || s.webChannel?.country?.code || "";
  return {
    id: s.id,
    _tvmazeId: s.id,
    name,
    title: name,
    original_language: TVMAZE_LANG_MAP[langRaw] || langRaw,
    origin_country: country ? [country] : [],
    first_air_date: date,
    release_date: date,
    vote_average: rating,
    popularity: rating ? Math.round(rating * 10) : 50,
    genre_ids: [],
    overview: (s.summary || "").replace(/<[^>]+>/g, "").trim().slice(0, 200),
    _overviewEn: (s.summary || "").replace(/<[^>]+>/g, "").trim().slice(0, 200),
    _posterUrl: s.image?.medium || s.image?.original || "",
    _tvmazePosterUrl: s.image?.medium || s.image?.original || "", // keep original for fallback
    _genres: Array.isArray(s.genres) ? s.genres : [],
    // S/E from the schedule episode (season/episode numbers on the ep entry)
    _season: ep?.season ?? null,
    _episode: ep?.number ?? null,
    source: "tvmaze",
    mediaType: "tv",
  };
}

function intelTVMazeToOutput(m) {
  const poster = m._posterUrl || m._tvmazePosterUrl || "";
  return {
    tmdbId: m.tmdbId || null,
    title: m.title,
    titleEn: m.titleEn || m.title,
    originalLanguage: m.original_language || "",
    originCountry: m.origin_country || [],
    year: (m.first_air_date || "").slice(0, 4),
    releaseDate: m.first_air_date || "",
    poster,
    rating: m.vote_average || 0,
    genre: m._genres || [],
    summary: m.overview || "",
    summaryEn: m._overviewEn || "",
    season: m._season ?? null,
    episode: m._episode ?? null,
    source: "tvmaze",
    mediaType: "tv",
  };
}

async function intelTVMazeEnrich(candidate, token) {
  if (!candidate || candidate.source !== "tvmaze" || !token) return candidate;
  try {
    const year = (candidate.first_air_date || "").slice(0, 4);
    const hit = await searchTMDB(candidate.title, year, "tv", token, "zh-CN");
    // 2026-08-20: no TMDB hit at all → no zh data possible → drop.
    // (TVMAZE carries no Chinese metadata; a show that can't be found on TMDB
    // can never get a zh title or summary, so it's unusable in the zh UI.)
    if (!hit?.tmdbId) { candidate._drop = true; return candidate; }
    candidate.tmdbId = hit.tmdbId;
    const d = await fetchTMDBDetails(hit.tmdbId, token, "zh-CN");
    const hasZh = (text) => /[一-鿿]/.test(text || "");
    if (d?.name) candidate.title = d.name;
    if (d?.overview) candidate.overview = d.overview;
    if (d?.poster_path) candidate._posterUrl = `https://image.tmdb.org/t/p/w500${d.poster_path}`;
    if (d?.vote_average) candidate.vote_average = d.vote_average;
    if (Array.isArray(d?.genres)) candidate._genres = d.genres.map(g => g.name);
    // 2026-08-20: drop shows that end up with NEITHER a zh title NOR zh summary.
    // TVMAZE has no zh data, so a TMDB hit that itself carries no Chinese text
    // is unusable in the zh UI — kill it (at least title OR overview must be zh).
    if (!hasZh(candidate.title) && !hasZh(candidate.overview)) {
      candidate._drop = true;
    }
  } catch (e) { console.warn("tvmaze enrich fail:", candidate.title, e.message); }
  return candidate;
}

async function intelEnrichTVMazeBatch(candidates, token, max = 3) {
  const limited = (candidates || []).slice(0, max);
  return Promise.all(limited.map(s => intelTVMazeEnrich(s, token)))
    .then(arr => arr.filter(s => s && !s._drop));
}

async function handleIntelTV(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const weekAgo = intelDaysAgo(7);
  const ninetyDaysAgo = intelDaysAgo(90);
  const ninetyDaysLater = new Date(Date.now() + 90 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const thirtyDaysAgo = intelDaysAgo(30);
  const hundredEightyDaysAgo = intelDaysAgo(180);
  const cfg = await getIntelConfig(env);
  const stv = cfg.tv.sources;
  const reserve = cfg.tv.reserve;
  const scoreOpts = { ...SCORE_OPTS.tv, ...cfg.tv.score, cred: cfg.credibility };
  const yearCutoff = cfg.tv.yearCutoff;
  const popFloor = cfg.tv.popFloor;
  const tier1 = cfg.tv.ongoingTier1;
  const tier2 = cfg.tv.ongoingTier2;
  const upcomingScore = cfg.tv.upcomingScore || { wDate: 0.5, wPop: 0.3, wZh: 0.1, wRating: 0.1 };
  const detailBudget = cfg.tv.detailBudget != null ? cfg.tv.detailBudget : 12;

  // ── Data sources (2026-08-27 v3: + trending-pagination whole-season recovery) ──
    // premieres: TVMAZE schedule next 2-4 days (真实首播日，国产剧先上 TVMAZE 场景直接覆盖)
    // upcoming:  TVMAZE +7/+14 day samples + TMDB discover 未来 90 天
    // ongoing:   TMDB on_the_air (TVMAZE has no "airing now" list endpoint) +
    //            trending/tv/week 翻页 —— 通用地覆盖 "整季放出/刚完结" 型剧集
    //            (不限平台)。with_networks 只收单个 id（多选返回 0），且全平台
    //            热门池被超长寿剧稀释、捞不到 movie 45 的《百年孤独》；
    //            trending 是 "本周最热"，整季放出剧上线当周冲进前 20-30 → 翻第
    //            2-3 页即可纳入（实测《百年孤独》在 rank 23），零额外 detail 成本。
    const [onTheAir, discoverRaw, tvmazePremEps, tvmazeUpEps, tvTrendingWeek] = await Promise.all([
      stv.onTheAir.enabled ? intelFetchPages(token, "/tv/on_the_air", {}, stv.onTheAir.pages, { en: false }) : [],
      stv.discoverUpcoming.enabled ? intelFetchPages(token, "/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": ninetyDaysLater, "sort_by": "popularity.desc" }, stv.discoverUpcoming.pages, { en: false }) : [],
      stv.tvmazePremiere.enabled ? intelFetchTVMazeWeb(stv.tvmazePremiere.offsets) : [], // premieres
      stv.tvmazeUpcoming.enabled ? intelFetchTVMazeWeb(stv.tvmazeUpcoming.offsets) : [], // upcoming samples
      // trending/tv/week 翻页 —— 既是整季放出剧的通用补充源，
      // 也自带完整 episode 对象 (last_episode_to_air) 供 hydrateFromTrending 补 S/E。
      stv.trendingWeek.enabled ? intelFetchPages(token, "/trending/tv/week", {}, stv.trendingWeek.pages, { en: false }) : [],
    ]);

  const hasChinese = (text) => /[一-鿿]/.test(text || "");
  const cnFilter = (s) => hasChinese(s.title || s.name) && hasChinese(s.overview);
  const titleCn = (s) => hasChinese(s.title || s.name);

  // ── S/E hydration from trending payload (2026-08-24) ──
  // on_the_air list items carry NO episode data; the paid detail backfill was
  // getting squeezed out by the handler's subrequest budget, so ongoing shipped
  // with zero S/E. trending/tv/week DOES carry full episode objects and its
  // cache entry is already warm in this pipeline run → merge for free, then let
  // intelFetchTVEpisodeDates handle only what trending doesn't know.
  // ⚠️ Defined BEFORE both use sites (premieres + ongoing) — a TDZ here 500'd
  // the whole tv endpoint once already (2026-08-24).
  const hydrateFromTrending = async (items) => {
    if (!items?.length) return items;
    const trend = tvTrendingWeek || [];
    if (!trend.length) return items;
    return Promise.all(items.map(async (s) => {
      if (s.source === "tvmaze") return s;
      if (s.last_episode_to_air || s.next_episode_to_air) return s;
      const t = trend.find(x => x.id === s.id);
      if (!t) return s;
      if (!(t.last_episode_to_air || t.next_episode_to_air)) return s;
      return { ...s, last_episode_to_air: t.last_episode_to_air, next_episode_to_air: t.next_episode_to_air };
    }));
  };

  // ── TVMAZE → unified candidates (dedup by show id, date-windowed) ──
  const toTvmazeShows = (eps) => {
    const seen = new Set();
    return (eps || [])
      .map(ep => intelTVMazeToCandidate(ep))
      .filter(s => {
        if (!s._tvmazeId || seen.has(s._tvmazeId)) return false;
        seen.add(s._tvmazeId);
        return Boolean(s.first_air_date) && s.first_air_date >= weekAgo && s.first_air_date <= ninetyDaysLater;
      });
  };
  const tvmazePremiere = toTvmazeShows(tvmazePremEps).filter(s => s.first_air_date <= today);
  const tvmazeUpcoming = toTvmazeShows(tvmazeUpEps).filter(s => s.first_air_date > today);

  // ── This week premieres: TVMAZE primary + on_the_air supplement ──
  // P1-3① (2026-08-24): TMDB supplements must be zh-VISIBLE — title OR overview
  // in Chinese (zh-CN fetch already localizes most). The old `lang==="en" ||`
  // pass-through admitted EN-only shows that all died at the pipeline's strict
  // zh gate downstream → wasted episode-date enrichment subrequests on doomed
  // items (live: premieres section was 1/15).
  const premiereFromOnAir = onTheAir
    .filter(s => s.first_air_date && s.first_air_date >= weekAgo && s.first_air_date <= today)
    .filter(intelRatingOk)
    .filter(s => hasChinese(s.title || s.name) || hasChinese(s.overview));
  const premiereMerged = [...premiereFromOnAir];
  const premOnAirIds = new Set(premiereFromOnAir.map(s => s.id));
  for (const s of tvmazePremiere) {
    if (!premOnAirIds.has(s.id)) premiereMerged.push(s);
  }
  const premiereSelected = intelSelectDiverse(premiereMerged, 15, reserve, scoreOpts, today);
  // Premiere shows do NOT query episode detail (saves subrequests for ongoing).
  // Their S/E defaults to S1E1 — a brand-new show's first episode IS season 1.
  // (2026-08-28 Rex decision: premieres/upcoming always show S1E1, never detail.)
  const premiereHydrated = await hydrateFromTrending(premiereSelected.filter(s => s.source !== "tvmaze"));
  const premiereEnriched = premiereHydrated; // no intelFetchTVEpisodeDates — free
  // TVMAZE premieres: TMDB zh fallback (bounded; _drop kills no-zh shows)
  const tvmazePicked = premiereSelected.filter(s => s.source === "tvmaze");
  const tvmazePremiereEnriched = await intelEnrichTVMazeBatch(tvmazePicked, token, 2);
  const defaultSE = (item) => ({ ...item, season: item.season != null ? item.season : 1, episode: item.episode != null ? item.episode : 1 });
  const weekPremieres = [
    ...premiereEnriched.map(s => defaultSE(intelNormalizeMovie(s, "tv"))),
    ...tvmazePremiereEnriched.map(s => defaultSE(intelTVMazeToOutput(s))),
  ];
  // Only TMDB ids go into the exclusion set (TVMAZE ids are a different namespace)
  const premiereIds = new Set(premiereSelected.filter(s => s.source !== "tvmaze").map(s => s.id));

  // ── Upcoming: TVMAZE +7/+14 samples + TMDB discover 未来 90 天 ──
  // 2026-08-20 v2: no popularity dependency — unreleased shows have no pop.
  // Score = date proximity (30d peak) + zh info + TVMAZE rating. Floor: none
  // (no-rating is normal pre-air); zh-less shows are dropped later by enrich.
  // 2026-11-06 供给兜底: `intelRatingOk`(vote_average>=4) 是为已播剧设的可信门槛，
  // 未播剧常常只有零星票甚至 3.x（预告片刷分），硬套会让 discover 池在淡季被砍空 →
  // tv.json.upcoming=0 → 排片日历剧集整块「暂无」。改为「先严格、不够再放宽」：
  // 严格池不足 UPCOMING_MIN 时，把被门槛砍掉但日期在 45 天内的条目补回候选，
  // 让评分只影响排序权重（scoreUpcoming 里的 wRating），不再一票否决。
  const UPCOMING_MIN = 12;
  const UPCOMING_RELAX_DAYS = 45;
  const upcomingBase = discoverRaw
    .filter(s => s.first_air_date && s.first_air_date > today)
    .filter(s => !premiereIds.has(s.id));
  const upcomingStrict = upcomingBase.filter(intelRatingOk);
  const upcomingPool = upcomingStrict.length >= UPCOMING_MIN ? upcomingStrict : [
    ...upcomingStrict,
    ...upcomingBase
      .filter(s => !intelRatingOk(s))
      .filter(s => {
              const d = intelDaysUntil(s.first_air_date, today);
              return d >= 0 && d <= UPCOMING_RELAX_DAYS;
            }),
  ];
  if (upcomingPool.length > upcomingStrict.length) {
    console.log(`· tv.upcoming — 严格池仅 ${upcomingStrict.length}/${UPCOMING_MIN}，放宽评分门槛补入 ${upcomingPool.length - upcomingStrict.length} 条（≤${UPCOMING_RELAX_DAYS}天）`);
  }
  const upcomingFromDiscover = upcomingPool;
  const upcomingMerged = [...upcomingFromDiscover];
  const discIds = new Set(upcomingFromDiscover.map(s => s.id));
  for (const s of tvmazeUpcoming) {
    if (!discIds.has(s.id)) upcomingMerged.push(s);
  }
  // 池内 min/max 热度归一(软信号,2026-09-04): 仅 coerce 真实 popularity; tvmaze 合成 pop(50)不参与归一,避免拉偏。
  const realPops = upcomingFromDiscover.map(s => s.popularity).filter(p => typeof p === 'number' && isFinite(p));
  const popMin = realPops.length ? Math.min(...realPops) : 0;
  const popMax = realPops.length ? Math.max(...realPops) : 1;
  const scoreUpcoming = (s) => {
      const daysUntil = Math.max(0, intelDaysUntil(s.first_air_date, today));
    const dateScore = daysUntil <= 30 ? 1 : Math.max(0, 1 - (daysUntil - 30) / 60); // 30d peak, decays to 0 by 90d
    const zhScore = (titleCn(s) ? 0.5 : 0) + (hasChinese(s.overview) ? 0.5 : 0);
    const ratingScore = s.vote_average ? Math.min(1, s.vote_average / 10) : 0.5; // neutral when no rating
    const popScore = (s.popularity != null && popMax > popMin) ? (s.popularity - popMin) / (popMax - popMin) : 0.5; // 池内min-max软信号
    // 权重可调 (2026-09-04): 加 wPop(池内min-max热度) 破 dateScore 全打平; 日期降 0.5→热度 0.3 修冷门挤入。
    return { s, score: upcomingScore.wDate * dateScore + (upcomingScore.wPop || 0) * popScore + (upcomingScore.wZh || 0) * zhScore + (upcomingScore.wRating || 0) * ratingScore };
  };
  const upcomingSelected = upcomingMerged
    .map(scoreUpcoming)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(x => x.s);
  // No episode-date enrichment for upcoming (saves subrequests); S/E shown when TVMAZE carries it
  const tvmazeUpcomingPicked = upcomingSelected.filter(s => s.source === "tvmaze");
  const tvmazeUpcomingEnriched = await intelEnrichTVMazeBatch(tvmazeUpcomingPicked, token, 1);
  // daysUntil added 2026-08-23: movies.upcoming carries it; TV side was missing it
    // so coming.json/email had to recompute and CountdownCard showed no countdown.
    const tvDays = (s) => {
      const d = s.first_air_date || "";
      return d ? Math.max(0, intelDaysUntil(d, today)) : null;
    };
  const upcomingTV = [
    ...upcomingSelected.filter(s => s.source !== "tvmaze").map(s => defaultSE({ ...intelNormalizeMovie(s, "tv") , daysUntil: tvDays(s) })),
    ...tvmazeUpcomingEnriched.map(s => defaultSE({ ...intelTVMazeToOutput(s), daysUntil: tvDays(s) })),
  ];

  // ── P1-3③ (2026-08-24): imminent premieres fold into the premieres section ──
  // TVMAZE's schedule is a continuum — a show airing in 0-3 days is, to a viewer,
  // the same thing as one that premiered today. upcoming entries with
  // daysUntil <= 3 are appended to premieresThisWeek (date-sorted) so the
  // section stops being structurally near-empty (live: 1/15 on 08-23).
  const imminent = upcomingTV
    .filter(s => typeof s.daysUntil === "number" && s.daysUntil <= 3)
    .sort((a, b) => (a.releaseDate || "").localeCompare(b.releaseDate || ""));
  const weekPremieresFinal = [...weekPremieres, ...imminent];
  const upcomingIds = new Set(upcomingSelected.filter(s => s.source !== "tvmaze").map(s => s.id));

  // ── Ongoing: TMDB on_the_air + trending-pagination recovery, 2010 cutoff ──
  // 2026-08-20 v2: 超长连载剧集从 2010 截断（first_air_date < 2010-01-01 全部淘汰），
  // 一级优先 = 近一个月有播新集 OR 近 180 天首播；二级 = 其余 2010 后剧集。
  // 2026-08-27 v3: trending/tv/week 翻页(60部) 并入候选池 —— 通用覆盖
  // "整季放出/刚完结" 型剧集（不限平台，with_networks 只接受单 id）。trending 条目
  // 自带 last_episode_to_air，天然满足"只看最新一季"语义；热度衰减后滑出
  // 前 60 自然掉落（与 ongoing 衰减语义一致）。
  const onTheAirCandidates = onTheAir
      .filter(s => !premiereIds.has(s.id) && !upcomingIds.has(s.id))
      .filter(cnFilter)
      .filter(intelRatingOk)
      // yearCutoff cutoff — compare NUMERIC year, not string: "1989-12-17" >= "2010-01-01"
      // is TRUE lexicographically ('9' > '0'), so string compare lets pre-2010
      // long-runners (Simpsons 1989, Kamen Rider 1971…) slip through.
      .filter(s => Number((s.first_air_date || "").slice(0, 4)) >= yearCutoff)
      .filter(s => (s.popularity || 0) >= popFloor); // relaxed from 80 (yearCutoff cutoff already trims)

  // ── Ongoing candidate pool ──
    // 2026-08-28 v4: trending/tv/week 翻页(top 60) 并入候选池 —— 通用覆盖"整季放出/刚完结"型剧。
    // 复用本次 Promise.all 已抓取的 tvTrendingWeek（line 1436,3 页/60 部）。
    const trendingCandidates = (tvTrendingWeek || [])
      .filter(s => !premiereIds.has(s.id) && !upcomingIds.has(s.id))
      .filter(intelRatingOk)
      .filter(s => Number((s.first_air_date || "").slice(0, 4)) >= yearCutoff)
      .filter(s => (s.popularity || 0) >= popFloor)
      .filter(cnFilter);
    // 合并 + 去重（on_the_air 为主池,trending 补位）; _trendingOnly 标记整季放出型剧。
    const onAirIds = new Set(onTheAirCandidates.map(s => s.id));
    let mergedOngoing = [...onTheAirCandidates];
    for (const s of trendingCandidates) {
      if (!onAirIds.has(s.id)) { s._trendingOnly = true; mergedOngoing.push(s); }
    }
    // 可选硬下限（默认关）：国产/华语放宽，其余用全局 minVotes。贝叶斯加权已自然压尾，
    // 此过滤仅当 minVoteCountHard=true 时生效。
    if (cfg.credibility && cfg.credibility.minVoteCountHard) {
      const tGlobal = cfg.credibility.minVotes;
      const tCn = (cfg.credibility.cnMinVotes != null) ? cfg.credibility.cnMinVotes : 5;
      mergedOngoing = mergedOngoing.filter(s => (s.vote_count || 0) >= (cnFilter(s) ? tCn : tGlobal));
    }
    const ongoingCandidates = mergedOngoing;

    // Tier-1 boost. 整季放出剧(trending-only) 无 list 级 S/E,但本周正热 → 视为 recent
    // (recent 才进 tier1 拿到更多名额)。注入 release_date=today 让 S_date 按"本周热"算;
    // 用 release_date 而非 last_episode 作假,否则 intelFetchTVEpisodeDates 会跳过 detail 回填。
    const ongoingScored = ongoingCandidates.map(s => {
      const isTrendingOnly = s._trendingOnly === true;
      if (isTrendingOnly && !s.release_date) s.release_date = today;
      const lastAir = s.last_episode_to_air?.air_date || "";
      const isRecent = isTrendingOnly || (lastAir && lastAir >= thirtyDaysAgo) || ((s.first_air_date || "") >= hundredEightyDaysAgo);
      return { s, recent: isRecent, trendingOnly: isTrendingOnly };
    });
    const ongoingTier1 = ongoingScored.filter(x => x.recent).map(x => x.s);
    const ongoingTier2 = ongoingScored.filter(x => !x.recent).map(x => x.s);
    const ongoingSelected = [
      ...intelSelectDiverse(ongoingTier1, tier1, reserve, scoreOpts, today),
      ...intelSelectDiverse(ongoingTier2, tier2, reserve, scoreOpts, today),
    ].slice(0, 15);
    // Detail backfill (≤ cap, 预算保护): cold-cache paid detail is the #1 budget
        // killer. Premieres/upcoming NO LONGER fetch detail (they default to S1E1),
        // so ALL of detailBudget goes to ongoing. S/E is best-effort display:
        // exceeding the cap never drops a show (passThrough).
        // 2026-08-31: hydrateFromTrending is DEAD — trending/tv/week list payloads
        // carry NO last/next_episode_to_air (live-verified 3 pages all empty), so the
        // ONLY S/E source for on_the_air/trending shows is the paid detail backfill.
        // Raise coverage from detailBudget (12) to ALL selected shows so the pool-tail
        // (previously 13-15th) stop shipping as S?E?. Still budget-guarded: list
        // fetches ~23 + tvep detail ≤15 ≈ 38 cold, safely under the 50-subrequest cap.
        const sortDetail = [...ongoingSelected].sort((a, b) => (b._trendingOnly === true) - (a._trendingOnly === true));
        const needDetail = [];
        const passThrough = [];
        for (const s of sortDetail) {
          if (s.last_episode_to_air || s.next_episode_to_air) {
            passThrough.push(s); // already has S/E — no fetch
          } else {
            needDetail.push(s); // cover ALL selected — even beyond detailBudget
          }
        }
        const detailed = await intelFetchTVEpisodeDates(needDetail, token);
        const ongoingEnriched = [...detailed, ...passThrough];
        // S/E is BEST-EFFORT DISPLAY, NOT a selection filter. We deliberately do
        // NOT drop shows whose detail didn't fill an air date (e.g. airing paused,
        // or beyond the detail cap) — every selected show stays in ongoing.
        const ongoingTV = ongoingEnriched.map(s => intelNormalizeMovie(s, "tv"));

        return {
          updated: today,
          premieresThisWeek: weekPremieresFinal,
          upcoming: upcomingTV,
          ongoing: ongoingTV,
        };
    }

async function handleIntelWeekly(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;

  // ── Weekly Hot v2 (2026-08-23): one heat signal per side ──
  // Design intent (Rex): 本周热榜 = this week's hottest works, INCLUDING
  // not-yet-released/aired ones. Both sides now use TMDB weekly trending —
  // the real heat signal, which inherently contains unreleased titles
  // surging in interest (the old TV chain couldn't see them at all).
  // Retired here (still used by the 目录 pages): on_the_air sourcing,
  // 2010 cutoff, pop floor 30, recent-activity tiers, cn/hmt/jp/kr quotas,
  // strict cnFilter — directory-diversity machinery, wrong tool for a heat
  // chart (and it made weekly.tv a 7/8 copy of ongoing).
  const [movieTrending, tvTrending] = await Promise.all([
    intelFetchTMDB(token, "/trending/movie/week"),
    intelFetchTMDB(token, "/trending/tv/week"),
  ]);

  const normalizeItem = (item, type, rank) => ({
    ...intelNormalizeMovie(item, type), rank, trend: "new",
  });

  const movies = movieTrending.filter(intelRatingOk).slice(0, 10)
    .map((m, i) => normalizeItem(m, "movie", i + 1));

  // Trending payload usually carries episode data; intelFetchTVEpisodeDates
  // skips items that already have it, so this only backfills the gaps.
  const tvSelected = tvTrending.filter(intelRatingOk).slice(0, 10);
  const tvEnriched = await intelFetchTVEpisodeDates(tvSelected, token);
  const tv = tvEnriched.map((s, i) => normalizeItem(s, "tv", i + 1));

  // Music: AI-curated tags are NOT a heat signal — WeeklyView ranks music.json
  // picks by Last.fm listeners client-side (single source of truth, no dup data).
  return {
    updated: intelToday(),
    movies,
    tv,
    music: [],
  };
}

async function handleIntelComing(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();

  const movieUpcoming = await intelFetchUpcomingMovies(token, 1);

  const allItems = [];

  // Movies — scored selection (pop floor 15 + zh bonus), consistent with handleIntelMovies
  intelSelectScored(movieUpcoming.filter(m => m.release_date && m.release_date >= today).filter(intelRatingOk), 15)
    .forEach(m => {
      const days = Math.ceil((new Date(m.release_date) - new Date(today)) / 86400000);
      allItems.push({ ...intelNormalizeMovie(m), mediaType: "movie", daysUntil: Math.max(0, days) });
    });

  // TV — discover brand new shows premiering in the future (90d window, scored: pop floor 8 + zh bonus)
  try {
    const tvResults = await intelFetchPages(token, "/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": new Date(Date.now() + 90 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" }), "sort_by": "popularity.desc" }, 1);
    intelSelectScored(tvResults.filter(s => s.first_air_date && s.first_air_date >= today).filter(intelRatingOk), 8)
      .forEach(s => {
              const days = s.first_air_date ? intelDaysUntil(s.first_air_date, today) : 999;
              allItems.push({ ...intelNormalizeMovie(s, "tv"), mediaType: "tv", daysUntil: Math.max(0, days) });
            });
  } catch (e) { console.warn("TV upcoming failed:", e.message); }

  // Primary sort by daysUntil, secondary by composite score tiebreak
  allItems.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return (b.vote_average || 0) - (a.vote_average || 0);
  });

  return {
    updated: today,
    next7Days: allItems.filter(m => m.daysUntil <= 7),
    next30Days: allItems.filter(m => m.daysUntil <= 30),
  };
}

async function handleIntelDebug(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
  const weekAgo = intelDaysAgo(7);
  const ninetyDaysAgo = intelDaysAgo(90);
  const [discover, onTheAir, trending, nowPlayingRaw, upcomingRaw] = await Promise.all([
    intelFetchPages(token, "/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": thirtyDaysLater, "sort_by": "popularity.desc" }, 5),
    intelFetchPages(token, "/tv/on_the_air", {}, 4),
    intelFetchTMDB(token, "/trending/tv/week"),
    intelFetchPages(token, "/movie/now_playing", { region: "US" }, 4),
    intelFetchPages(token, "/movie/upcoming", {}, 4),
  ]);

  const hasChinese = (text) => /[一-鿿]/.test(text || "");
  const titleCn = (s) => hasChinese(s.title || s.name);
  const cnFilter = (s) => hasChinese(s.title || s.name) && hasChinese(s.overview);

  const extractPop = (items) => items.map((s, i) => ({
    rank: i + 1,
    title: s.title || s.name,
    titleEn: s._titleEn || "",
    originalLanguage: s.original_language,
    popularity: s.popularity,
    voteAverage: s.vote_average,
    releaseDate: s.first_air_date || s.release_date,
    hasCnTitle: titleCn(s),
    hasCnOverview: hasChinese(s.overview || ""),
  }));

  return {
    updated: today,
    discoverTV: extractPop(discover),
    onTheAir: extractPop(onTheAir),
    trendingTV: extractPop(trending),
    nowPlaying: extractPop(nowPlayingRaw),
    upcomingMovies: extractPop(upcomingRaw),
  };
}

async function handleIntelHiddenGems(request, env) {
  if (request && request.method === "POST") {
    try {
      const body = await request.json();
      if (body?.movies && body?.tv && env.DEEPSEEK_API_KEY) {
        return await curateFromIntelligence(env, body.movies, body.tv);
      }
      return { updated: intelToday(), gems: [], error: "missing body fields or key" };
    } catch (e) {
      return { updated: intelToday(), gems: [], error: `body parse: ${e.message}` };
    }
  }
  // Legacy GET path (own now_playing fetch) — used by direct calls/debug
  return handleIntelHiddenGemsLegacy(env);
}

async function curateFromIntelligence(env, moviesData, tvData) {
  const today = intelToday();

  // Candidate pools from today's intelligence (rating >= 7, deduped, capped)
  const buildPool = (data, keys) => {
    const seen = new Set();
    const pool = [];
    for (const key of keys) {
      for (const it of (data[key] || [])) {
        if (!it || it.tmdbId == null || seen.has(String(it.tmdbId))) continue;
        if (!(it.rating || 0) || it.rating < 7) continue;
        seen.add(String(it.tmdbId));
        pool.push(it);
      }
    }
    return pool.slice(0, 15);
  };

  const movieCands = buildPool(moviesData, ["releasedThisWeek", "nowPlaying", "upcoming"]);
  const tvCands = buildPool(tvData, ["premieresThisWeek", "ongoing", "upcoming"]);

  if (!movieCands.length && !tvCands.length) {
    return { updated: today, gems: [] };
  }

  let raw = "", dResp = null;
  try {
    const prompt = `You are a film & TV curator selecting Hidden Gems from today's intelligence feed. Movies and TV series below were just collected (high quality, some overlooked). Select 3-5 movies AND 3-5 TV series that deserve more attention. Prioritize quality, freshness, and uniqueness.

For each selected item provide: "mediaType" ("movie" or "tv"), "index" (position in the corresponding list above), "why" (one-line Chinese recommendation), "whyEn" (English), "aiScore" (0-10), "tags" (3-5, in Chinese), "tagsEn" (same tags in English), "audience" (Chinese), "audienceEn" (English).

Return JSON: { "gems": [{ "mediaType": "movie", "index": 0, "why": "...", "whyEn": "...", "aiScore": 8.5, "tags": [...], "tagsEn": [...], "audience": "...", "audienceEn": "..." }] }

Movies (index 0-${movieCands.length - 1}):
${JSON.stringify(movieCands.map((m, i) => ({ index: i, title: m.title, genre: m.genre, summary: (m.summary || "").slice(0, 100), rating: m.rating, releaseDate: m.releaseDate })))}

TV (index 0-${tvCands.length - 1}):
${JSON.stringify(tvCands.map((s, i) => ({ index: i, title: s.title, genre: s.genre, summary: (s.summary || "").slice(0, 100), rating: s.rating, season: s.season, episode: s.episode })))}`;

    // Hard timeout (40s) as a safety net — a truly hung DeepSeek call must not
    // run forever, but a NORMAL call legitimately takes ~25-35s (measured), so
    // 20s was too tight and forced every call to fallback. 40s lets the AI
    // succeed while still capping pathological hangs below Worker limits.
    for (let ai = 0; ai < 2; ai++) {
      if (ai > 0) await new Promise(r => setTimeout(r, 1200));
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 40000);
      try {
        dResp = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          signal: ac.signal,
          headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "deepseek-v4-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 4000 }),
        });
      } finally {
        clearTimeout(t);
      }
      if (dResp.ok) {
        const dr = await dResp.json();
        raw = dr?.choices?.[0]?.message?.content || "";
        if (raw) break;
      }
    }
    if (!raw) throw new Error(`Empty content from DeepSeek`);
    const parsed = intelParseJSON(raw);
    const gems = (parsed?.gems || []).map(g => {
      const isTv = g.mediaType === "tv";
      const src = isTv ? tvCands[g.index] : movieCands[g.index];
      if (!src) return null;
      return {
        tmdbId: src.tmdbId || null,
        title: src.title || "",
        titleEn: src.titleEn || "",
        poster: src.poster || "",
        genre: src.genre || [],
        summary: src.summary || "",
        summaryEn: src.summaryEn || "",
        rating: src.rating || 0,
        year: src.year || "",
        releaseDate: src.releaseDate || "",
        mediaType: isTv ? "tv" : "movie",
        season: isTv ? (src.season || null) : null,
        episode: isTv ? (src.episode || null) : null,
        whyWatch: g.why || "",
        whyWatchEn: g.whyEn || "",
        aiScore: g.aiScore || 0,
        tags: g.tags || [],
        tagsEn: g.tagsEn || [],
        audience: g.audience || "",
        audienceEn: g.audienceEn || "",
      };
    }).filter(Boolean);
    return { updated: today, gems };
  } catch (e) {
    console.warn(`Hidden gems v2 failed: ${e.message} (raw ${(raw || "").length} chars)`);
    // Fallback: no AI — pick programmatically so the email always ships picks.
    // Bias strongly toward FRESH releases (reflects the latest heat) while a
    // day-seeded shuffle varies the picks day to day so the head never repeats
    // 3 days running (it was stuck on 欢迎来龙餐馆 2026-08-30→09-01 because a
    // fixed rating-sort made the top-rated title always win).
    const freshness = (src) => {
      const d = src.releaseDate || src.release_date || "";
      const t = Date.parse(d);
      return t ? t : 0; // 0 sorts to the tail
    };
    const daySeed = (today) => {
      const h = String(today || "").replace(/[^0-9]/g, "");
      let x = Number(h.slice(-6) || "1");
      return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
    };
    const pick = (pool, n, mediaType) => {
      const out = pool
        .slice()
        .filter(src => freshness(src))
        .sort((a, b) => freshness(b) - freshness(a)) // newest first
        .slice(0, Math.max(n + 4, 10));               // shuffle within a fresh window
      const rnd = daySeed(today);
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out.slice(0, n).map(src => ({
        tmdbId: src.tmdbId || null,
        title: src.title || "",
        titleEn: src.titleEn || "",
        poster: src.poster || "",
        genre: src.genre || [],
        summary: src.summary || "",
        summaryEn: src.summaryEn || "",
        rating: src.rating || 0,
        year: src.year || "",
        releaseDate: src.releaseDate || "",
        mediaType,
        season: mediaType === "tv" ? (src.season || null) : null,
        episode: mediaType === "tv" ? (src.episode || null) : null,
        whyWatch: "",
        whyWatchEn: "",
        aiScore: 0,
        tags: [],
        tagsEn: [],
        audience: "",
        audienceEn: "",
      }));
    };
    const fbGems = [...pick(movieCands, 3, "movie"), ...pick(tvCands, 3, "tv")];
    return { updated: today, gems: fbGems, fallback: true };
  }
}

async function handleIntelHiddenGemsLegacy(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const thirtyDaysAgo = intelDaysAgo(30);

  const nowPlaying = await intelFetchTMDB(token, "/movie/now_playing", { region: "US" });

  // Filter: last 30 days, rating >= 7.0, votes >= 100, sort by popularity ascending
  const candidates = nowPlaying
    .filter(m => m.release_date && m.release_date >= thirtyDaysAgo && m.release_date <= today)
    .filter(m => (m.vote_average || 0) >= 7.0)
    .filter(m => (m.vote_count || 0) >= 100)
    .sort((a, b) => (a.popularity || 999) - (b.popularity || 999))
    .slice(0, 15)
    .map(m => intelNormalizeMovie(m));

  if (!candidates.length || !env.DEEPSEEK_API_KEY) {
    return { updated: today, gems: [] };
  }

  try {
    const prompt = `You are a film curator selecting Hidden Gems. From these recently released movies, select 4-6 that deserve more attention. Prioritize quality and uniqueness.

For each selected gem provide: "why" (one-line Chinese recommendation), "whyEn" (English), "aiScore" (0-10), "tags" (3-5, in Chinese), "tagsEn" (same tags in English), "audience" (Chinese), "audienceEn" (English).

Return JSON: { "gems": [{ "index": 0, "why": "...", "whyEn": "...", "aiScore": 8.5, "tags": [...], "tagsEn": [...], "audience": "...", "audienceEn": "..." }] }

Movies:\n${JSON.stringify(candidates.map((m, i) => ({ index: i, title: m.title, genre: m.genre, summary: m.summary, rating: m.rating })))}`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-v4-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 2000 }),
    });
    if (!res.ok) throw new Error(`DeepSeek: ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = intelParseJSON(raw);
    const gems = (parsed?.gems || []).map(g => {
      const src = candidates[g.index] || {};
      return {
        tmdbId: src.tmdbId || null,
        title: src.title || "",
        titleEn: src.titleEn || "",
        poster: src.poster || "",
        genre: src.genre || [],
        summary: src.summary || "",
        summaryEn: src.summaryEn || "",
        rating: src.rating || 0,
        year: src.year || "",
        releaseDate: src.releaseDate || "",
        whyWatch: g.why || "",
        whyWatchEn: g.whyEn || "",
        aiScore: g.aiScore || 0,
        tags: g.tags || [],
        tagsEn: g.tagsEn || [],
        audience: g.audience || "",
        audienceEn: g.audienceEn || "",
      };
    });
    return { updated: today, gems };
  } catch (e) {
    console.warn("Hidden gems failed:", e.message);
    return { updated: today, gems: [] };
  }
}

// ═══════════════════════════════════════════════════════════════════
// Router（仅保留 intel GET 端点 + trailer + hidden-gems POST）
// ═══════════════════════════════════════════════════════════════════
const GENRE_ZH = {
  "hip hop": "嘻哈", "hip-hop": "嘻哈", "rap": "说唱", "trap": "陷阱说唱", "gangsta rap": "匪帮说唱", "old school hip hop": "老派嘻哈", "east coast hip hop": "东岸嘻哈", "west coast hip hop": "西岸嘻哈", "southern hip hop": "南部嘻哈", "underground hip hop": "地下嘻哈", "alternative hip hop": "另类嘻哈", "jazz rap": "爵士说唱", "cloud rap": "云说唱", "drill": "钻头说唱", "grime": "格里姆", "uk hip hop": "英国嘻哈",
  "pop": "流行", "art pop": "艺术流行", "dream pop": "梦幻流行", "synth pop": "合成器流行", "indie pop": "独立流行", "electropop": "电子流行", "dance pop": "舞曲流行", "k-pop": "韩流", "j-pop": "日语流行", "french pop": "法国流行", "latin pop": "拉丁流行",
  "rock": "摇滚", "indie rock": "独立摇滚", "alternative rock": "另类摇滚", "classic rock": "经典摇滚", "hard rock": "硬摇滚", "progressive rock": "前卫摇滚", "psychedelic rock": "迷幻摇滚", "garage rock": "车库摇滚", "post-rock": "后摇滚", "math rock": "数学摇滚", "soft rock": "软摇滚", "southern rock": "南方摇滚", "stoner rock": "石人摇滚", "folk rock": "民谣摇滚", "blues rock": "蓝调摇滚",
  "electronic": "电子", "electronic music": "电子音乐", "edm": "电子舞曲", "house": "浩室", "deep house": "深度浩室", "tech house": "科技浩室", "progressive house": "前卫浩室", "trance": "迷幻", "techno": "铁克诺", "dubstep": "回响贝斯", "drum and bass": "鼓打贝斯", "ambient": "氛围", "idm": "智能舞曲", "breakbeat": "碎拍", "downtempo": "缓拍", "chillout": "弛放", "trip hop": "神游舞曲", "industrial": "工业", "synthwave": "合成器浪潮", "vaporwave": "蒸汽波",
  "r&b": "节奏蓝调", "rnb": "节奏蓝调", "soul": "灵魂", "neo soul": "新灵魂", "funk": "放克", "disco": "迪斯科", "motown": "摩城",
  "jazz": "爵士", "fusion": "融合爵士", "smooth jazz": "流畅爵士", "acid jazz": "酸爵士", "bebop": "比波普", "cool jazz": "冷爵士", "free jazz": "自由爵士", "latin jazz": "拉丁爵士",
  "metal": "金属", "heavy metal": "重金属", "black metal": "黑金属", "death metal": "死亡金属", "doom metal": "厄运金属", "thrash metal": "鞭挞金属", "power metal": "力量金属", "symphonic metal": "交响金属", "folk metal": "民谣金属", "pagan metal": "异教金属", "viking metal": "维京金属", "gothic metal": "哥特金属", "progressive metal": "前卫金属", "nu metal": "新金属", "metalcore": "金属核", "deathcore": "死核",
  "country": "乡村", "folk": "民谣", "indie folk": "独立民谣", "singer-songwriter": "唱作人",
  "blues": "蓝调", "reggae": "雷鬼", "dancehall": "舞厅", "ska": "斯卡",
  "latin": "拉丁", "salsa": "萨尔萨", "bossa nova": "波萨诺瓦", "samba": "桑巴", "reggaeton": "雷击顿", "cumbia": "昆比亚", "bachata": "巴恰塔",
  "classical": "古典", "orchestral": "管弦乐", "chamber music": "室内乐", "opera": "歌剧", "baroque": "巴洛克",
  "jesus": "福音", "gospel": "福音", "christian": "基督教音乐", "christmas": "圣诞音乐",
  "punk": "朋克", "pop punk": "流行朋克", "hardcore punk": "硬核朋克", "post-punk": "后朋克", "skate punk": "滑板朋克",
  "indie": "独立", "alternative": "另类", "experimental": "实验", "avant-garde": "先锋",
  "instrumental": "器乐", "lo-fi": "低保真", "noise": "噪音乐", "ambient pop": "氛围流行",
  "world": "世界音乐", "african": "非洲音乐", "afrobeat": "非洲节拍", "caribbean": "加勒比音乐", "celtic": "凯尔特音乐", "japanese": "日本音乐", "korean": "韩国音乐", "chinese": "中国音乐",
  "soundtrack": "原声", "score": "配乐", "video game music": "游戏音乐", "anime": "动漫",
  "children": "儿童音乐", "comedy": "喜剧", "spoken word": "朗诵", "audiobook": "有声书",
  "electronic pop": "电子流行", "dreamy": "梦幻", "melancholic": "忧郁", "energetic": "活力", "dark": "暗黑", "romantic": "浪漫", "sexy": "性感", "chill": "放松", "party": "派对", "summer": "夏日",
  "2019": "2019", "2020": "2020", "2021": "2021", "2022": "2022", "2023": "2023", "2024": "2024", "2025": "2025", "2026": "2026",
  "favorites": "精选", "best of": "精选", "seen live": "现场", "live": "现场", "cover": "翻唱", "remix": "混音", "remastered": "重制", "deluxe": "豪华版", "compilation": "合辑",
  "rapcore": "说唱核", "g-funk": "G放克", "hardcore hip hop": "硬核说唱", "abstract hip hop": "抽象说唱", "experimental hip hop": "实验说唱", "concept rap": "概念说唱",
  "happy hardcore": "快乐硬核", "jersey club": "泽西俱乐部", "dariacore": "Dariacore", "donk": "Donk", "deer": "Deer", "nightcore": "Nightcore", "breakcore": "Breakcore", "speedcore": "Speedcore",
  "glitch hop": "故障嘻哈", "wonky": "Wonky", "footwork": "Footwork", "jungle": "Jungle",
  "new age": "新世纪", "meditation": "冥想", "relaxation": "放松",
  "viking rock": "维京摇滚", "tropical": "热带音乐", "pagoo": "Pagoo", "karolinerna": "Karolinerna",
  "anthem": "圣歌", "epic": "史诗", "orchestral pop": "管弦流行",
};
function intelGenreZH(tags) {
  if (!tags || !tags.length) return "";
  for (const t of tags) {
    const key = t.toLowerCase().trim();
    if (/^\d+$/.test(key)) continue;
    if (GENRE_ZH[key]) return GENRE_ZH[key];
  }
  for (const t of tags) {
    const key = t.toLowerCase().trim();
    if (!/^\d+$/.test(key)) return t;
  }
  return tags[0];
}

async function searchTMDBList(query, token, language) {
  language = language || "zh-CN";
  const clean = String(query || "").replace(/[《》「」『』【】]/g, "").trim();
  if (!clean || clean.length < 2) return [];
  const cacheKey = "suggest-" + clean + "-" + language;
  return withCache(cacheKey, async () => {
    const searchType = async (type) => {
      const nameF = type === "movie" ? "title" : "name";
      const dateF = type === "movie" ? "release_date" : "first_air_date";
      const origF = type === "movie" ? "original_title" : "original_name";
      const params = new URLSearchParams({ query: clean, include_adult: "false", language });
      const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
      if (!res.ok) return [];
      const d = await res.json();
      return (d?.results || []).slice(0, 5);
    };
    const [mres, tres] = await Promise.all([searchType("movie"), searchType("tv")]);
    const items = [];
    const seen = new Set();
    const push = (m, type) => {
      const nameF = type === "movie" ? "title" : "name";
      const dateF = type === "movie" ? "release_date" : "first_air_date";
      const origF = type === "movie" ? "original_title" : "original_name";
      const title = m[nameF] || "";
      if (!title) return;
      const year = (m[dateF] || "").slice(0, 4);
      const dedupKey = title + "|" + year;
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);
      const tLabel = type === "movie" ? (language.startsWith("zh") ? "电影" : "Movie") : (language.startsWith("zh") ? "剧集" : "TV Series");
      items.push({ title, year, tmdbId: m.id || null, originalTitle: m[origF] || "", type: tLabel, director: "" });
    };
    for (const m of mres) push(m, "movie");
    for (const m of tres) push(m, "tv");
    const top = items.slice(0, 5);
    await Promise.all(top.map(async (it) => {
      if (!it.tmdbId) return;
      const type = it.type === "电影" || it.type === "Movie" ? "movie" : "tv";
      try {
        const cr = await withCache(`${it.tmdbId}-${type}-credits-${language}`, async () => {
          const c = await fetch(`https://api.themoviedb.org/3/${type}/${it.tmdbId}/credits?language=${language}`, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
          return c.ok ? c.json() : { crew: [] };
        });
        if (cr?.crew) {
          const d = cr.crew.find(c => c.job === "Director")?.name || "";
          if (d) it.director = d;
        }
      } catch (e) {}
    }));
    return top;
  }, 21600);
}

async function fetchTMDBEnrichment(title, year, token, language) { language = language || "zh-CN"; let r = await searchTMDB(title, year, "movie", token, language); if (r.poster || r.tmdbId) return r; return searchTMDB(title, year, "tv", token, language); }

async function translateText(text, env) {
  if (!env.DEEPSEEK_API_KEY || !text) return "";
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: "你是专业的影视内容本地化翻译。将英文电影简介翻译成简体中文，要求准确、通顺、符合中文电影简介的文风。只输出翻译结果本身，不要任何解释、引号、前后缀或多余格式。" },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 500,
        thinking: { type: "disabled" },
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return (data?.choices?.[0]?.message?.content || "").trim();
  } catch {
    return "";
  }
}

const INTEL_TAG_CATEGORY = { trending: "trending", editor: "editor", hidden: "hidden-gem", world: "world" };

async function intelEnrichAlbums(items, env) {
  if (!env.DEEPSEEK_API_KEY || !items.length) return [];
  try {
    const prompt = `You are an expert music editor curating "This Week's Picks" — a hand-picked selection of the best new album releases for a diverse global audience.

Below are new releases with MusicBrainz metadata and artist popularity data (starRating: 5★ >100k, 4★ 10k-100k, 3★ 1k-10k listeners):

${JSON.stringify(items.map((i, idx) => ({
  index: idx,
  title: i.title,
  artist: i.artist,
  country: i.country || "Unknown",
  releaseDate: i.releaseDate,
  type: i.primaryType,
  listeners: i.listeners,
  playcount: i.playcount,
  starRating: i.artistStars || 0,
  style: (i.lfmTags || []).slice(0, 5),
  genre: (i.tags || []).slice(0, 3),
})))}

**Task:** Select exactly 20 albums as "This Week's Picks". These will be the ONLY 20 albums shown.

**Critical constraints (follow strictly):**
1. **Popularity first** — strongly prefer 4★ (10k-100k listeners) and 5★ (>100k) items. Only pick 3★ or no-data items if truly exceptional.
2. **Same artist max 1** — never pick more than one album by the same artist.
3. **CJK representation** — MUST include at least 2-3 Chinese/Korean/Japanese items IF available in the data.
4. **Genre diversity** — avoid clustering. If a genre already has 2 picks, deprioritize more from that genre.
5. **Regional diversity** — spread across different countries, not dominated by one region.

**Tags (pick one per album):**
1. "trending" = 🔥 热门趋势 — high popularity (starRating ≥ 4 or listeners > 50000), major artist.
2. "editor" = ⭐ 编辑推荐 — strong artistic merit, outstanding quality, any popularity tier.
3. "hidden" = 💎 隐藏宝石 — excellent quality, unique style, lower popularity (starRating 3 or no data).
4. "world" = 🌍 环球音乐 — from outside US/UK/EU, represents regional music culture.

**Target proportions (approximate, adjust based on data):**
- Trending Now: ~30% (6)
- Editor's Pick: ~30% (6)
- Hidden Gem: ~25% (5)
- Around the World: ~15% (3)

If a category lacks quality candidates, reduce its count — never force a pick.

**Output for each selected album:**
- "tag": one of "trending" | "editor" | "hidden" | "world"
- "tagDisplay": Chinese label, exactly one of "🔥 热门趋势" | "⭐ 编辑推荐" | "💎 隐藏宝石" | "🌍 环球音乐"
- "tagDisplayEn": English label, exactly one of "Trending Now" | "Editor's Pick" | "Hidden Gem" | "Around the World"
- "recommendation": 40-70 character Chinese recommendation line (punchy, informative)
- "recommendationEn": same in English
- "reason": objective reason in Chinese (max 100 chars). Describe style, mood, notable aspects.
- "reasonEn": same in English
- "aiScore": 0-10
- "genres": array of 1-3 Chinese genre/style tags, e.g. ["独立摇滚", "梦幻流行", "电子"]
- "genresEn": same in English

Return JSON only: { "items": [ { index: 0, tag: "trending", tagDisplay: "🔥 热门趋势", tagDisplayEn: "Trending Now", recommendation: "...", recommendationEn: "...", reason: "...", reasonEn: "...", aiScore: 8.5, genres: ["独立摇滚", "梦幻流行"], genresEn: ["Indie Rock", "Dream Pop"] }, ... ] }`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek albums: ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = intelParseJSON(raw);
    return (parsed?.items || []).slice(0, 20).map(ai => {
      const item = items[ai.index] || {};
      return {
        ...item,
        aiScore: ai.aiScore || 0,
        tags: ai.genres || item.tags || [],
        tagsEn: ai.genresEn || item.tagsEn || [],
        genre: (ai.genres || [])[0] || item.genre || "",
        highlight: ai.recommendation || item.highlight || (item.genre ? `${item.genre}精选` : ""),
        highlightEn: ai.recommendationEn || item.highlightEn || "",
        summary: ai.reason || item.summary || (item.genre ? `${item.genre}风格作品` : ""),
        summaryEn: ai.reasonEn || item.summaryEn || "",
        recommendationTag: ai.tagDisplay || "",
        recommendationTagEn: ai.tagDisplayEn || "",
        recommendationTagId: ai.tag || "",
        category: INTEL_TAG_CATEGORY[ai.tag] || "world",
      };
    });
  } catch (e) {
    console.warn("DeepSeek album curation failed:", e.message);
    return [];
  }
}

async function handleIntelMusicV2(request, env) {
  const today = intelToday();

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ updated: today, picks: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const candidates = body?.candidates || [];
    if (!candidates.length) {
      return new Response(JSON.stringify({ updated: today, picks: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Map candidates to format expected by AI enrichment
    const aiInput = candidates.map((c, index) => ({
      index,
      mbid: c.mbid,
      cover: c.cover || "",
      title: c.title,
      artist: c.artist,
      country: c.country || "Unknown",
      releaseDate: c.releaseDate,
      year: c.year || (c.releaseDate || "").slice(0, 4),
      primaryType: c.type,
      listeners: c.artistListeners || 0,
      playcount: c.artistPlaycount || 0,
      artistStars: c.scoreBreakdown?.artist
        ? Math.min(5, Math.max(1, Math.round(c.scoreBreakdown.artist / 10)))
        : 0,
      lfmTags: c.lfmTags || [],
      tags: c.genres || [],
    }));

    // AI curation with one retry (same pattern as digest/hidden-gems — DeepSeek
    // occasionally 5xx/times out; a single hiccup must not drop the whole board
    // into fallback. 2 attempts, 1.2s gap.)
    let aiPicks = null;
    for (let attempt = 0; attempt < 2 && !aiPicks?.length; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1200));
      aiPicks = await intelEnrichAlbums(aiInput, env);
    }

    // ── World-music quota (Rex 2026-08-24): enforced AFTER the AI path too ──
    // Regional bias feeds JP/KR/CN releases into the pool, but two failures
    // stacked: the AI labeled all of them trending/editor/hidden, AND the
    // original hasCJK(artist) detector misses KR acts stored under Latin-script
    // names (Red Velvet, SUMIN…). Signal = CJK chars in name OR MB release
    // country ∈ {JP,KR,CN,TW,HK} OR regional genre tags (k-pop/j-pop/…).
    const WORLD_REGION_COUNTRIES = new Set(["JP", "KR", "CN", "TW", "HK"]);
    const WORLD_REGION_TAG_RE = /\b(k-pop|j-pop|c-pop|mandopop|cantopop|k-rock|j-rock|k-hip hop|k-indie|j-indie|city pop|korean|japanese|chinese|taiwanese|hong kong|shibuya-kei|anime|idol)\b/i;
    const isWorldMaterial = (p) =>
      /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(p.artist || "")
      || WORLD_REGION_COUNTRIES.has(String(p.country || "").toUpperCase())
      || WORLD_REGION_TAG_RE.test((p.lfmTags || []).join(" "))
      || WORLD_REGION_TAG_RE.test((p.tags || []).join(" "))
      || WORLD_REGION_TAG_RE.test((p.genres || []).join(" "))
      || WORLD_REGION_TAG_RE.test((p.genresEn || []).join(" "));
    const applyWorldQuota = (list, max = 4) => {
      let used = 0;
      for (const p of list || []) {
        if (used >= max) break;
        if (!isWorldMaterial(p)) continue;
        if (p.recommendationTagId === "trending" || p.recommendationTagId === "world") continue;
        p.recommendationTag = "🌍 环球音乐";
        p.recommendationTagEn = "Around the World";
        p.recommendationTagId = "world";
        p.category = "world";
        used++;
      }
      return list;
    };
    if (aiPicks?.length) applyWorldQuota(aiPicks);

    // Fallback: programmatic percentile ranking when AI is unavailable.
    // Fixed 2026-08-23: was ASCENDING listener sort → the LEAST-listened 30% got
    // 🔥trending while the biggest artists were tagged 💎hidden AND cut by the
    // final slice(0,15). Now DESCENDING (top listeners = trending), plus:
    // - CJK quota: up to 4 mid/low-ranked CJK artists relabeled 🌍环球音乐
    //   (programmatic version of the AI prompt's "CJK representation" rule)
    // - aiScore from normalized listeners (6.0–10.0) so AIScoreBadge isn't empty
    // - bilingual highlight/summary so the zh UI never shows EN-only filler
    if ((!aiPicks || !aiPicks.length) && aiInput.length) {
      const seenArtist = new Set();
      const ranked = [...aiInput]
        .sort((a, b) => (b.listeners || 0) - (a.listeners || 0))
        .filter(a => {
          const k = (a.artist || "").toLowerCase().trim();
          if (!k || seenArtist.has(k)) return false;
          seenArtist.add(k);
          return true;
        });
      const n = ranked.length;
      const maxL = Math.max(...ranked.map(x => x.listeners || 0), 1);
      const minL = Math.min(...ranked.map(x => x.listeners || 0), 0);
      const lRange = Math.max(maxL - minL, 1);
      const hasCJK = (s) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(s || "");
      const zhStyle = (a) => {
        for (const t of (a.lfmTags || []).slice(0, 5)) {
          const zh = GENRE_ZH[String(t).toLowerCase().trim()];
          if (zh) return zh;
        }
        return "";
      };
      aiPicks = ranked.map((a, i) => {
        const pct = n > 1 ? i / (n - 1) : 0; // 0 = most listened … 1 = least
        let tag, tagEn, tagId, cat;
        if (pct < 0.3) { tag = "🔥 热门趋势"; tagEn = "Trending Now"; tagId = "trending"; cat = "trending"; }
        else if (pct < 0.6) { tag = "⭐ 编辑推荐"; tagEn = "Editor's Pick"; tagId = "editor"; cat = "editor"; }
        else if (pct < 0.85) {
          const editorLow = (a.artistStars || 0) < 3;
          tag = editorLow ? "⭐ 编辑推荐" : "💎 隐藏宝石";
          tagEn = editorLow ? "Editor's Pick" : "Hidden Gem";
          tagId = editorLow ? "editor" : "hidden";
          cat = editorLow ? "editor" : "hidden-gem";
        } else {
          tag = "🌍 环球音乐"; tagEn = "Around the World"; tagId = "world"; cat = "world";
        }
        const styleZh = zhStyle(a);
        const styleEn = (a.lfmTags || [])[0] || "";
        const kListeners = Math.round((a.listeners || 0) / 1000);
        return {
          ...a,
          artist: a.artist || "", title: a.title || "",
          aiScore: Math.round((6 + ((a.listeners || 0) - minL) / lRange * 4) * 10) / 10,
          recommendationTag: tag, recommendationTagEn: tagEn, recommendationTagId: tagId, category: cat,
          highlight: a.highlight || `${styleZh || "新专辑"}发行 · ${kListeners}k 听众`,
          highlightEn: a.highlightEn || `New ${styleEn || "release"} from ${a.artist || "unknown"}`,
          summary: a.summary || (styleZh ? `${styleZh}风格新作，来自${a.artist || "未知艺人"}` : `${a.artist || "Unknown artist"} 的最新专辑作品`),
          summaryEn: a.summaryEn || `Latest album from ${a.artist || "unknown artist"}`,
        };
      });
      // World quota override AFTER percentile tagging — same detector as the
      // AI path above (CJK chars / MB country / regional genre tags).
      applyWorldQuota(aiPicks);
    }

    // Cover art: top 3 from Cover Art Archive
    for (const item of (aiPicks || []).slice(0, 3)) {
      if (item.mbid && !item.cover) {
        try {
          const r = await fetch(`https://coverartarchive.org/release/${item.mbid}/front-250.jpg`);
          if (r.ok) item.cover = `https://coverartarchive.org/release/${item.mbid}/front-250.jpg`;
        } catch {}
      }
    }

    const result = { updated: today, picks: (aiPicks || []).slice(0, 15) };
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ updated: today, picks: [], error: e.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const ALLOWED_ORIGINS = ["https://bloodyrex.xyz", "https://www.bloodyrex.xyz", "https://bloodyrex.github.io", "https://api.bloodyrex.xyz", "http://localhost:4173", "http://localhost:5173", "http://localhost:5174", "http://localhost:7850", "http://127.0.0.1:7850"];
    const origin = request.headers.get("Origin");
    const corsHeaders = { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "Access-Control-Max-Age": "86400" };
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response(JSON.stringify({ error: "Forbidden Origin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── GET routes ──
    if (method === "GET") {
      // ── Intelligence API ──
      const intelMatch = path.match(/^\/intelligence\/(overview|movies|tv|coming|weekly|hidden-gems|debug)$/);
      if (intelMatch) {
        const intelHandlers = {
          overview: handleIntelOverview, movies: handleIntelMovies, tv: handleIntelTV,
          coming: handleIntelComing,
          weekly: handleIntelWeekly, "hidden-gems": handleIntelHiddenGems,
          debug: handleIntelDebug,
        };
        try {
          const intelData = intelMatch[1] === "hidden-gems"
            ? await handleIntelHiddenGems(request, env)
            : await intelHandlers[intelMatch[1]](env);
          return Response.json(intelData, { headers: corsHeaders });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
        }
      }
      // Trailer lookup
      if (path === "/intelligence/trailer") {
        const tmdbId = url.searchParams.get("tmdbId");
        const mtype = url.searchParams.get("type") || "movie";
        if (!tmdbId) return Response.json({ error: "Missing tmdbId" }, { status: 400, headers: corsHeaders });
        try {
          const tk = env.TMDB_API_READ_ACCESS_TOKEN;
          const vurl = `https://api.themoviedb.org/3/${mtype}/${tmdbId}/videos?language=en-US`;
          const vr = await fetch(vurl, { headers: { Authorization: "Bearer " + tk, "Content-Type": "application/json" } });
          if (!vr.ok) return Response.json({ key: null }, { headers: corsHeaders });
          const vd = await vr.json();
          const videos = vd?.results || [];
          const trailer = videos.find(v => v.site === "YouTube" && v.type === "Trailer") || videos.find(v => v.site === "YouTube");
          return Response.json({ key: trailer?.key || null }, { headers: corsHeaders });
        } catch (e) {
          return Response.json({ key: null }, { headers: corsHeaders });
        }
      }
      // Public: AI-search recommendation ratio subset (no auth — only the ai.* knobs)
      if (path === "/intelligence/ai-config") { const cfg = await getIntelConfig(env); return Response.json({ ai: cfg.ai }, { headers: corsHeaders }); }

      // Fallback: health check
      return Response.json({ status: "ok", worker: "intel" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      // Hidden gems v2 (Pipeline-fed: POST today's movies/tv intelligence)
      if (url.pathname === "/intelligence/hidden-gems") {
        try { return Response.json(await handleIntelHiddenGems(request, env), { headers: corsHeaders }); }
        catch (e) { return Response.json({ error: `hidden-gems: ${e.message}` }, { status: 500, headers: corsHeaders }); }
      }

      if (path === "/intelligence/translate-overview") {
        let tb; try { tb = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }
        if (!tb.tmdbId) return Response.json({ error: "Missing tmdbId" }, { status: 400, headers: corsHeaders });
        try {
          const en = await fetchTMDBDetails(tb.tmdbId, env.TMDB_API_READ_ACCESS_TOKEN, "en-US");
          const overview = en?.overview || "";
          if (!overview) return Response.json({ content: { translated: "", hasOverview: false } }, { headers: corsHeaders });
          if (tb.mode === "source") {
            return Response.json({ content: { overviewEn: overview, hasOverview: true } }, { headers: corsHeaders });
          }
          const translated = await translateText(overview, env);
          return Response.json({ content: { translated, hasOverview: true } }, { headers: corsHeaders });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
        }
      }

      // Intelligence Music V2 (Pipeline-fed: POST candidates, returns AI-curated picks)
      if (url.pathname === "/intelligence/music/v2") {
        return handleIntelMusicV2(request, env);
      }

      let body;
      try { body = await request.json(); } catch (e) { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }

      // TMDB / DeepSeek
      try {
        if (body.tmdbId && !body.prompt) { const d = await fetchTMDBDetails(body.tmdbId, env.TMDB_API_READ_ACCESS_TOKEN, body.language); return Response.json({ content: d || {} }, { headers: corsHeaders }); }
        if (body.searchTitle) { const r = await fetchTMDBEnrichment(body.searchTitle, body.searchYear || "", env.TMDB_API_READ_ACCESS_TOKEN, body.language); return Response.json({ content: r || { tmdbId: null } }, { headers: corsHeaders }); }
        if (body.searchQuery) { const sq = await searchTMDBList(body.searchQuery, env.TMDB_API_READ_ACCESS_TOKEN, body.language); return Response.json({ content: sq }, { headers: corsHeaders }); }
        const msgs = []; if (body.systemInstruction) msgs.push({ role: "system", content: body.systemInstruction }); let up = body.prompt; if (body.responseSchema) up += "\n\nIMPORTANT:\nReturn ONLY valid JSON.\nNo markdown.\nNo code block.\nNo explanation.\n"; msgs.push({ role: "user", content: up });
        // DeepSeek call: max_tokens cap + JSON mode (object schemas) + 1 retry on empty/failed response
        const dsBody = { model: "deepseek-v4-flash", messages: msgs, temperature: 0.7, max_tokens: 3000, thinking: { type: "disabled" } };
        if (body.responseSchema?.type === "object") dsBody.response_format = { type: "json_object" };
        let raw = "", dResp = null;
        for (let ai = 0; ai < 2; ai++) {
          if (ai > 0) await new Promise(r => setTimeout(r, 1200));
          dResp = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(dsBody) });
          if (dResp.ok) {
            const dr = await dResp.json();
            raw = dr?.choices?.[0]?.message?.content || "";
            if (raw) break;
          }
        }
        if (!raw) return Response.json({ content: { raw: "", error: "empty_content" } }, { headers: corsHeaders });
        const sp = (c) => { if (typeof c !== "string") return c; try { return JSON.parse(c.replace(/```json/g,"").replace(/```/g,"").trim()); } catch { return { raw, error: "parse_failed" }; } };
        const parsed = sp(raw); let list = []; if (Array.isArray(parsed?.recommendations)) list = parsed.recommendations; else if (parsed?.recommendations) list = [parsed.recommendations]; else if (parsed?.title) list = [parsed];
        if (!list.length) return Response.json({ content: parsed }, { headers: corsHeaders });
        const rl = body.language || "zh-CN"; const enriched = await Promise.all(list.map(async rec => { const sdf = !rec.director; const td = await fetchTMDBEnrichment(rec.title, rec.year, env.TMDB_API_READ_ACCESS_TOKEN, rl); return { ...rec, title: td.title || rec.title, poster: td.poster, tmdbId: td.tmdbId || rec.tmdbId, originalTitle: td.originalTitle || rec.originalTitle || "", year: td.year || rec.year || "", director: sdf && td.director ? td.director : (rec.director || ""), type: td.type || rec.type || "" }; }));
        return Response.json({ content: { recommendations: enriched } }, { headers: corsHeaders });
      } catch (err) { return Response.json({ error: err.message }, { status: 500, headers: corsHeaders }); }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }
};

