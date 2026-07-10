// ═══════════════════════════════════════════════════════════
// Kim's Video — Cloudflare Worker
// Routes: poster-proxy, TMDB details, DeepSeek AI, Discover API, Admin API
// ═══════════════════════════════════════════════════════════

// ── Genre classifier ──
const GENRE_MAP = { 878: "科幻", 9648: "悬疑", 53: "悬疑", 27: "恐怖", 16: "动画", 10752: "战争", 80: "犯罪", 18: "剧情", 10749: "剧情", 36: "剧情", 10402: "剧情", 14: "奇幻", 12: "奇幻" };
function classifyGenre(tmdbGenres) { if (!Array.isArray(tmdbGenres)) return "剧情"; for (const g of tmdbGenres) { const cat = GENRE_MAP[g.id]; if (cat) return cat; } return "剧情"; }

// ── Music genre EN→ZH translation ──
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

// ── TMDB helpers ──
async function fetchTMDBEnrichment(title, year, token, language) { language = language || "zh-CN"; let r = await searchTMDB(title, year, "movie", token, language); if (r.poster || r.tmdbId) return r; return searchTMDB(title, year, "tv", token, language); }

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

async function withCache(key, fetcher, ttl = 86400) { const c = caches.default; const r = new Request(`https://tmdb-cache/${key}`); const h = await c.match(r); if (h) { console.log("[CACHE HIT]", key); return h.json(); } console.log("[CACHE MISS]", key); const d = await fetcher(); if (!d) return null; const resp = new Response(JSON.stringify(d), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` } }); c.put(r, resp.clone()); return d; }

async function fetchTMDBDetails(tmdbId, token, language) { language = language || "zh-CN"; let d = await fetchTMDBByType(tmdbId, "movie", token, language); if (d) return d; d = await fetchTMDBByType(tmdbId, "tv", token, language); return d || {}; }

async function fetchTMDBByType(tmdbId, type, token, language) { language = language || "zh-CN"; try { const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; const det = await withCache(`${tmdbId}-${type}-${language}-details`, async () => { const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?language=${language}`, { headers: h }); return r.ok ? r.json() : null; }); if (!det) return null; const cr = await withCache(`${tmdbId}-${type}-${language}-credits`, async () => { const r = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/credits?language=${language}`, { headers: h }); return r.ok ? r.json() : { crew: [] }; }) || { crew: [] }; const director = cr.crew?.find(c => c.job === "Director")?.name || ""; const yr = det.release_date ? det.release_date.slice(0,4) : det.first_air_date ? det.first_air_date.slice(0,4) : ""; const tLabel = type === "movie" ? (language.startsWith("zh") ? "电影" : "Movie") : (language.startsWith("zh") ? "剧集" : "TV Series"); const cast = cr.cast?.slice(0,5).map(c => c.name) || []; let poster = det.poster_path ? `https://image.tmdb.org/t/p/w342${det.poster_path}` : null; if (poster) { const ep = await fetchEnglishPoster(tmdbId, type, token); if (ep) poster = ep; } return { director, year: yr, originalTitle: det.original_title || det.original_name || "", type: tLabel, title: det.title || det.name || "", poster, overview: det.overview || "", genres: (det.genres || []).map(g => g.name), vote_average: det.vote_average || null, runtime: det.runtime || null, cast }; } catch (e) { return null; } }

// ── Discover API ──
function genId() { return crypto.randomUUID(); } function nowISO() { return new Date().toISOString(); }

async function handleDiscoverList(env, url) { const genre = url.searchParams.get("genre") || ""; const sort = url.searchParams.get("sort") || "newest"; const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50); if (!env.DISCOVER_KV) return { results: [], hasMore: false }; const opts = { limit: limit + 1 }; const { keys, cursor: nc, list_complete } = await env.DISCOVER_KV.list({ prefix: "result:", ...opts }); const results = []; for (const k of keys) { try { const raw = await env.DISCOVER_KV.get(k.name, "json"); if (raw && (!genre || raw.genre === genre)) results.push(raw); } catch (e) {} } results.sort(sort === "popular" ? (a,b) => (b.likes||0) - (a.likes||0) : (a,b) => b.createdAt.localeCompare(a.createdAt)); return { results: results.slice(0, limit), hasMore: results.length > limit, cursor: list_complete ? null : nc }; }

async function handleDiscoverCreate(env, body) { const { sourceMovies, recommendations, genre, contributorName } = body; if (!sourceMovies?.length || !recommendations?.length || !genre) return { error: "Missing fields" }; if (!Array.isArray(sourceMovies) || sourceMovies.length > 2) return { error: "sourceMovies: 1-2" }; if (!Array.isArray(recommendations) || recommendations.length > 5) return { error: "recommendations: max 5" }; if (!env.DISCOVER_KV) return { error: "KV not configured" }; const id = genId(); const doc = { id, createdAt: nowISO(), contributorName: (contributorName || "").trim().slice(0, 30) || "匿名用户", sourceMovies: sourceMovies.map(m => ({ title: m.title || "", titleEn: m.titleEn || "", year: m.year || "", tmdbId: m.tmdbId || null })), recommendations: recommendations.map(r => ({ tmdbId: r.tmdbId || null, title: r.title || "", titleEn: r.titleEn || "", year: r.year || "", director: r.director || "", type: r.type || "", reason: r.reason || "", matchedTags: r.matchedTags || [] })), genre, thumbnail: body.thumbnail || "", likes: 0 }; await env.DISCOVER_KV.put(`result:${id}`, JSON.stringify(doc)); return doc; }

async function handleDiscoverLike(env, id) { if (!env.DISCOVER_KV) return { error: "KV not configured" }; const raw = await env.DISCOVER_KV.get(`result:${id}`, "json"); if (!raw) return { error: "not_found" }; raw.likes = (raw.likes || 0) + 1; await env.DISCOVER_KV.put(`result:${id}`, JSON.stringify(raw)); return { id, likes: raw.likes }; }

async function handleDiscoverUpload(env, body) { const { id, image } = body; if (!id || !image) return { error: "Missing id or image" }; if (!env.DISCOVER_R2) return { error: "R2 not configured" }; const base64 = image.replace(/^data:image\/\w+;base64,/, ""); const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)); const key = `thumbnails/${id}.png`; await env.DISCOVER_R2.put(key, bytes, { httpMetadata: { contentType: "image/png", cacheControl: "public, max-age=86400" } }); const thumbnailUrl = `https://api.bloodyrex.xyz/discover/thumbnail/${id}`; const raw = await env.DISCOVER_KV.get(`result:${id}`, "json"); if (raw) { raw.thumbnail = thumbnailUrl; await env.DISCOVER_KV.put(`result:${id}`, JSON.stringify(raw)); } return { url: thumbnailUrl }; }

// ── Admin API ──
function createAdminToken(password) { return btoa(password + ":" + (Date.now() + 7200000)); }
function verifyAdminToken(token, password) { try { const d = atob(token); const s = d.lastIndexOf(":"); if (s < 0) return false; return d.slice(0,s) === password && Date.now() < parseInt(d.slice(s+1)); } catch { return false; } }

async function handleAdminResults(env) { if (!env.DISCOVER_KV) return { results: [] }; const { keys } = await env.DISCOVER_KV.list({ prefix: "result:", limit: 100 }); const results = []; for (const k of keys) { try { const raw = await env.DISCOVER_KV.get(k.name, "json"); if (raw) results.push(raw); } catch {} } results.sort((a,b) => b.createdAt.localeCompare(a.createdAt)); return { results }; }
async function handleAdminDelete(env, id) { if (!env.DISCOVER_KV) return { error: "KV not configured" }; await env.DISCOVER_KV.delete(`result:${id}`); return { deleted: id }; }
async function handleAdminPatch(env, id, body) { if (!env.DISCOVER_KV) return { error: "KV not configured" }; const raw = await env.DISCOVER_KV.get(`result:${id}`, "json"); if (!raw) return { error: "not_found" }; if (body.genre) raw.genre = body.genre; await env.DISCOVER_KV.put(`result:${id}`, JSON.stringify(raw)); return raw; }


// ═══════════════════════════════════════════════════════════
// Intelligence Data API
// Endpoints: /intelligence/overview | movies | tv | music | trending | coming | weekly
// Data sources: TMDB + MusicBrainz + DeepSeek AI
// ═══════════════════════════════════════════════════════════

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
function intelRatingOk(m) { return !m.vote_average || m.vote_average >= 4; }
const INTEL_TAG_CATEGORY = { trending: "trending", editor: "editor", hidden: "hidden-gem", world: "world" };
function intelParseJSON(raw) { return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim()); }

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
    else if (m.season_number) item.season = m.season_number;
    if (m.last_episode_to_air?.episode_number) item.episode = m.last_episode_to_air.episode_number;
    else if (m.episode_number) item.episode = m.episode_number;
    if (m.last_episode_to_air?.air_date) item.latestAirDate = m.last_episode_to_air.air_date;
    else if (m.next_episode_to_air?.air_date) item.latestAirDate = m.next_episode_to_air.air_date;
  }
  return item;
}

