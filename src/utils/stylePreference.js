/**
 * 风格偏好分析（可解释）
 * ------------------------------------------------------------------
 * 数据来源（全部只读，不改动任何既有存储结构）：
 *   1. 搜索记录  searches[].query     —— 用户主动表达的兴趣
 *   2. 收藏记录  favorites[].*        —— 明确的正反馈
 *   3. 推荐记录  recos[].payload...   —— 点开过的推荐
 * 打分规则：每条证据按来源权重 × 类型命中累计，同名证据去重在记录里保留
 * 每一分都可追溯到「哪条记录、哪个字段、什么文本、命中哪个关键词」，
 * 前端调试面板可直接展开查看（见 PixelAvatar debug / MyDataPanel debug）。
 */

import { GENRE_KEYWORDS } from "./discoverGenre";

export const HALF_LIFE_DAYS = 30;
export const DIVERSITY_BONUS = 0.3;
export const AI_SEARCH_WEIGHT_MULT = 1.25;

export function overallXpLevel(xp) {
  const x = Number(xp) || 0;
  return Math.max(0, Math.min(5, Math.floor(x / 5)));
}

/**
 * 网站等级 1–10：由用户基础数据算出的 XP 决定。等级越高，游戏开局越靠后，
 * 具体换算见 gameStartForSiteLevel（10 个网站等级压缩到游戏 5 个生物阶段）。
 * 阈值递增，越往后越难升。
 */
export const SITE_LEVEL_XP = [0, 12, 30, 60, 105, 170, 260, 380, 540, 760];

export function siteLevel(xp) {
  const x = Math.max(0, Number(xp) || 0);
  let lvl = 1;
  for (let i = 0; i < SITE_LEVEL_XP.length; i += 1) {
    if (x >= SITE_LEVEL_XP[i]) lvl = i + 1;
  }
  return lvl;
}

/** 当前等级、下一级门槛与进度（0–1），供展示/调试用 */
export function siteLevelProgress(xp) {
  const x = Math.max(0, Number(xp) || 0);
  const level = siteLevel(x);
  if (level >= SITE_LEVEL_XP.length) return { level, current: x, need: null, ratio: 1 };
  const base = SITE_LEVEL_XP[level - 1];
  const need = SITE_LEVEL_XP[level];
  return { level, current: x, need, ratio: Math.max(0, Math.min(1, (x - base) / (need - base || 1))) };
}

/**
 * 网站等级 → 游戏开局状态。
 * 游戏内只有 5 个生物阶段，网站等级有 10 档，按 2:1 压缩：
 *   满级 10 → 第 5 阶段、能量满（下一口就能进化）；
 *    9 → 第 5 阶段 90%｜8 → 第 4 阶段 76%｜7 → 第 4 阶段 60%｜6 → 第 3 阶段 44%
 *    5 → 第 3 阶段 30%｜4 → 第 2 阶段 20%｜3 → 第 2 阶段 12%｜2 → 第 1 阶段 6%｜1 → 第 1 阶段空
 * stage 为 0-indexed，与 evolution-game 的 startLevel 同口径；energy 为 0–1 的比例。
 */
export const GAME_START_STAGE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const GAME_START_ENERGY = [0, 0.06, 0.12, 0.2, 0.3, 0.44, 0.6, 0.76, 0.9, 1];

export function gameStartForSiteLevel(siteLevelValue) {
  const lv = Math.max(1, Math.min(10, Math.round(Number(siteLevelValue) || 1)));
  return { stage: GAME_START_STAGE[lv - 1], energy: GAME_START_ENERGY[lv - 1] };
}
export const SOURCE_WEIGHT = {
  favorite: 3,
  search: 2,
  reco: 1,
};

/**
 * 网站等级用的「稳定 XP」：按去重后的记录条数累计，不做时间衰减。
 * 等级只随用户积累的数据上升，不会因为久未访问而掉级。
 *   ｜收藏 3 分 ｜搜索 2 分（AI 搜索同样 2 分）｜推荐结果每条 1 分
 */
export function siteXp(input = {}) {
  const searches = Array.isArray(input.searches) ? input.searches : [];
  const favorites = Array.isArray(input.favorites) ? input.favorites : [];
  const recos = Array.isArray(input.recos) ? input.recos : [];
  const seen = new Set();
  const counts = { favorites: 0, searches: 0, recos: 0 };
  let xp = 0;

  const add = (source, key) => {
    const k = source + "|" + String(key);
    if (seen.has(k)) return;
    seen.add(k);
    counts[source === "favorite" ? "favorites" : source === "search" ? "searches" : "recos"] += 1;
    xp += SOURCE_WEIGHT[source] || 1;
  };

  favorites.forEach((f, i) => {
    if (!f || typeof f !== "object") return;
    add("favorite", f.id || f.title || f.itemKey || `fav-${i}`);
  });

  searches.forEach((s, i) => {
    if (!s) return;
    const q = typeof s === "string" ? s : s.query || s.q || s.text || "";
    if (!q) return;
    add("search", norm(q));
  });

  recos.forEach((r, i) => {
    if (!r) return;
    const payload = r.payload || r;
    const list = payload && (payload.recommendations || payload.items || payload.results);
    if (Array.isArray(list) && list.length) {
      list.forEach((item, j) => {
        if (!item) return;
        add("reco", (r.id || `reco-${i}`) + "#" + (item.title || item.name || item.id || j));
      });
    } else {
      const text = [payload.query, payload.title, payload.keyword, payload.text]
        .filter(Boolean)
        .join(" ");
      if (text) add("reco", (r.id || `reco-${i}`) + "|" + norm(text));
    }
  });

  return { xp, ...counts };
}

