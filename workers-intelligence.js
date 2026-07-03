// ═══════════════════════════════════════════════════════════
// Intelligence Data Endpoints — merge into existing Worker
// Routes: GET /intelligence/{overview,movies,tv,trending,coming,weekly,editor}
// ═══════════════════════════════════════════════════════════

// ── Intelligence helpers ──

const GENRE_ID_MAP = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
};

function mapGenres(ids) {
  return (ids || []).map(id => GENRE_ID_MAP[id]).filter(Boolean);
}

function normalizeMovieItem(m, type = "movie") {
  const dateField = type === "movie" ? "release_date" : "first_air_date";
  return {
    tmdbId: m.id,
    title: m.title || m.name || "",
    titleEn: m.original_title || m.original_name || m.title || "",
    year: (m[dateField] || "").slice(0, 4),
    releaseDate: m[dateField] || "",
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "",
    rating: m.vote_average || 0,
    genre: mapGenres(m.genre_ids),
    summary: (m.overview || "").slice(0, 200),
    type,
  };
}

async function fetchTMDBList(token, path, params = {}) {
  const url = new URL(path, "https://api.themoviedb.org/3");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("language", "en-US");
  const cacheKey = url.toString();
  const cached = await withCache(`intel-tmdb-${btoa(cacheKey).slice(0, 40)}`, async () => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`TMDB ${path}: ${res.status}`);
    return res.json();
  }, 3600);
  return cached?.results || [];
}

async function enrichWithDeepSeek(items, type, env) {
  if (!env.DEEPSEEK_API_KEY || !items.length) return items;
  try {
    const prompt = `You are an entertainment intelligence editor. For each ${type} below, provide: 1) aiScore (0-10 number), 2) reason (2-3 sentences explaining why it's worth watching, in Chinese), 3) reasonEn (same in English), 4) audience (target audience in Chinese), 5) audienceEn (target audience in English), 6) tags (3-5 short tags). Return a JSON object with key "items" containing an array with the same count.\\n\\n${JSON.stringify(items.map((i, idx) => ({ index: idx, title: i.title, genre: i.genre, summary: i.summary })))}`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 4000 }),
    });
    if (!res.ok) throw new Error(`DeepSeek: ${res.status}`);
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
    const enriched = parsed?.items || [];

    return items.map((item, idx) => {
      const ai = enriched.find(e => e.index === idx) || {};
      return { ...item, aiScore: ai.aiScore, reason: ai.reason || "", reasonEn: ai.reasonEn || "", audience: ai.audience || "", audienceEn: ai.audienceEn || "", tags: ai.tags || [] };
    });
  } catch (e) {
    console.warn("DeepSeek enrichment skipped:", e.message);
    return items;
  }
}

// ── Intelligence endpoint handlers ──

async function handleIntelligenceOverview(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [nowPlaying, upcoming, trending] = await Promise.all([
    fetchTMDBList(token, "/movie/now_playing", { region: "US" }),
    fetchTMDBList(token, "/movie/upcoming"),
    fetchTMDBList(token, "/trending/movie/week"),
  ]);

  const todayMovies = nowPlaying.filter(m => m.release_date === today).map(m => normalizeMovieItem(m));
  const weekMovies = nowPlaying.filter(m => m.release_date >= weekAgo && m.release_date !== today).slice(0, 20).map(m => normalizeMovieItem(m));

  const tvAiring = await fetchTMDBList(token, "/tv/airing_today");
  const todayTV = tvAiring.filter(s => s.first_air_date === today).map(s => normalizeMovieItem(s, "tv"));
  const weekTV = tvAiring.filter(s => s.first_air_date >= weekAgo && s.first_air_date !== today).slice(0, 10).map(s => normalizeMovieItem(s, "tv"));

  const enrichedToday = await enrichWithDeepSeek(todayMovies, "movie", env);

  return {
    updated: today,
    stats: {
      moviesReleased: todayMovies.length + weekMovies.length,
      tvPremieres: todayTV.length + weekTV.length,
      albumsReleased: 0,
      trending: trending.length,
    },
    editorsPicks: enrichedToday,
    hiddenGems: [],
    comingSoon: upcoming.slice(0, 6).map(m => normalizeMovieItem(m)),
    trending: trending.slice(0, 5).map((m, i) => ({ ...normalizeMovieItem(m), rank: i + 1, trend: "new" })),
    brief: `${today} global entertainment roundup.`,
  };
}