async function intelFetchTMDB(token, path, params, lang) {
  params = params || {};
  lang = lang || "zh-CN";
  const buildUrl = (language) => {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    url.searchParams.set("language", language);
    return url;
  };
  const zhUrl = buildUrl(lang);
  const cacheKey = "intel2-" + btoa(zhUrl.toString()).replace(/[=+/]/g, "");
  const data = await withCache(cacheKey, async () => {
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

// ── Multi-page TMDB fetch ──
async function intelFetchPages(token, path, params = {}, pages = 4) {
  const all = [];
  const seen = new Set();
  for (let p = 1; p <= pages; p++) {
    const page = await intelFetchTMDB(token, path, { ...params, page: p });
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

// ── Region classification ──
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

// ── Diverse selection: guarantee regional representation + genre diversity ──
function intelSelectDiverse(items, count = 20, reserved = { zh: 2, ja: 1, ko: 1 }) {
  if (items.length <= count) return items;

  const maxPop = Math.max(...items.map(m => m.popularity || 0), 0);
  const minPop = Math.min(...items.map(m => m.popularity || 0), 0);
  const popRange = Math.max(maxPop - minPop, 1);

  const scored = items.map(m => ({
    item: m,
    region: classifyRegion(m),
    score: ((m.vote_average || 0) / 10) * 0.5 + ((m.popularity || 0) - minPop) / popRange * 0.5,
    mainGenre: (m.genre_ids || [])[0],
  }));
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

// ── MusicBrainz ──
async function intelFetchAlbumCover(mbid) {
  const cacheKey = `cover-${mbid}`;
  return withCache(cacheKey, async () => {
    const url = `https://coverartarchive.org/release/${mbid}/front-250.jpg`;
    const res = await fetch(url);
    if (res.ok) return url;
    return "";
  }, 604800);
}

// ── Last.fm ──
async function intelFetchLastFM(method, params, env, noCache) {
  if (!env.LASTFM_API_KEY) return null;
  try {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", method);
    url.searchParams.set("api_key", env.LASTFM_API_KEY);
    url.searchParams.set("format", "json");
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const urlStr = url.toString();
    if (noCache) {
      const res = await fetch(urlStr, { headers: { "User-Agent": "KimVideo/1.0" } });
      if (!res.ok) return null;
      return res.json();
    }
    const cacheKey = "lfm-" + btoa(urlStr).replace(/[=+/]/g, "");
    return withCache(cacheKey, async () => {
      const res = await fetch(urlStr, { headers: { "User-Agent": "KimVideo/1.0" } });
      if (!res.ok) { return null; }
      return res.json();
    }, 3600);
  } catch (e) { console.error("intelFetchLastFM error:", method, e?.message); return null; }
}

// ── Filter releases by artist popularity (Last.fm artist.getinfo) ──
async function intelFilterByArtistPopularity(items, env) {
  if (!env.LASTFM_API_KEY || !items.length) return [];
  const artistMap = new Map();
  for (const item of items) {
    const key = item.artist.toLowerCase().trim();
    if (!artistMap.has(key)) {
      artistMap.set(key, { name: item.artist, releases: [] });
    }
    artistMap.get(key).releases.push(item);
  }
  const uniqueArtists = [...artistMap.values()].slice(0, 20);
  const artistData = new Map();
  for (let i = 0; i < uniqueArtists.length; i += 5) {
    const batch = await Promise.allSettled(
      uniqueArtists.slice(i, i + 5).map(async (a) => {
        const data = await intelFetchLastFM("artist.getinfo", { artist: a.name }, env, true);
        if (data?.artist?.stats) {
          const listeners = parseInt(data.artist.stats.listeners) || 0;
          let stars = 0;
          if (listeners >= 100000) stars = 5;
          else if (listeners >= 10000) stars = 4;
          const tags = (data.artist.tags?.tag || []).map(t => t.name).slice(0, 10);
          return { name: a.name, listeners, stars, playcount: parseInt(data.artist.stats.playcount) || 0, tags };
        }
        return { name: a.name, listeners: 0, stars: 0, playcount: 0, tags: [] };
      })
    );
    batch.forEach((r) => {
      if (r.status === "fulfilled" && r.value) {
        artistData.set(r.value.name.toLowerCase().trim(), r.value);
      }
    });
  }
  const result = [];
  for (const item of items) {
    const key = item.artist.toLowerCase().trim();
    const ad = artistData.get(key);
    if (ad && ad.stars > 0) {
      result.push({
        ...item,
        artistListeners: ad.listeners,
        artistPlaycount: ad.playcount,
        artistStars: ad.stars,
        listeners: ad.listeners,
        playcount: ad.playcount,
        lfmTags: ad.tags || [],
        tags: ad.tags?.map(t => intelGenreZH([t])).filter(Boolean).slice(0, 5) || [],
        tagsEn: (ad.tags || []).slice(0, 5),
        genre: intelGenreZH(ad.tags || []) || (ad.tags?.[0] || ""),
      });
    }
  }
  return result;
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

// ── MusicBrainz date range query (full week) ──
async function intelFetchMusicBrainzRange(dateFrom, dateTo) {
  const cacheKey = `intel-mb-range-${dateFrom}-${dateTo}`;
  return withCache(cacheKey, async () => {
    const fetchPage = async (offset) => {
      const qp = new URLSearchParams({ query: `date:[${dateFrom} TO ${dateTo}]`, fmt: "json", limit: "100", offset: String(offset) });
      const url = `https://musicbrainz.org/ws/2/release?${qp.toString()}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(url, {
          headers: { "User-Agent": "BloodyRex-Intelligence/1.0 (rexhr@yahoo.com)" },
        });
        if (res.ok) { const d = await res.json(); return d?.releases || []; }
        if (res.status === 429 && attempt === 0) { await new Promise(r => setTimeout(r, 1000)); continue; }
        return [];
      }
      return [];
    };
    const [page1, page2] = await Promise.all([fetchPage(0), fetchPage(100)]);
    const allReleases = [...page1, ...page2];
    return allReleases.map(r => ({
      mbid: r.id,
      title: r.title || "",
      artist: (r["artist-credit"] || []).map(ac => ac.name || ac.artist?.name || "").join(", "),
      releaseDate: r.date || "",
      year: (r.date || "").slice(0, 4),
      cover: "",
      status: r.status || "",
      country: r.country || "",
      primaryType: r["release-group"]?.["primary-type"] || "",
      secondaryTypes: r["release-group"]?.["secondary-types"] || [],
      tags: (r["release-group"]?.tags || []).map(t => t.name).slice(0, 5),
    }));
  }, 7200);
}

// ── Album type filter: keep Album/EP, exclude remixes/live/compilations ──
function intelIsValidAlbum(r) {
  if (r.primaryType !== "Album" && r.primaryType !== "EP") return false;
  if (r.status === "Bootleg") return false;
  const st = new Set(r.secondaryTypes || []);
  const badST = ["Live", "Compilation", "Remix", "Soundtrack", "Demo", "Bootleg", "Karaoke", "Other"];
  for (const t of badST) { if (st.has(t)) return false; }
  const t = (r.title || "").toLowerCase();
  const badKW = ["live", "remastered", "deluxe", "expanded", "anniversary", "greatest hits", "the collection", "box set", "instrumental", "remix album", "karaoke", "bootleg", "demo"];
  for (const kw of badKW) { if (t.includes(kw)) return false; }
  return true;
}

function intelNormalizeAlbum(r) {
  return {
    ...r,
    mbid: r.mbid,
    title: r.title,
    artist: r.artist,
    releaseDate: r.releaseDate,
    year: r.year,
    cover: r.cover || "",
    country: r.country || "",
    genre: (r.tags?.length > 0 ? r.tags[0] : (r.genre || "")),
    tags: r.tags || [],
    listeners: r.listeners || 0,
    playcount: r.playcount || 0,
    lfmTags: r.lfmTags || [],
  };
}

// ── Last.fm chart top albums (guaranteed popular, has real listener data) ──
async function intelFetchLastFMCharts(env) {
  if (!env.LASTFM_API_KEY) return [];
  const tags = ["hip hop", "pop", "rock", "electronic", "jazz", "blues", "classical", "folk", "k-pop", "j-pop", "mandopop", "latin"];
  const cacheKey = "lfm-charts-v5-" + tags.join("-");
  return withCache(cacheKey, async () => {
    const seen = new Set();
    const all = [];
    for (const tag of tags) {
      try {
        const data = await intelFetchLastFM("tag.gettopalbums", { tag, limit: "30" }, env, true);
        if (data?.albums?.album) {
          for (const a of data.albums.album) {
            const key = (a.name + "|||" + (a.artist?.name || "")).toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              all.push({
                title: a.name || "",
                artist: a.artist?.name || "",
                listeners: 0,
                playcount: 0,
                cover: a.image?.find(i => i.size === "large")?.["#text"] || a.image?.find(i => i.size === "extralarge")?.["#text"] || "",
                mbid: a.mbid || "",
                releaseDate: "",
                year: "",
                primaryType: "Album",
                secondaryTypes: [],
                lfmTags: [],
                tags: [],
                tagsEn: [],
                genre: "",
              });
            }
          }
        }
      } catch {}
    }
    // Enrich top 5 chart items with album.getinfo for real listener/tag data
    const toEnrich = all.slice(0, 5);
    const enriched = await Promise.allSettled(toEnrich.map(async (rel) => {
      try {
        const d = await intelFetchLastFM("album.getinfo", { artist: rel.artist, album: rel.title }, env, true);
        if (d?.album) {
          rel.listeners = parseInt(d.album.listeners) || 0;
          rel.playcount = parseInt(d.album.playcount) || 0;
          rel.lfmTags = (d.album.tags?.tag || []).map(t => t.name).slice(0, 5);
          rel.tags = rel.lfmTags.map(t => intelGenreZH([t])).filter(Boolean).slice(0, 5);
          rel.tagsEn = rel.lfmTags.slice(0, 5);
          rel.genre = intelGenreZH(rel.lfmTags) || rel.lfmTags[0] || "";
        }
      } catch {}
    }));
    return all.slice(0, 100);
  }, 21600);
}

// ── DeepSeek enrichment ──
async function intelEnrichWithAI(items, type, env) {
  if (!env.DEEPSEEK_API_KEY || !items.length) return items;
  try {
    let prompt, maxTokens;
    if (type === "album") {
      // Album pipeline: filter diverse albums
      maxTokens = 8000;
      prompt = `You are a music editor. Today's new album releases:\n\n${JSON.stringify(items.map((i, idx) => ({ index: idx, title: i.title, artist: i.artist, genre: i.genre, country: i.country })))}\n\nYour task:\n1. Select 8-12 of the most noteworthy albums covering a DIVERSE range: mainstream/popular releases, niche/underground gems, and thought-provoking/unconventional works. Do NOT just pick the first ones.\n2. For each selected one, provide: a) "highlight" — one punchy recommendation line in Chinese, b) "highlightEn" — same in English, c) "aiScore" (0-10), d) "tags" (3-5 style/genre tags, in Chinese), e) "tagsEn" (same tags in English), f) "category" — either "global" (mainstream/international) or "niche" (indie/underground/cult), g) "summary" — a short description in Chinese (1-2 sentences about style, mood, notable aspects), h) "summaryEn" — same in English.\n3. Return JSON: { "items": [ { "index": 0, "highlight": "...", "highlightEn": "...", "aiScore": 8.5, "tags": [...], "tagsEn": [...], "category": "global", "summary": "...", "summaryEn": "..." }, ... ] }\nSelect 8-12 albums max. Do NOT return all albums.`;
    } else {
      maxTokens = 4000;
      prompt = `You are an entertainment editor. For each ${type} below, provide: 1) aiScore (0-10), 2) reason (2-3 sentences why it's worth watching, in Chinese), 3) reasonEn (same in English), 4) audience (target audience in Chinese), 5) audienceEn (target audience in English), 6) tags (3-5 short tags, in Chinese), 7) tagsEn (same tags in English). Return JSON object with key "items" containing an array (same count, same order).\n\n${JSON.stringify(items.map((i, idx) => ({ index: idx, title: i.title, genre: i.genre, summary: i.summary })))}`;
    }

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: maxTokens, response_format: { type: "json_object" } }),
    });
    if (!res.ok) throw new Error(`DeepSeek: ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = intelParseJSON(raw);
    const enriched = parsed?.items || [];

    if (type === "album") {
      if (!enriched.length) return items.slice(0, 12);
      return enriched.slice(0, 12).map(ai => {
        const item = items[ai.index] || {};
        return {
          ...item,
          aiScore: ai.aiScore,
          genre: ai.tags?.[0] || item.genre || "",
          tags: ai.tags || [],
          tagsEn: ai.tagsEn || [],
          highlight: ai.highlight || "",
          highlightEn: ai.highlightEn || "",
          summary: ai.summary || "",
          summaryEn: ai.summaryEn || "",
          category: ai.category || "niche",
        };
      });
    }

    return items.map((item, idx) => {
      const ai = enriched.find(e => e.index === idx) || {};
      return { ...item, aiScore: ai.aiScore, tags: ai.tags || item.tags || [], tagsEn: ai.tagsEn || [], reason: ai.reason || "", reasonEn: ai.reasonEn || "", audience: ai.audience || "", audienceEn: ai.audienceEn || "", summary: ai.summary || item.summary || "", summaryEn: ai.summaryEn || item.summaryEn || "" };
    });
  } catch (e) {
    console.warn("DeepSeek enrichment skipped:", e.message);
    return items;
  }
}

// ── AI album curation with 4-tag system (Trending Now / Editor's Pick / Hidden Gem / Around the World) ──
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
        model: "deepseek-chat",
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

// ── Intelligence handlers ──

async function handleIntelOverview(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const weekAgo = intelDaysAgo(7);

  // Fetch data directly with same page counts as category handlers (21 subrequests)
  const [nowPlaying, upcoming, trending, tvOnAir, todayMB] = await Promise.all([
    intelFetchPages(token, "/movie/now_playing", { region: "US" }, 4),
    intelFetchTMDB(token, "/movie/upcoming"),
    intelFetchTMDB(token, "/trending/movie/week"),
    intelFetchPages(token, "/tv/on_the_air", {}, 4),
    intelFetchMusicBrainz(today),
  ]);

  const hasChinese = (text) => /[一-鿿]/.test(text || "");
  const cnFilter = (m) => hasChinese(m.title || m.name) && hasChinese(m.overview);
  const titleCn = (m) => hasChinese(m.title || m.name);

  // Movies: same cnFilter + diversity as handleIntelMovies
  const weekCandidates = nowPlaying
    .filter(m => m.release_date && m.release_date >= weekAgo && m.release_date <= today)
    .filter(cnFilter)
    .filter(intelRatingOk);
  const weekSelected = intelSelectDiverse(weekCandidates, 20, { zh: 2, ja: 1, ko: 1 });
  const moviesReleased = weekSelected.length;

  // TV: same cnFilter as handleIntelTV  (ongoing section)
  const tvCandidates = tvOnAir.filter(cnFilter).filter(intelRatingOk);
  const tvSelected = intelSelectDiverse(tvCandidates, 20, { cn: 1, hmt: 1, jp: 1, kr: 1 });

  // Upcoming movies: same title-only filter + reduced reserve as handleIntelMovies
  const upcomingCandidates = upcoming
    .filter(m => m.release_date && m.release_date >= today)
    .filter(titleCn)
    .filter(intelRatingOk);
  const upcomingSelected = intelSelectDiverse(upcomingCandidates, 20, {});
  const comingSoon = upcomingSelected.slice(0, 6).map(m => {
    const days = Math.ceil((new Date(m.release_date) - new Date(today)) / 86400000);
    return { ...intelNormalizeMovie(m), daysUntil: Math.max(0, days) };
  });

  return {
    updated: today,
    stats: {
      moviesReleased,
      tvAiringThisWeek: tvSelected.length,
      albumsReleased: (todayMB || []).length,
      trending: (trending || []).length,
    },
    editorsPicks: weekSelected.slice(0, 2).map(m => intelNormalizeMovie(m)),
    comingSoon,
    trending: (trending || []).filter(intelRatingOk).slice(0, 5).map((m, i) => ({
      ...intelNormalizeMovie(m), rank: i + 1, trend: "new"
    })),
    brief: `Today: ${moviesReleased} movie(s) released, ${tvSelected.length} TV show(s) airing, ${(todayMB || []).length} new album(s).`,
  };
}

async function handleIntelMovies(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const weekAgo = intelDaysAgo(7);
  const ninetyDaysAgo = intelDaysAgo(90);

  const [nowPlayingRaw, upcomingRaw] = await Promise.all([
    intelFetchPages(token, "/movie/now_playing", { region: "US" }, 4),
    intelFetchPages(token, "/movie/upcoming", {}, 4),
  ]);

  const hasChinese = (text) => /[一-鿿]/.test(text || "");
  const cnFilter = (m) => hasChinese(m.title || m.name) && hasChinese(m.overview);
  const reserve = { zh: 2, ja: 1, ko: 1 };

  // This week: now_playing released in past 7 days
  const weekCandidates = nowPlayingRaw
    .filter(m => m.release_date && m.release_date >= weekAgo && m.release_date <= today)
    .filter(cnFilter)
    .filter(intelRatingOk);
  const weekSelected = intelSelectDiverse(weekCandidates, 20, reserve);
  const weekM = weekSelected.map(m => intelNormalizeMovie(m));

  // Upcoming: release_date >= today, relaxed filter (title Chinese only), reduced reserve
  const titleCn = (m) => hasChinese(m.title || m.name);
  const weekIds = new Set(weekSelected.map(m => m.id));
  const upcomingCandidates = upcomingRaw
    .filter(m => m.release_date && m.release_date >= today)
    .filter(m => !weekIds.has(m.id))
    .filter(titleCn)
    .filter(intelRatingOk);
  const upcomingSelected = intelSelectDiverse(upcomingCandidates, 20, {});
  const upcoming = upcomingSelected.map(m => {
    const days = Math.ceil((new Date(m.release_date) - new Date(today)) / 86400000);
    return { ...intelNormalizeMovie(m), daysUntil: Math.max(0, days) };
  });

  // Now playing: exclude this week + upcoming, 90-day window
  const upcomingIds = new Set(upcomingSelected.map(m => m.id));
  const nowPlayingCandidates = nowPlayingRaw
    .filter(m => m.release_date && m.release_date >= ninetyDaysAgo)
    .filter(m => !weekIds.has(m.id) && !upcomingIds.has(m.id))
    .filter(cnFilter)
    .filter(m => (m.popularity || 0) >= 25)
    .filter(intelRatingOk);
  const nowPlaying = intelSelectDiverse(nowPlayingCandidates, 20, reserve)
    .map(m => intelNormalizeMovie(m));

  return {
    updated: today,
    releasedThisWeek: (await intelEnrichWithAI(weekM, "movie", env)).slice(0, 20),
    upcoming,
    nowPlaying,
  };
}

async function intelFetchTVEpisodeDates(shows, token) {
  if (!token) return shows || [];
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const results = await Promise.allSettled((shows || []).map(async (show) => {
    try {
      const r = await fetch(`https://api.themoviedb.org/3/tv/${show.id}?language=zh-CN`, { headers });
      if (!r.ok) return show;
      const details = await r.json();
      if (details?.last_episode_to_air || details?.next_episode_to_air) {
        return { ...show, last_episode_to_air: details.last_episode_to_air, next_episode_to_air: details.next_episode_to_air };
      }
    } catch (e) { console.warn("TV enrich fail:", show.id, e.message); }
    return show;
  }));
  return results.map(r => r.status === "fulfilled" ? r.value : null).filter(Boolean);
}

async function handleIntelTV(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const weekAgo = intelDaysAgo(7);
  const ninetyDaysAgo = intelDaysAgo(90);
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });

  const [onTheAir, trendingTV, discoverRaw] = await Promise.all([
    intelFetchPages(token, "/tv/on_the_air", {}, 4),
    intelFetchTMDB(token, "/trending/tv/week"),
    intelFetchPages(token, "/discover/tv", { "first_air_date.gte": today, "first_air_date.lte": thirtyDaysLater, "sort_by": "popularity.desc" }, 5),
  ]);

  const hasChinese = (text) => /[一-鿿]/.test(text || "");
  const cnFilter = (s) => hasChinese(s.title || s.name) && hasChinese(s.overview);
  const titleCn = (s) => hasChinese(s.title || s.name);
  const reserve = { cn: 1, hmt: 1, jp: 1, kr: 1 };

  // This week premieres: on_the_air + trending supplement, title-only filter, English auto-pass
  const premiereFromOnAir = onTheAir
    .filter(s => s.first_air_date && s.first_air_date >= weekAgo && s.first_air_date <= today)
    .filter(titleCn)
    .filter(intelRatingOk)
    .filter(s => s.original_language === "en" || (s.popularity || 0) >= 50);
  const premiereFromTrending = trendingTV
    .filter(s => s.first_air_date && s.first_air_date >= weekAgo && s.first_air_date <= today)
    .filter(intelRatingOk)
    .filter(titleCn)
    .filter(s => s.original_language === "en" || (s.popularity || 0) >= 5);
  const premiereMerged = [...premiereFromOnAir];
  const onAirPremIds = new Set(premiereFromOnAir.map(s => s.id));
  for (const s of premiereFromTrending) {
    if (!onAirPremIds.has(s.id)) premiereMerged.push(s);
  }
  const premiereSelected = intelSelectDiverse(premiereMerged, 20, reserve);
  const weekPremieres = premiereSelected.map(s => intelNormalizeMovie(s, "tv"));
  const premiereIds = new Set(premiereSelected.map(s => s.id));

  // Upcoming: trending TV (popular recent buzz) + discover/tv (future premieres within 30 days)
  // Relaxed title-only Chinese filter; English shows auto-pass
  // Trending: intelRatingOk (keep unscored, exclude < 4), Discover: higher popularity threshold (all scored 0)
  const upcomingFromTrending = trendingTV
    .filter(s => s.first_air_date && s.first_air_date >= weekAgo)
    .filter(s => !premiereIds.has(s.id))
    .filter(intelRatingOk)
    .filter(titleCn)
    .filter(s => s.original_language === "en" || (s.popularity || 0) >= 5);
  const upcomingFromDiscover = discoverRaw
    .filter(s => !premiereIds.has(s.id))
    .filter(titleCn)
    .filter(intelRatingOk)
    .filter(s => s.original_language === "en" || (s.popularity || 0) >= 15);
  // Merge and dedup
  const upcomingMerged = [...upcomingFromTrending];
  const trendIds = new Set(upcomingFromTrending.map(s => s.id));
  for (const s of upcomingFromDiscover) {
    if (!trendIds.has(s.id)) upcomingMerged.push(s);
  }
  const upcomingSelected = intelSelectDiverse(upcomingMerged, 20, {});
  const upcomingTV = upcomingSelected.map(s => intelNormalizeMovie(s, "tv"));
  const upcomingIds = new Set(upcomingSelected.map(s => s.id));

  // Ongoing: exclude premieres + upcoming, enrich episode dates on final 20 only
  const ongoingCandidates = onTheAir
    .filter(s => !premiereIds.has(s.id) && !upcomingIds.has(s.id))
    .filter(cnFilter)
    .filter(intelRatingOk)
    .filter(s => (s.popularity || 0) >= 80);
  const ongoingSelected = intelSelectDiverse(ongoingCandidates, 20, reserve);
  const ongoingEnriched = await intelFetchTVEpisodeDates(ongoingSelected, token);
  const ongoingTV = ongoingEnriched
    .filter(s => {
      const lastAir = s.last_episode_to_air?.air_date;
      return !lastAir || lastAir >= ninetyDaysAgo;
    })
    .map(s => intelNormalizeMovie(s, "tv"));

  return {
    updated: today,
    premieresThisWeek: await intelEnrichWithAI(weekPremieres, "movie", env),
    upcoming: upcomingTV,
    ongoing: ongoingTV,
  };
}