/** 用户基础数据 → 网站等级（1–10），与游戏内生物等级同一刻度 */
export function siteLevelFromUser(input = {}) {
  const s = siteXp(input);
  return { ...s, ...siteLevelProgress(s.xp) };
}

export const SOURCE_LABEL = {
  favorite: "收藏",
  search: "搜索",
  reco: "推荐",
};

const STYLE_KEYS = [
  "sci-fi",
  "mystery",
  "horror",
  "animation",
  "war",
  "crime",
  "drama",
  "fantasy",
];

const EMPTY_RESULT = {
  style: "sci-fi",
  scores: {},
  evidence: [],
  deduped: 0,
  totalSamples: 0,
  fallback: true,
  reason: "no-data",
  xp: 0,
  diversity: 0,
};

function norm(v) {
  return String(v == null ? "" : v)
    .toLowerCase()
    .trim();
}

/** 从一条文本里找出命中的全部风格（可叠加） */
function matchStyles(text, extraStyle) {
  const t = norm(text);
  const hits = new Set();
  if (!t && !extraStyle) return hits;

  // 显式风格标记（如 item.genre = "sci-fi" / matchedTags 里带了 style key）
  if (extraStyle) {
    const s = norm(extraStyle);
    if (STYLE_KEYS.includes(s)) hits.add(s);
  }
  if (t && STYLE_KEYS.includes(t)) hits.add(t);

  for (const style of STYLE_KEYS) {
    const words = GENRE_KEYWORDS[style] || [];
    if (words.some((w) => w && t.includes(norm(w)))) hits.add(style);
  }
  return hits;
}

/**
 * 分析用户风格偏好
 * @param {{searches?:Array, favorites?:Array, recos?:Array}} input
 * @returns {{style:string, scores:Object, evidence:Array, deduped:number,
 *            totalSamples:number, fallback:boolean, reason:string}}
 */