async function handleIntelligenceMovies(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [nowPlaying, upcoming, popular] = await Promise.all([
    fetchTMDBList(token, "/movie/now_playing", { region: "US" }),
    fetchTMDBList(token, "/movie/upcoming"),
    fetchTMDBList(token, "/movie/popular"),
  ]);

  const todayMovies = nowPlaying.filter(m => m.release_date === today).map(m => normalizeMovieItem(m));
  const weekMovies = nowPlaying.filter(m => m.release_date >= weekAgo && m.release_date !== today).slice(0, 20).map(m => normalizeMovieItem(m));

  return {
    updated: today,
    releasedToday: await enrichWithDeepSeek(todayMovies, "movie", env),
    releasedThisWeek: weekMovies,
    upcoming: upcoming.slice(0, 20).map(m => normalizeMovieItem(m)),
    nowPlaying: popular.slice(0, 20).map(m => normalizeMovieItem(m)),
  };
}

async function handleIntelligenceTV(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [airing, onAir, popular] = await Promise.all([
    fetchTMDBList(token, "/tv/airing_today"),
    fetchTMDBList(token, "/tv/on_the_air"),
    fetchTMDBList(token, "/tv/popular"),
  ]);

  return {
    updated: today,
    premieresToday: airing.filter(s => s.first_air_date === today).map(s => normalizeMovieItem(s, "tv")),
    premieresThisWeek: airing.filter(s => s.first_air_date >= weekAgo && s.first_air_date !== today).slice(0, 20).map(s => normalizeMovieItem(s, "tv")),
    upcoming: onAir.slice(0, 20).map(s => normalizeMovieItem(s, "tv")),
    ongoing: popular.slice(0, 20).map(s => normalizeMovieItem(s, "tv")),
  };
}

async function handleIntelligenceTrending(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = new Date().toISOString().split("T")[0];

  const [trendingMovies, trendingTV] = await Promise.all([
    fetchTMDBList(token, "/trending/movie/week"),
    fetchTMDBList(token, "/trending/tv/week"),
  ]);

  return {
    updated: today,
    today: { movies: [], tv: [], music: [] },
    week: {
      movies: trendingMovies.slice(0, 10).map((m, i) => ({ ...normalizeMovieItem(m), rank: i + 1, trend: "new" })),
      tv: trendingTV.slice(0, 10).map((s, i) => ({ ...normalizeMovieItem(s, "tv"), rank: i + 1, trend: "new" })),
      music: [],
    },
    month: { movies: [], tv: [], music: [] },
  };
}

async function handleIntelligenceComing(env) {
  const token = env.TMDB_API_READ_ACCESS_TOKEN;
  const today = new Date().toISOString().split("T")[0];

  const upcoming = await fetchTMDBList(token, "/movie/upcoming");
  const all = upcoming.map(m => ({ ...normalizeMovieItem(m), daysUntil: Math.max(0, Math.ceil((new Date(m.release_date) - new Date()) / 86400000)) }));

  return {
    updated: today,
    next7Days: all.filter(m => m.daysUntil <= 7),
    next30Days: all.filter(m => m.daysUntil <= 30),
    mostAnticipated: all.slice(0, 10),
  };
}

async function handleIntelligenceWeekly(env) {
  const today = new Date().toISOString().split("T")[0];
  const weekNum = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000 / 7);
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  return {
    updated: today,
    currentWeek: `Week ${weekNum}`,
    reports: [{
      week: `Week ${weekNum}`,
      weekLabel: `Week ${weekNum}`,
      date: `${weekStart} - ${today}`,
      title: "Weekly Entertainment Roundup",
      titleEn: "Weekly Entertainment Roundup",
      highlights: [
        { text: "Data compiled from TMDB trending, now playing, and upcoming releases", en: "Data compiled from TMDB trending, now playing, and upcoming releases" },
      ],
      count: 0,
    }],
  };
}