// ── Music V2 handler (Pipeline-fed: receives POST from GitHub Actions, calls DeepSeek) ──
async function handleIntelMusicV2(env, request) {
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

    const aiPicks = await intelEnrichAlbums(aiInput, env);

    // Cover art: top 3 from Cover Art Archive
    for (const item of (aiPicks || []).slice(0, 3)) {
      if (item.mbid && !item.cover) {
        try {
          const r = await fetch(`https://coverartarchive.org/release/${item.mbid}/front-250.jpg`);
          if (r.ok) item.cover = `https://coverartarchive.org/release/${item.mbid}/front-250.jpg`;
        } catch {}
      }
    }

    const result = { updated: today, picks: (aiPicks || []).slice(0, 20) };
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ updated: today, picks: [], error: e.message }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

// @deprecated — Music data collection moved to Pipeline (handleIntelMusicV2)
async function handleIntelMusic(env) {
  const today = intelToday();
  return withCache(`intel-music-v6-${today}`, async () => {
    const weekAgo = intelDaysAgo(7);

    // Phase 1: Fetch MB releases this week, filter valid
    const weekReleases = await intelFetchMusicBrainzRange(weekAgo, today).catch(() => []);
    let validReleases = weekReleases.filter(r => intelIsValidAlbum(r) && r.status !== "Bootleg");

    // Phase 2: Filter by artist popularity (artist.getinfo, keep 4★+ = 10k+ listeners)
    let picks = await intelFilterByArtistPopularity(validReleases, env);

    // Phase 3: Always supplement with chart data for diversity (CJK, jazz, blues, classical, folk, etc.)
    const chartAlbums = await intelFetchLastFMCharts(env);
    for (const c of chartAlbums) {
      const dup = picks.some(p =>
        p.title.toLowerCase() === c.title.toLowerCase() &&
        p.artist.toLowerCase() === c.artist.toLowerCase()
      );
      if (!dup) {
        // Chart items: use real listeners if enriched, default 0 otherwise
        const stars = c.listeners >= 100000 ? 5 : c.listeners >= 10000 ? 4 : 0;
        picks.push({ ...c, artistListeners: c.listeners, artistStars: stars });
      }
      if (picks.length >= 100) break;
    }

    // Phase 4: AI diversity curation (select 20 from up to 80 candidates)
    const topInput = picks.slice(0, 80);
    let aiPicks = topInput.length ? await intelEnrichAlbums(topInput, env) : [];

    // Phase 5: Fallback if AI fails
    if (!aiPicks.length && topInput.length) {
      const sorted = [...topInput].sort((a, b) => (b.listeners || 0) - (a.listeners || 0));
      const total = Math.min(sorted.length, 20);
      aiPicks = [];
      for (let i = 0; i < total; i++) {
        const a = sorted[i];
        let tag, tagEn, tagId, cat;
        const pct = i / total;
        if (pct < 0.3) { tag = "🔥 热门趋势"; tagEn = "Trending Now"; tagId = "trending"; cat = "trending"; }
        else if (pct < 0.6) { tag = "⭐ 编辑推荐"; tagEn = "Editor's Pick"; tagId = "editor"; cat = "editor"; }
        else if (pct < 0.85) {
          tag = (a.artistStars || 0) < 3 ? "⭐ 编辑推荐" : "💎 隐藏宝石";
          tagEn = (a.artistStars || 0) < 3 ? "Editor's Pick" : "Hidden Gem";
          tagId = (a.artistStars || 0) < 3 ? "editor" : "hidden";
          cat = (a.artistStars || 0) < 3 ? "editor" : "hidden-gem";
        } else {
          tag = "🌍 环球音乐"; tagEn = "Around the World"; tagId = "world"; cat = "world";
        }
        aiPicks.push({
          ...a,
          recommendationTag: tag, recommendationTagEn: tagEn, recommendationTagId: tagId, category: cat,
          highlight: a.highlight || `New release from ${a.artist}`,
          highlightEn: a.highlightEn || `New release from ${a.artist}`,
          summary: a.summary || "", summaryEn: a.summaryEn || "",
        });
      }
    }

    // Fetch cover art for top 3 picks (direct fetch, 1 subreq each)
    for (const item of (aiPicks.length ? aiPicks.slice(0, 3) : [])) {
      if (item.mbid && !item.cover) {
        try { const r = await fetch(`https://coverartarchive.org/release/${item.mbid}/front-250.jpg`); if (r.ok) item.cover = `https://coverartarchive.org/release/${item.mbid}/front-250.jpg`; } catch {}
      }
    }

    return {
      updated: today,
      picks: aiPicks.slice(0, 20),
    };
  }, 21600);
}

