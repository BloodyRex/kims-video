#!/usr/bin/env node
/**
 * 标准化 + 校验（与站点无关）
 *   normalize(): 适配器原始输出 → 统一数据模型（Festival / Edition / Section / Film / ScreeningOrEvent / Venue / Source）
 *   validate() : 失败即拒绝写入，保证「更新失败不覆盖旧的有效数据」
 *
 * 排片条目分三类并如实保留：SCREENING（影片场次）/ EVENT（大师班、对谈等活动）/ TBA（官方暂无链接）。
 * 「尚未公布」= 明确的状态，不等于没有信息。
 */

import { slugify, daysBetween, nowIso } from "./lib.mjs";

export function normalize({ festival, edition, raw }) {
  const slug = edition.id;
  const now = raw.fetchedAt || nowIso();
  const tz = edition.timezone;

  const sectionByCIdx = new Map();
  for (const s of raw.sections || []) {
    if (s.cIdx) sectionByCIdx.set(s.cIdx, s.name || null);
  }

  // ── Films ──
  const films = [];
  const filmByIdx = new Map();
  for (const f of raw.films || []) {
    const rec = {
      id: `${slug}-f${f.idx}`,
      idx: f.idx,
      cIdx: f.cIdx || null,
      title: f.title,
      director: f.director || null,
      country: f.country || null,
      sectionId: f.cIdx ? `c${f.cIdx}` : null,
      sectionName: f.sectionName || null,
      officialUrl: f.officialUrl || null,
      inProgramme: true,
    };
    films.push(rec);
    filmByIdx.set(f.idx, rec);
  }

  // ── Venues ──
  const venueByName = new Map();
  const ensureVenue = (name) => {
    if (!venueByName.has(name)) venueByName.set(name, { id: slugify(name), name });
    return venueByName.get(name);
  };

  // ── 排片条目 ──
  const screenings = [];
  const seenIds = new Set();
  for (const s of raw.items || []) {
    const kind = s.kind || (s.filmIdx ? "SCREENING" : "TBA");
    const venue = ensureVenue(s.venueName);
    let film = null;
    if (kind === "SCREENING") {
      film = filmByIdx.get(s.filmIdx) || null;
      if (!film) {
        // 排片里出现但官方片单未收录 —— 保留事实并标记
        film = {
          id: `${slug}-f${s.filmIdx}`,
          idx: s.filmIdx,
          cIdx: s.cIdx || null,
          title: s.title || "(untitled)",
          director: null,
          country: null,
          sectionId: s.cIdx ? `c${s.cIdx}` : null,
          sectionName: sectionByCIdx.get(s.cIdx) || null,
          officialUrl: s.officialSourceUrl || null,
          inProgramme: false,
        };
        films.push(film);
        filmByIdx.set(s.filmIdx, film);
      }
    }
    const id = `${slug}-${String(s.date).replace(/-/g, "")}-${s.code || s.localTime.replace(":", "")}${
      kind === "SCREENING" ? "" : "-" + slugify(s.title || kind).slice(0, 24)
    }`;
    if (seenIds.has(id)) continue; // 官方页面重复行不重复计数
    seenIds.add(id);
    screenings.push({
      id,
      kind,
      filmId: film ? film.id : null,
      title: film ? film.title : s.title || null,
      sectionId: film ? film.sectionId : s.cIdx ? `c${s.cIdx}` : null,
      sectionName: (film && film.sectionName) || sectionByCIdx.get(s.cIdx) || null,
      date: s.date,
      localTime: s.localTime,
      timezone: tz,
      venueId: venue.id,
      venueName: venue.name,
      code: s.code || null,
      grade: s.grade || null,
      subtitle: s.subtitle || null,
      qa: !!s.qa,
      ticketStatus: s.ticketStatus || null,
      // 官方票价原文（如 "£10.00" / "£0.00"）——仅当适配器真的提供时才落字段（条件落键）；
      // 语义交由前端区分：£0.00 = 官方免费价，缺键 = 未知（不得当成免费）。
      // 未接入票价的届次（BIFF/IDFA）不得被写入 minPrice 键，以保持其 schema 逐字节不变。
      ...(s.minPrice ? { minPrice: s.minPrice } : {}),
      ticketUrl: s.ticketUrl || null,
      eventUrl: s.eventUrl || null,
      officialSourceUrl: s.officialSourceUrl || null,
      lastVerifiedAt: now,
    });
  }

  screenings.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.localTime.localeCompare(b.localTime) ||
      a.venueName.localeCompare(b.venueName)
  );
  films.sort(
    (a, b) =>
      (a.sectionName || "zz").localeCompare(b.sectionName || "zz") || a.title.localeCompare(b.title)
  );

  // ── Sections ──
  const sections = [];
  const sectionIds = new Set();
  const addSection = (cIdx, name) => {
    if (!cIdx || sectionIds.has(cIdx)) return;
    sectionIds.add(cIdx);
    sections.push({ id: `c${cIdx}`, cIdx, name: name || sectionByCIdx.get(cIdx) || null });
  };
  for (const f of films) addSection(f.cIdx, f.sectionName);
  for (const s of screenings) {
    if (s.sectionId) addSection(Number(s.sectionId.slice(1)), s.sectionName);
  }

  // ── 官方「节目变更」（如有）—— 原样保留可追溯文本，缺失即 null，不编造 ──
  const programmeChanges = raw.programmeChanges
    ? {
        url: raw.programmeChanges.url || null,
        via: raw.programmeChanges.via || null,
        format: raw.programmeChanges.format || null,
        lastUpdate: raw.programmeChanges.lastUpdate || null,
        sectionCount: Number(raw.programmeChanges.sectionCount) || 0,
        entryCount: Number(raw.programmeChanges.entryCount) || 0,
        sections: (raw.programmeChanges.sections || []).map((s) => ({
          title: s.title,
          entryCount: (s.entries || []).length,
          entries: (s.entries || []).map((e) => ({ title: e.title, lines: e.lines || [] })),
        })),
      }
    : null;

  // ── 状态 ──
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const lifecycle = today < edition.startDate ? "UPCOMING" : today > edition.endDate ? "ENDED" : "LIVE";
  const datesStatus = "CONFIRMED";
  const programmeStatus = films.some((f) => f.inProgramme) ? "RELEASED" : "PENDING";
  const hasSchedule = screenings.some((s) => s.kind === "SCREENING");
  const scheduleStatus = hasSchedule ? "LIVE" : "PENDING";
  let status;
  if (scheduleStatus === "LIVE" && lifecycle === "LIVE") status = "SCREENING_LIVE";
  else if (scheduleStatus === "LIVE") status = "SCHEDULE_LIVE";
  else if (programmeStatus === "RELEASED") status = "PROGRAM_RELEASED";
  else status = "SCHEDULE_PENDING";

  const venues = [...venueByName.values()].sort((a, b) => a.name.localeCompare(b.name));
  const daySet = [...new Set(screenings.map((s) => s.date))].sort();
  const byKind = (k) => screenings.filter((s) => s.kind === k).length;

  return {
    slug,
    festivalId: festival.id,
    festival: {
      id: festival.id,
      name: festival.name,
      city: festival.city,
      country: festival.country,
      countryCode: festival.countryCode || null,
      region: festival.region || null,
      types: festival.types || [],
      officialUrl: festival.officialUrl,
    },
    edition: {
      id: edition.id,
      year: edition.year,
      startDate: edition.startDate,
      endDate: edition.endDate,
      timezone: tz,
      dayCount: daysBetween(edition.startDate, edition.endDate) + 1,
      officialUrl: edition.officialUrl || festival.officialUrl,
    },
    lifecycle,
    status,
    statusDetail: { dates: datesStatus, programme: programmeStatus, schedule: scheduleStatus },
    statusNote: {
      zh:
        programmeStatus === "PENDING"
          ? "官方尚未公布节目单"
          : scheduleStatus === "PENDING"
          ? "官方已公布节目，具体排片尚未公布"
          : null,
      en:
        programmeStatus === "PENDING"
          ? "Programme not announced yet"
          : scheduleStatus === "PENDING"
          ? "Programme announced, screening schedule pending"
          : null,
    },
    sources: (raw.sources || []).map((s) => ({
      kind: s.kind,
      label: s.label,
      url: s.url,
      httpStatus: s.httpStatus,
      ok: s.ok !== false,
      fetchedAt: s.fetchedAt || now,
    })),
    sections,
    venues,
    films,
    screenings,
    stats: {
      films: films.filter((f) => f.inProgramme).length,
      filmsTotal: films.length,
      screenings: byKind("SCREENING"),
      events: byKind("EVENT"),
      pending: byKind("TBA"),
      entries: screenings.length,
      venues: venues.length,
      sections: sections.length,
      days: daySet.length,
      guestVisits: screenings.filter((s) => s.qa).length,
    },
    days: raw.days || [],
    // 仅当适配器真的提供了官方节目变更时才落字段（BIFF/IDFA 产物保持逐字节不变）
    ...(programmeChanges ? { programmeChanges } : {}),
    warnings: raw.warnings || [],
    fetchedAt: now,
    lastVerifiedAt: now,
    dataSource: "official",
  };
}

