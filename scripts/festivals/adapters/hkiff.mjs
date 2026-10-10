#!/usr/bin/env node
/**
 * HKIFF Cine Fan 适配器 —— 仅抓取 cinefan.hkiff.org.hk 官方页面
 *
 * 数据源（全部来自 Cine Fan 站点 __NEXT_DATA__ 载荷）：
 *   1) Schedule 页  → /schedule → props.pageProps.data.offline（当前可购场次）+ remarks 场馆字典
 *   2) Period 页    → /period  → props.pageProps.periodList + programmeList（档期/单元/片单）
 *   3) Movie 详情页 → /film/:slug → props.pageProps.page（影片完整元数据 + screening.offline 完整场次）
 *
 * 关键：Schedule 页只展示「当前与未来」场次，已放映的场次会从该页消失；
 *   而 Movie 详情页的 screening.offline 保留该片全部场次（含已过场次）。
 *   → 权威排片源 = Movie 详情页；Schedule 页仅用于发现片目与购票链接/售罄状态。
 *
 * 合规红线：
 *   - www.hkiff.org.hk robots.txt = Disallow: /  —— 绝不可抓取该域
 *   - cinefan.hkiff.org.hk 无 robots.txt ≠ 获准接入；HKIFF Society 条款仍限制自动访问/复制/分发
 *   - adapter 仅演示解析逻辑，实际落地需官方授权
 *
 * 覆盖率说明：Cine Fan 为常年放映计划（repertory），场次天然稀疏（44 场 / 15 distinct days / 50 day span）
 *   → edition.coverageMinDays 绕过标准 ceil(dayCount/2) 校验
 *
 * 离线快照模式：fetchText 可被替换为「读本地快照」的 fetcher（见 run.mjs --snapshot=DIR），
 *   用于在未获授权时以已抓取快照生成产物，adapter 解析逻辑完全一致。
 */

import { nowIso } from "../lib.mjs";

export const HOST = "https://cinefan.hkiff.org.hk";
export const SCHEDULE_URL = `${HOST}/schedule`;
export const PERIOD_URL = `${HOST}/period`;
export const FILM_URL = (slug) => `${HOST}/film/${slug}`;
export const OFFICIAL_SITE = `${HOST}/`;

/** 从 __NEXT_DATA__ 提取 pageProps */
function extractPageProps(html) {
  const m = String(html).match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]).props?.pageProps || null;
  } catch {
    return null;
  }
}

/** 从 remarks 字典建立 code -> {title,type} 映射 */
function buildRemarkDict(pageProps) {
  const map = new Map();
  const list = pageProps?.remarks?.remarks || pageProps?.screeningRemarks || [];
  for (const r of list) {
    if (r?.code) map.set(r.code, { title: r.title || null, type: r.type || null });
  }
  return map;
}

/** 从一批 remark 代码中解析出场馆名（取第一个 type === "Venue" 的代码） */
function resolveVenue(codes, dict) {
  for (const c of codes || []) {
    const hit = dict.get(c);
    if (hit && hit.type === "Venue") return hit.title;
  }
  return null;
}

/** 解析 schedule 页离线场次（用于发现片目 / 购票链接 / 售罄状态） */
function parseSchedule(pageProps) {
  const dict = buildRemarkDict(pageProps);
  const byKey = new Map();
  for (const s of pageProps?.data?.offline || []) {
    if (!s.startDate || !s.startTime || !s.movie?.slug) continue;
    const remarks = Array.isArray(s.remarks) ? s.remarks : [];
    const key = `${s.movie.slug}|${s.startDate}|${String(s.startTime).slice(0, 5)}`;
    byKey.set(key, {
      ticketUrl: s.url || null,
      statusLabel: s.title || null, // "Full House" 等
      venueName: resolveVenue(remarks, dict),
      remarks,
      filmCode: s.filmCode || null,
    });
  }
  return { dict, byKey };
}

/** 解析 period 页 → 单元映射 slug -> {sectionId, sectionName} + 片单 slug 集合 */
function parseProgrammes(pageProps) {
  const map = new Map();
  const slugs = new Set();
  for (const p of pageProps?.programmeList || []) {
    const sectionId = Number(p.id);
    const sectionName = p.title;
    for (const m of p.movies || []) {
      if (m.slug) {
        map.set(m.slug, { sectionId, sectionName });
        slugs.add(m.slug);
      }
    }
  }
  return { map, slugs };
}