async function handleIntelWeekly(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();

  const [movieTrending, tvTrending] = await Promise.all([
    intelFetchTMDB(token, "/trending/movie/week"),
    intelFetchTMDB(token, "/trending/tv/week"),
  ]);

  const normalizeItem = (item, rank) => {
    const type = item.media_type === "tv" ? "tv" : "movie";
    return { ...intelNormalizeMovie(item, type), rank, trend: "new" };
  };

  return {
    updated: today,
    movies: movieTrending.filter(intelRatingOk).slice(0, 10).map((m, i) => normalizeItem(m, i + 1)),
    tv: tvTrending.filter(intelRatingOk).slice(0, 10).map((s, i) => normalizeItem(s, i + 1)),
    music: [],
  };
}

async function handleIntelComing(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();

  const movieUpcoming = await intelFetchTMDB(token, "/movie/upcoming");

  const allItems = [];

  // Movies
  movieUpcoming
    .filter(m => m.release_date && m.release_date >= today)
    .filter(intelRatingOk)
    .forEach(m => {
      const days = Math.ceil((new Date(m.release_date) - new Date(today)) / 86400000);
      allItems.push({ ...intelNormalizeMovie(m), mediaType: "movie", daysUntil: Math.max(0, days) });
    });

  // TV — discover brand new shows premiering in the future (bilingual)
  try {
    const tvResults = await intelFetchTMDB(token, "/discover/tv", { "first_air_date.gte": today, "sort_by": "popularity.desc" });
    tvResults.filter(intelRatingOk).forEach(s => {
      const days = s.first_air_date ? Math.ceil((new Date(s.first_air_date) - new Date(today)) / 86400000) : 999;
      allItems.push({ ...intelNormalizeMovie(s, "tv"), mediaType: "tv", daysUntil: Math.max(0, days) });
    });
  } catch (e) { console.warn("TV upcoming failed:", e.message); }

  allItems.sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    updated: today,
    next7Days: allItems.filter(m => m.daysUntil <= 7),
    next30Days: allItems.filter(m => m.daysUntil <= 30),
  };
}