/**
 * 硬性校验 —— 不通过则调用方必须放弃本次写入（保留旧数据）
 */
export function validate(store, previous) {
  const errors = [];
  const warnings = [];

  if (!store.slug) errors.push("missing slug");
  if (!store.edition?.startDate || !store.edition?.endDate) errors.push("missing edition dates");
  if (!store.sources?.length) errors.push("no official sources recorded");
  if (!store.sources?.some((s) => s.ok)) errors.push("all official sources failed");

  const { startDate, endDate } = store.edition || {};
  const filmIds = new Set(store.films.map((f) => f.id));
  const venueIds = new Set(store.venues.map((v) => v.id));
  const ids = new Set();

  for (const s of store.screenings) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errors.push(`bad date on ${s.id}: ${s.date}`);
    if (!/^\d{2}:\d{2}$/.test(s.localTime)) errors.push(`bad time on ${s.id}: ${s.localTime}`);
    if (startDate && (s.date < startDate || s.date > endDate))
      errors.push(`entry ${s.id} outside festival range (${s.date})`);
    if (s.kind === "SCREENING" && !filmIds.has(s.filmId))
      errors.push(`screening ${s.id} references unknown film ${s.filmId}`);
    if (s.kind !== "SCREENING" && !s.title) errors.push(`entry ${s.id} (${s.kind}) has no title`);
    if (!venueIds.has(s.venueId)) errors.push(`entry ${s.id} references unknown venue ${s.venueId}`);
    if (!s.officialSourceUrl) errors.push(`entry ${s.id} has no official source url`);
    if (ids.has(s.id)) errors.push(`duplicate entry id ${s.id}`);
    ids.add(s.id);
  }

  if (!store.screenings.length && store.statusDetail?.schedule === "LIVE")
    errors.push("status says schedule LIVE but no entries parsed");
  // 口径不变量：列表条目总数 = 场次 + 活动 + 待定（PROGRAMME SCHEDULE 的计数拆分必须自洽）
  const st = store.stats || {};
  if (st.entries !== st.screenings + st.events + st.pending) {
    errors.push(
      `stats mismatch: entries ${st.entries} != screenings ${st.screenings} + events ${st.events} + pending ${st.pending}`
    );
  }
  if (!store.films.length) warnings.push("no films parsed");

  // 官方排片页只要有任一页抓取失败 → 拒绝覆盖（宁可用旧数据，也不发布残缺排片）
  const failedSched = (store.sources || []).filter((s) => s.kind === "SCHEDULE" && !s.ok);
  if (failedSched.length) {
    errors.push(
      `${failedSched.length} official schedule page(s) failed: ` +
        failedSched.map((s) => s.url.split("?")[1] || s.url).slice(0, 5).join(", ")
    );
  }

  // 覆盖天数不足
  const daysCovered = new Set(store.screenings.map((s) => s.date)).size;
  const dayCount = store.edition?.dayCount || 0;
  if (dayCount && daysCovered < dayCount) warnings.push(`schedule covers ${daysCovered}/${dayCount} days`);
  if (dayCount && daysCovered < Math.ceil(dayCount / 2))
    errors.push(`schedule covers only ${daysCovered}/${dayCount} days`);

  // 防回退：新数据比旧数据少一半以上 → 视为抓取异常
  if (previous?.screenings?.length) {
    const ratio = store.screenings.length / previous.screenings.length;
    if (ratio < 0.5)
      errors.push(
        `regression: entries ${store.screenings.length} vs previous ${previous.screenings.length} (<50%)`
      );
  }

  if (store.warnings?.length) warnings.push(...store.warnings);

  return { ok: errors.length === 0, errors, warnings };
}
