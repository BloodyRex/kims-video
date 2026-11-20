// Shared utility functions — extracted from workers-1.4.js
// 所有 Worker 共用的纯函数，避免代码复制

// ── 获流/格式化工具 ────────────────────────────────────────────────
function normGenre(g) {
  // GENRE_ZH 已在 constants.js 定义，此处保持兼容接口
  return g;
}

function genresToString(genres) {
  if (!Array.isArray(genres)) return "";
  return genres.slice(0, 3).join(" / ");
}

function genreIncludes(genres, target) {
  if (!Array.isArray(genres)) return false;
  const targetL = (target || "").toLowerCase().trim();
  return genres.some(g => (g || "").toLowerCase().includes(targetL));
}

// ── 日期工具 ──────────────────────────────────────────────────────────
function calcDaysUntil(dateStr, referenceDateStr) {
  if (!dateStr) return 999;
  const d = dateStr.slice(0, 10);
  return Math.round((new Date(`${d}T00:00:00+08:00`).getTime() - new Date(referenceDateStr || "now").getTime()) / 86400000);
}

function dateToString(dateObj) {
  if (!dateObj) return "";
  return dateObj.toISOString().slice(0, 10);
}

// ── HTML 安全工具 ────────────────────────────────────────────────────
function htmlEscape(str) {
  if (str === null || str === undefined) return "";
  const specials = { "&": "&", "<": "<", ">": ">", '"': "" };
  return String(str).replace(/[&"<>]/g, (c) => specials[c]);
}

// ── 深度合并（用于配置合并，沿用 workers-1.4.js 366 行实现）────────
function deepMerge(base, over) {
  if (over == null || typeof over !== "object" || Array.isArray(over)) return over === undefined ? base : over;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
  return out;
}

// ── 工具：从 TMDB release_dates 中提取首个 theatrical 日期 ────────────
function pickTheatricalReleaseDate(releaseDates) {
  if (!releaseDates || !Array.isArray(releaseDates)) return null;
  const theatrical = releaseDates.filter(d => [2, 3].includes(d.type));
  if (!theatrical.length) return null;
  return theatrical.sort((a, b) => a.release_date.localeCompare(b.release_date))[0]?.release_date;
}

// ── 工具：验证 migration blob（沿用 3869 行实现要点）───────────────
function migrateValidateBlob(code) {
  if (typeof code !== "string" || !code.length) return { ok: false, error: "empty" };
  if (code.length > 1500000) return { ok: false, error: "too_large" };
  const isGzip = code.startsWith("KV1G:");
  const isPlain = code.startsWith("KV1:");
  if (!isGzip && !isPlain) return { ok: false, error: "bad_prefix" };
  const body = code.slice(isGzip ? 5 : 4);
  let bin;
  try { bin = atob(body); } catch { return { ok: false, error: "bad_base64" }; }
  if (isGzip) {
    if (bin.length === 0) return { ok: false, error: "empty_payload" };
    return { ok: true, format: "kims-video-personal", version: 1, compressed: true };
  }
  const json = new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  let parsed;
  try { parsed = JSON.parse(json); } catch { return { ok: false, error: "bad_json" }; }
  if (!parsed || parsed.format !== "kims-video-personal") return { ok: false, error: "bad_format" };
  if (!Number.isFinite(parsed.version)) return { ok: false, error: "bad_version" };
  return { ok: true, format: parsed.format, version: parsed.version, compressed: false };
}

// ── Export ────────────────────────────────────────────────────────────
module.exports = {
  normGenre,
  genresToString,
  genreIncludes,
  calcDaysUntil,
  dateToString,
  htmlEscape,
  deepMerge,
  pickTheatricalReleaseDate,
  migrateValidateBlob
};