// ── Debug: test Last.fm API ──
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

// ── Daily Digest ──
async function handleIntelDigest(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = intelToday();
  const weekAgo = intelDaysAgo(7);

  if (!env.DEEPSEEK_API_KEY) {
    return { date: today, headline: "", summary: "", topTrends: [], industryHighlights: [] };
  }

  try {
    const [nowPlaying, upcoming, dayTrending, weekTrending] = await Promise.all([
      intelFetchTMDB(token, "/movie/now_playing", { region: "US" }),
      intelFetchTMDB(token, "/movie/upcoming"),
      intelFetchTMDB(token, "/trending/all/day"),
      intelFetchTMDB(token, "/trending/all/week"),
    ]);
    const todayMovies = nowPlaying.filter(m => m.release_date === today).length;
    const weekMovies = nowPlaying.filter(m => m.release_date >= weekAgo).length;
    const weekUpcoming = upcoming.filter(m => m.release_date && m.release_date >= today).slice(0, 5).map(m => m.title || m.name);

    const prompt = `Today is ${today}. Summarize today's entertainment news in a digest.

Stats: ${todayMovies} movies released today, ${weekMovies} new movies this week.
Top trending today: ${dayTrending.slice(0, 5).map(m => m.title || m.name).join(", ")}.
Top trending this week: ${weekTrending.slice(0, 8).map(m => m.title || m.name).join(", ")}.
Upcoming: ${weekUpcoming.join(", ") || "none notable"}.

Return JSON only:
{
  "headline": "One punchy headline in Chinese (max 30 chars)",
  "headlineEn": "Same headline in English",
  "summary": "One paragraph summary in Chinese (max 150 chars)",
  "summaryEn": "Same summary in English",
  "topTrends": [{ "rank": 1, "title": "...(in Chinese)", "titleEn": "...(same in English)", "category": "movie" }],
  "industryHighlights": [{ "text": "short highlight in Chinese", "en": "same in English" }]
}

Top 3-5 trends. 3-5 highlights.`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 1500 }),
    });
    if (!res.ok) throw new Error(`DeepSeek: ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = intelParseJSON(raw);
    return { date: today, ...parsed };
  } catch (e) {
    console.warn("Digest failed:", e.message);
    return { date: today, headline: "", summary: "", topTrends: [], industryHighlights: [] };
  }
}

// ── Hidden Gems ──
async function handleIntelHiddenGems(env) {
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
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 2000 }),
    });
    if (!res.ok) throw new Error(`DeepSeek: ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = intelParseJSON(raw);
    const gems = (parsed?.gems || []).map(g => {
      const src = candidates[g.index] || {};
      return {
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

// ── Unsubscribe (Worker-rendered HTML, no frontend needed) ──
async function handleUnsubscribe(request, env) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") || "";

  // POST: process unsubscribe
  if (request.method === "POST") {
    let postEmail = email;
    try {
      const form = await request.formData();
      postEmail = form.get("email") || postEmail;
    } catch {}
    if (postEmail && env.SUBSCRIBE_KV) {
      await env.SUBSCRIBE_KV.delete(`sub:${postEmail}`);
    }
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed — Kim's Video</title></head>
<body style="margin:0;padding:0;background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center;max-width:400px;padding:30px">
  <div style="background:#ff00ff;padding:12px;text-align:center;border:4px solid #000;margin-bottom:20px">
    <h1 style="margin:0;font-size:16px;color:#000;text-transform:uppercase">KIM'S VIDEO</h1>
  </div>
  <h2 style="color:#00ff00;font-size:18px">✅ 已取消订阅</h2>
  <p style="color:#ccc;font-size:13px;line-height:1.5">您已成功取消 Kim's Video 每日影音情报摘要的订阅。如需再次订阅，可随时访问网站。</p>
  <div style="text-align:center;margin-top:20px">
    <a href="https://bloodyrex.xyz/intelligence" style="display:inline-block;background:#ffff00;color:#000;padding:10px 20px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase">返回 Kim's Video</a>
  </div>
  <p style="font-size:10px;color:#666;margin-top:20px">Sent by Kim's Video · bloodyrex.xyz</p>
</div></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }

  // GET: show confirmation form
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invalid Link — Kim's Video</title></head>
<body style="margin:0;padding:0;background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center;max-width:400px;padding:30px">
  <h2 style="color:#ff00ff">无效链接</h2>
  <p style="color:#ccc">此取消订阅链接无效，请检查邮件中的链接是否正确。</p>
  <a href="https://bloodyrex.xyz" style="color:#ffff00">返回首页</a>
</div></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe — Kim's Video</title></head>
<body style="margin:0;padding:0;background:#111;color:#eee;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center;max-width:420px;padding:30px">
  <div style="background:#ff00ff;padding:12px;text-align:center;border:4px solid #000;margin-bottom:20px">
    <h1 style="margin:0;font-size:16px;color:#000;text-transform:uppercase">KIM'S VIDEO</h1>
  </div>
  <h2 style="color:#ffff00;font-size:16px">取消订阅</h2>
  <p style="color:#ccc;font-size:13px">确认取消 Kim's Video 每日影音情报摘要？</p>
  <p style="color:#999;font-size:12px">邮箱：${email}</p>
  <form method="POST" action="/intelligence/unsubscribe?email=${encodeURIComponent(email)}" style="margin-top:16px">
    <input type="hidden" name="email" value="${email}">
    <button type="submit" style="background:#ff00ff;color:#fff;border:4px solid #000;padding:10px 24px;font-size:13px;font-weight:bold;cursor:pointer;text-transform:uppercase">确认取消订阅</button>
  </form>
  <p style="margin-top:16px"><a href="https://bloodyrex.xyz/intelligence" style="color:#666;font-size:12px">不取消，返回 Kim's Video</a></p>
  <p style="font-size:10px;color:#666;margin-top:20px">Sent by Kim's Video · bloodyrex.xyz</p>
</div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
}

// ── Subscribe ──
async function handleSubscribe(request, env) {
  const ALLOWED_ORIGINS = ["https://bloodyrex.xyz", "https://www.bloodyrex.xyz", "https://bloodyrex.github.io", "http://localhost:4173", "http://localhost:5173", "http://localhost:5174", "http://localhost:7850", "http://127.0.0.1:7850"];
  const origin = request.headers.get("Origin");
  const corsHeaders = { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400" };

  if (!env.SUBSCRIBE_KV) return Response.json({ error: "Subscribe not configured" }, { status: 503, headers: corsHeaders });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }

  const email = (body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Invalid email" }, { status: 400, headers: corsHeaders });

  // Check already subscribed
  const existing = await env.SUBSCRIBE_KV.get(`sub:${email}`);
  if (existing) return Response.json({ ok: true, message: "Already subscribed" }, { headers: corsHeaders });

  // Store
  const subscriber = JSON.stringify({ email, locale: body.locale || "zh", subscribedAt: new Date().toISOString() });
  await env.SUBSCRIBE_KV.put(`sub:${email}`, subscriber);

  // Send confirmation via Resend
  if (env.RESEND_API_KEY) {
    const unsubUrl = `https://api.bloodyrex.xyz/intelligence/unsubscribe?email=${encodeURIComponent(email)}`;
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Kim's Video <digest@bloodyrex.xyz>",
          to: email,
          subject: body.locale === "en" ? "Subscription confirmed — Kim's Video Daily Digest" : "✅ 订阅确认 — Kim's Video 每日影音情报摘要",
          html: body.locale === "en"
            ? `<!DOCTYPE html>
<html><body style="margin:0;padding:20px;background:#111;color:#eee;font-family:sans-serif">
<div style="max-width:480px;margin:0 auto">
  <div style="background:#ff00ff;padding:12px;text-align:center;border:4px solid #000;margin-bottom:16px">
    <h1 style="margin:0;font-size:16px;color:#000;text-transform:uppercase">KIM'S VIDEO · DIGEST</h1>
  </div>
  <div style="background:#000;border:4px solid #ffff00;padding:16px;margin-bottom:16px">
    <p style="font-size:14px;color:#00ff00;font-weight:bold;margin:0 0 8px">✅ Subscription confirmed!</p>
    <p style="font-size:13px;color:#ccc;line-height:1.5;margin:0">You'll receive the Kim's Video Daily Intelligence Digest every morning (Beijing time 8:00), including:</p>
    <ul style="font-size:12px;color:#999;line-height:1.8;padding-left:16px;margin:8px 0 0">
      <li>📰 AI-curated daily headlines</li>
      <li>🔥 Weekly hot lists (movies & TV top 10)</li>
      <li>▶ Coming soon preview</li>
      <li>🎬 New movie releases</li>
      <li>📺 TV premieres & ongoing</li>
      <li>💿 Editor's album picks</li>
    </ul>
  </div>
  <div style="text-align:center;margin:16px 0">
    <a href="https://bloodyrex.xyz/intelligence" style="display:inline-block;background:#ffff00;color:#000;padding:10px 20px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase">Explore Intelligence</a>
  </div>
  <p style="font-size:10px;color:#666;text-align:center;margin-top:20px">
    <a href="${unsubUrl}" style="color:#666">Unsubscribe</a> · <a href="https://bloodyrex.xyz" style="color:#666">bloodyrex.xyz</a>
  </p>
</div></body></html>`
            : `<!DOCTYPE html>
<html><body style="margin:0;padding:20px;background:#111;color:#eee;font-family:sans-serif">
<div style="max-width:480px;margin:0 auto">
  <div style="background:#ff00ff;padding:12px;text-align:center;border:4px solid #000;margin-bottom:16px">
    <h1 style="margin:0;font-size:16px;color:#000;text-transform:uppercase">KIM'S VIDEO · 每日影音情报</h1>
  </div>
  <div style="background:#000;border:4px solid #ffff00;padding:16px;margin-bottom:16px">
    <p style="font-size:14px;color:#00ff00;font-weight:bold;margin:0 0 8px">✅ 订阅成功！</p>
    <p style="font-size:13px;color:#ccc;line-height:1.5;margin:0">每天上午 8:00（北京时间）您将收到以下内容：</p>
    <ul style="font-size:12px;color:#999;line-height:1.8;padding-left:16px;margin:8px 0 0">
      <li>📰 AI 精选每日摘要</li>
      <li>🔥 本周热榜（电影 & 剧集 Top 10）</li>
      <li>▶ 即将上映预告</li>
      <li>🎬 本周新片速递</li>
      <li>📺 剧集首播与热播追踪</li>
      <li>💿 编辑精选专辑推荐</li>
    </ul>
  </div>
  <div style="text-align:center;margin:16px 0">
    <a href="https://bloodyrex.xyz/intelligence" style="display:inline-block;background:#ffff00;color:#000;padding:10px 20px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase">前往情报中心</a>
  </div>
  <p style="font-size:10px;color:#666;text-align:center;margin-top:20px">
    <a href="${unsubUrl}" style="color:#666">取消订阅</a> · <a href="https://bloodyrex.xyz" style="color:#666">bloodyrex.xyz</a>
  </p>
</div></body></html>`,
        }),
      });
    } catch (e) { console.warn("Resend confirmation failed:", e.message); }
  }

  return Response.json({ ok: true, message: "Subscribed" }, { headers: corsHeaders });
}

