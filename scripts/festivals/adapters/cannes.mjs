#!/usr/bin/env node
/**
 * Festival de Cannes — Adapter
 *
 * 模式：授权 pending + 离线快照（默认不实时抓取；仅 --snapshot 可跑）
 * 契约：export async function fetchEdition({ festival, edition, fetchText, log, snapshotDir })
 *       export const meta = { id, officialHost, entryPages, offlineSnapshots }
 *
 * 数据源（2026 = 79th）：
 *   1) 官方选片页  https://www.festival-cannes.com/en/the-selection/
 *      → 9 个 section（<h2 id="…">），共 150 部影片，链接 /en/f/{slug}/
 *   2) 影片详情页  https://www.festival-cannes.com/en/f/{slug}/
 *      → 服务端渲染 + microdata：synopsis（itemprop="description" / og:description）、
 *        runtime（itemprop="duration" content="PT112M"）、country（itemprop="countryOfOrigin"）、
 *        year（"Year of production: 2026"）、director（"Directed by : X"）
 *
 * 注意：Cannes 站点对 node 直连（undici/fetch）超时/断连，实时抓取必须经具备浏览器能力的
 *   fetcher；本项目在 pending 授权下仅使用离线快照（raw/cannes/ 不入库）。
 *
 * programme-only：官方未提供机器可读的场次/场馆（选片页只列影片）→ 只产出影片元数据，
 *   不发出 SCREENING；edition.coverageMinDays 必须为 0，且绝不发出失败的 SCHEDULE source。
 *
 * 合规：Cannes 法律声明明文禁止提取/复用/存储/复制数据库内容及未经授权的再发布；
 *   故 authorization = pending，raw HTML 不入库（gitignore），仅由离线快照生成产物。
 */

import { nowIso, clean } from "../lib.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const meta = {
  id: "cannes",
  officialHost: "www.festival-cannes.com",
  entryPages: [
    "https://www.festival-cannes.com/en/the-selection/",
    "https://www.festival-cannes.com/en/f/{slug}/",
  ],
  offlineSnapshots: true,
};

const BASE = "https://www.festival-cannes.com";
const SELECTION_URL = `${BASE}/en/the-selection/`;
const SELECTION_SNAPSHOT = "selection.html";
const OFFICIAL_SITE = `${BASE}/en/`;

function readSnapshot(snapshotDir, rel) {
  const p = join(snapshotDir, rel);
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/** 选片页 → { sections, films }（影片链接 = /en/f/{slug}/，每个 .list_item 一条） */
function parseSelection(html) {
  const h2re = /<h2[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g;
  const marks = [];
  let m;
  while ((m = h2re.exec(html))) marks.push({ id: m[1], name: clean(m[2]), index: m.index, end: h2re.lastIndex });

  const sections = [];
  const films = [];
  for (let i = 0; i < marks.length; i++) {
    const seg = html.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].index : html.length);
    // 同名 section（两处 "In Competition"）用 h3 副标题区分（Feature films / Short films）
    const h3 = seg.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    const sub = h3 ? clean(h3[1]) : null;
    const name = sub ? `${marks[i].name} — ${sub}` : marks[i].name;
    const cIdx = i + 1;
    sections.push({ cIdx, name });

    for (const block of seg.split(/<div class="list_item /).slice(1)) {
      const link = block.match(
        /<a href="(https:\/\/www\.festival-cannes\.com\/(?:en\/)?f\/([^"\/]+)\/)"[^>]*class="[^"]*list_item__content__title/
      );
      if (!link) continue;
      const titleM = block.match(/list_item__content__title[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/);
      const dirM = block.match(/<span[^>]*>([\s\S]*?)<\/span>/);
      films.push({
        slug: link[2],
        url: link[1],
        title: titleM ? clean(titleM[1]) : null,
        director: dirM ? clean(dirM[1]).replace(/^by\s+/i, "") : null,
        cIdx,
        sectionName: name,
      });
    }
  }
  return { sections, films };
}

