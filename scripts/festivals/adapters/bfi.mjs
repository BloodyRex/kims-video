#!/usr/bin/env node
/**
 * BFI London Film Festival（whatson.bfi.org.uk/lff）适配器
 *
 * ── 取数层：离线快照优先 ──────────────────────────────────────────────
 * 官方 whatson 站点对任何非浏览器 HTTP 客户端返回 403（Cloudflare 挑战），
 * 因此排片页由真实浏览器采集为离线快照，落在 data/festivals/raw/bfi/<permalink>.html：
 *   日程页  20261007.html … 20261018.html（每天一页，LFF 2026 共 12 天）
 *   变更页  programme-changes-lff.html
 * 规则：
 *   快照存在 → 读本地 HTML 解析，完全不联网；
 *   快照缺失 → 回退 fetchText（线上/CI 上 403 属预期）并 push warning；
 *   任何失败都**不 throw**（不能让 run.mjs 崩），且失败页会被标为 ok:false —
 *   normalize.validate() 会因「有 SCHEDULE 页失败」而拒绝覆盖旧数据，
 *   于是已发布的 BFI 数据不会被残缺/空结果清空。
 *
 * ── 解析层：括号深度扫描 ────────────────────────────────────────────
 * 页面内联 JS 数组 searchResults : [ [ …98 列… ], … ]，其中字符串含非法转义，
 * JSON.parse / 正则切分都会失败 —— 必须用括号深度扫描器（scanArray），
 * 且单元格切分也必须 depth-aware（否则 ["1","2"] 这类未转义嵌套数组会把行切坏）。
 *
 * 合规：robots.txt 禁止 /WebAPI/、/Common/、/app/ 与部分 /Online/*.asp 端点；
 *       本适配器只访问 default.asp?BOparam::WScontent::loadArticle::permalink=…
 *       与 default.asp?doWork::WScontent::loadArticle=Load… 这两类未被禁止的页面。
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, clean, daysBetween, nowIso } from "../lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");

export const HOST = "https://whatson.bfi.org.uk";
export const ONLINE = `${HOST}/lff/Online/default.asp`;
/** 官方站点入口（可引证） */
export const OFFICIAL_SITE = `${HOST}/lff/`;
/** 离线快照目录：data/festivals/raw/bfi/ */
export const SNAPSHOT_DIR = join(ROOT, "data", "festivals", "raw", "bfi");
export const CHANGES_PERMALINK = "programme-changes-lff";
/** 日程页 permalink 模板（官方 URL 形态，可引证） */
export const DAY_URL = (yyyymmdd) =>
  `${ONLINE}?BOparam::WScontent::loadArticle::permalink=${yyyymmdd}`;

/** 每行 98 列（0-based），列名以页面内联 searchNames 为权威 */
export const COLUMN_COUNT = 98;
export const COL = Object.freeze({
  itemId: 0, // UUID，每场唯一
  code: 4, // andr_08Oct26
  description: 5, // 描述/全称
  title: 6, // 标题
  startText: 7, // "Thursday 08 October 2026 17:45"
  localTime: 8, // "17:45"
  day: 9,
  month: 10, // 0-based
  year: 11,
  salesStatus: 14, // C / S
  availabilityStatus: 15, // E / G / L / S / U
  availableNum: 16,
  keywords: 17, // 逗号分隔标签（国家/导演/题材/无障碍）
  detailQuery: 18, // default.asp?doWork::…Load… → 每场官方详情深链
  strand: 28, // 单元代码 LFFGALA / LFFTHRILL / …
  venueId: 62,
  venueRaw: 63, // "LFF 2026 BFI Southbank - NFT1"
  venueName: 64, // "BFI Southbank, Screen NFT1"（规范展示名）
  venueGroup: 66,
  seriesName: 80,
  minPrice: 81, // "£10.00"
  access: 93,
});

/**
 * 单元代码 → 官方标签。
 * 只收录「在该单元行内以官方 token 形式出现、且不被其它单元共用」的标签
 * （证据：快照 searchResults[17] keywords 的同现统计）。
 * 无法引证单一标签的单元（LFFAWARDS(70 行无共有 token) / LFFSCREENTALKS /
 * LFFEVENTS / LFF / n/a …）一律保留官方原始代码，绝不臆造名称。
 */