// ── Digest email builder: fetches rich data, returns ready-to-send HTML ──
async function buildDigestHTML(env, now) {
  now = now || intelToday();
  // Fetch sections in parallel (cached calls from daily pipeline)
  const [digestData, weeklyData, comingData, overviewData] = await Promise.allSettled([
    handleIntelDigest(env),
    handleIntelWeekly(env),
    handleIntelComing(env),
    handleIntelOverview(env),
  ]);
  const digest = digestData.status === "fulfilled" ? digestData.value : {};
  const weekly = weeklyData.status === "fulfilled" ? weeklyData.value : {};
  const coming = comingData.status === "fulfilled" ? comingData.value : {};
  const overview = overviewData.status === "fulfilled" ? overviewData.value : {};
  const stats = overview.stats || {};
  const date = digest.date || overview.updated || now;

  // ── Daily Digest section ──
  const headline = digest.headline || "";
  const summaryZh = digest.summary || "";
  const trends = (digest.topTrends || []).slice(0, 5);
  const trendsHtml = trends.length
    ? `<div style="margin:8px 0">${trends.map(t => `<span style="display:inline-block;background:#ff00ff;color:#000;padding:2px 7px;font-size:10px;font-weight:bold;margin:2px;text-transform:uppercase">${t.title}</span>`).join("")}</div>`
    : "";

  // ── Weekly Hot section ──
  const hotMovies = (weekly.movies || []).slice(0, 3);
  const hotTV = (weekly.tv || []).slice(0, 3);
  const hotMoviesHtml = hotMovies.length
    ? `<table style="width:100%;border-collapse:collapse">${hotMovies.map((m, i) =>
      `<tr><td style="padding:3px 6px;font-size:13px;color:#fff;width:20px;vertical-align:top"><strong style="color:#ff00ff">${i+1}.</strong></td><td style="padding:3px 6px;font-size:13px;color:#fff">${m.title || ""}</td></tr>`
    ).join("")}</table>`
    : "";
  const hotTVHtml = hotTV.length
    ? `<table style="width:100%;border-collapse:collapse">${hotTV.map((s, i) =>
      `<tr><td style="padding:3px 6px;font-size:13px;color:#fff;width:20px;vertical-align:top"><strong style="color:#00ffff">${i+1}.</strong></td><td style="padding:3px 6px;font-size:13px;color:#fff">${s.title || ""}</td></tr>`
    ).join("")}</table>`
    : "";

  // ── Coming Soon section ──
  const comingItems = (coming.next7Days || []).slice(0, 5);
  const comingHtml = comingItems.length
    ? `<table style="width:100%;border-collapse:collapse">${comingItems.map(item => {
      const d = item.daysUntil || 0;
      const label = d === 0 ? "今日" : d <= 3 ? `${d}天后` : `${d}天`;
      const genre = Array.isArray(item.genre) ? item.genre.slice(0, 2).join("/") : (item.genre || "");
      return `<tr><td style="padding:4px 8px;font-size:11px;color:#ff00ff;white-space:nowrap;width:50px">${label}</td><td style="padding:4px 8px;font-size:13px;color:#fff">${item.title || ""}</td><td style="padding:4px 8px;font-size:11px;color:#999;text-align:right">${genre}</td></tr>`;
    }).join("")}</table>`
    : "";

  // ── Editor's Picks (movies) ──
  const editorsPicks = (overview.editorsPicks || []).slice(0, 2);
  const editorsHtml = editorsPicks.length
    ? editorsPicks.map(pick => {
      const g = Array.isArray(pick.genre) ? pick.genre.slice(0, 2).join(" / ") : (pick.genre || "");
      const r = pick.rating || 0;
      const s = pick.summary || "";
      return `<div style="background:#000;border:2px solid #ff00ff;padding:10px;margin:6px 0">
  <div style="font-size:14px;color:#ffff00;font-weight:bold">${pick.title || ""}</div>
  <div style="font-size:11px;color:#999;margin-top:2px">${g} · ${r}/10</div>
  ${s ? `<div style="font-size:12px;color:#ccc;margin-top:4px;line-height:1.4">${s}</div>` : ""}
</div>`;
    }).join("")
    : "";

  // ── Stats ──
  const statsHtml = `<table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:3px 8px;font-size:12px;color:#fff">🎬 电影上新</td><td style="padding:3px 8px;font-size:12px;color:#ffff00;font-weight:bold;text-align:right">${stats.moviesReleased || 0}</td></tr>
    <tr><td style="padding:3px 8px;font-size:12px;color:#fff">📺 剧集在播</td><td style="padding:3px 8px;font-size:12px;color:#ffff00;font-weight:bold;text-align:right">${stats.tvAiringThisWeek || 0}</td></tr>
    <tr><td style="padding:3px 8px;font-size:12px;color:#fff">💿 专辑发行</td><td style="padding:3px 8px;font-size:12px;color:#ffff00;font-weight:bold;text-align:right">${stats.albumsReleased || 0}</td></tr>
    <tr><td style="padding:3px 8px;font-size:12px;color:#fff">🔥 热榜变动</td><td style="padding:3px 8px;font-size:12px;color:#ffff00;font-weight:bold;text-align:right">${stats.trending || 0}</td></tr>
  </table>`;

  // ── Assemble full HTML ──
  const unsubUrl = `https://api.bloodyrex.xyz/intelligence/unsubscribe?email=`;
  const title = (text) => `<div style="display:flex;align-items:center;gap:6px;margin:12px 0 8px"><span style="font-size:16px;font-weight:bold;color:#ffff00;text-transform:uppercase">${text}</span></div>`;
  const divider = `<div style="border-top:2px dashed #333;margin:16px 0"></div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>a{color:#999;text-decoration:none}@media only screen and (max-width:480px){.body{padding:10px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#111;color:#eee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<div style="max-width:560px;margin:0 auto;padding:20px">

  <!-- Header -->
  <div style="background:#ff00ff;padding:14px;text-align:center;border:4px solid #000;margin-bottom:16px">
    <h1 style="margin:0;font-size:18px;color:#000;text-transform:uppercase;letter-spacing:2px">KIM'S VIDEO · ${date}</h1>
    <p style="margin:4px 0 0;font-size:10px;color:#000;text-transform:uppercase;letter-spacing:1px">每日影音情报摘要</p>
  </div>

  <!-- Daily Digest -->
  ${headline || summaryZh ? `
  <div style="background:#000;border:4px solid #ffff00;padding:14px;margin-bottom:16px">
    ${title("📰 每日摘要")}
    ${headline ? `<h2 style="margin:0;font-size:15px;color:#ffff00;line-height:1.4">${headline}</h2>` : ""}
    ${summaryZh ? `<p style="font-size:12px;color:#ccc;line-height:1.6;margin:6px 0 0">${summaryZh}</p>` : ""}
    ${trendsHtml}
  </div>` : ""}

  ${divider}

  <!-- Weekly Hot -->
  ${hotMoviesHtml || hotTVHtml ? `
  ${title("🔥 本周热榜")}
  <table style="width:100%"><tr>
    <td style="vertical-align:top;padding-right:8px;width:50%">
      <p style="font-size:11px;color:#ff00ff;font-weight:bold;text-transform:uppercase;margin:0 0 4px">🎬 电影 Top 3</p>
      ${hotMoviesHtml || '<p style="font-size:11px;color:#666">暂无数据</p>'}
    </td>
    <td style="vertical-align:top;padding-left:8px;width:50%">
      <p style="font-size:11px;color:#00ffff;font-weight:bold;text-transform:uppercase;margin:0 0 4px">📺 剧集 Top 3</p>
      ${hotTVHtml || '<p style="font-size:11px;color:#666">暂无数据</p>'}
    </td>
  </tr></table>
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/intelligence/weekly" style="font-size:11px;color:#00ffff">查看完整热榜 →</a>
  </div>` : ""}

  ${divider}

  <!-- Coming Soon -->
  ${comingHtml ? `
  ${title("▶ 即将上映")}
  ${comingHtml}
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/intelligence/coming" style="font-size:11px;color:#ff00ff">查看全部 →</a>
  </div>` : ""}

  ${divider}

  <!-- Editor's Picks (Movies) -->
  ${editorsHtml ? `
  ${title("🎬 本周电影精选")}
  ${editorsHtml}
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/intelligence/movies" style="font-size:11px;color:#ff00ff">查看全部电影 →</a>
  </div>` : ""}

  ${divider}

  <!-- TV Section -->
  ${hotTVHtml ? `
  ${title("📺 本周剧集精选")}
  <div style="background:#000;border:2px solid #00ffff;padding:10px;margin:6px 0">
    ${hotTV.slice(0, 2).map(s => {
      const g = Array.isArray(s.genre) ? s.genre.slice(0, 2).join(" / ") : (s.genre || "");
      return `<div style="margin:4px 0"><span style="font-size:13px;color:#fff;font-weight:bold">${s.title || ""}</span>${g ? ` <span style="font-size:11px;color:#999">· ${g}</span>` : ""}</div>`;
    }).join("")}
  </div>
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/intelligence/tv" style="font-size:11px;color:#00ffff">查看全部剧集 →</a>
  </div>` : ""}

  ${divider}

  <!-- Music Section -->
  ${title("💿 本周音乐精选")}
  <div style="background:#000;border:2px solid #ffff00;padding:10px;margin:6px 0">
    <p style="font-size:12px;color:#ccc;margin:0">本周共发行 <strong style="color:#ffff00">${stats.albumsReleased || 0}</strong> 张新专辑</p>
    <p style="font-size:11px;color:#999;margin:4px 0 0">涵盖流行、摇滚、电子、嘻哈等多种风格，由 AI 精选推荐</p>
  </div>
  <div style="text-align:right;margin:4px 0">
    <a href="https://bloodyrex.xyz/intelligence/music" style="font-size:11px;color:#ffff00">查看全部专辑 →</a>
  </div>

  ${divider}

  <!-- Stats + CTA -->
  <div style="background:#000;border:4px solid #ff00ff;padding:10px;margin:12px 0">
    ${statsHtml}
  </div>
  <div style="text-align:center;margin:16px 0">
    <a href="https://bloodyrex.xyz/intelligence" style="display:inline-block;background:#ffff00;color:#000;padding:12px 28px;font-weight:bold;font-size:13px;border:4px solid #000;text-decoration:none;text-transform:uppercase;letter-spacing:1px">查看完整情报</a>
  </div>

  <!-- Footer -->
  <div style="border-top:2px dashed #333;margin:16px 0;padding-top:12px;text-align:center">
    <p style="font-size:10px;color:#666;margin:0 0 4px">
      <a href="${unsubUrl}" style="color:#666;text-decoration:underline">取消订阅</a>
      <span style="color:#444"> · </span>
      <a href="https://bloodyrex.xyz" style="color:#666">bloodyrex.xyz</a>
    </p>
    <p style="font-size:9px;color:#444;margin:0">Sent by Kim's Video · 武汉变色龙科技文化有限公司</p>
  </div>

</div></body></html>`;

  return { html, date };
}

