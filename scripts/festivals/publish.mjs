#!/usr/bin/env node
/**
 * 发布 —— 把标准化存储摊平成前端要读的静态 JSON（沿用仓库既有 public/api 风格）
 *   public/api/festivals.json          今日/本周/月历所需（含今日排片内联）
 *   public/api/festivals/<slug>.json   单个届次完整排片（详情页按需加载）
 *   public/api/festival-changes.json   变更流
 */

const DAY = 86400000;

function localDay(now, timeZone) {
  try {
    return new Date(now).toLocaleDateString("en-CA", { timeZone });
  } catch {
    return String(now).slice(0, 10);
  }
}

function dateRange(start, end) {
  const out = [];
  let t = Date.parse(start + "T00:00:00Z");
  const e = Date.parse(end + "T00:00:00Z");
  while (t <= e) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += DAY;
  }
  return out;
}

/** registry 里「只有官方日期、暂未接入抓取」的届次 → 明确显示为待公布，而不是留空 */
export function registryOnlyStore(festival, edition, now) {
  return {
    slug: edition.id,
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
      timezone: edition.timezone,
      dayCount: dateRange(edition.startDate, edition.endDate).length,
      officialUrl: edition.officialUrl || festival.officialUrl,
    },
    lifecycle: "UPCOMING",
    status: "CONFIRMED",
    statusDetail: { dates: "CONFIRMED", programme: "PENDING", schedule: "PENDING" },
    statusNote: {
      zh: "日期已由官方确认，节目单与具体排片尚未公布",
      en: "Dates officially confirmed — programme and screening schedule not announced yet",
    },
    sources: (edition.sources || []).map((s) => ({ ...s, ok: true, httpStatus: null, fetchedAt: now })),
    sections: [],
    venues: [],
    films: [],
    screenings: [],
    stats: {
      films: 0, filmsTotal: 0, screenings: 0, events: 0, pending: 0,
      entries: 0, venues: 0, sections: 0, days: 0, guestVisits: 0,
    },
    days: [],
    warnings: [],
    fetchedAt: now,
    lastVerifiedAt: null,
    dataSource: "registry",
  };
}

function cardOf(store, { today, changes }) {
  const tz = store.edition.timezone;
  const entries = store.screenings || [];
  const todayEntries = entries.filter((s) => s.date === today);
  const venuesToday = new Set(todayEntries.map((s) => s.venueId));
  const items = todayEntries.slice(0, 160).map((s) => ({
    id: s.id,
    kind: s.kind,
    time: s.localTime,
    title: s.title,
    venueName: s.venueName,
    section: s.sectionName,
    grade: s.grade,
    subtitle: s.subtitle,
    qa: s.qa,
    ticketStatus: s.ticketStatus || null,
    ticketUrl: s.ticketUrl,
    eventUrl: s.eventUrl,
    officialUrl: s.officialSourceUrl,
  }));
  const upcoming = entries.find((s) => s.date > today);
  const changes7d = (changes || []).filter(
    (c) => c.slug === store.slug && Date.parse(c.at) > Date.now() - 7 * DAY
  ).length;

  return {
    slug: store.slug,
    festivalId: store.festivalId,
    name: store.festival.name,
    city: store.festival.city,
    country: store.festival.country,
    countryCode: store.festival.countryCode,
    region: store.festival.region,
    types: store.festival.types,
    year: store.edition.year,
    startDate: store.edition.startDate,
    endDate: store.edition.endDate,
    dayCount: store.edition.dayCount,
    timezone: tz,
    officialUrl: store.festival.officialUrl,
    lifecycle: store.lifecycle,
    status: store.status,
    statusDetail: store.statusDetail,
    statusNote: store.statusNote,
    stats: store.stats,
    today: {
      date: today,
      screenings: todayEntries.filter((s) => s.kind === "SCREENING").length,
      events: todayEntries.filter((s) => s.kind !== "SCREENING").length,
      entries: todayEntries.length,
      venues: venuesToday.size,
      guestVisits: todayEntries.filter((s) => s.qa).length,
      items,
    },
    nextScreeningDate: upcoming ? upcoming.date : null,
    sources: (store.sources || []).map((s) => ({
      kind: s.kind, label: s.label, url: s.url, ok: s.ok, httpStatus: s.httpStatus, fetchedAt: s.fetchedAt,
    })),
    fetchedAt: store.fetchedAt,
    lastVerifiedAt: store.lastVerifiedAt,
    dataAgeMinutes: store.lastVerifiedAt
      ? Math.max(0, Math.round((Date.now() - Date.parse(store.lastVerifiedAt)) / 60000))
      : null,
    changes7d,
    dataSource: store.dataSource,
  };
}

export function buildPublished({ stores, changes, now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z") }) {
  const cards = stores.map((store) => cardOf(store, { today: localDay(now, store.edition.timezone || "UTC"), changes }));

  // 月历 / 周视图密度：日期 → {screenings, events, festivals}
  const calendar = {};
  const bump = (date, slug, screenings = 0, events = 0) => {
    if (!calendar[date]) calendar[date] = { screenings: 0, events: 0, festivals: [] };
    if (!calendar[date].festivals.includes(slug)) calendar[date].festivals.push(slug);
    calendar[date].screenings += screenings;
    calendar[date].events += events;
  };
  for (const store of stores) {
    for (const d of dateRange(store.edition.startDate, store.edition.endDate)) bump(d, store.slug, 0, 0);
    const perDay = new Map();
    for (const s of store.screenings || []) {
      const cur = perDay.get(s.date) || { scr: 0, ev: 0 };
      if (s.kind === "SCREENING") cur.scr++;
      else cur.ev++;
      perDay.set(s.date, cur);
    }
    for (const [d, v] of perDay) bump(d, store.slug, v.scr, v.ev);
  }
  for (const d of Object.keys(calendar)) calendar[d].festivals.sort();

  const today = localDay(now, "Asia/Shanghai");
  const liveToday = cards.filter(
    (c) => c.lifecycle === "LIVE" || (c.startDate <= today && c.endDate >= today)
  );
  const upcoming = cards.filter((c) => c.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const recentChanges = (changes || []).filter((c) => Date.parse(c.at) > Date.now() - 7 * DAY);

  return {
    summary: {
      updated: now,
      today,
      scopeNote: {
        zh: "只收录已核实官方来源的电影节；尚未公布排片会明确标注状态，而不是留空。",
        en: "Only festivals with verified official sources. Unannounced schedules are labelled, never left blank.",
      },
      stats: {
        festivals: cards.length,
        liveToday: liveToday.length,
        screeningsToday: liveToday.reduce((n, c) => n + (c.today?.screenings || 0), 0),
        eventsToday: liveToday.reduce((n, c) => n + (c.today?.events || 0), 0),
        upcoming: upcoming.length,
        changes7d: recentChanges.length,
        venuesToday: liveToday.reduce((n, c) => n + (c.today?.venues || 0), 0),
      },
      festivals: cards,
      calendar,
    },
    details: Object.fromEntries(stores.map((s) => [s.slug, s])),
    changesFeed: {
      updated: now,
      count7d: recentChanges.length,
      changes: (changes || []).slice(0, 200),
    },
  };
}
