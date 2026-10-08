#!/usr/bin/env node
/**
 * IDFA 适配器 —— 阿姆斯特丹国际纪录片电影节（International Documentary Film Festival Amsterdam）
 *
 * 官方数据入口（唯一）：`https://my.idfa.nl/api/graphql/festival`
 *   — 这是 festival.idfa.nl 官方站点自身调用的公开 GraphQL 端点（Next.js 前端 JS 里直接可见），
 *     不是第三方聚合、不是逆向产物；页面 HTML 只是 JS 壳，真正的事实都从这个端点返回。
 *   — 只读查询：searchSchedule / searchFestivalFilms / currentFestivalSections。
 *
 * 事实来源原则：
 *   日期、时间、影厅、售票状态 100% 取自官方响应；本文件不做推断、不做 AI 补全。
 *   官方没给的东西（如购票深链、单片海报）就留空，绝不用第三方数据填充。
 *
 * 常见坑（均为实测结论）：
 *   1) `searchSchedule(filters: [])` 虽然返回 totalHits，但 `hits` 为空 → 必须至少带 1 个有效 filter。
 *   2) 端点同时返回**非本届残留记录**（实测 2026 届返回 5 条 2026-05-xx 的遗留场次）→ 必须按届次日期区间过滤。
 *   3) 官方 show 记录里有**整日节目块**（跨度 8–12 小时、共用同一 ticketId）→ 不冒充单片场次，按 EVENT 归类。
 *   4) 官方排片尚未发布时，schema、字段、状态都齐全但只剩节目块 → 必须如实呈现为 SCHEDULE_PENDING。
 */

import { nowIso } from "../lib.mjs";

export const ENDPOINT = "https://my.idfa.nl/api/graphql/festival";
export const SITE = "https://festival.idfa.nl";

/** 单片场次的最长合理时长（分钟）。官方 show 记录中存在「整日节目块」（跨度 8–12 小时、同一 ticketId、
 *  film 为 null 或把多部影片挂在同一条记录上）；这类记录按 EVENT 归类 —— 保留官方事实，但不冒充单片场次。 */
export const BLOCK_MAX_MINUTES = 240;

/** 端点要求 JSON POST；站点自身请求带 Origin/Referer。UA 沿用项目自报身份（实测该端点接受）。 */
const GQL_HEADERS = {
  "content-type": "application/json",
  origin: SITE,
  referer: `${SITE}/`,
};

const filmLookup = `{ key translation }`;
const SHOW_FIELDS = `id fullTitle startOn endOn location ticketId noSale ticketAvailabilityStatus hasQa isVideoOnDemand isOngoingProgram externalSaleLink aToZType
  film { id fullPreferredTitle translatedTitle }`;
const FILM_FIELDS = `id fullPreferredTitle translatedTitle yearOfProduction lengthInMinutes
  countriesOfProduction ${filmLookup} subtitleLanguages ${filmLookup} kijkwijzer { translation sortOrder }
  sections { id name } credits { fullName role ${filmLookup} person { fullName } }`;