async function handleSendDigest(request, env) {
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (!env.RESEND_API_KEY) return Response.json({ error: "Resend not configured" }, { status: 503, headers: corsHeaders });
  if (!env.SUBSCRIBE_KV) return Response.json({ error: "KV not configured" }, { status: 503, headers: corsHeaders });

  const auth = request.headers.get("Authorization");
  if (!auth || auth !== `Bearer ${env.DIGEST_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });

  const list = await env.SUBSCRIBE_KV.list({ prefix: "sub:" });
  if (!list.keys.length) return Response.json({ ok: true, sent: 0 }, { headers: corsHeaders });

  // Build digest once
  const { html, date } = await buildDigestHTML(env);

  let sent = 0;
  for (const key of list.keys) {
    try {
      const raw = await env.SUBSCRIBE_KV.get(key.name);
      if (!raw) continue;
      const sub = JSON.parse(raw);
      const personalHtml = html.replace(
        "https://api.bloodyrex.xyz/intelligence/unsubscribe?email=",
        `https://api.bloodyrex.xyz/intelligence/unsubscribe?email=${encodeURIComponent(sub.email)}`
      );
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Kim's Video <digest@bloodyrex.xyz>",
          to: sub.email,
          subject: `Kim's Video 每日影音情报 · ${date}`,
          html: personalHtml,
        }),
      });
      sub.lastSentAt = new Date().toISOString();
      await env.SUBSCRIBE_KV.put(key.name, JSON.stringify(sub));
      sent++;
    } catch (e) { console.warn(`Send to ${key.name} failed:`, e.message); }
  }

  return Response.json({ ok: true, sent }, { headers: corsHeaders });
}