export const STRAND_LABELS = Object.freeze({
  LFFGALA: "Galas", // token "Galas"
  LFFGALAREPEAT: "Galas", // 同族重映，官方 token 同为 "Galas"
  LFFDARE: "Dare",
  LFFJOURNEY: "Journey",
  LFFLOVE: "Love",
  LFFTHRILL: "Thrill",
  LFFCULT: "Cult",
  LFFLAUGH: "Laugh",
  LFFCREATE: "Create",
  LFFDEBATE: "Debate",
  LFFEXPERIMENTA: "Experimenta",
  LFFFAMILY: "Family",
  LFFSPECIALPRESENTATIONS: "Special Presentations", // token "Special Presentations"，8/8 行，不在其它单元出现
  LFFSHORTS: "Shorts", // token "Shorts"，12 行中 10 行带该 token
  LFFFREE: "LFF for Free",
});

/* ────────────────────────── 括号深度扫描解析 ────────────────────────── */

/** 从 open 处的 '[' 起做深度扫描，返回完整数组字面量（含括号）与是否闭合 */
export function scanArray(text, open) {
  let depth = 0;
  let quote = null;
  let esc = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return { arr: text.slice(open, i + 1), closed: true };
    }
  }
  return { arr: text.slice(open), closed: false };
}

/** 找到 key 之后出现的第一个数组字面量 */
export function extractInlineArray(text, key) {
  const s = String(text ?? "");
  const at = s.indexOf(key);
  if (at < 0) return null;
  const open = s.indexOf("[", at);
  if (open < 0) return null;
  return scanArray(s, open);
}

/** depth-aware 顶层切分：只在深度 0、且不在字符串内时按 sep 切 */
export function splitTopLevel(inner, sep = ",") {
  const out = [];
  let depth = 0;
  let quote = null;
  let esc = false;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quote) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (depth === 0 && ch === sep) {
      out.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  out.push(inner.slice(start));
  return out;
}

/** 去掉单元格两端引号并还原转义（非法转义原样保留） */
export function unquoteCell(raw) {
  let s = String(raw ?? "").trim();
  if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) {
    const q = s[0];
    s = s.slice(1, -1);
    s = s.replace(/\\(["'\\/])/g, "$1");
    if (q === '"') s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }
  return s.trim();
}

/** 页面内联 searchNames（权威列名） */
export function extractColumnNames(html) {
  const res = extractInlineArray(String(html ?? ""), "searchNames");
  if (!res) return null;
  return splitTopLevel(res.arr.slice(1, -1)).map((c) => unquoteCell(c));
}

/** 页面内联 searchLabels（官方状态标签来源） */
export function extractLabels(html) {
  const s = String(html ?? "");
  const pick = (k) => {
    const m = s.match(new RegExp(`${k}\\s*[:=]\\s*["']([^"']*)["']`));
    return m ? m[1] : null;
  };
  return {
    excellent: pick("avail_excellent"),
    good: pick("avail_good"),
    limited: pick("avail_limited"),
    soldOut: pick("avail_sold_out"),
    soldOutMessage: pick("sold_out_message"),
    onSaleMessage: pick("on_sale_message"),
  };
}

/**
 * 单个日程页 HTML → 行（每行 98 单元格）
 * @returns {{permalink:string, sourceUrl:string, rows:string[][], count:number, columnNames:string[]|null, labels:object|null}}
 */
export function parseDayHtml(html, { permalink, sourceUrl, warn = () => {} } = {}) {
  const out = {
    permalink,
    sourceUrl,
    rows: [],
    count: 0,
    columnNames: extractColumnNames(html),
    labels: extractLabels(html),
  };
  const res = extractInlineArray(String(html ?? ""), "searchResults");
  if (!res) {
    warn(`${permalink}: 未找到内联 searchResults（页面结构变化？）`);
    return out;
  }
  if (!res.closed) warn(`${permalink}: searchResults 数组未正常闭合（页面被截断？）`);
  const parts = splitTopLevel(res.arr.slice(1, -1));
  const rows = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t.startsWith("[")) continue;
    const inner = t.endsWith("]") ? t.slice(1, -1) : t.slice(1);
    rows.push(splitTopLevel(inner).map(unquoteCell));
  }
  out.rows = rows;
  out.count = rows.length;
  const bad = rows.filter((r) => r.length !== COLUMN_COUNT);
  if (bad.length) {
    warn(
      `${permalink}: ${bad.length} 行列数异常（期望 ${COLUMN_COUNT}，实际 ${[
        ...new Set(bad.map((r) => r.length)),
      ].join("/")}）——已跳过`
    );
  }
  return out;
}