/** 影片详情页 → { synopsis, runtime, country, year, director, title } */
function parseFilmDetail(html) {
  const out = {};
  const es = html.match(/itemprop="description"[^>]*>([\s\S]*?)<\/div>/);
  if (es) out.synopsis = clean(es[1]);
  else {
    const og = html.match(/property="og:description"[^>]*content="([^"]*)"/);
    out.synopsis = og ? clean(og[1]) : null;
  }
  const dur = html.match(/itemprop="duration"[^>]*content="PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (dur && (dur[1] || dur[2])) {
    const h = Number(dur[1] || 0);
    const mm = Number(dur[2] || 0);
    out.runtime = `${h * 60 + mm} min`;
  } else out.runtime = null;

  const co = html.match(/itemprop="countryOfOrigin"[^>]*>([\s\S]*?)<\/span>/);
  out.country = co ? clean(co[1]) : null;

  const yr = html.match(/Year of production:\s*(\d{4})/i);
  out.year = yr ? Number(yr[1]) : null;

  const dir = html.match(/Directed by\s*:\s*([^<]+)</i);
  out.director = dir ? clean(dir[1]) : null;

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  out.title = h1 ? clean(h1[1]) : null;

  return out;
}

export async function fetchEdition({ festival, edition, fetchText, log = () => {}, snapshotDir } = {}) {
  const SNAPSHOT = !!snapshotDir;
  const fetchedAt = nowIso();
  const warnings = [];
  const sources = [];

  // ── 1) 选片页 ──
  let selectionHtml = "";
  let selStatus = 200;
  if (SNAPSHOT) {
    selectionHtml = readSnapshot(snapshotDir, SELECTION_SNAPSHOT) || "";
    if (!selectionHtml) warnings.push(`snapshot missing: ${SELECTION_SNAPSHOT}`);
  } else {
    log(`[cannes] selection: ${SELECTION_URL}`);
    const res = await fetchText(SELECTION_URL, { label: "selection" });
    selectionHtml = res.body || "";
    selStatus = res.status || 200;
    if (!res.ok) warnings.push(`selection fetch failed: ${res.error || res.status}`);
  }
  sources.push({
    kind: "PROGRAMME",
    label: "Official selection (all films & sections)",
    url: SELECTION_URL,
    httpStatus: selStatus,
    ok: !!selectionHtml,
    fetchedAt,
  });

  const { sections, films: sel } = selectionHtml ? parseSelection(selectionHtml) : { sections: [], films: [] };
  log(`[cannes] selection parsed: ${sel.length} films in ${sections.length} sections`);

  if (!sel.length) {
    throw new Error(`cannes selection yielded 0 films (warnings: ${warnings.join("; ") || "none"})`);
  }

  // ── 2) 影片详情页（补 synopsis / runtime / country / year / director） ──
  const films = [];
  let detailOk = 0;
  let detailMissing = 0;
  for (let i = 0; i < sel.length; i++) {
    const f = sel[i];
    let html = "";
    if (SNAPSHOT) {
      html = readSnapshot(snapshotDir, `films/${f.slug}.html`) || "";
    } else {
      const res = await fetchText(`${BASE}/en/f/${f.slug}/`, { label: `film ${f.slug}` });
      html = res.ok ? res.body || "" : "";
    }
    const d = html ? parseFilmDetail(html) : {};
    if (html) detailOk++;
    else {
      detailMissing++;
      warnings.push(`film detail missing: ${f.slug}`);
    }
    films.push({
      idx: i + 1,
      cIdx: f.cIdx,
      title: d.title || f.title,
      director: d.director || f.director || null,
      country: d.country || null,
      sectionName: f.sectionName,
      officialUrl: f.url,
      synopsis: d.synopsis || null,
      runtime: d.runtime || null,
      _year: d.year ?? null, // 诊断字段（normalize 丢弃）
      _slug: f.slug,
    });
  }
  log(`[cannes] film details: ${detailOk} ok, ${detailMissing} missing`);

  sources.push({
    kind: "PROGRAMME",
    label: `Official film detail pages (${detailOk}/${sel.length})`,
    url: `${BASE}/en/f/`,
    httpStatus: detailOk ? 200 : 0,
    ok: detailOk > 0,
    fetchedAt,
  });
  sources.push({
    kind: "OFFICIAL_SITE",
    label: "Festival de Cannes official site",
    url: OFFICIAL_SITE,
    httpStatus: null,
    ok: true,
    fetchedAt,
  });

  log(`[cannes] total: ${films.length} films, ${sections.length} sections (programme-only)`);

  return {
    items: [], // programme-only：官方选片页不含场次
    films,
    sections,
    sources,
    days: [],
    warnings,
    fetchedAt,
    notes: {
      programmeOnly: true,
      films: films.length,
      sections: sections.length,
      detailOk,
      detailMissing,
      via: SNAPSHOT ? "offline snapshot" : "live fetch",
    },
  };
}