export function analyzeStylePreference(input = {}) {
  const searches = Array.isArray(input.searches) ? input.searches : [];
  const favorites = Array.isArray(input.favorites) ? input.favorites : [];
  const recos = Array.isArray(input.recos) ? input.recos : [];

  const scores = {};
  for (const k of STYLE_KEYS) scores[k] = 0;

  const evidence = [];
  const seen = new Set();
  let deduped = 0;
  let totalSamples = 0;

  const styleCounts = {};
  let baseXp = 0;

  const push = (source, rawKey, text, extraStyle, detail, at, weightOverride) => {
    const key = source + "|" + rawKey + "|" + norm(text);
    if (seen.has(key)) {
      deduped += 1;
      return;
    }
    seen.add(key);
    totalSamples += 1;

    const hits = matchStyles(text, extraStyle);
    if (!hits.size) return;

    const baseWeight = weightOverride != null ? weightOverride : (SOURCE_WEIGHT[source] || 1);
    // 时间衰减
    const now = Date.now();
    const ts = Number(at) || 0;
    const days = ts > 0 ? Math.max(0, (now - ts) / 86400000) : 0;
    const decay = ts > 0 ? Math.pow(0.5, days / HALF_LIFE_DAYS) : 1;
    const weight = baseWeight * decay;

    const styles = [...hits];
    let points = 0;
    for (const s of styles) {
      const n = styleCounts[s] || 0;
      const inc = weight / Math.sqrt(n + 1);
      scores[s] += inc;
      baseXp += inc;
      styleCounts[s] = n + 1;
      points += inc;
    }

    evidence.push({
      source,
      sourceLabel: SOURCE_LABEL[source] || source,
      text: String(text == null ? "" : text).slice(0, 80),
      styles,
      weight: baseWeight,
      decay: Math.round(decay * 1000) / 1000,
      points: Math.round(points * 100) / 100,
      detail: detail || "",
    });
  };

  // 1) 收藏
  favorites.forEach((f, i) => {
    if (!f || typeof f !== "object") return;
    const id = f.id || f.title || f.itemKey || `fav-${i}`;
    const text = [f.title, f.name, f.enTitle, f.original_title, f.overview]
      .filter(Boolean)
      .join(" ");
    const explicit = f.genre || f.category || (Array.isArray(f.genres) ? f.genres[0] : "");
    push("favorite", id, text, explicit, "收藏影片", f.addedAt || f.createdAt || f.updatedAt);
  });

  // 2) 搜索
  searches.forEach((s, i) => {
    if (!s) return;
    const q = typeof s === "string" ? s : s.query || s.q || s.text || "";
    if (!q) return;
    const id = (typeof s === "object" && (s.id || s.ts)) || `s-${i}`;
    const ts = typeof s === "object" ? (s.at || s.ts || s.createdAt) : 0;
    const isAi = typeof s === "object" && s.scope === "ai_search";
    const weight = isAi ? SOURCE_WEIGHT.search * AI_SEARCH_WEIGHT_MULT : undefined;
    push("search", id, q, null, "搜索关键词", ts, weight);
  });

  // 3) 推荐（点开过的结果）
  recos.forEach((r, i) => {
    if (!r) return;
    const payload = r.payload || r;
    const list =
      (payload && (payload.recommendations || payload.items || payload.results)) || [];
    if (Array.isArray(list) && list.length) {
      list.forEach((item, j) => {
        if (!item) return;
        const text = [item.title, item.name, item.reason, item.why]
          .filter(Boolean)
          .join(" ");
        const tags = []
          .concat(item.matchedTags || [], item.genres || [], item.genre || [])
          .filter(Boolean)
          .join(" ");
        const id = (r.id || `reco-${i}`) + "#" + (item.title || j);
        push("reco", id, (text + " " + tags).trim(), null, "推荐结果", r.updatedAt || r.createdAt);
      });
    } else {
      const text = [r.query, r.title, r.keyword, r.text].filter(Boolean).join(" ");
      if (text) push("reco", r.id || `reco-${i}`, text, null, "推荐关键词", r.updatedAt || r.createdAt);
    }
  });

  const touched = STYLE_KEYS.filter((k) => scores[k] > 0).length;
  const diversity = touched / STYLE_KEYS.length;
  const xp = baseXp * (1 + DIVERSITY_BONUS * diversity);

  if (!totalSamples) return { ...EMPTY_RESULT, scores, evidence, deduped, xp, diversity };

  // 找出最高分；打平则回退默认场景，避免随机跳变
  const ranked = STYLE_KEYS.map((k) => [k, scores[k]]).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  if (!top[1]) {
    return { ...EMPTY_RESULT, scores, evidence, deduped, totalSamples, reason: "no-signal", xp, diversity };
  }
  if (second && second[1] === top[1]) {
    return {
      ...EMPTY_RESULT,
      scores,
      evidence,
      deduped,
      totalSamples,
      reason: `tie:${top[0]}=${second[0]}`,
      xp,
      diversity,
    };
  }

  return {
    style: top[0],
    scores,
    evidence,
    deduped,
    totalSamples,
    fallback: false,
    reason: `top:${top[0]}=${top[1]}`,
    xp,
    diversity,
  };
}

/** 供列表展示：按分数从高到低 */
export function rankStyles(scores = {}) {
  return STYLE_KEYS.map((k) => ({ style: k, score: scores[k] || 0 })).sort(
    (a, b) => b.score - a.score
  );
}

/* ------------------------------------------------------------------ */
/* 倾向级别（8 类目）— 运行时派生，不持久化                           */
/* 阈值为拟议默认值，待 Rex 确认后可仅改此常量。                     */
/* ------------------------------------------------------------------ */
export const CATEGORY_LEVEL_THRESHOLDS = [
  { level: 0, minScore: 0, label: "Lv0 未入门" },
  { level: 1, minScore: 1, label: "Lv1 初探" },
  { level: 2, minScore: 3, label: "Lv2 爱好" },
  { level: 3, minScore: 6, label: "Lv3 熟客" },
  { level: 4, minScore: 10, label: "Lv4 达人" },
  { level: 5, minScore: 15, label: "Lv5 大师" },
];

export function levelForScore(score) {
  const s = Number(score) || 0;
  let result = CATEGORY_LEVEL_THRESHOLDS[0];
  for (const t of CATEGORY_LEVEL_THRESHOLDS) {
    if (s >= t.minScore) result = t;
    else break;
  }
  return result;
}

/** 8 类目倾向级别：{ [style]: { score, level, label } } */
export function computeTendencyLevels(scores = {}) {
  const out = {};
  for (const k of STYLE_KEYS) {
    const sc = Number((scores && scores[k]) || 0);
    const t = levelForScore(sc);
    out[k] = { score: sc, level: t.level, label: t.label };
  }
  return out;
}

/** 用户总级别（外形：人物大小）：总分每 5 分一级，0-5 */
export function overallLevel(scores = {}) {
  const total = STYLE_KEYS.reduce(
    (acc, k) => acc + (Number((scores && scores[k]) || 0) || 0),
    0
  );
  return Math.max(0, Math.min(5, Math.floor(total / 5)));
}

export { STYLE_KEYS };