/* ────────────────────────── 字段抽取 ────────────────────────── */

/** 20261007 → 2026-10-07 */
export function dateFromPermalink(permalink) {
  const p = String(permalink ?? "");
  return /^\d{8}$/.test(p) ? `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}` : null;
}

/** 届次日期区间 → 12 个日程页 permalink（YYYYMMDD） */
export function dayPermalinks(edition) {
  const n = daysBetween(edition.startDate, edition.endDate) + 1;
  const out = [];
  for (let i = 0; i < n; i++) out.push(addDays(edition.startDate, i).replace(/-/g, ""));
  return out;
}

/** 行内 [year][month(0-based)][day] → ISO 日期（不合法返回 null） */
export function dateOf(y, m, d, permalink) {
  if (!/^\d{4}$/.test(String(y)) || !/^\d{1,2}$/.test(String(m)) || !/^\d{1,2}$/.test(String(d))) return null;
  const Y = Number(y);
  const M = Number(m);
  const D = Number(d);
  const mm = M + 1;
  if (mm < 1 || mm > 12 || D < 1 || D > 31) return null;
  const chk = new Date(Date.UTC(Y, M, D));
  if (chk.getUTCFullYear() !== Y || chk.getUTCMonth() !== M || chk.getUTCDate() !== D) return null;
  const iso = `${Y}-${String(mm).padStart(2, "0")}-${String(D).padStart(2, "0")}`;
  return { iso, permalinkDate: dateFromPermalink(permalink) };
}

/** [8] localTime，缺失时退回 [7] 末尾的 HH:MM */
export function timeOf(localTime, startText) {
  const s = String(localTime ?? "").trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, "0");
  const m = /(\d{1,2}:\d{2})\s*$/.exec(String(startText ?? ""));
  return m ? m[1].padStart(5, "0") : null;
}

/** [28] 单元代码；空或 n/a → null（不建伪单元） */
export function strandOf(v) {
  const s = String(v ?? "").trim();
  return !s || /^n\/?a$/i.test(s) ? null : s;
}