export const QUERIES = {
  /** 全站公开场次的「日维度」官方统计（只取 id，避免整份排片一次性下载） */
  overview: `query { searchSchedule(filters: [{key: SHOW_TYPE, value: ["Public"]}]) { totalHits filters { filter amounts { key amount } } hits { id } } }`,
  day: (day) => `query { searchSchedule(filters: [{key: DAY, value: ["${day}"]}]) { totalHits hits { ${SHOW_FIELDS} } } }`,
  films: (limit, offset) => `query { searchFestivalFilms(limit: ${limit}, offset: ${offset}) { totalHits hits { ${FILM_FIELDS} } } }`,
  sections: `query { currentFestivalSections { id name group } }`,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ───────────────────────── 纯函数（verify.mjs 直接单测，无需网络） ───────────────────────── */

/** GraphQL 层错误（HTTP 200 + errors） */
export function gqlError(json) {
  const errs = json?.errors;
  if (!Array.isArray(errs) || !errs.length) return null;
  return errs.map((e) => e.message).filter(Boolean).join("; ") || "graphql error";
}

export function scheduleHits(json) {
  const hits = json?.data?.searchSchedule?.hits;
  return Array.isArray(hits) ? hits.filter((h) => h && typeof h === "object") : [];
}

/** 官方日维度统计：哪些日期有场次、各多少（官方自己给出的口径） */
export function dayAmounts(json) {
  const dims = json?.data?.searchSchedule?.filters;
  const day = (Array.isArray(dims) ? dims : []).find((d) => d?.filter === "DAY");
  return (day?.amounts || [])
    .map((a) => ({ day: String(a?.key || ""), amount: Number(a?.amount) || 0 }))
    .filter((x) => DATE_RE.test(x.day));
}

/** 官方 UUID → 稳定整数，保证跨次抓取的 film/section 内部键不变（否则会产出假「新增/移除」变更） */
export function stableNum(uuid) {
  const hex = String(uuid || "").replace(/[^0-9a-f]/gi, "").slice(0, 8);
  return hex ? parseInt(hex, 16) || 0 : 0;
}

/** 官方 UTC ISO → 当地日期/时间（用官方届次时区换算，不手算 DST） */
export function localParts(iso, timeZone) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  let date;
  let time;
  try {
    date = d.toLocaleDateString("en-CA", { timeZone });
    time = d.toLocaleTimeString("en-GB", { timeZone, hour12: false, hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
  if (!DATE_RE.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  return { date, time };
}

export function durationMinutes(show) {
  const a = Date.parse(show?.startOn);
  const b = Date.parse(show?.endOn);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / 60000);
}

/** 官方 show 记录 → 条目类型。只依据官方字段，不做语义猜测。 */
export function classifyShow(show) {
  if (!show?.film) return "EVENT"; // 官方未关联影片 → 节目块 / 活动条目
  const mins = durationMinutes(show);
  if (mins != null && mins > BLOCK_MAX_MINUTES) return "EVENT"; // 整日节目块，不是单片场次
  return "SCREENING";
}

const lookupText = (v) => (v && typeof v === "object" ? v.translation || v.key || null : typeof v === "string" ? v : null);
const lookupList = (arr) => (Array.isArray(arr) ? arr.map(lookupText).filter(Boolean) : []);

export function directorOf(film) {
  const credits = Array.isArray(film?.credits) ? film.credits : [];
  const names = credits
    .filter((c) => /director/i.test(`${c?.role?.key || ""} ${c?.role?.translation || ""}`))
    .map((c) => c?.fullName || c?.person?.fullName)
    .filter(Boolean);
  return names.length ? names.join(", ") : null;
}

/** 影片级事实（字幕/分级随影片走，展示在每条场次行上） */
export function filmMetaByIdx(filmHits) {
  const map = new Map();
  for (const f of filmHits || []) {
    if (!f?.id) continue;
    map.set(stableNum(f.id), {
      subtitle: lookupList(f.subtitleLanguages).join(", ") || null,
      grade: lookupList(f.kijkwijzer)[0] || null,
    });
  }
  return map;
}

/** 官方影片 hits → normalize 需要的 films（缺 id/片名的联合成员直接丢弃） */
export function parseFilms(hits) {
  const films = [];
  const seen = new Set();
  for (const f of hits || []) {
    if (!f || !UUID_RE.test(String(f.id || ""))) continue;
    const title = f.fullPreferredTitle || f.translatedTitle || null;
    if (!title) continue;
    const idx = stableNum(f.id);
    if (!idx || seen.has(idx)) continue;
    seen.add(idx);
    const sec = (f.sections || []).find((s) => s && s.id) || null;
    films.push({
      idx,
      cIdx: sec ? stableNum(sec.id) : null,
      title,
      director: directorOf(f),
      country: lookupList(f.countriesOfProduction).join(", ") || null,
      sectionName: sec?.name || null,
      officialUrl: null,
    });
  }
  return films;
}

export function parseSections(json) {
  const raw = json?.data?.currentFestivalSections;
  return (Array.isArray(raw) ? raw : [])
    .filter((s) => s && s.id && s.name)
    .map((s) => ({ cIdx: stableNum(s.id), name: s.name, group: s.group || null }));
}

/**
 * 官方 show hits → 排片条目（纯函数）
 * 丢弃并记录原因：非本届（届次区间外）、缺时间、缺影厅、缺标题、重复 show.id
 */
export function parseShows(rows, { edition, timeZone, filmMeta = new Map() } = {}) {
  const items = [];
  const dropped = [];
  const seen = new Set();
  const start = edition?.startDate || null;
  const end = edition?.endDate || null;

  for (const show of rows || []) {
    const id = show?.id || null;
    if (!id) {
      dropped.push({ id: null, reason: "malformed record" });
      continue;
    }
    const parts = localParts(show.startOn, timeZone);
    if (!parts) {
      dropped.push({ id, reason: "no start time in official record" });
      continue;
    }
    if (start && end && (parts.date < start || parts.date > end)) {
      dropped.push({ id, reason: `outside edition ${start}..${end} (${parts.date})`, date: parts.date });
      continue;
    }
    const venueName = typeof show.location === "string" && show.location.trim() ? show.location.trim() : null;
    if (!venueName) {
      dropped.push({ id, reason: "no venue in official record", date: parts.date });
      continue;
    }
    const kind = classifyShow(show);
    const film = show.film || null;
    const title = kind === "SCREENING" ? film?.fullPreferredTitle || film?.translatedTitle || show.fullTitle || null : show.fullTitle || film?.fullPreferredTitle || null;
    if (!title) {
      dropped.push({ id, reason: "no title in official record", date: parts.date });
      continue;
    }
    if (seen.has(id)) {
      dropped.push({ id, reason: "duplicate show id", date: parts.date });
      continue;
    }
    seen.add(id);

    const meta = kind === "SCREENING" && film ? filmMeta.get(stableNum(film.id)) || null : null;
    items.push({
      kind,
      filmIdx: kind === "SCREENING" && film ? stableNum(film.id) : null,
      venueName,
      title,
      date: parts.date,
      localTime: parts.time,
      code: id,
      grade: meta?.grade || null,
      subtitle: meta?.subtitle || null,
      qa: !!show.hasQa,
      ticketStatus: show.noSale ? "NO_SALE" : show.ticketAvailabilityStatus || null,
      ticketUrl: show.externalSaleLink || null,
      eventUrl: null,
      officialSourceUrl: ENDPOINT,
    });
  }
  return { items, dropped };
}

/* ───────────────────────── 抓取 ───────────────────────── */

const FILM_PAGE = 200;
const MAX_FILM_PAGES = 8;

export async function fetchEdition({ edition, fetchText, log = () => {} }) {
  const timeZone = edition.timezone || "Europe/Amsterdam";
  const fetchedAt = nowIso();
  const sources = [];
  const warnings = [];

  const post = async (query, label) => {
    const res = await fetchText(ENDPOINT, {
      label,
      method: "POST",
      headers: GQL_HEADERS,
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return { res, json: null, err: res.error || `HTTP ${res.status}` };
    let json = null;
    let err = null;
    try {
      json = JSON.parse(res.body);
      err = gqlError(json);
    } catch (e) {
      err = `response is not JSON (${String(e?.message || e)})`;
    }
    return { res, json, err };
  };

  // ── 1) 官方日维度统计（决定要抓哪几天）──
  log(`[idfa] schedule overview ← ${ENDPOINT}`);
  const ov = await post(QUERIES.overview, "schedule overview");
  const allDays = ov.json ? dayAmounts(ov.json) : [];
  const inRange = allDays.filter((d) => d.day >= edition.startDate && d.day <= edition.endDate);
  const outRange = allDays.filter((d) => d.day < edition.startDate || d.day > edition.endDate);
  if (ov.err) warnings.push(`schedule overview: ${ov.err}`);
  if (outRange.length) {
    warnings.push(
      `ignored ${outRange.reduce((n, d) => n + d.amount, 0)} official record(s) outside this edition: ` +
        outRange.map((d) => `${d.day}×${d.amount}`).join(", ")
    );
  }
  const declaredTotal = ov.json?.data?.searchSchedule?.totalHits ?? null;
  const declaredSum = allDays.reduce((n, d) => n + d.amount, 0);
  const inRangeSum = inRange.reduce((n, d) => n + d.amount, 0);
  if (declaredTotal != null && declaredTotal !== declaredSum) {
    warnings.push(`official day amounts (${declaredSum}) do not sum to totalHits (${declaredTotal})`);
  }

  // ── 2) 逐日抓取本届场次 ──
  const rows = [];
  const days = [];
  let dayFailures = 0;
  for (const { day, amount } of inRange) {
    log(`[idfa] schedule ← DAY=${day}`);
    const r = await post(QUERIES.day(day), `DAY=${day}`);
    if (r.err || !r.json) {
      dayFailures++;
      warnings.push(`schedule DAY=${day} failed: ${r.err}`);
      days.push({ date: day, sourceUrl: ENDPOINT, officialItems: amount, items: 0, failed: true });
      continue;
    }
    const hits = scheduleHits(r.json);
    if (hits.length !== amount) warnings.push(`DAY=${day}: official amount ${amount} != returned ${hits.length}`);
    rows.push(...hits);
    days.push({ date: day, sourceUrl: ENDPOINT, officialItems: amount, items: hits.length, failed: false });
    log(`[idfa]   ${day}: ${hits.length} official record(s) (declared ${amount})`);
  }

  const scheduleOk = ov.res.ok && !ov.err && dayFailures === 0;
  if (rows.length !== inRangeSum) {
    warnings.push(`fetched ${rows.length} of ${inRangeSum} officially declared in-edition record(s)`);
  }
  sources.push({
    kind: "SCHEDULE",
    label: `Official schedule (GraphQL, DAY × ${inRange.length})`.slice(0, 80),
    url: ENDPOINT,
    httpStatus: ov.res.status || null,
    ok: scheduleOk,
    fetchedAt,
  });
  if (dayFailures) warnings.push(`${dayFailures} official day query/queries failed — keeping previous data`);

  // ── 3) 官方节目单（影片 + 单元）──
  let filmHits = [];
  let filmsOk = false;
  let filmsTotal = null;
  try {
    for (let page = 0; page < MAX_FILM_PAGES; page++) {
      const r = await post(QUERIES.films(FILM_PAGE, page * FILM_PAGE), `films page ${page + 1}`);
      if (r.err || !r.json) {
        warnings.push(`programme page ${page + 1}: ${r.err}`);
        break;
      }
      const res = r.json.data.searchFestivalFilms;
      filmsTotal = res.totalHits ?? filmsTotal;
      const hits = (res.hits || []).filter((h) => h && typeof h === "object");
      filmHits.push(...hits);
      filmsOk = true;
      if (hits.length < FILM_PAGE || filmHits.length >= (filmsTotal || 0)) break;
    }
  } catch (e) {
    warnings.push(`programme fetch threw: ${String(e?.message || e)}`);
  }
  if (filmsTotal != null && filmHits.length < filmsTotal) warnings.push(`programme: parsed ${filmHits.length}/${filmsTotal} films`);
  sources.push({
    kind: "PROGRAMME",
    label: "Official programme (GraphQL, searchFestivalFilms)",
    url: ENDPOINT,
    httpStatus: ov.res.status || null,
    ok: filmsOk,
    fetchedAt,
  });

  // ── 4) 官方单元 ──
  const sec = await post(QUERIES.sections, "sections");
  if (sec.err) warnings.push(`sections: ${sec.err}`);

  const films = parseFilms(filmHits);
  const filmMeta = filmMetaByIdx(filmHits);
  const officialSections = parseSections(sec.json);

  // ── 5) 归一化为排片条目 ──
  const { items, dropped } = parseShows(rows, { edition, timeZone, filmMeta });
  const reasons = new Map();
  for (const d of dropped) reasons.set(d.reason, (reasons.get(d.reason) || 0) + 1);
  for (const [reason, n] of reasons) warnings.push(`dropped ${n} official record(s): ${reason}`);
  const screenings = items.filter((i) => i.kind === "SCREENING").length;
  const blocks = items.filter((i) => i.kind === "EVENT" && i.code && rows.some((r) => r.id === i.code && r.film)).length;
  if (blocks) warnings.push(`${blocks} record(s) look like all-day programme blocks (linked film, > ${BLOCK_MAX_MINUTES}min) — kept as EVENT, not screenings`);
  if (!screenings) {
    warnings.push(
      `official screening times not published yet: 0 SCREENING, ${items.length} official programme entry/entries ` +
        `(status SCHEDULE_PENDING — partial data, NOT a complete schedule)`
    );
  }
  log(`[idfa] films=${films.length} entries=${items.length} (screenings=${screenings})`);

  return {
    items,
    films,
    sections: officialSections.length ? officialSections : [...new Set(films.filter((f) => f.cIdx).map((f) => f.cIdx))].map((cIdx) => ({ cIdx, name: films.find((f) => f.cIdx === cIdx)?.sectionName || null })),
    sources,
    days,
    warnings,
    fetchedAt,
    coverage: { declaredTotal, declaredDaySum: declaredSum, declaredInEdition: inRangeSum, fetched: rows.length, inEditionDays: inRange.map((d) => d.day) },
  };
}

export const meta = {
  id: "idfa",
  officialHost: SITE,
  endpoint: ENDPOINT,
  entryPages: [ENDPOINT, `${SITE}/en/about`],
};
