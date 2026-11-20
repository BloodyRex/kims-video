// Shared TMDB helper — extracted from workers-1.4.js
// 所有 Worker 共用的 TMDB 请求封装与缓存工厂

// ── 基础 fetch（带 Bearer token）─────────────────────────────────────
async function fetchTMDB(token, url, init = {}) {
  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  const merged = { ...init, headers };
  const res = await fetch(url, merged);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`TMDB ${res.status}: ${txt}`);
  }
  return res.json();
}

// ── 带缓存的 fetch（使用 Cloudflare Cache API）───────────────────────
// 注：实际使用时需要 env 传入，这里仅提供函数签名
async function withCache(key, fetcher, ttl = 3600) {
  // 此处在 Worker 中实际使用 caches.default matching
  // 此处保留占位，具体实现在各 Worker 中
  const d = await fetcher();
  if (!d || (Array.isArray(d) && d.length === 0)) return null;
  return d;
}

// ── 日期工具 ──────────────────────────────────────────────────────────
function intelToday(timezone = "Asia/Shanghai") {
  return new Date().toLocaleDateString("en-CA", { timeZone });
}

function intelDaysAgo(n, timezone = "Asia/Shanghai") {
  return new Date(Date.now() - n * 86400000).toLocaleDateString("en-CA", { timeZone });
}

function intelDaysUntil(releaseDateStr, todayStr, timezone = "Asia/Shanghai") {
  if (!releaseDateStr) return typeof releaseDateStr === "number" ? releaseDateStr : 999;
  const today = todayStr || intelToday();
  return Math.ceil((Date.parse(`${releaseDateStr}T00:00:00+08:00`) - Date.parse(`${today}T00:00:00+08:00`)) / 86400000);
}

// ── 常用过滤器 ────────────────────────────────────────────────────────
const hasChinese = (text) => /[一-鿿]/.test(text || "");

const titleCn = (s) => hasChinese(s.title || s.name);

const cnFilter = (s) => hasChinese(s.title || s.name) && hasChinese(s.overview || "");

// ── 评分可信度（贝叶斯加权）─────────────────────────────────────────
function intelCredibleRating(item, cred) {
  const v = item && item.vote_count ? item.vote_count : 0;
  const R = item && item.vote_average ? item.vote_average : 0;
  if (R <= 0) return 0;
  const m = (cred && cred.minVotes) || 20;
  const C = (cred && cred.meanRating) != null ? cred.meanRating : 6.0;
  if (v <= 0) return C;
  const w = v / (v + m);
  return w * R + (1 - w) * C;
}

// ── Export ────────────────────────────────────────────────────────────
module.exports = {
  fetchTMDB,
  withCache,
  intelToday,
  intelDaysAgo,
  intelDaysUntil,
  hasChinese,
  titleCn,
  cnFilter,
  intelCredibleRating
};