/** 标签列 [17] → token 数组 */
export function keywordTokens(v) {
  return String(v ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/** [18] 详情页 query → 绝对 URL */
export function eventUrlOf(detailQuery) {
  const s = String(detailQuery ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `${HOST}/lff/Online/${s.replace(/^\/+/, "")}`;
}

/**
 * 状态映射（证据：快照内联 searchLabels + 480 行实测无一对矛盾）
 *   avail_excellent="Excellent" avail_good="Good" avail_limited="Limited"
 *   avail_sold_out="Sold Out"  sold_out_message="Sold out!"  on_sale_message="On sale"
 * sales_status 的 C/S 语义在页面里没有可引证的标签，这里只按实测共现事实映射：
 *   C → NOT_ON_SALE（渲染 next-on-sale，无购票入口）；S + availability → S/G/L 三档。
 * 没有任何证据的组合（如 availability="U"）一律返回 null，绝不臆造。
 */
export function ticketStatusOf({ salesStatus, availabilityStatus }) {
  const s = String(salesStatus ?? "").toUpperCase();
  const a = String(availabilityStatus ?? "").toUpperCase();
  if (s === "C") return "NOT_ON_SALE";
  if (s === "S" && a === "S") return "SOLD_OUT";
  if (s === "S" && a === "L") return "LIMITED";
  if (s === "S" && a === "G") return "GOOD";
  if (a === "E") return "EXCELLENT"; // 理论枚举；本批 480 行未观测到，故实际不会输出
  return null;
}

/* ────────────────────────── 取数 ────────────────────────── */

/* ─────────── 官方「节目变更」页：散文列表解析（非表格） ─────────── */

const ENTITIES = [
  [/&nbsp;/gi, " "],
  [/&amp;/gi, "&"],
  [/&quot;/gi, '"'],
  [/&#39;|&rsquo;/gi, "'"],
  [/&ldquo;|&rdquo;/gi, '"'],
  [/&lsquo;/gi, "'"],
  [/&ndash;/gi, "–"],
  [/&mdash;/gi, "—"],
  [/&hellip;/gi, "…"],
];

/** 去标签 + 实体归一 + 空白折叠（仅用于变更页的散文解析） */
function plain(s) {
  let t = String(s == null ? "" : s).replace(/<[^>]*>/g, " ");
  for (const [re, v] of ENTITIES) t = t.replace(re, v);
  return t.replace(/\s+/g, " ").trim();
}

/**
 * 解析官方 programme-changes 页（实测结构：散文列表，不是日程表格）。
 *   <h1>Programme additions and changes</h1> … 「Last update: 6 October」
 *   <h3>LATE ADDITIONS</h3><p>ARTIFICIAL<br>SUN 11 OCT 21:00 …<br>…</p>…
 * 即 <h3> 分节、每个 <p> 为一条变更、<br> 分隔条目内的行（首行=片名/标题）。
 * 正文截止到「最早的」正文容器闭合标记（role="complementary" / tertiary-linked-features-div /
 * role="contentinfo" / id="footer"）—— 实测正文在第一条 role="complementary"（右侧栏）前闭合，
 * 其后是页脚与 cookie 同意脚本/促销文案，必须剔除。
 * 纯函数、不联网、不 throw；解析不到分节时返回空结果，不编造。
 */
export function parseProgrammeChanges(html) {
  const empty = { lastUpdate: null, sections: [], sectionCount: 0, entryCount: 0 };
  if (!html) return empty;

  const h1 = /<h1[^>]*>\s*Programme additions and changes/i.exec(html);
  let region = h1 ? html.slice(h1.index) : html;
  // 正文结束标记：实测正文容器在第一条 role="complementary"（右侧栏/日历/推广）之前闭合，
  // 其后才是页脚与 cookie 同意脚本。取「最早出现的」边界，避免尾部推广文案混入条目。
  let cut = -1;
  for (const re of [/role="complementary"/i, /class="tertiary-linked-features-div"/i, /role="contentinfo"/i, /id="footer"/i]) {
    const i = region.search(re);
    if (i >= 0 && (cut < 0 || i < cut)) cut = i;
  }
  if (cut >= 0) region = region.slice(0, cut);

  let lastUpdate = null;
  for (const m of region.matchAll(/<p[^>]*>([\s\S]{0,300}?)<\/p>/gi)) {
    const t = plain(m[1]);
    if (/last update/i.test(t)) { lastUpdate = t; break; }
  }

  const heads = [...region.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].filter((h) => plain(h[1]));
  const sections = [];
  let entryCount = 0;
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    const end = i + 1 < heads.length ? heads[i + 1].index : region.length;
    const chunk = region.slice(h.index + h[0].length, end);
    const entries = [];
    for (const m of chunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const lines = m[1].split(/<br[^>]*>/i).map(plain).filter(Boolean);
      if (!lines.length) continue;
      entries.push({ title: lines[0], lines });
    }
    entryCount += entries.length;
    sections.push({ title: plain(h[1]), entries });
  }
  return { lastUpdate, sections, sectionCount: sections.length, entryCount };
}

function readSnapshot(dir, permalink) {
  const p = join(dir, `${permalink}.html`);
  if (!existsSync(p)) return null;
  try {
    return { path: p, body: readFileSync(p, "utf8") };
  } catch {
    return null;
  }
}

/**
 * 抓取一个届次 → 原始（未标准化）数据
 * 契约与 bff/idfa 一致：{ items, films, sections, sources, days, warnings, fetchedAt }
 * 额外支持 snapshotDir 覆盖（测试用），绝不 throw。
 */
export async function fetchEdition({ festival, edition, fetchText, log = () => {}, snapshotDir } = {}) {
  const warnings = [];
  const sources = [];
  const fetchedAt = nowIso();
  const dir = snapshotDir || edition?.snapshotDir || SNAPSHOT_DIR;
  const warn = (m) => {
    if (warnings.length < 40) warnings.push(m);
  };

  const dayList = dayPermalinks(edition);
  const days = [];
  const collected = []; // { cells, permalink, sourceUrl }
  let snapshotDays = 0;
  let liveDays = 0;
  let unclosed = 0;

  for (const permalink of dayList) {
    const url = DAY_URL(permalink);
    const snap = readSnapshot(dir, permalink);
    let body = null;
    let httpStatus = null;
    let ok = false;
    let via = "none";

    if (snap) {
      body = snap.body;
      ok = true;
      via = "snapshot";
      snapshotDays++;
      log(`[bfi] schedule ${permalink} ← 离线快照（不联网）`);
    } else {
      log(`[bfi] schedule ${permalink} ← 无离线快照，回退 fetchText`);
      try {
        const res = (await fetchText(url, { label: `schedule ${permalink}` })) || {};
        httpStatus = res.status ?? null;
        ok = res.ok === true;
        if (ok) {
          body = res.body;
          via = "live";
          liveDays++;
        } else {
          warn(
            `schedule ${permalink}: 无离线快照且实时抓取失败（${res.error || res.status || "unknown"}）` +
              `—— whatson.bfi.org.uk 对非浏览器客户端 403 属预期；本页标记失败，不产出该页数据`
          );
        }
      } catch (e) {
        warn(`schedule ${permalink}: 无离线快照且 fetchText 抛错（${String(e?.message || e)}）；本页标记失败`);
      }
    }

    sources.push({
      kind: "SCHEDULE",
      label:
        via === "snapshot"
          ? `Official schedule (offline snapshot) — ${permalink}`
          : `Official schedule — ${permalink}`,
      url,
      httpStatus,
      ok,
      fetchedAt,
    });

    const day = { date: dateFromPermalink(permalink), permalink, sourceUrl: url, via, ok, items: 0, venues: 0 };
    if (ok) {
      const parsed = parseDayHtml(body, { permalink, sourceUrl: url, warn });
      if (!parsed.columnNames || parsed.columnNames.length !== COLUMN_COUNT) {
        warn(
          `${permalink}: searchNames 列数 ${parsed.columnNames ? parsed.columnNames.length : "缺失"}` +
            `，期望 ${COLUMN_COUNT}`
        );
      }
      const rows = parsed.rows.filter((r) => r.length === COLUMN_COUNT);
      for (const r of rows) collected.push({ cells: r, permalink, sourceUrl: url });
      day.items = rows.length;
      day.venues = new Set(rows.map((r) => clean(r[COL.venueName]) || clean(r[COL.venueRaw]))).size;
      if (!parsed.count) warn(`${permalink}: 快照内 searchResults 解析出 0 行`);
      if (!parsed.columnNames) unclosed++;
    }
    days.push(day);
  }

  // ── 官方「节目变更」页（散文列表，不是日程表格） ──
  const chUrl = DAY_URL(CHANGES_PERMALINK);
  const chSnap = readSnapshot(dir, CHANGES_PERMALINK);
  let chOk = false;
  let chHttpStatus = null;
  let chBody = null;
  if (chSnap) {
    chOk = true;
    chBody = chSnap.body;
  } else {
    log("[bfi] programme-changes ← 无离线快照，回退 fetchText");
    try {
      const res = (await fetchText(chUrl, { label: "programme-changes" })) || {};
      chHttpStatus = res.status ?? null;
      chOk = res.ok === true;
      if (chOk) chBody = res.body;
      else
        warn(
          `programme-changes: 无离线快照且实时抓取失败（${res.error || res.status || "unknown"}）` +
            "—— 该来源标记失败，不产出变更数据"
        );
    } catch (e) {
      warn(`programme-changes: 无离线快照且 fetchText 抛错（${String(e?.message || e)}）；该来源标记失败`);
    }
  }

  // 该页曾按日程表解析（找 searchResults 数组）→ 散文页必然得 0 行。
  // 先按散文列表解析；万一页面变回表格则退回表格口径，两种都如实登记，绝不编造。
  let programmeChanges = null;
  let chRows = null;
  if (chOk && chBody) {
    const prose = parseProgrammeChanges(chBody);
    const tableRows = prose.sectionCount
      ? 0
      : parseDayHtml(chBody, { permalink: CHANGES_PERMALINK, sourceUrl: chUrl }).count;
    const format = prose.sectionCount ? "prose" : tableRows ? "table" : "unknown";
    chRows = format === "prose" ? prose.entryCount : tableRows;
    programmeChanges = {
      url: chUrl,
      via: chSnap ? "snapshot" : "live",
      format,
      lastUpdate: prose.lastUpdate,
      sectionCount: prose.sectionCount,
      entryCount: chRows,
      sections: prose.sections,
    };
    log(
      `[bfi] programme-changes ← ${format}（${prose.sectionCount} 节 / ${chRows} 条` +
        `${prose.lastUpdate ? ` / ${prose.lastUpdate}` : ""}）`
    );
    if (!(chRows > 0)) {
      warn("programme-changes: 抓取成功但解析出 0 条变更（页面结构可能已变更，未编造数据）");
    }
  }
  sources.push({
    kind: "PROGRAMME_CHANGES",
    label: chSnap
      ? "Official programme changes (offline snapshot)"
      : "Official programme changes",
    url: chUrl,
    httpStatus: chHttpStatus,
    ok: chOk,
    fetchedAt,
  });

  // ── 行 → 影片 / 场次 ──
  const filmByTitle = new Map();
  const filmOrder = [];
  const items = [];
  let skipped = 0;
  const skipReasons = new Map();
  const bump = (k) => skipReasons.set(k, (skipReasons.get(k) || 0) + 1);
  const unknownSales = new Set();
  const unknownAvail = new Set();
  let strandConflicts = 0;
  let dateMismatch = 0;
  let qaCount = 0;

  for (const { cells: c, permalink, sourceUrl } of collected) {
    const g = (i) => (i < c.length ? c[i] : "");
    const title = clean(g(COL.title)) || clean(g(COL.description));
    const venueName = clean(g(COL.venueName)) || clean(g(COL.venueRaw));
    const time = timeOf(g(COL.localTime), g(COL.startText));
    const d = dateOf(g(COL.year), g(COL.month), g(COL.day), permalink);
    if (!title || !venueName || !time || !d) {
      skipped++;
      bump(!title ? "缺标题" : !venueName ? "缺场馆" : !time ? "缺时间" : "日期非法");
      continue;
    }
    if (d.permalinkDate && d.permalinkDate !== d.iso) {
      dateMismatch++;
      warn(`${permalink}: 行日期 ${d.iso} 与页面日期 ${d.permalinkDate} 不一致（以行内字段为准）`);
    }
    const strand = strandOf(g(COL.strand));
    const sectionName = strand ? STRAND_LABELS[strand] || strand : null;
    const detail = eventUrlOf(g(COL.detailQuery));
    const tokens = keywordTokens(g(COL.keywords));
    const qa = tokens.some((t) => /q\s*&\s*a/i.test(t));
    if (qa) qaCount++;

    let film = filmByTitle.get(title);
    if (!film) {
      film = {
        idx: filmOrder.length + 1,
        cIdx: strand,
        title,
        director: null, // 无法从页面可引证地抽取 → 如实 null
        country: null, // 同上
        sectionName,
        officialUrl: detail, // 该片首个场次的官方详情深链
      };
      filmByTitle.set(title, film);
      filmOrder.push(film);
    } else if (strand && film.cIdx && strand !== film.cIdx) {
      // 同族重映（如 LFFGALA / LFFGALAREPEAT 同为 "Galas"）不算冲突；
      // 只有映射到**不同**展示标签时才是真冲突。
      const sameLabel =
        STRAND_LABELS[strand] && STRAND_LABELS[strand] === STRAND_LABELS[film.cIdx];
      if (!sameLabel) {
        strandConflicts++;
        warn(`同一影片跨单元：${title} 已在 ${film.cIdx}，又见 ${strand}（保留首次）`);
      }
    }

    const salesStatus = String(g(COL.salesStatus) || "").trim();
    const availabilityStatus = String(g(COL.availabilityStatus) || "").trim();
    const availRaw = String(g(COL.availableNum) || "").trim();
    const availableNum = /^\d+$/.test(availRaw) ? Number(availRaw) : null;
    if (salesStatus && !"CS".includes(salesStatus)) unknownSales.add(salesStatus);
    if (availabilityStatus && !"EGLSU".includes(availabilityStatus)) unknownAvail.add(availabilityStatus);

    items.push({
      kind: "SCREENING",
      filmIdx: film.idx,
      cIdx: film.cIdx,
      title,
      localTime: time,
      code: String(g(COL.code) || "").trim() || null,
      grade: null,
      subtitle: null,
      qa,
      ticketStatus: ticketStatusOf({ salesStatus, availabilityStatus }),
      // 快照内没有稳定的官方购票 URL → 如实置 null（C / S 行按规约也必须 null）
      ticketUrl: null,
      eventUrl: detail,
      officialSourceUrl: sourceUrl,
      date: d.iso,
      venueName,
      // 以下为诊断参考值，normalize 会丢弃
      itemId: String(g(COL.itemId) || "").trim() || null,
      salesStatus: salesStatus || null,
      availabilityStatus: availabilityStatus || null,
      availableNum,
      sectionCode: strand,
      minPrice: String(g(COL.minPrice) || "").trim() || null,
      keywords: tokens.join(", "),
    });
  }

  if (unknownSales.size) warn(`sales_status 出现未登记取值：${[...unknownSales].join("/")}`);
  if (unknownAvail.size) warn(`availability_status 出现未登记取值：${[...unknownAvail].join("/")}`);

  const sectionMap = new Map();
  for (const f of filmOrder) if (f.cIdx && !sectionMap.has(f.cIdx)) sectionMap.set(f.cIdx, f.sectionName);
  const sections = [...sectionMap].map(([cIdx, name]) => ({ cIdx, name }));

  const distinctVenues = new Set(items.map((i) => i.venueName)).size;
  if (!items.length) {
    warn(
      "BFI: 未解析到任何场次（离线快照缺失且实时抓取失败）—— 请勿用空结果覆盖已发布数据；" +
        "normalize.validate() 会因 SCHEDULE 源失败而拒绝写入"
    );
  }

  log(
    `[bfi] 汇总：快照日 ${snapshotDays}/${dayList.length}，实时回退 ${liveDays}，` +
      `场次 ${items.length}，影片 ${filmOrder.length}，场馆 ${distinctVenues}`
  );

  return {
    items,
    films: filmOrder,
    sections,
    programmeChanges,
    sources,
    days,
    warnings,
    fetchedAt,
    notes: {
      snapshotDir: dir,
      snapshotDays,
      liveDays,
      columnNamesConfirmed: COLUMN_COUNT - unclosed,
      unclosedArrays: unclosed,
      skippedRows: skipped,
      skipReasons: [...skipReasons].map(([k, v]) => `${k}=${v}`),
      strandConflicts,
      dateMismatch,
      qaItems: qaCount,
      distinctVenues,
      changesRows: chRows,
      programmeChangesOk: chOk,
      programmeChangesFormat: programmeChanges ? programmeChanges.format : null,
      programmeChangesSections: programmeChanges ? programmeChanges.sectionCount : null,
      programmeChangesEntries: programmeChanges ? programmeChanges.entryCount : null,
    },
  };
}

export const meta = {
  id: "bfi",
  officialHost: "whatson.bfi.org.uk",
  entryPages: ["lff/Online/default.asp?BOparam::WScontent::loadArticle::permalink=YYYYMMDD"],
  offlineSnapshots: "data/festivals/raw/bfi/<permalink>.html",
};
