// Shared constants used across all Worker splits
// Extracted from workers-1.4.js — keep in sync when source evolves

// ── Genre classification ────────────────────────────────────────────
const GENRE_MAP = {
  878: "科幻",
  9648: "悬疑",
  53: "悬疑",
  27: "恐怖",
  16: "动画",
  10752: "战争",
  80: "犯罪",
  18: "剧情",
  10749: "剧情",
  36: "剧情",
  10402: "剧情",
  14: "奇幻",
  12: "奇幻"
};

function classifyGenre(tmdbGenres) {
  if (!Array.isArray(tmdbGenres)) return "剧情";
  for (const g of tmdbGenres) {
    const cat = GENRE_MAP[g.id];
    if (cat) return cat;
  }
  return "剧情";
}

// ── Intel genre map (TMDB ID → English) ───────────────────────────────
const INTEL_GENRE_IDS = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western"
};

function intelMapGenres(ids) {
  return (ids || []).map(id => INTEL_GENRE_IDS[id]).filter(Boolean);
}

// ── Pick categories ───────────────────────────────────────────────────
const PICK_CATS = {
  editors: { zh: "★ 编辑精选", en: "★ EDITOR", bg: "#ff00ff", text: "#000" },
  gem: { zh: "💎 隐藏宝藏", en: "💎 GEM", bg: "#00ffff", text: "#000" },
  trending: { zh: "🔥 热榜趋势", en: "🔥 TRENDING", bg: "#ffff00", text: "#000" }
};

// ── Common genre lists ────────────────────────────────────────────────
const COMMON_GENRES_ZH = [
  "Action", "Sci-Fi", "Comedy", "Romance",
  "Horror", "Drama", "Animation", "Thriller", "Documentary"
];
const COMMON_GENRES_EN = [
  "Action", "Sci-Fi", "Comedy", "Romance",
  "Horror", "Drama", "Animation", "Thriller", "Documentary"
];

// ── Pipeline config constants ─────────────────────────────────────────
const PAGE_SIZE = 24;
const CAL_LIMIT = 12; // release calendar daily limit
const CAL_MAX_DAYS = 30; // calendar day range
const MAP_LIMIT_DEFAULT = 10; // concurrent KV/R2 reads

// ── KV key prefixes (由各 Worker 按需拼接，如 `discover:result:${id}`) ─────
// 统一前缀，避免跨 Worker key 冲突
const KV_PREFIX = {
  discover: "discover:",
  intel: "intel:",
  digest: "digest:",
  user: "sub:",
  wall: "wallRec:",
  gemCool: "intel:gemCool:"
};

// ── Wallpaper spec constants ──────────────────────────────────────────
// 从 wall-worker-helpers.mjs 提取的纯函数相关常量（不含 API Key）
const WALL_SEEDREAM_SPEC = {
  // 仅保留结构描述，实际值由 build 时的 JSON import 注入
};
const WALL_PREVIEW_SIZES = ["w185", "w300", "w500", "original"];

// ── TMDB cache TTL (秒) ───────────────────────────────────────────────
const CACHE_TTL = {
  tmdb: 3600,        // 1 小时（详情/列表）
  deepseek: 86400,   // 24 小时（AI 串）
  r2: 86400,         // 24 小时（图片/壁纸）
  kv: 86400          // 24 小时（KV 条目）
};

// ── Export ────────────────────────────────────────────────────────────
module.exports = {
  GENRE_MAP,
  classifyGenre,
  INTEL_GENRE_IDS,
  intelMapGenres,
  PICK_CATS,
  COMMON_GENRES_ZH,
  COMMON_GENRES_EN,
  PAGE_SIZE,
  CAL_LIMIT,
  CAL_MAX_DAYS,
  KV_PREFIX,
  WALL_SEEDREAM_SPEC,
  WALL_PREVIEW_SIZES,
  CACHE_TTL,
  MAP_LIMIT_DEFAULT
};