// ── Main ──
export default {
  async fetch(request, env) {
    const ALLOWED_ORIGINS = ["https://bloodyrex.xyz", "https://www.bloodyrex.xyz", "https://bloodyrex.github.io", "http://localhost:4173", "http://localhost:5173", "http://localhost:5174", "http://localhost:7850", "http://127.0.0.1:7850"];
    const origin = request.headers.get("Origin");
    const corsHeaders = { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0], "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", "Access-Control-Max-Age": "86400" };
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response(JSON.stringify({ error: "Forbidden Origin" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const auth = request.headers.get("Authorization");
    const token = auth ? auth.replace("Bearer ", "") : "";

    // ── Admin auth check helper ──
    const requireAdmin = () => { if (!token || !verifyAdminToken(token, env.ADMIN_PASSWORD)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders }); return null; };

    // ── GET routes ──
    if (method === "GET") {
      // Thumbnail serve
      const tm = path.match(/^\/discover\/thumbnail\/(.+)$/);
      if (tm && env.DISCOVER_R2) { try { const obj = await env.DISCOVER_R2.get(`thumbnails/${tm[1]}.png`); if (!obj) return new Response("Not found", { status: 404, headers: corsHeaders }); const h = new Headers(); obj.writeHttpMetadata(h); h.set("Access-Control-Allow-Origin", corsHeaders["Access-Control-Allow-Origin"]); h.set("Cache-Control", "public, max-age=86400"); return new Response(obj.body, { headers: h }); } catch (e) { return new Response("Error", { status: 500, headers: corsHeaders }); } }

      // Poster proxy (TMDB + Cover Art Archive)
      if (path === "/poster-proxy") { const iu = url.searchParams.get("url"); if (!iu) return new Response("Missing url", { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }); if (!iu.startsWith("https://image.tmdb.org/") && !iu.startsWith("https://coverartarchive.org/")) return new Response("Forbidden", { status: 403, headers: { "Access-Control-Allow-Origin": "*" } }); try { const ir = await fetch(iu); const nh = new Headers(ir.headers); nh.set("Access-Control-Allow-Origin", "*"); nh.set("Cache-Control", "public, max-age=86400"); return new Response(ir.body, { status: ir.status, headers: nh }); } catch (e) { return new Response("Proxy error", { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }); } }

      // Admin: list results
      if (path === "/admin/results") { const err = requireAdmin(); if (err) return err; try { return Response.json(await handleAdminResults(env), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }

      // Discover list
      if (path === "/discover/results") { try { return Response.json(await handleDiscoverList(env, url), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message, results: [] }, { headers: corsHeaders }); } }


      // Unsubscribe page
      if (path === "/intelligence/unsubscribe") {
        return handleUnsubscribe(request, env);
      }

      // ── Intelligence API ──
      const intelMatch = path.match(/^\/intelligence\/(overview|movies|tv|music|coming|weekly|hidden-gems|digest|debug)$/);
      if (intelMatch) {
        const intelHandlers = {
          overview: handleIntelOverview, movies: handleIntelMovies, tv: handleIntelTV,
          music: handleIntelMusic, coming: handleIntelComing,
          weekly: handleIntelWeekly, "hidden-gems": handleIntelHiddenGems,
          digest: handleIntelDigest, debug: handleIntelDebug,
        };
        try {
          const intelData = await intelHandlers[intelMatch[1]](env);
          return Response.json(intelData, { headers: corsHeaders });
        } catch (e) {
          return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
        }
      }
      return Response.json({ status: "ok" }, { headers: corsHeaders });
    }

    // ── POST routes ──
    if (method === "POST") {
      // Admin: login
      if (path === "/admin/login") { let b; try { b = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); } if (!env.ADMIN_PASSWORD) return Response.json({ error: "Admin not configured" }, { headers: corsHeaders }); if (b.password !== env.ADMIN_PASSWORD) return Response.json({ error: "Invalid password" }, { headers: corsHeaders }); return Response.json({ token: createAdminToken(env.ADMIN_PASSWORD) }, { headers: corsHeaders }); }

      // Discover upload
      const um = path.match(/^\/discover\/results\/(.+)\/upload$/);
      if (um) { try { const ub = await request.json(); return Response.json(await handleDiscoverUpload(env, { id: um[1], image: ub.image }), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }

      // Discover like
      const lm = path.match(/^\/discover\/results\/(.+)\/like$/);
      if (lm) { try { return Response.json(await handleDiscoverLike(env, lm[1]), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }

      // Intelligence Music V2 (Pipeline-fed: POST candidates, returns AI-curated picks)
      if (url.pathname === "/intelligence/music/v2") {
        return handleIntelMusicV2(env, request);
      }

      // Subscribe
      if (path === "/intelligence/subscribe") {
        return handleSubscribe(request, env);
      }

      // Send digest (internal, authenticated)
      if (path === "/intelligence/send-digest") {
        return handleSendDigest(request, env);
      }

      // Unsubscribe (POST)
      if (path === "/intelligence/unsubscribe") {
        return handleUnsubscribe(request, env);
      }

      let body;
      try { body = await request.json(); } catch (e) { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); }

      // Discover create
      if (path === "/discover/results") { try { return Response.json(await handleDiscoverCreate(env, body), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }

      // TMDB / DeepSeek
      try {
        if (body.tmdbId && !body.prompt) { const d = await fetchTMDBDetails(body.tmdbId, env.TMDB_API_READ_ACCESS_TOKEN, body.language); return Response.json({ content: d || {} }, { headers: corsHeaders }); }
        if (body.searchTitle) { const r = await fetchTMDBEnrichment(body.searchTitle, body.searchYear || "", env.TMDB_API_READ_ACCESS_TOKEN, body.language); return Response.json({ content: r || { tmdbId: null } }, { headers: corsHeaders }); }
        const msgs = []; if (body.systemInstruction) msgs.push({ role: "system", content: body.systemInstruction }); let up = body.prompt; if (body.responseSchema) up += "\n\nIMPORTANT:\nReturn ONLY valid JSON.\nNo markdown.\nNo code block.\nNo explanation.\n"; msgs.push({ role: "user", content: up });
        const res = await fetch("https://api.deepseek.com/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "deepseek-chat", messages: msgs, temperature: 0.7 }) });
        const result = await res.json(); const raw = result?.choices?.[0]?.message?.content || "";
        const sp = (c) => { if (typeof c !== "string") return c; try { return JSON.parse(c.replace(/```json/g,"").replace(/```/g,"").trim()); } catch { return { raw, error: "parse_failed" }; } };
        const parsed = sp(raw); let list = []; if (Array.isArray(parsed?.recommendations)) list = parsed.recommendations; else if (parsed?.recommendations) list = [parsed.recommendations]; else if (parsed?.title) list = [parsed];
        if (!list.length) return Response.json({ content: parsed }, { headers: corsHeaders });
        const rl = body.language || "zh-CN"; const enriched = await Promise.all(list.map(async rec => { const sdf = !rec.director; const td = await fetchTMDBEnrichment(rec.title, rec.year, env.TMDB_API_READ_ACCESS_TOKEN, rl); return { ...rec, title: td.title || rec.title, poster: td.poster, tmdbId: td.tmdbId || rec.tmdbId, originalTitle: td.originalTitle || rec.originalTitle || "", year: td.year || rec.year || "", director: sdf && td.director ? td.director : (rec.director || ""), type: td.type || rec.type || "" }; }));
        return Response.json({ content: { recommendations: enriched } }, { headers: corsHeaders });
      } catch (err) { return Response.json({ error: err.message }, { status: 500, headers: corsHeaders }); }
    }

    // ── DELETE / PATCH routes (admin only) ──
    const adm = path.match(/^\/admin\/results\/(.+)$/);
    if (adm) {
      if (method === "DELETE") { const er = requireAdmin(); if (er) return er; try { return Response.json(await handleAdminDelete(env, adm[1]), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
      if (method === "PATCH") { const er = requireAdmin(); if (er) return er; let b; try { b = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders }); } try { return Response.json(await handleAdminPatch(env, adm[1], b), { headers: corsHeaders }); } catch (e) { return Response.json({ error: e.message }, { status: 500, headers: corsHeaders }); } }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }
};