/** 解析电影详情页 → 影片元数据 + 完整场次 */
function parseFilmPage(pageProps) {
  const p = pageProps?.page;
  if (!p?.slug) return null;
  const offline = p?.screening?.offline || [];
  return {
    slug: p.slug,
    title: p.title,
    director: p.director || null,
    cast: p.cast || null,
    year: p.year || null,
    country: p.country || null,
    runtime: p.runtime ? String(p.runtime) : null,
    fileFormat: p.fileFormat || null,
    language: p.language || null,
    description: p.description || null,
    orgTitle: p.orgTitle || null,
    subtitle: p.subtitle === true,
    slides: Array.isArray(p.slides) ? p.slides : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    programme: p.programme || null,
    screenings: offline.map((s) => ({
      date: s.startDate || null,
      time: s.startTime ? String(s.startTime).slice(0, 5) : null,
      ticketUrl: s.url || null,
      remarks: Array.isArray(s.remarks) ? s.remarks : [],
      statusLabel: s.title || null,
      filmCode: s.filmCode || null,
    })),
  };
}

/** 主入口：fetchEdition 契约 → { items, films, sections, sources, days, warnings, fetchedAt, notes } */
export async function fetchEdition({ festival, edition, fetchText, log = () => {} }) {
  const warnings = [];
  const sources = [];
  const fetchedAt = nowIso();

  // ── 1) Schedule 页（发现片目 + 购票链接/售罄状态） ──
  log(`[hkiff] schedule: ${SCHEDULE_URL}`);
  const schedRes = await fetchText(SCHEDULE_URL, { label: "schedule" });
  sources.push({
    kind: "SCHEDULE",
    label: "Cine Fan official schedule (current & upcoming screenings)",
    url: SCHEDULE_URL,
    httpStatus: schedRes.status || null,
    ok: schedRes.ok,
    fetchedAt,
  });
  let scheduleByKey = new Map();
  let venueDict = new Map();
  const scheduleSlugs = new Set();
  if (schedRes.ok) {
    const pageProps = extractPageProps(schedRes.body);
    if (pageProps) {
      const parsed = parseSchedule(pageProps);
      scheduleByKey = parsed.byKey;
      venueDict = parsed.dict;
      for (const s of pageProps?.data?.offline || []) {
        if (s.movie?.slug) scheduleSlugs.add(s.movie.slug);
      }
      log(`[hkiff] schedule parsed: ${scheduleByKey.size} upcoming screenings, ${venueDict.size} remark codes`);
    } else {
      warnings.push("schedule page: __NEXT_DATA__ not found or parse failed");
    }
  } else {
    warnings.push(`schedule fetch failed: ${schedRes.error}`);
  }

  // ── 2) Period 页（档期/单元/片单） ──
  log(`[hkiff] period: ${PERIOD_URL}`);
  const periodRes = await fetchText(PERIOD_URL, { label: "period" });
  sources.push({
    kind: "PROGRAMME",
    label: "Cine Fan official programme (periods + sections)",
    url: PERIOD_URL,
    httpStatus: periodRes.status || null,
    ok: periodRes.ok,
    fetchedAt,
  });
  let sectionMap = new Map();
  const periodSlugs = new Set();
  if (periodRes.ok) {
    const pageProps = extractPageProps(periodRes.body);
    if (pageProps) {
      const parsed = parseProgrammes(pageProps);
      sectionMap = parsed.map;
      for (const s of parsed.slugs) periodSlugs.add(s);
      log(`[hkiff] section map: ${sectionMap.size} film→section mappings`);
    } else {
      warnings.push("period page: __NEXT_DATA__ not found or parse failed");
    }
  } else {
    warnings.push(`period fetch failed: ${periodRes.error}`);
  }

  // ── 3) 片目 slug = schedule ∪ period（任一来源发现即抓详情页） ──
  const filmSlugs = [...new Set([...scheduleSlugs, ...periodSlugs])].sort();

  // ── 4) 抓取电影详情页 → 影片元数据 + 完整场次（权威排片源） ──
  const films = [];
  const filmIdxBySlug = new Map();
  let filmPagesFetched = 0;
  let filmPagesFailed = 0;

  for (const slug of filmSlugs) {
    const url = FILM_URL(slug);
    log(`[hkiff] film: ${url}`);
    const res = await fetchText(url, { label: `film ${slug}` });
    sources.push({
      kind: "FILM_DETAIL",
      label: `Film detail — ${slug}`,
      url,
      httpStatus: res.status || null,
      ok: res.ok,
      fetchedAt,
    });
    if (res.ok) {
      const pageProps = extractPageProps(res.body);
      const film = pageProps ? parseFilmPage(pageProps) : null;
      if (film) {
        filmIdxBySlug.set(slug, films.length + 1);
        films.push(film);
        filmPagesFetched++;
      } else {
        warnings.push(`film ${slug}: __NEXT_DATA__ not found or parse failed`);
        filmPagesFailed++;
      }
    } else {
      warnings.push(`film ${slug} fetch failed: ${res.error}`);
      filmPagesFailed++;
    }
  }
  log(`[hkiff] film pages: ${filmPagesFetched} ok, ${filmPagesFailed} failed`);

  // ── 5) 合并：以电影详情页场次为权威 → normalize items ──
  const items = [];
  const seen = new Set();
  for (const film of films) {
    const filmIdx = filmIdxBySlug.get(film.slug);
    const section = sectionMap.get(film.slug) || { sectionId: null, sectionName: null };
    for (const s of film.screenings) {
      if (!s.date || !s.time) continue;
      const key = `${film.slug}|${s.date}|${s.time}`;
      const sched = scheduleByKey.get(key) || null; // 若仍在 schedule 页 → 取购票链接/售罄状态
      const remarks = s.remarks?.length ? s.remarks : sched?.remarks || [];
      const venueName =
        resolveVenue(remarks, venueDict) || sched?.venueName || "Cine Fan (venue TBA)";
      const code = `${s.date.replace(/-/g, "")}${s.time.replace(":", "")}`;
      const id = `${film.slug}|${s.date}|${s.time}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        kind: "SCREENING",
        filmIdx, // 整数，与 films[].idx 对应
        filmSlug: film.slug,
        cIdx: section.sectionId,
        title: film.title,
        localTime: s.time,
        code,
        grade: null,
        subtitle: film.subtitle || false,
        qa: remarks.includes("PT"), // 映后谈
        ticketStatus: s.statusLabel || sched?.statusLabel || null, // "Full House" 等
        ticketUrl: s.ticketUrl || sched?.ticketUrl || null,
        eventUrl: FILM_URL(film.slug),
        officialSourceUrl: FILM_URL(film.slug),
        date: s.date,
        venueName,
        // 诊断字段（normalize 会丢弃）
        filmCode: s.filmCode || sched?.filmCode || null,
        remarks,
        sectionName: section.sectionName,
      });
    }
  }

  // ── 6) films → normalize 期望格式（带整数 idx） ──
  const filmsForNormalize = films.map((f, i) => {
    const section = sectionMap.get(f.slug);
    return {
      idx: i + 1,
      cIdx: section?.sectionId || null,
      title: f.title,
      director: f.director,
      country: f.country,
      sectionName: section?.sectionName || f.programme?.name || null,
      officialUrl: FILM_URL(f.slug),
      // 扩展字段（normalize 会忽略，保留供后续扩展）
      _slug: f.slug,
      _runtime: f.runtime,
      _fileFormat: f.fileFormat,
      _language: f.language,
      _description: f.description,
      _orgTitle: f.orgTitle,
      _cast: f.cast,
      _year: f.year,
      _slides: f.slides,
      _tags: f.tags,
      _screeningCount: f.screenings.length,
    };
  });

  // ── 7) sections ──
  const sectionSet = new Map();
  for (const sec of sectionMap.values()) {
    if (sec.sectionId && !sectionSet.has(sec.sectionId)) sectionSet.set(sec.sectionId, sec.sectionName);
  }
  const sections = [...sectionSet].map(([cIdx, name]) => ({ cIdx, name }));

  // ── 8) days 统计（按权威场次日期） ──
  const dayMap = new Map();
  for (const s of items) {
    const d =
      dayMap.get(s.date) ||
      { date: s.date, tab: 0, sourceUrl: SCHEDULE_URL, heading: null, venues: 0, items: 0 };
    d.items++;
    dayMap.set(s.date, d);
  }
  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    items,
    films: filmsForNormalize,
    sections,
    sources,
    days,
    warnings,
    fetchedAt,
    notes: {
      filmPagesFetched,
      filmPagesFailed,
      scheduleItems: scheduleByKey.size,
      screeningsTotal: items.length,
      sectionMappings: sectionMap.size,
    },
  };
}

export const meta = {
  id: "hkiff",
  officialHost: "cinefan.hkiff.org.hk",
  entryPages: ["/schedule", "/period", "/film/:slug"],
  note: "Requires official authorization. www.hkiff.org.hk is Disallowed by robots.txt.",
};
